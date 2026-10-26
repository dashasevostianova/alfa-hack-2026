from fastapi import FastAPI, HTTPException, Query
from parser import get_credit_rate, get_bank_text
from parser import zalog, legal_form, period


app = FastAPI(title="Parser")

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
    from offers import get_offers, age_bucket
    try:
        offers = await get_offers(legal_form, business_age_months, collateral)
        return dict(offers=offers, businessAgeBucket=age_bucket(legal_form, business_age_months))
    except Exception as error:
        import logging
        logging.exception("Cannot read named calculator offers")
        raise HTTPException(502, "Calculator source is unavailable or its layout changed") from error
