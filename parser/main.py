from fastapi import FastAPI, HTTPException, Query
import asyncio
import os
from contextlib import asynccontextmanager, suppress
from parser import get_credit_rate, get_bank_text
from parser import zalog, legal_form, period
from offers import get_offers
from offer_cache import OfferCache


offer_cache = OfferCache(get_offers, os.environ.get('OFFERS_CACHE_FILE', '/tmp/alpha-bank-offers.json'))


@asynccontextmanager
async def lifespan(app):
    refresh = asyncio.create_task(offer_cache.run())
    try:
        yield
    finally:
        refresh.cancel()
        with suppress(asyncio.CancelledError):
            await refresh


app = FastAPI(title="Parser", lifespan=lifespan)

@app.get("/")
async def get_current_rate():
    res = {}
    for p in period:
        for z in zalog:
            for f in legal_form:
                raw = await get_bank_text([p, z, f])
                res[f"{p}|{z}|{f}"] = get_credit_rate(raw)
    return res

@app.get("/offers")
async def current_offers(legal_form: str = Query(pattern="^(OOO|IP)$"),
                         business_age_months: int = Query(ge=0, le=12000), collateral: bool = False):
    try:
        return await offer_cache.get(legal_form, business_age_months, collateral)
    except Exception as error:
        import logging
        logging.exception("Cannot read named calculator offers")
        raise HTTPException(502, "Calculator source is unavailable or its layout changed") from error
