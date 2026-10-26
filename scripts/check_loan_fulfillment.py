"""Check the local Java/PostgreSQL signing workflow using only synthetic accounts.

Run after docker compose up --build -d --wait. Uses live formation/parser through
existing application submission; creates test data without editing existing users.
"""
import concurrent.futures
import http.cookiejar
import json
import os
import time
from datetime import datetime, timezone
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('APP_URL', 'http://127.0.0.1:8088').rstrip('/') + '/api'


class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, method='GET', body=None, expected=200, content_type='application/json', raw=False, csrf=True):
        headers = {'Accept': 'application/json, application/pdf'}
        if method != 'GET' and csrf:
            token = self.call('/auth/csrf')
            headers[token['headerName']] = token['token']
        if body is not None:
            headers['Content-Type'] = content_type
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
        else:
            data = None
        request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
        try:
            with self.http.open(request, timeout=220) as response:
                status, response_body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, response_body = error.code, error.read()
        assert status == expected, f'{method} {path}: expected {expected}, got {status}: {response_body[:500]!r}'
        return response_body if raw else json.loads(response_body) if response_body else None

    def upload(self, path, data, filename='signed.pdf', mime='application/pdf', expected=200):
        boundary = 'alpha-' + uuid.uuid4().hex
        payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                   f'Content-Type: {mime}\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
        return self.call(path + '/document', 'POST', payload, expected, 'multipart/form-data; boundary=' + boundary)


def run():
    client = Client()
    suffix = str(time.time_ns())[-9:]
    credentials = dict(login='signing_' + suffix, password='SigningDemoPass1')
    client.call('/auth/register', 'POST', credentials, 201)
    profile = dict(fullName='Тестов Тест Тестович', email='signing@example.com', phone='+79990000000', passport='0000 123456',
                   birthDate='1990-01-01', citizenship='RU', companyName='ООО Подписание ' + suffix, inn='9' + suffix,
                   industry='Разработка ПО', monthlyRevenue=10000000,
                   manualBusiness=dict(legalForm='OOO', ogrn='', registrationDate='2020-01-01', okved='62.01', status='ACTIVE'),
                   manualFinances=dict(netProfit='20000000', currentLoans='', taxArrears='', equity='', assets=''))
    client.call('/profile', 'POST', profile)
    product = client.call('/loans/products')[0]
    print('Loading existing bank offers through Java/parser...', flush=True)
    quote = client.call('/loans/quote?collateral=false')
    offer = next(item for item in quote['offers'] if item['annualRate'] is not None)
    draft = dict(productId=product['id'], amount=100000, months=24, purpose='Развитие бизнеса', collateral=False,
                 bankOfferId=offer['id'], annualRate=offer['annualRate'])
    client.call('/applications', 'POST', {**draft, 'annualRate': -1}, 409)
    app = client.call('/applications', 'POST', draft, 201)
    path = '/applications/' + app['id'] + '/fulfillment'
    client.call(path + '/contract', 'POST', expected=409)
    # Compare the original frontend model call with Java's independent confirmation.
    formation = client.call('/applications/' + app['id'])
    finance = formation['finances'][0]
    registered = datetime.fromisoformat(formation['company']['registration_date']).replace(tzinfo=timezone.utc)
    features = dict(business_age_years=(datetime.now(timezone.utc)-registered).total_seconds()/86400/365.2425,
                    legal_form=1, revenue=finance['revenue'], net_profit=finance['net_profit'],
                    current_loans=int((finance['current_loans'] or 0)>0), purpose=2,
                    amount=draft['amount'], term_months=draft['months'])
    request = urllib.request.Request(BASE.removesuffix('/api') + '/model/predict', data=json.dumps(features).encode(),
                                     headers={'Content-Type':'application/json'}, method='POST')
    with client.http.open(request, timeout=40) as response:
        prediction = json.loads(response.read())['prediction']
    approved = client.call('/applications/' + app['id'] + '/model-decision', 'POST')
    expected = 'APPROVED' if prediction == 1 else 'REJECTED'
    assert approved['decision']['outcome'] == expected and approved['status'] == 'COMPLETED'
    assert client.call('/applications/' + app['id'] + '/model-decision', 'POST')['decision'] == approved['decision']
    if prediction == 0:
        for action in ('/contract', '/confirm', '/issue'):
            client.call(path + action, 'POST', expected=409)
        raise AssertionError('The real model rejected this synthetic applicant; refusal protection passed, but a model-approved fixture is needed to test signing.')
    first = client.call(path + '/contract', 'POST')['fulfillment']
    assert first == client.call(path + '/contract', 'POST')['fulfillment']
    assert first['contract']['amount'] == draft['amount'] and first['contract']['annualRate'] == offer['annualRate']
    assert first['contract']['borrower']['fullName'] == profile['fullName']
    client.call('/profile', 'POST', {**profile, 'fullName': 'Изменённый Заёмщик'})
    assert client.call(path)['fulfillment']['contract'] == first['contract']
    client.call(path + '/confirm', 'POST', expected=409)
    client.call(path + '/issue', 'POST', expected=409)
    client.upload(path, b'%PDF-1.7\ndemo', expected=409)
    pdf = client.call(path + '/contract.pdf', raw=True)
    assert pdf.startswith(b'%PDF-') and len(pdf) > 10000
    assert pdf == client.call(path + '/contract.pdf', raw=True)
    for data, name, mime, status in [(b'plain', 'bad.pdf', 'application/pdf', 400),
                                    (pdf, 'bad.txt', 'application/pdf', 415), (pdf, 'bad.pdf', 'text/plain', 415),
                                    (b'%PDF-' + b'x' * (10 * 1024 * 1024), 'large.pdf', 'application/pdf', 413)]:
        client.upload(path, data, name, mime, status)
    # Also catches nginx's previous 64KB request limit.
    client.upload(path, pdf + b'\n%' + b'x' * 100000)
    assert client.call(path)['fulfillment']['status'] == 'DOCUMENT_UPLOADED'
    client.call(path + '/document', 'DELETE')
    client.call(path + '/confirm', 'POST', expected=409)
    client.upload(path, pdf)
    client.call(path + '/confirm', 'POST', expected=403, csrf=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        signed = list(pool.map(lambda _: client.call(path + '/confirm', 'POST')['fulfillment'], range(4)))
        assert len({value['signedAt'] for value in signed}) == 1
        issued = list(pool.map(lambda _: client.call(path + '/issue', 'POST')['fulfillment'], range(4)))
        assert len({value['issuedAt'] for value in issued}) == 1
    final = client.call(path)['fulfillment']
    for event in ('SIGNED', 'ISSUED'):
        assert sum(item['type'] == event for item in final['history']) == 1
    client.upload(path, pdf, expected=409)
    client.call(path + '/document', 'DELETE', expected=409)
    assert next(item for item in client.call('/applications') if item['id'] == app['id'])['fulfillment'] == final
    client.call('/auth/logout', 'POST', expected=204)
    client.call('/auth/login', 'POST', credentials)
    assert client.call(path)['fulfillment'] == final
    stranger = Client()
    stranger.call('/auth/register', 'POST', dict(login='stranger_' + suffix, password='SigningDemoPass1'), 201)
    stranger.call(path, expected=404)
    stranger.call(path + '/contract.pdf', expected=404)
    for action in ('/contract', '/confirm', '/issue'):
        stranger.call(path + action, 'POST', expected=404)
    stranger.upload(path, pdf, expected=404)
    stranger.call(path + '/document', 'DELETE', expected=404)
    print('PASS: Java/PostgreSQL signing and issuance on main port; real offers preserved; PDF, upload limits, CSRF, '
          'ownership, snapshots, concurrent idempotency, persistence and real model confirmation verified.', flush=True)
    print('Synthetic test accounts and applications remain in the local database.', flush=True)


if __name__ == '__main__':
    run()
