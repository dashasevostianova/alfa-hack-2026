import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from offer_cache import CONDITIONS, OfferCache, RETRY_SECONDS, TTL_SECONDS


class OfferCacheTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'offers.json'
        self.now = 1_700_000_000
        self.calls = []
        self.rate = 20
        self.fail = False

        async def fetch(form, age, collateral):
            self.calls.append((form, age, collateral))
            if self.fail:
                raise RuntimeError('Source unavailable')
            return [dict(id='credit', name='Кредит', rateUnit='annual', annualRate=self.rate)]

        self.fetch = fetch
        self.cache = OfferCache(fetch, self.path, clock=lambda: self.now)

    async def test_shares_quotes_for_same_group_and_keeps_all_conditions_separate(self):
        first = await self.cache.get('OOO', 6, False)
        self.assertEqual(first, await self.cache.get('OOO', 9, False))
        self.assertEqual(len(self.calls), 1)
        await self.cache.refresh_due()
        self.assertEqual(len(self.calls), 8)
        await self.cache.refresh_due()
        self.assertEqual(len(self.calls), 8)
        self.assertEqual(len(self.cache.entries), 8)
        self.assertEqual(len({self.cache.key(*condition) for condition in CONDITIONS}), 8)

    async def test_refreshes_at_24_hours_and_preserves_source_timestamp(self):
        first = await self.cache.get('IP', 4, True)
        self.now += TTL_SECONDS - 1
        self.rate = 25
        self.assertEqual(first, await self.cache.get('IP', 8, True))
        self.assertEqual(len(self.calls), 1)
        self.now += 1
        refreshed = await self.cache.get('IP', 8, True)
        self.assertEqual(refreshed['offers'][0]['annualRate'], 25)
        self.assertNotEqual(first['fetchedAt'], refreshed['fetchedAt'])
        self.assertEqual(len(self.calls), 2)

    async def test_restores_cache_after_restart_without_fetching_fresh_groups(self):
        await self.cache.refresh_due()
        self.assertTrue(self.path.is_file())
        restarted = OfferCache(self.fetch, self.path, clock=lambda: self.now)
        await restarted.refresh_due()
        self.assertEqual(len(self.calls), 8)
        self.now += TTL_SECONDS
        await restarted.refresh_due()
        self.assertEqual(len(self.calls), 16)

    async def test_coalesces_simultaneous_requests_for_one_group(self):
        started, release = asyncio.Event(), asyncio.Event()
        count = 0

        async def slow_fetch(*args):
            nonlocal count
            count += 1
            started.set()
            await release.wait()
            return await self.fetch(*args)

        cache = OfferCache(slow_fetch, self.path, clock=lambda: self.now)
        tasks = [asyncio.create_task(cache.get('OOO', 10, False)) for _ in range(10)]
        await started.wait()
        release.set()
        results = await asyncio.gather(*tasks)
        self.assertEqual(count, 1)
        self.assertTrue(all(value == results[0] for value in results))

    async def test_runs_background_refresh_without_any_user_requests(self):
        worker = asyncio.create_task(self.cache.run(interval=0.01))
        try:
            async def wait_for_count(expected):
                while len(self.calls) < expected:
                    await asyncio.sleep(0.001)

            await asyncio.wait_for(wait_for_count(8), timeout=2)
            self.now += TTL_SECONDS
            await asyncio.wait_for(wait_for_count(16), timeout=2)
            self.assertEqual(len(self.calls), 16)
        finally:
            worker.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await worker

    async def test_failed_refresh_does_not_serve_expired_rates_or_hammer_source(self):
        first = await self.cache.get('OOO', 10, False)
        self.now += TTL_SECONDS
        self.fail = True
        with self.assertRaises(RuntimeError):
            await self.cache.get('OOO', 10, False)
        with self.assertRaises(RuntimeError):
            await self.cache.get('OOO', 12, False)
        self.assertEqual(len(self.calls), 2)
        # Preserve the last successful version on disk, but never call it fresh.
        self.assertEqual(self.cache.entries[self.cache.key('OOO', 10, False)]['offers'], first['offers'])
        self.now += RETRY_SECONDS
        self.fail = False
        self.rate = 25
        self.assertEqual((await self.cache.get('OOO', 10, False))['offers'][0]['annualRate'], 25)
        self.assertEqual(len(self.calls), 3)

    async def test_invalid_cache_is_rebuilt_and_invalid_source_is_not_saved(self):
        self.path.write_text('{broken json', encoding='utf-8')
        with self.assertLogs('offer_cache', level='WARNING'):
            cache = OfferCache(self.fetch, self.path, clock=lambda: self.now)
        await cache.get('IP', 0, False)
        data = json.loads(self.path.read_text(encoding='utf-8'))
        self.assertEqual(data['version'], 1)

        async def invalid_fetch(*args):
            return [dict(id='seller', name='Селлер', rateUnit='monthly_overpayment', annualRate=1.2)]

        bad_path = self.path.with_name('bad.json')
        invalid = OfferCache(invalid_fetch, bad_path, clock=lambda: self.now)
        with self.assertRaises(ValueError):
            await invalid.get('IP', 0, False)
        self.assertFalse(bad_path.exists())

    async def test_response_mutation_does_not_change_shared_cache(self):
        first = await self.cache.get('OOO', 0, False)
        first['offers'][0]['annualRate'] = 99
        self.assertEqual((await self.cache.get('OOO', 0, False))['offers'][0]['annualRate'], 20)


if __name__ == '__main__':
    unittest.main()
