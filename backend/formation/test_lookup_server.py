import csv
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from lookup_server import LookupHandler
from server import Companies, Module


class ReadOnlyLookupTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'companies.csv'
        fields = ['inn', 'ogrn', 'okopf', 'okved', 'creation_date', 'dissolution_date',
                  'revenue', 'net_profit', 'capital', 'assets', 'long_term_borrowed_funds',
                  'short_term_borrowed_funds', 'accounts_payable']
        with path.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.writer(stream, delimiter=';')
            writer.writerow(fields)
            writer.writerow(['1234567890', '1234567890123', '12300', '62.01', '01.01.2020', '',
                             '100', '-2', '50', '200', '10', '20', '30'])
        handler = type('TestHandler', (LookupHandler,), {'module': Module(Companies(path))})
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)
        self.connection = patch('server.connect', side_effect=AssertionError('Lookup must not access DB'))
        self.connection.start()
        self.addCleanup(self.connection.stop)

    def request(self, path, data=None):
        payload = None if data is None else json.dumps(data).encode()
        request = urllib.request.Request(self.base + path, data=payload,
                                         headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request) as response:
            return json.load(response)

    def test_lookup_reuses_calculations_without_database_writes(self):
        result = self.request('/api/formation/companies/1234567890')
        self.assertTrue(result['found'])
        self.assertEqual(result['stored']['revenue'], 100000)
        self.assertEqual(result['stored']['net_profit'], -2000)
        self.assertEqual(result['stored']['current_loans'], 33500)
        self.assertNotIn('fullname', result)
        self.assertEqual(result['status'], 'ACTIVE')

    def test_missing_company_and_manual_prepare(self):
        self.assertFalse(self.request('/api/formation/companies/990000000001')['found'])
        result = self.request('/api/formation/prepare', {
            'inn': '990000000001', 'companyName': 'ИП Тест', 'monthlyRevenue': 100000,
            'manualBusiness': {'legalForm': 'IP', 'registrationDate': '2020-01-01',
                               'okved': '62.01', 'status': 'ACTIVE'},
            'manualFinances': {'netProfit': '-100'},
        })
        self.assertEqual(result['company']['legal_form'], 'IP')
        self.assertEqual(result['stored']['revenue'], 1200000)
        self.assertIsNone(result['stored']['current_loans'])

    def test_legacy_write_routes_are_unavailable(self):
        for path in ['/api/formation/draft', '/api/formation/applications/1/form']:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request(path, {})
            self.assertEqual(error.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
