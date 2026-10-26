"""Read-only HTTP boundary around the existing formation calculations.

No registrations, application writes, database connections or demo decisions.
The original server.py remains unchanged and supplies Companies/Module.prepare.
"""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from server import Companies, Failure, Module, json_default


class LookupHandler(BaseHTTPRequestHandler):
    module = None

    def do_GET(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch()

    def dispatch(self):
        try:
            path = urlsplit(self.path).path
            if self.command == 'GET' and path == '/health':
                return self.respond(200, {'status': 'ok'})
            match = re.fullmatch(r'/api/formation/companies/(\d{10}|\d{12})', path)
            if self.command == 'GET' and match:
                inn = match[1]
                if inn not in self.module.companies.rows:
                    return self.respond(200, {'found': False, 'inn': inn})
                # Reuse the authoritative calculations and validation, including INTEGER bounds.
                company, stored, report = self.module.prepare({'inn': inn, 'companyName': 'lookup'})
                company.pop('fullname')  # The dataset has no company name; never invent one.
                return self.respond(200, dict(found=True, **company, stored=stored,
                                              calculated=report['calculated'], warnings=report['warnings']))
            if self.command == 'POST' and path == '/api/formation/prepare':
                length = int(self.headers.get('Content-Length', '0'))
                if length <= 0 or length > 32768:
                    raise Failure('Invalid request size', 400)
                profile = json.loads(self.rfile.read(length))
                if not isinstance(profile, dict):
                    raise Failure('Expected profile object', 400)
                company, stored, report = self.module.prepare(profile)
                return self.respond(200, dict(company=company, stored=stored, report=report))
            raise Failure('Route not found', 404)
        except Failure as error:
            self.respond(error.status, {'message': str(error)})
        except (ValueError, TypeError, KeyError):
            self.respond(400, {'message': 'Invalid request data'})

    def respond(self, status, result):
        body = json.dumps(result, ensure_ascii=False, default=json_default).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    path = os.environ.get('COMPANIES_CSV', str(Path(__file__).parent / 'data' / 'companies_small.csv'))
    LookupHandler.module = Module(Companies(path))
    server = ThreadingHTTPServer((os.environ.get('FORMATION_HOST', '127.0.0.1'),
                                  int(os.environ.get('FORMATION_PORT', '8081'))), LookupHandler)
    server.serve_forever()
