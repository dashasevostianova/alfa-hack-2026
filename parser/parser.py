import asyncio
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from links import CALC_URL

period = ["Более 9 месяцев", "До 9 месяцев"]
zalog = ["Без залога", "С залогом"]
legal_form = ["Для ООО", "Для ИП"]


async def get_bank_text(buttons: list, include_offers: bool = False):
    async with async_playwright() as p:

         # VERSION FOR DOCKER !!!!!!!!!!!!!!!
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        # browser = await p.chromium.launch(headless=True, channel="chrome") # версия для чека БЕЗ докера С ЛОКАЛХОСТ ЛИБО ПРОСТО ЭТОТ ФАЙЛ
        try:
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                ignore_https_errors=True,
            )
            page = await context.new_page()

            print("Connecting to the page")
            await page.goto(CALC_URL, wait_until="domcontentloaded")
            print("The page is loaded")

            # press all 3 buttons
            btn = page.get_by_text(buttons[0], exact=True).first
            await btn.wait_for(state="visible", timeout=15_000)
            await btn.click()
            await asyncio.sleep(2)

            btn = page.get_by_text(buttons[1], exact=True).first
            await btn.wait_for(state="visible", timeout=15_000)
            await btn.click()
            await asyncio.sleep(2)

            btn = page.get_by_text(buttons[2], exact=True).first
            await btn.wait_for(state="visible", timeout=15_000)
            await btn.click()
            await asyncio.sleep(2)


            if include_offers:
                from offers import extract_offers
                return await extract_offers(page)
            html = await page.content()
        finally:
            await browser.close()

    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator="\n", strip=True)


def get_credit_rate(raw: str) -> list:
    res, flag = [], False
    for line in raw.split("\n"):
        if line == "Кредит под любую задачу":
            break
        if flag:
            res.append(float(line.replace(",", ".").replace("%", "")))
            flag = False
        if line == "Ставка":
            flag = True
    return res


async def main():
    for p in period:
        for z in zalog:
            for f in legal_form:
                t0 = await get_bank_text([p, z, f])
                print(get_credit_rate(t0))
    #print(get_credit_rate(t1))


if __name__ == "__main__":
    asyncio.run(main())