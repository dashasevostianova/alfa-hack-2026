import asyncio
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from links import CALC_URL

buttons = ["Более 9 месяцев", "До 9 месяцев"]


async def get_bank_text(text: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="chrome")
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

            await page.wait_for_selector(f"text={text}", timeout=15_000)
            await page.click(f"text={text}")
            await asyncio.sleep(2)

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
    t0 = await get_bank_text(buttons[0])
    t1 = await get_bank_text(buttons[1])
    print(get_credit_rate(t0))
    print(get_credit_rate(t1))


if __name__ == "__main__":
    asyncio.run(main())