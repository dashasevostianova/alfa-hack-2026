"""One persistent daily bank-offer cache shared by all users of the parser service."""
import asyncio
import copy
import json
import logging
import math
import time
from datetime import datetime, timezone
from pathlib import Path

from offers import age_bucket

TTL_SECONDS = 24 * 60 * 60
RETRY_SECONDS = 5 * 60
CONDITIONS = tuple((form, age, collateral)
                   for form, boundary in (('OOO', 9), ('IP', 3))
                   for age in (0, boundary + 1) for collateral in (False, True))
logger = logging.getLogger(__name__)


class OfferCache:
    def __init__(self, fetch_offers, path, clock=time.time):
        self.fetch_offers = fetch_offers
        self.path = Path(path)
        self.clock = clock
        self.entries = {}
        self.locks = {}
        self.retry_after = {}
        self._load()

    @staticmethod
    def key(form, age, collateral):
        return f'{form}|{age_bucket(form, age)}|{int(collateral)}'

    @staticmethod
    def validate(offers):
        if not isinstance(offers, list) or not offers:
            raise ValueError('No bank offers found')
        ids = set()
        for offer in offers:
            if not isinstance(offer, dict):
                raise ValueError('Invalid offer')
            identifier, name = offer.get('id'), offer.get('name')
            if not isinstance(identifier, str) or not identifier.strip() or identifier in ids:
                raise ValueError('Invalid or duplicate offer ID')
            if not isinstance(name, str) or not name.strip():
                raise ValueError('Missing offer name')
            ids.add(identifier)
            unit, rate = offer.get('rateUnit'), offer.get('annualRate')
            if unit not in ('annual', 'monthly', 'monthly_overpayment', 'not_published'):
                raise ValueError('Invalid rate unit')
            if unit == 'annual':
                if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not math.isfinite(rate) or not 0 <= rate <= 100:
                    raise ValueError('Invalid annual rate')
            elif rate is not None:
                raise ValueError('A monthly rate cannot be used as an annual rate')
        json.dumps(offers, allow_nan=False)

    def _load(self):
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('entries'), dict):
                raise ValueError('Invalid cache format')
            valid_keys = {self.key(*condition) for condition in CONDITIONS}
            for key, entry in data['entries'].items():
                if key not in valid_keys or not isinstance(entry, dict):
                    continue
                try:
                    self.validate(entry['offers'])
                    timestamp = entry['fetched_at']
                    if isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)) or not math.isfinite(timestamp) or timestamp > self.clock():
                        continue
                    self.entries[key] = entry
                except (KeyError, ValueError, TypeError):
                    logger.warning('Ignoring an invalid saved bank-offer group: %s', key)
        except (OSError, ValueError, TypeError):
            logger.warning('Cannot load the bank-offer cache; it will be rebuilt')

    def _save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_suffix('.tmp')
            temporary.write_text(json.dumps({'version': 1, 'entries': self.entries}, ensure_ascii=False, allow_nan=False), encoding='utf-8')
            temporary.replace(self.path)
        except OSError:
            # Rates are usable in memory; report that restart persistence failed.
            logger.exception('Cannot persist the bank-offer cache')

    async def get(self, form, age, collateral):
        key = self.key(form, age, collateral)
        async with self.locks.setdefault(key, asyncio.Lock()):
            entry = self.entries.get(key)
            now = self.clock()
            if entry is None or not 0 <= now - entry['fetched_at'] < TTL_SECONDS:
                if self.retry_after.get(key, 0) > now:
                    raise RuntimeError('Bank source unavailable; automatic retry is pending')
                try:
                    offers = await self.fetch_offers(form, age, collateral)
                    self.validate(offers)
                except Exception:
                    self.retry_after[key] = self.clock() + RETRY_SECONDS
                    raise
                entry = {'offers': copy.deepcopy(offers), 'fetched_at': self.clock()}
                self.entries[key] = entry
                self.retry_after.pop(key, None)
                self._save()
                logger.info('Updated bank offers: %s', key)
            return {
                'offers': copy.deepcopy(entry['offers']),
                'businessAgeBucket': age_bucket(form, age),
                'fetchedAt': datetime.fromtimestamp(entry['fetched_at'], timezone.utc).isoformat(),
            }

    async def refresh_due(self):
        for condition in CONDITIONS:
            try:
                await self.get(*condition)
            except Exception as error:
                logger.warning('Bank-offer refresh failed for %s: %s', self.key(*condition), error)

    async def run(self, interval=60):
        # Warm all groups at startup, then refresh each after 24h, even without users.
        while True:
            await self.refresh_due()
            await asyncio.sleep(interval)
