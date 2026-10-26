import csv
import os
import tempfile
import json
import threading
import urllib.request
from http.server import HTTPServer
import unittest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import server

FIELDS = ['inn','ogrn','okopf','okved','creation_date','dissolution_date','revenue','net_profit',
          'capital','assets','long_term_borrowed_funds','short_term_borrowed_funds','accounts_payable']
ROW = dict(zip(FIELDS, ['1234567890','1234567890123','12300','62.01','01.01.2020','','100','-2','50','200','10','20','30']))


class Calculations(unittest.TestCase):
    def load(self, rows):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'companies.csv'
        with path.open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=FIELDS, delimiter=';')
            writer.writeheader()
            writer.writerows(rows)
        return server.Companies(path)

    def test_decimal_formulas_and_rubles(self):
        values, stored, _ = self.load([ROW]).calculate(ROW['inn'])
        self.assertEqual(stored, dict(revenue=100000, net_profit=-2000, current_loans=33500, tax_arrears=150))
        self.assertEqual(values['equity'], Decimal('50000'))
        self.assertEqual(values['assets'], Decimal('200000'))

    def test_missing_optional_is_null_not_zero(self):
        row = {**ROW, 'long_term_borrowed_funds': ''}
        self.assertIsNone(self.load([row]).calculate(row['inn'])[1]['current_loans'])

    def test_bad_values_and_not_found(self):
        for key, value in [('revenue',''),('revenue','NaN'),('revenue','999999999'),
                           ('okopf','20700'),('ogrn','1.234E12'),('creation_date','')]:
            with self.subTest(key=key, value=value):
                company = self.load([{**ROW, key: value}])
                with self.assertRaises(server.Failure):
                    company.calculate(ROW['inn'])
        for inn in ('123', '0123456789', '1234567890.0'):
            with self.assertRaises(server.Failure):
                self.load([ROW]).get(inn)

    def test_demo_review_keeps_existing_three_outcomes(self):
        for amount, outcome in [(1000000, 'APPROVED'), (3000000, 'REVISION'), (6000000, 'REJECTED')]:
            with self.subTest(amount=amount):
                self.assertEqual(server.demo_decision(amount)['outcome'], outcome)

    def test_duplicate_inn_rejected(self):
        with self.assertRaises(ValueError):
            self.load([ROW, ROW])

    def test_manual_company_requires_real_inputs_and_preserves_unknowns(self):
        module = server.Module(self.load([ROW]))
        profile = dict(inn='9900000000', companyName='Ручная компания', monthlyRevenue=100000,
                       manualBusiness=dict(legalForm='OOO', registrationDate='2020-01-02', okved='62.01', status='ACTIVE'),
                       manualFinances=dict(netProfit='-100', equity='120000', assets='220000'))
        company, stored, report = module.prepare(profile)
        self.assertIsNone(company['ogrn'])
        self.assertEqual(company['registration_date'].isoformat(), '2020-01-02')
        self.assertEqual(stored, dict(revenue=1200000, net_profit=-100, current_loans=None, tax_arrears=None))
        self.assertEqual(report['source'], 'manual')
        self.assertEqual(report['calculated']['assets'], 220000)
        ip_profile = {**profile, 'inn': '990000000001', 'manualBusiness': {**profile['manualBusiness'], 'legalForm': 'IP', 'ogrn': '123456789012345'}}
        self.assertEqual(module.prepare(ip_profile)[0]['legal_form'], 'IP')
        with self.assertRaises(server.Failure):
            module.prepare({**profile, 'manualFinances': {}})
        with self.assertRaises(server.Failure):
            module.prepare({**profile, 'manualBusiness': {}})
        with self.assertRaises(server.Failure):
            module.prepare({**profile, 'manualFinances': {'netProfit': 'NaN'}})


@unittest.skipUnless(os.environ.get('FORMATION_TEST_DB') == '1', 'Set FORMATION_TEST_DB=1 for rollback-only PostgreSQL checks')
class Database(unittest.TestCase):
    def test_persistence_retry_ownership_and_rollback(self):
        companies = server.Companies(server.ROOT / 'data' / 'companies_small.csv')
        conn = server.connect()
        self.addCleanup(conn.close)
        self.addCleanup(conn.rollback)

        class Transaction:
            def cursor(self, **kwargs):
                return conn.cursor(**kwargs)
            def __enter__(self):
                with conn.cursor() as q:
                    q.execute('SAVEPOINT module_call')
                return self
            def __exit__(self, exc_type, exc, tb):
                with conn.cursor() as q:
                    q.execute('ROLLBACK TO SAVEPOINT module_call' if exc_type else 'RELEASE SAVEPOINT module_call')
            def close(self):
                pass

        with patch.object(server, 'connect', return_value=Transaction()):
            server.seed_products()
            module = server.Module(companies)
            token = str(uuid4())
            products = module.handle('GET', '/products', {}, token)
            self.assertTrue(products, 'The database needs at least one existing product')
            p = products[0]
            with conn.cursor() as q:
                q.execute('SELECT inn FROM business')
                occupied = {r[0] for r in q.fetchall()}
            for inn in companies.rows:
                if inn in occupied:
                    continue
                try:
                    _, expected, _ = companies.calculate(inn)
                except server.Failure:
                    continue
                break
            else:
                self.fail('No usable unregistered CSV company')
            data = dict(profile=dict(inn=inn, companyName='Локальная тестовая компания'),
                        amount=p['minAmount'], months=p['minMonths'], productId=p['id'], purpose=server.PURPOSES[0])
            draft = module.handle('POST', '/draft', data, token)
            again = module.handle('POST', '/draft', data, token)
            self.assertEqual(draft['id'], again['id'])
            self.assertEqual(draft['formationStatus'], 'DRAFT')
            route = '/applications/' + draft['id']
            formed = module.handle('POST', route + '/form', {}, token)
            repeated = module.handle('POST', route + '/form', {}, token)
            self.assertEqual(formed['formationStatus'], 'SUBMITTED')
            self.assertEqual(formed['finances'], [expected])
            self.assertEqual(repeated['finances'], [expected])
            self.assertEqual(module.handle('GET', route, {}, token)['id'], draft['id'])
            self.assertEqual(len(module.handle('GET', '/applications', {}, token)), 1)
            with self.assertRaises(server.Failure) as denied:
                module.handle('GET', route, {}, str(uuid4()))
            self.assertEqual(denied.exception.status, 404)
            # A new Module instance and changed source must not recalculate a saved report.
            restarted = server.Module(companies)
            with patch.object(companies, 'calculate', side_effect=AssertionError('CSV must not be read for a saved report')):
                restored = restarted.handle('GET', route, {}, token)
                self.assertEqual(restored['calculated'], formed['calculated'])
                self.assertEqual(restored['company'], formed['company'])
            started = datetime.now(timezone.utc)
            for seconds, stage in [(6, 'VERIFICATION'), (11, 'REVIEW'), (16, 'COMPLETED')]:
                with patch.object(server, 'datetime', wraps=datetime) as clock:
                    clock.now.return_value = started + timedelta(seconds=seconds)
                    advanced = restarted.handle('GET', route, {}, token)
                    self.assertEqual(advanced['status'], stage)
            finished = restarted.handle('GET', route, {}, token)
            self.assertEqual(finished['status'], 'COMPLETED')
            self.assertEqual(finished['decision'], advanced['decision'])
            self.assertEqual(restarted.handle('POST', route + '/form', {}, token)['status'], 'COMPLETED')
            with conn.cursor() as q:
                q.execute('SELECT count(*) FROM decision WHERE decision_id=%s', (draft['id'],))
                self.assertEqual(q.fetchone()[0], 1)
                q.execute('SELECT count(*) FROM finances WHERE application_id=%s', (draft['id'],))
                self.assertEqual(q.fetchone()[0], 1)

            # Missing CSV INN: explicit company details and finances travel through the same frontend API.
            manual_inn = next(str(n) for n in range(9900000000, 9999999999) if str(n) not in occupied and str(n) not in companies.rows)
            manual_token = token
            lookup = module.handle('GET', '/companies/' + manual_inn, {}, manual_token)
            self.assertFalse(lookup['found'])
            manual_profile = dict(inn=manual_inn, companyName='Компания без CSV', monthlyRevenue=100000,
                manualBusiness=dict(legalForm='OOO', registrationDate='2021-03-01', okved='62.01', status='ACTIVE'),
                manualFinances=dict(netProfit='-500', currentLoans='100', taxArrears='', equity='30000', assets='40000'))
            manual_data = {**data, 'profile': manual_profile}
            manual_draft = module.handle('POST', '/draft', manual_data, manual_token)
            # Same loan conditions for different companies must not reuse another company's draft.
            csv_again_draft = module.handle('POST', '/draft', data, token)
            self.assertNotEqual(csv_again_draft['id'], manual_draft['id'])
            self.assertEqual(module.handle('POST', '/draft', manual_data, token)['id'], manual_draft['id'])
            self.assertEqual(module.handle('POST', '/draft', data, token)['id'], csv_again_draft['id'])
            self.assertEqual(module.handle('GET', route, {}, token)['company']['inn'], inn)
            manual_route = '/applications/' + manual_draft['id']
            manual_formed = module.handle('POST', manual_route + '/form', {}, manual_token)
            self.assertEqual(manual_formed['source'], 'manual')
            self.assertEqual(manual_formed['finances'][0], dict(revenue=1200000, net_profit=-500, current_loans=100, tax_arrears=None))
            self.assertEqual(manual_formed['calculated']['equity'], 30000)
            self.assertEqual(server.Module(companies).handle('GET', manual_route, {}, manual_token)['calculated'], manual_formed['calculated'])
            handler = type('TestHandler', (server.Handler,), {'module': module})
            http = HTTPServer(('127.0.0.1', 0), handler)
            thread = threading.Thread(target=http.serve_forever, daemon=True)
            thread.start()
            try:
                request = urllib.request.Request(
                    f'http://127.0.0.1:{http.server_port}/api/formation{route}/form',
                    data=b'{}', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
                with urllib.request.urlopen(request, timeout=5) as response:
                    over_http = json.load(response)
                self.assertEqual(over_http['finances'], [expected])
                self.assertIn(over_http['formationStatus'], ('APPROVED', 'REJECTED'))
                listed = module.handle('GET', '/applications', {}, token)
                self.assertEqual(len(listed), 3)
                by_id = {app['id']: app for app in listed}
                self.assertEqual(by_id[draft['id']]['company']['inn'], inn)
                self.assertEqual(by_id[manual_draft['id']]['company']['inn'], manual_inn)
                self.assertEqual(by_id[csv_again_draft['id']]['company']['inn'], inn)
            finally:
                http.shutdown()
                http.server_close()
                thread.join(timeout=2)
            print('PostgreSQL verified: draft reuse, CSV mapping, finances, status, ownership, replay. Test rows rolled back.')


if __name__ == '__main__':
    unittest.main()
