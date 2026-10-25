from fastapi import FastAPI, Depends
from parser import get_credit_rate, get_bank_text, buttons


app = FastAPI(title="Parser")

@app.get("/")
async def get_current_rate():
    res = {}
    for el in buttons:
        raw = await get_bank_text(el)
        res[el] = get_credit_rate(raw)
    return res