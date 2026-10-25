"""Local hackathon adapter. No schema changes; not a production authentication service."""
import csv
import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import UUID

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parent
PURPOSES = ['Пополнение оборотных средств', 'Покупка оборудования', 'Развитие бизнеса', 'Ремонт помещения']
DB_PURPOSES = ['REPLENISHMENT OF WORKING CAPITAL', 'PURCHASE OF EQUIPMENT', 'BUSINESS DEVELOPMENT', 'RENOVATION OF THE PREMISES']


class Failure(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


class Companies:
    def __init__(self, path):
        self.rows = {}
        with open(path, encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream, delimiter=';')
            required = {'inn', 'ogrn', 'okopf', 'okved', 'creation_date', 'dissolution_date', 'revenue', 'net_profit',
                        'capital', 'assets', 'long_term_borrowed_funds', 'short_term_borrowed_funds', 'accounts_payable'}
            if not required.issubset(reader.fieldnames or []):
                raise ValueError('В CSV отсутствуют необходимые столбцы')
            for row in reader:
                inn = row['inn']
                if not re.fullmatch(r'\d{10}|\d{12}', inn) or inn in self.rows:
                    raise ValueError('Некорректный или повторяющийся ИНН в CSV')
                self.rows[inn] = row

    def get(self, inn):
        if not isinstance(inn, str) or not re.fullmatch(r'\d{10}|\d{12}', inn):
            raise Failure('ИНН должен содержать 10 или 12 цифр')
        if inn not in self.rows:
            raise Failure('Компания с таким ИНН отсутствует в локальном CSV', 404)
        row = self.rows[inn]
        if row['okopf'] != '12300' or len(inn) != 10:
            raise Failure('Юридическая форма компании не поддерживается: ожидается ООО, ОКОПФ 12300')
        if not re.fullmatch(r'\d{13}', row['ogrn']):
            raise Failure('ОГРН отсутствует или повреждён в CSV')
        try:
            date = datetime.strptime(row['creation_date'], '%d.%m.%Y').date()
        except ValueError:
            raise Failure('В CSV отсутствует корректная дата регистрации')
        if not row['okved'] or len(row['okved']) > 10:
            raise Failure('В CSV отсутствует корректный ОКВЭД')
        return row, date

    def calculate(self, inn):
        row, _ = self.get(inn)
        warnings = []

        def number(key):
            if not row[key].strip():
                return None
            try:
                result = Decimal(row[key])
                if not result.is_finite():
                    raise InvalidOperation
                return result
            except InvalidOperation:
                raise Failure(f'Некорректное число в CSV: {key}')

        def rubles(value):
            return None if value is None else value * Decimal('1000')

        long, short, payable = (number(k) for k in ('long_term_borrowed_funds', 'short_term_borrowed_funds', 'accounts_payable'))
        debt = None if long is None or short is None else long * Decimal('0.85') + short * Decimal('1.25')
        tax = None if payable is None else payable * Decimal('0.005')
        values = dict(revenue=rubles(number('revenue')), net_profit=rubles(number('net_profit')),
                      current_loans=rubles(debt), tax_arrears=rubles(tax),
                      equity=rubles(number('capital')), assets=rubles(number('assets')))
        for field in ('revenue', 'net_profit'):
            if values[field] is None:
                raise Failure(f'В CSV отсутствует обязательный показатель {field}')
        if values['revenue'] < 0:
            raise Failure('Выручка в CSV отрицательная')
        stored = {}
        for key in ('revenue', 'net_profit', 'current_loans', 'tax_arrears'):
            value = values[key]
            if value is None:
                warnings.append(f'{key}: нет исходных данных, сохранено NULL')
                stored[key] = None
                continue
            rounded = int(value.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            if not -2147483648 <= rounded <= 2147483647:
                raise Failure(f'{key}: сумма в рублях превышает диапазон INTEGER. Требуется согласованная миграция БД')
            stored[key] = rounded
        warnings.append('equity и assets рассчитаны из CSV, но не сохраняются: в таблице finances нет этих столбцов')
        return values, stored, warnings


def connect():
    config = {}
    envfile = ROOT.parent.parent / 'Docker' / '.env'
    if envfile.exists():
        config = dict(line.split('=', 1) for line in envfile.read_text().splitlines() if '=' in line and not line.startswith('#'))
    def setting(key, default):
        return os.environ.get(key, config.get(key, default)).strip('"\'')
    return psycopg2.connect(host=setting('DB_HOST', '127.0.0.1'), port=setting('POSTGRES_PORT', '5432'),
                            dbname=setting('POSTGRES_DB', 'credit_db'), user=setting('POSTGRES_USER', 'demo_user'),
                            password=setting('POSTGRES_PASSWORD', 'change-me'), connect_timeout=5)


def money_value(value, name, required=False, nonnegative=False):
    if value is None or value == '':
        if required:
            raise Failure(f'Заполните показатель: {name}')
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite() or (nonnegative and number < 0):
            raise InvalidOperation
        rounded = int(number.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError):
        raise Failure(f'Некорректное значение: {name}')
    if not -2147483648 <= rounded <= 2147483647:
        raise Failure(f'{name}: сумма превышает допустимый диапазон')
    return rounded


def demo_decision(amount):
    # The same demo thresholds used by frontend/src/api/mock.ts; this is not credit scoring.
    if amount <= 2000000:
        return dict(outcome='APPROVED', summary='Ваша заявка одобрена.', reasons=[], recommendations=[])
    if amount <= 5000000:
        return dict(outcome='REVISION', summary='Текущая заявка не одобрена. Можно изменить условия и подать новую.',
                    reasons=['Запрошенная сумма превышает демонстрационный лимит.'],
                    recommendations=['Уменьшите сумму до 2 000 000 ₽ и подайте новую заявку.'], suggestedAmount=2000000)
    return dict(outcome='REJECTED', summary='По заявке принято отрицательное решение.',
                reasons=['Сумма существенно превышает демонстрационный лимит.', 'Расчётная долговая нагрузка слишком велика.'],
                recommendations=['Пересмотрите объём финансирования и показатели бизнеса.'])


class Module:
    def __init__(self, companies):
        self.companies = companies

    def prepare(self, profile):
        inn = profile.get('inn')
        if not isinstance(inn, str) or not re.fullmatch(r'\d{10}|\d{12}', inn):
            raise Failure('ИНН должен содержать 10 или 12 цифр')
        name = profile.get('companyName')
        if not isinstance(name, str) or not name.strip():
            raise Failure('Укажите название компании в анкете')
        if inn in self.companies.rows:
            row, registered = self.companies.get(inn)
            values, stored, warnings = self.companies.calculate(inn)
            company = dict(inn=inn, fullname=name.strip(), ogrn=row['ogrn'], okved=row['okved'],
                           registration_date=registered, legal_form='OOO', status='LIQUIDATED' if row['dissolution_date'] else 'ACTIVE')
            source = 'csv'
        else:
            business = profile.get('manualBusiness') or {}
            finance = profile.get('manualFinances') or {}
            form = business.get('legalForm')
            if form not in ('OOO', 'IP') or len(inn) != (10 if form == 'OOO' else 12):
                raise Failure('Укажите юридическую форму: ООО — ИНН 10 цифр, ИП — 12 цифр')
            try:
                registered = datetime.strptime(business.get('registrationDate', ''), '%Y-%m-%d').date()
                if registered > datetime.now().date():
                    raise ValueError
            except ValueError:
                raise Failure('Укажите корректную дату регистрации компании')
            okved = business.get('okved', '')
            if not isinstance(okved, str) or not re.fullmatch(r'\d{2}(?:\.\d{1,2}){0,2}', okved):
                raise Failure('Укажите ОКВЭД, например 62.01')
            ogrn = business.get('ogrn') or None
            if ogrn and (not isinstance(ogrn, str) or not re.fullmatch(r'\d{13}' if form == 'OOO' else r'\d{15}', ogrn)):
                raise Failure('Проверьте ОГРН / ОГРНИП')
            status = business.get('status')
            if status not in ('ACTIVE', 'LIQUIDATED', 'BANKRUPT'):
                raise Failure('Укажите статус компании')
            company = dict(inn=inn, fullname=name.strip(), ogrn=ogrn, okved=okved, registration_date=registered, legal_form=form, status=status)
            monthly = money_value(profile.get('monthlyRevenue'), 'Месячная выручка', required=True, nonnegative=True)
            stored = dict(revenue=money_value(Decimal(monthly) * 12, 'Годовая выручка', required=True, nonnegative=True),
                          net_profit=money_value(finance.get('netProfit'), 'Чистая прибыль за год', required=True),
                          current_loans=money_value(finance.get('currentLoans'), 'Текущие обязательства', nonnegative=True),
                          tax_arrears=money_value(finance.get('taxArrears'), 'Возможная текущая просрочка', nonnegative=True))
            values = dict(stored, equity=money_value(finance.get('equity'), 'Капитал'), assets=money_value(finance.get('assets'), 'Активы', nonnegative=True))
            warnings, source = [], 'manual'
        report = dict(kind='formation_snapshot_v1', source=source, company=company, calculated=values, warnings=warnings, formedAt=None)
        return company, stored, report

    def write_finances(self, q, app_id, stored, report):
        q.execute('INSERT INTO finances(application_id,revenue,net_profit,current_loans,tax_arrears,account_statements) VALUES (%s,%s,%s,%s,%s,%s)',
                  (app_id, stored['revenue'], stored['net_profit'], stored['current_loans'], stored['tax_arrears'],
                   json.dumps(report, ensure_ascii=False, default=json_default)))

    def handle(self, method, path, data, token):
        try:
            UUID(token)
        except (ValueError, TypeError, AttributeError):
            raise Failure('Нужен токен локальной демо-сессии', 401)
        login = 'demo_' + hashlib.sha256(token.encode()).hexdigest()[:40]
        conn = connect()
        try:
            with conn, conn.cursor(cursor_factory=RealDictCursor) as q:
                q.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (login,))
                q.execute('SELECT id FROM reg WHERE login=%s', (login,))
                reg = q.fetchone()
                if not reg:
                    q.execute('INSERT INTO reg(login,password_hash) VALUES (%s,%s) RETURNING id', (login, secrets.token_urlsafe(32)))
                    reg = q.fetchone()
                reg_id = reg['id']
                company_match = re.fullmatch(r'/companies/(\d+)', path)
                if method == 'GET' and company_match:
                    inn = company_match[1]
                    if not re.fullmatch(r'\d{10}|\d{12}', inn):
                        raise Failure('ИНН должен содержать 10 или 12 цифр')
                    if inn not in self.companies.rows:
                        return dict(found=False, inn=inn)
                    row, registered = self.companies.get(inn)
                    values, stored, warnings = self.companies.calculate(inn)
                    return dict(found=True, inn=inn, ogrn=row['ogrn'], okved=row['okved'], legal_form='OOO',
                                registration_date=registered, calculated=values, stored=stored, warnings=warnings)
                if method == 'GET' and path == '/products':
                    q.execute('SELECT * FROM product ORDER BY id')
                    return [dict(id=str(p['id']), name=p['name'], description=p['description'], annualRate=p['rate'],
                                 minAmount=p['min_amount'], maxAmount=p['max_amount'], minMonths=p['min_term'], maxMonths=p['max_term']) for p in q.fetchall()]
                if method == 'POST' and path == '/draft':
                    company, stored, report = self.prepare(data.get('profile') or {})
                    purpose = data.get('purpose')
                    if purpose not in PURPOSES:
                        raise Failure('Неизвестная цель кредита')
                    q.execute('SELECT * FROM product WHERE id=%s', (int(data['productId']),))
                    product = q.fetchone()
                    amount, months = data.get('amount'), data.get('months')
                    if (not product or type(amount) is not int or type(months) is not int
                            or not product['min_amount'] <= amount <= product['max_amount']
                            or not product['min_term'] <= months <= product['max_term']):
                        raise Failure('Сумма или срок вне допустимых пределов продукта')
                    q.execute('SELECT * FROM business WHERE inn=%s FOR UPDATE', (company['inn'],))
                    business = q.fetchone()
                    if business and business['reg_id'] != reg_id:
                        raise Failure('ИНН уже связан с другой регистрацией. Используйте исходную демо-сессию или другой ИНН', 409)
                    if not business:
                        # Freeze legacy reports while the old registration still has an unambiguous company.
                        q.execute('SELECT id FROM application WHERE reg_id=%s ORDER BY id', (reg_id,))
                        for old in q.fetchall():
                            saved = self.snapshot(q, old['id'], reg_id)
                            if not saved['finances']:
                                legacy = dict(kind='formation_snapshot_v1', source=saved['source'], company=saved['company'],
                                              calculated=saved['calculated'], warnings=saved['warnings'], formedAt=None)
                                stored_legacy = {key: money_value(saved['calculated'].get(key), key, required=key in ('revenue', 'net_profit'))
                                                 for key in ('revenue', 'net_profit', 'current_loans', 'tax_arrears')}
                                self.write_finances(q, old['id'], stored_legacy, legacy)
                        q.execute("""INSERT INTO business(reg_id,legal_form,fullname,status,inn,ogrn,registration_date,okved)
                                     VALUES (%s,%s::legal_form_t,%s,%s::status_t,%s,%s,%s,%s)""",
                                  (reg_id, company['legal_form'], company['fullname'], company['status'], company['inn'],
                                   company['ogrn'], company['registration_date'], company['okved']))
                    q.execute("""SELECT a.id,f.account_statements FROM application a
                                 LEFT JOIN finances f ON f.application_id=a.id
                                 WHERE a.reg_id=%s AND a.status='DRAFT' AND a.product_id=%s
                                 AND a.amount=%s AND a.term_months=%s AND a.purpose=%s::purpose_t ORDER BY a.id DESC""",
                              (reg_id, product['id'], amount, months, DB_PURPOSES[PURPOSES.index(purpose)]))
                    for candidate in q.fetchall():
                        previous = self.read_report(candidate['account_statements'])
                        if previous and previous['company']['inn'] == company['inn']:
                            return self.snapshot(q, candidate['id'], reg_id)
                    q.execute("""INSERT INTO application(reg_id,product_id,amount,term_months,purpose,status)
                                 VALUES (%s,%s,%s,%s,%s::purpose_t,'DRAFT') RETURNING id""",
                              (reg_id, product['id'], amount, months, DB_PURPOSES[PURPOSES.index(purpose)]))
                    app_id = q.fetchone()['id']
                    self.write_finances(q, app_id, stored, report)
                    return self.snapshot(q, app_id, reg_id)
                match = re.fullmatch(r'/applications/(\d+)(/form)?', path)
                if match and ((method == 'POST' and match[2]) or (method == 'GET' and not match[2])):
                    app = self.snapshot(q, int(match[1]), reg_id, advance=method == 'GET')
                    if method == 'POST' and app['formationStatus'] == 'DRAFT':
                        q.execute('SELECT id,account_statements FROM finances WHERE application_id=%s ORDER BY id', (app['id'],))
                        finance = q.fetchone()
                        if not finance:
                            # Compatibility with drafts created before snapshots were introduced.
                            _, stored, _ = self.companies.calculate(app['company']['inn'])
                            report = dict(kind='formation_snapshot_v1', source='csv', company=app['company'], calculated=app['calculated'], warnings=[], formedAt=None)
                            self.write_finances(q, app['id'], stored, report)
                            q.execute('SELECT id,account_statements FROM finances WHERE application_id=%s', (app['id'],))
                            finance = q.fetchone()
                        report = self.read_report(finance['account_statements'])
                        if not report:
                            raise Failure('Не удалось восстановить данные черновика', 409)
                        report['formedAt'] = datetime.now(timezone.utc).isoformat()
                        q.execute('UPDATE finances SET account_statements=%s WHERE id=%s',
                                  (json.dumps(report, ensure_ascii=False, default=json_default), finance['id']))
                        q.execute("UPDATE application SET status='SUBMITTED' WHERE id=%s", (app['id'],))
                        app = self.snapshot(q, app['id'], reg_id)
                    return app
                if method == 'GET' and path == '/applications':
                    q.execute('SELECT id FROM application WHERE reg_id=%s ORDER BY id DESC', (reg_id,))
                    return [self.snapshot(q, a['id'], reg_id, advance=True) for a in q.fetchall()]
                raise Failure('Маршрут не найден', 404)
        finally:
            conn.close()

    @staticmethod
    def read_report(raw):
        try:
            report = json.loads(raw or '{}')
            return report if isinstance(report, dict) and report.get('kind') == 'formation_snapshot_v1' else None
        except (ValueError, TypeError):
            return None

    def snapshot(self, q, app_id, reg_id, advance=False):
        q.execute('''SELECT a.*,p.name,p.rate, EXTRACT(EPOCH FROM (LOCALTIMESTAMP-a.created_at)) AS age
                     FROM application a JOIN product p ON p.id=a.product_id
                     WHERE a.id=%s AND a.reg_id=%s''', (app_id, reg_id))
        a = q.fetchone()
        if not a:
            raise Failure('Заявка не найдена в текущей демо-сессии', 404)
        q.execute('SELECT id,revenue,net_profit,current_loans,tax_arrears,account_statements FROM finances WHERE application_id=%s ORDER BY id', (app_id,))
        records = q.fetchall()
        report = self.read_report(records[0]['account_statements']) if records else None
        if not report:
            # Legacy records have no explicit company snapshot. Never guess among multiple companies.
            q.execute('SELECT inn,ogrn,okved,legal_form,fullname,registration_date,status FROM business WHERE reg_id=%s ORDER BY id', (reg_id,))
            companies = q.fetchall()
            if len(companies) != 1:
                raise Failure('У старой заявки не сохранён ИНН компании. Требуется явно восстановить её привязку', 409)
            company = companies[0]
            values = dict(equity=None, assets=None)
            warnings = []
            if company['inn'] in self.companies.rows:
                try:
                    values, _, warnings = self.companies.calculate(company['inn'])
                except Failure:
                    if not records:
                        raise
            if records:
                values.update({k: records[0][k] for k in ('revenue', 'net_profit', 'current_loans', 'tax_arrears')})
            report = dict(kind='formation_snapshot_v1', source='legacy', company=dict(company), calculated=values, warnings=warnings, formedAt=None)
            # Upgrade only our old empty statement field. Preserve existing textual statements.
            if records and records[0]['account_statements'] is None:
                q.execute('UPDATE finances SET account_statements=%s WHERE id=%s',
                          (json.dumps(report, ensure_ascii=False, default=json_default), records[0]['id']))
        q.execute('SELECT * FROM decision WHERE decision_id=%s ORDER BY id DESC LIMIT 1', (app_id,))
        decision_row = q.fetchone()
        if advance and a['status'] in ('SUBMITTED', 'DOCS_REQUESTED', 'IN_CHECK') and not decision_row:
            elapsed = float(a['age'] or 0)
            if report.get('formedAt'):
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(report['formedAt'])).total_seconds()
            ranks = {'SUBMITTED': 0, 'DOCS_REQUESTED': 1, 'IN_CHECK': 2}
            if elapsed >= 15:
                result = demo_decision(a['amount'])
                db_decision = {'APPROVED': 'APPROVED', 'REVISION': 'REWORK', 'REJECTED': 'REJECTED'}[result['outcome']]
                q.execute('INSERT INTO decision(decision_id,decision,reason) VALUES (%s,%s::decision_t,%s) RETURNING *',
                          (app_id, db_decision, json.dumps(result, ensure_ascii=False)))
                decision_row = q.fetchone()
                a['status'] = 'APPROVED' if result['outcome'] == 'APPROVED' else 'REJECTED'
                q.execute('UPDATE application SET status=%s::app_status_t WHERE id=%s', (a['status'], app_id))
            else:
                target = 'IN_CHECK' if elapsed >= 10 else 'DOCS_REQUESTED' if elapsed >= 5 else 'SUBMITTED'
                if ranks[target] > ranks[a['status']]:
                    a['status'] = target
                    q.execute('UPDATE application SET status=%s::app_status_t WHERE id=%s', (target, app_id))
        decision = None
        if decision_row:
            try:
                decision = json.loads(decision_row['reason'])
                if not isinstance(decision, dict) or decision.get('outcome') not in ('APPROVED', 'REVISION', 'REJECTED'):
                    raise ValueError
            except (ValueError, TypeError):
                outcome = 'APPROVED' if decision_row['decision'] == 'APPROVED' else 'REVISION' if decision_row['decision'] in ('REWORK', 'APPROVED_NEW_TERMS') else 'REJECTED'
                decision = dict(outcome=outcome, summary=decision_row['reason'], reasons=[], recommendations=[])
        status = 'COMPLETED' if decision or a['status'] in ('APPROVED', 'REJECTED') else {
            'DRAFT': 'SUBMITTED', 'SUBMITTED': 'SUBMITTED', 'DOCS_REQUESTED': 'VERIFICATION', 'IN_CHECK': 'REVIEW'}[a['status']]
        finances = [{k: f[k] for k in ('revenue', 'net_profit', 'current_loans', 'tax_arrears')} for f in records]
        return dict(id=str(a['id']), productId=str(a['product_id']), productName=a['name'], amount=a['amount'], months=a['term_months'],
                    purpose=PURPOSES[DB_PURPOSES.index(a['purpose'])], annualRate=a['rate'], createdAt=a['created_at'].isoformat(),
                    status=status, decision=decision, formationStatus=a['status'], company=report['company'], finances=finances,
                    calculated=report['calculated'], source=report['source'], warnings=report['warnings'])


def json_default(value):
    if isinstance(value, Decimal):
        return str(value)  # lossless Decimal serialization
    return value.isoformat()


class Handler(BaseHTTPRequestHandler):
    module = None

    def do_GET(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch()

    def dispatch(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 16384:
                raise Failure('Слишком большой запрос', 413)
            data = json.loads(self.rfile.read(length)) if length else {}
            if not isinstance(data, dict):
                raise Failure('Ожидается JSON-объект', 400)
            token = self.headers.get('Authorization', '').removeprefix('Bearer ')
            prefix = '/api/formation'
            if not self.path.startswith(prefix):
                raise Failure('Маршрут не найден', 404)
            result = self.module.handle(self.command, self.path[len(prefix):], data, token)
            self.respond(200, result)
        except Failure as exc:
            self.respond(exc.status, {'message': str(exc)})
        except (ValueError, KeyError, TypeError, InvalidOperation):
            self.respond(400, {'message': 'Проверьте формат и обязательные поля запроса'})
        except psycopg2.Error:
            self.respond(503, {'message': 'Не удалось сохранить данные в PostgreSQL. Проверьте доступность БД и соответствие Docker/init/01_schema.sql'})

    def respond(self, status, data):
        body = json.dumps(data, ensure_ascii=False, default=json_default).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def seed_products():
    """Add labelled demo conditions only when the product catalog is empty."""
    conn = connect()
    try:
        with conn, conn.cursor() as q:
            q.execute("SELECT pg_advisory_xact_lock(hashtext('formation-demo-products'))")
            q.execute('SELECT count(*) FROM product')
            if q.fetchone()[0] == 0:
                q.executemany('INSERT INTO product(name,description,min_amount,max_amount,min_term,max_term,rate) VALUES (%s,%s,%s,%s,%s,%s,%s)', [
                    ('На оборотные средства', 'Демонстрационные условия для хакатона', 100000, 10000000, 6, 60, 22),
                    ('На развитие', 'Демонстрационные условия для хакатона', 300000, 15000000, 12, 84, 20),
                ])
    finally:
        conn.close()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed-products', action='store_true', help='Добавить два демо-продукта, только если каталог пуст')
    args = parser.parse_args()
    if args.seed_products:
        seed_products()
    Handler.module = Module(Companies(os.environ.get('COMPANIES_CSV', ROOT / 'data' / 'companies_small.csv')))
    server = ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('FORMATION_PORT', '8081'))), Handler)
    print('Local demo module: http://127.0.0.1:8081/api/formation', flush=True)
    server.serve_forever()
