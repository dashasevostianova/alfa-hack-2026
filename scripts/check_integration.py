"""Exercise the real local Docker stack with synthetic accounts and companies."""
import copy
import http.cookiejar
import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone


def months_ago(months):
    today = datetime.now(timezone.utc).date()
    total = today.year * 12 + today.month - 1 - months
    return date(total // 12, total % 12 + 1, min(today.day, 28)).isoformat()


class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None, expected=200, csrf=True):
        headers = {'Accept': 'application/json'}
        if body is not None:
            headers['Content-Type'] = 'application/json'
            if csrf:
                token = self.call('/auth/csrf')
                headers[token['headerName']] = token['token']
        request = urllib.request.Request(os.environ.get('APP_URL', 'http://127.0.0.1:8088').rstrip('/') + '/api' + path,
                                         data=None if body is None else json.dumps(body).encode(), headers=headers)
        try:
            with self.http.open(request, timeout=220) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        result = json.loads(raw) if raw else None
        assert status == expected, f'{path}: expected {expected}, got {status}: {result}'
        return result


def run():
    suffix = str(time.time_ns())[-9:]
    clients = [Client(), Client()]
    credentials = []
    original_id = None
    original_company = None
    for index, form in enumerate(('OOO', 'IP')):
        client = clients[index]
        login = f'e2e_{suffix}_{form.lower()}'
        auth = dict(login=login, password='IntegrationPass1')
        credentials.append(auth)
        client.call('/auth/me', expected=401)
        client.call('/auth/register', auth, expected=403, csrf=False)
        client.call('/auth/register', auth, expected=201)
        client.call('/auth/register', auth, expected=409)
        inn = ('9' if form == 'OOO' else '990') + suffix
        profile = dict(fullName='Тестов Тест Тестович', email='e2e@example.com', phone='+79990000000',
                       passport=f'0000 {suffix[-6:]}', birthDate='1990-01-01', citizenship='RU',
                       companyName=f'Тест {form} {suffix}', inn=inn, industry='Разработка ПО', monthlyRevenue=250000,
                       manualBusiness=dict(legalForm=form, ogrn='', registrationDate='2020-01-01', okved='62.01', status='ACTIVE'),
                       manualFinances=dict(netProfit='600000', currentLoans='', taxArrears='', equity='', assets=''))
        assert not client.call('/formation/companies/' + inn)['found']
        client.call('/profile', {**profile, 'birthDate': '2020-01-01'}, expected=400)
        saved = client.call('/profile', profile)
        assert saved['prepared']['company']['legal_form'] == form
        assert saved['prepared']['stored']['revenue'] == 3000000
        assert client.call('/profile')['inn'] == inn
        product = client.call('/loans/products')[0]
        count = 0
        for age in (2, 12):
            profile['manualBusiness']['registrationDate'] = months_ago(age)
            client.call('/profile', profile)
            for collateral in (False, True):
                print(f'Checking live offers: {form}, business age={age}, collateral={collateral}', flush=True)
                quote = client.call(f'/loans/quote?collateral={str(collateral).lower()}')
                boundary = 3 if form == 'IP' else 9
                expected_key = (f'До {boundary} месяцев' if age <= boundary else f'Более {boundary} месяцев') + '|' + ('С залогом' if collateral else 'Без залога') + '|' + ('Для ООО' if form == 'OOO' else 'Для ИП')
                assert quote['key'] == expected_key and quote['collateral'] == collateral
                assert quote['businessAgeMonths'] == age
                assert len({offer['id'] for offer in quote['offers']}) == len(quote['offers'])
                annual = [offer for offer in quote['offers'] if offer['annualRate'] is not None]
                for unsupported in [offer for offer in quote['offers'] if offer['annualRate'] is None]:
                    client.call('/applications', dict(productId=product['id'], amount=1000000, months=9, purpose='Развитие бизнеса',
                                                     collateral=collateral, bankOfferId=unsupported['id'], annualRate=1.2), expected=422)
                if not annual:
                    assert len(client.call('/applications')) == count
                    print('PASS: unsupported rate units cannot be submitted; no fabricated annual rate', flush=True)
                    continue
                selected = annual[0]
                for months in (9, 10):
                    draft = dict(productId=product['id'], amount=1000000, months=months, purpose='Развитие бизнеса',
                                 collateral=collateral, annualRate=selected['annualRate'], bankOfferId=selected['id'])
                    client.call('/applications', {**draft, 'annualRate': -1}, expected=409)
                    client.call('/applications', {**draft, 'bankOfferId': 'unknown'}, expected=409)
                    client.call('/applications', {**draft, 'amount': 1}, expected=400)
                    assert len(client.call('/applications')) == count, 'Rejected request must not create an application'
                    app = client.call('/applications', draft, expected=201)
                    count += 1
                    assert app['formationStatus'] == 'SUBMITTED' and app['decision'] is None
                    assert app['annualRate'] == selected['annualRate'] and app['collateral'] == collateral
                    assert app['bankOfferName'] == selected['name'] and app['bankOfferId'] == selected['id']
                    assert app['company']['inn'] == inn and app['source'] == 'manual'
                    assert app['finances'][0]['revenue'] == 3000000
                    assert app['finances'][0]['current_loans'] is None
                    assert len(client.call('/applications')) == count
                    if original_id is None:
                        original_id, original_company = app['id'], copy.deepcopy(app['company'])
                    print(f'PASS: {expected_key}, loan term={months}, application {app["id"]}', flush=True)
        renamed = {**profile, 'companyName': profile['companyName'] + ' изменено', 'monthlyRevenue': 300000}
        client.call('/profile', renamed)
        old = client.call('/applications/' + str(app['id']))
        assert old['company']['fullname'] == profile['companyName'] and old['finances'][0]['revenue'] == 3000000
        client.call('/auth/logout', {}, expected=204)
        client.call('/auth/me', expected=401)
        client.call('/auth/login', {**auth, 'password': 'wrong'}, expected=401)
        assert client.call('/auth/login', auth)['profileComplete']
        assert client.call('/profile')['companyName'] == renamed['companyName']
        print(f'PASS: {form} snapshot remains unchanged after editing; login restores profile', flush=True)
    clients[1].call('/applications/' + original_id, expected=404)
    assert original_id not in [app['id'] for app in clients[1].call('/applications')]
    stolen_profile = clients[1].call('/profile')
    stolen_profile['inn'] = original_company['inn']
    stolen_profile['manualBusiness']['legalForm'] = 'OOO'
    clients[1].call('/profile', stolen_profile)
    quote = clients[1].call('/loans/quote?collateral=false')
    selected = next(offer for offer in quote['offers'] if offer['annualRate'] is not None)
    clients[1].call('/applications', dict(productId=product['id'], amount=1000000, months=9, purpose='Развитие бизнеса',
                                        collateral=False, annualRate=selected['annualRate'], bankOfferId=selected['id']), expected=409)
    print('PASS: account isolation and company ownership; all eight live cases completed', flush=True)
    print('Synthetic test accounts and applications remain in the local database.', flush=True)


if __name__ == '__main__':
    run()
