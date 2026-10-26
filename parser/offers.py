"""Named calculator offers. Legacy GET / and get_credit_rate remain available."""
import hashlib
import re


def age_bucket(legal_form, age_months):
    if legal_form not in ('OOO', 'IP') or age_months < 0:
        raise ValueError('Invalid company age or legal form')
    threshold = 3 if legal_form == 'IP' else 9
    return f'{"Более" if age_months > threshold else "До"} {threshold} месяцев'


def parse_offer_card(text, details_url=''):
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError('Empty offer card')
    name = lines[0]
    rate_text = None
    rate = None
    unit = 'not_published'
    if 'Ставка' in lines:
        position = lines.index('Ставка') + 1
        if position >= len(lines):
            raise ValueError('Missing rate')
        rate_text = lines[position]
        match = re.fullmatch(r'(?:от\s*)?(\d+(?:[,.]\d+)?)\s*%(?:\s*(годовых|в месяц))?', rate_text, re.I)
        if not match:
            raise ValueError('Unrecognized rate format')
        rate = float(match[1].replace(',', '.'))
        if not 0 <= rate <= 100:
            raise ValueError('Rate out of range')
        # This product explicitly publishes monthly overpayment, not an annual rate:
        # https://alfabank.ru/sme/profits/creditsellers/
        seller = 'селлер' in name.lower() or '/creditsellers' in details_url
        unit = 'monthly_overpayment' if seller else 'monthly' if match[2] == 'в месяц' else 'annual'
    return dict(id=hashlib.sha256(name.encode()).hexdigest()[:20], name=name,
                ratePercent=rate, rateText=rate_text, rateUnit=unit,
                annualRate=rate if unit == 'annual' else None,
                detailsUrl=details_url if details_url.startswith('https://alfabank.ru/') else None)


async def extract_offers(page):
    start = await page.get_by_text('Рассчитаем кредит под вашу задачу', exact=True).first.bounding_box()
    end = await page.get_by_text('Кредит под любую задачу', exact=True).first.bounding_box()
    if not start or not end:
        raise ValueError('Calculator boundaries not found')
    offers = {}
    for label in ('Ставка', 'Грейс-период'):
        for locator in await page.get_by_text(label, exact=True).all():
            if not await locator.is_visible():
                continue
            box = await locator.bounding_box()
            if not box or not start['y'] < box['y'] < end['y']:
                continue
            card = await locator.evaluate('''node => {
                for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
                    const lines = parent.innerText.split('\\n').map(x => x.trim()).filter(Boolean);
                    const count = lines.filter(x => x === 'Ставка' || x === 'Грейс-период').length;
                    if (count > 1) break;
                    if (count === 1 && lines.includes('Узнать подробнее') && lines.includes('Заполнить заявку')) {
                        const link = Array.from(parent.querySelectorAll('a')).find(a => a.innerText.trim() === 'Узнать подробнее');
                        return {text: parent.innerText, url: link ? link.href : ''};
                    }
                }
                return null;
            }''')
            if not card:
                raise ValueError('Offer card not recognized')
            offer = parse_offer_card(card['text'], card['url'])
            if offer['id'] in offers and offers[offer['id']] != offer:
                raise ValueError('Conflicting duplicate offers')
            offers[offer['id']] = offer
    if not offers:
        raise ValueError('No calculator offers found')
    return list(offers.values())


async def get_offers(legal_form, age_months, collateral):
    from parser import get_bank_text
    bucket = age_bucket(legal_form, age_months)
    # Registration type must be selected first: it changes the age filter to 3/9 months.
    buttons = ['Для ИП' if legal_form == 'IP' else 'Для ООО', bucket,
               'С залогом' if collateral else 'Без залога']
    return await get_bank_text(buttons, include_offers=True)
