from fastapi import FastAPI, Depends
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