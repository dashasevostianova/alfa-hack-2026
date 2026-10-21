CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE reg (
	id SERIAL PRIMARY KEY,
	login VARCHAR(50) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL
);

CREATE OR REPLACE FUNCTION encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
    NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_encrypt_password
BEFORE INSERT OR UPDATE ON reg
FOR EACH ROW
EXECUTE FUNCTION encrypt_password();

CREATE TABLE person (
	id SERIAL PRIMARY KEY,
    reg_id BIGINT NOT NULL REFERENCES reg(id) ON DELETE CASCADE,
    firstname TEXT NOT NULL,
	lastname TEXT NOT NULL,
	patronymic TEXT,
    birth_date DATE NOT NULL CHECK (birth_date <= current_date - interval '18 years'),
	citizenship TEXT NOT NULL,
	passport_series VARCHAR(4) NOT NULL CHECK (passport_series ~ '^[0-9]{4}$'),
    passport_number VARCHAR(6) NOT NULL CHECK (passport_number ~ '^[0-9]{6}$'),
    passport_issued_by TEXT,
    passport_issued_date DATE,
    passport_dept_code TEXT CHECK (passport_dept_code ~ '^[0-9]{3}-[0-9]{3}$'),
    phone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE legal_form_t AS ENUM ('IP', 'OOO');
CREATE TYPE status_t AS ENUM ('ACTIVE', 'LIQUIDATED', 'BANKRUPT');

CREATE TABLE business (
	id SERIAL PRIMARY KEY,
    reg_id BIGINT NOT NULL REFERENCES reg(id) ON DELETE CASCADE,
	legal_form legal_form_t NOT NULL,
    fullname TEXT NOT NULL,
	status status_t NOT NULL,
    inn VARCHAR(12) NOT NULL UNIQUE CHECK (inn ~ '^([0-9]{10}|[0-9]{12})$'),
    ogrn VARCHAR(15) CHECK (ogrn ~ '^([0-9]{13}|[0-9]{15})$'),
    registration_date DATE NOT NULL,
    address TEXT,
    okved VARCHAR(10) NOT NULL,
    settlement_account VARCHAR(20) CHECK (settlement_account ~ '^[0-9]{20}$'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	CHECK ((legal_form = 'IP'  AND length(inn) = 12)
    	OR (legal_form = 'OOO' AND length(inn) = 10))
);

CREATE TABLE product (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	description TEXT NOT NULL,
	min_amount INTEGER NOT NULL CHECK (min_amount > 0),
	max_amount INTEGER NOT NULL,
	min_term INTEGER NOT NULL CHECK (min_term > 0),
    max_term INTEGER NOT NULL,
	rate NUMERIC(5, 2) CHECK (rate >= 0 AND rate <= 100),
	CHECK (max_amount > min_amount),
    CHECK (max_term > min_term)
);

CREATE TYPE purpose_t AS ENUM ('REPLENISHMENT OF WORKING CAPITAL', 'PURCHASE OF EQUIPMENT', 'BUSINESS DEVELOPMENT', 'RENOVATION OF THE PREMISES');
CREATE TYPE app_status_t AS ENUM ('DRAFT', 'SUBMITTED', 'DOCS_REQUESTED', 'IN_CHECK', 'APPROVED', 'REJECTED');

CREATE TABLE application (
	id SERIAL PRIMARY KEY,
	reg_id BIGINT NOT NULL REFERENCES reg(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
	amount INTEGER NOT NULL CHECK (amount > 0),
	term_months INTEGER NOT NULL CHECK (term_months > 0),
	purpose purpose_t NOT NULL,
	status app_status_t NOT NULL DEFAULT 'DRAFT',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_application_updated_at
BEFORE UPDATE ON application
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION clean_old_drafts()
RETURNS void AS $$
BEGIN
    DELETE FROM application 
    WHERE status = 'DRAFT' 
	AND updated_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

CREATE TABLE finances (
	id SERIAL PRIMARY KEY,
	application_id INTEGER NOT NULL REFERENCES application(id) ON DELETE CASCADE,
	revenue INTEGER NOT NULL CHECK (revenue >= 0),
	net_profit INTEGER NOT NULL,
	account_statements TEXT,
	tax_arrears INTEGER,
	current_loans INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE decision_t AS ENUM ('APPROVED', 'APPROVED_NEW_TERMS', 'REJECTED', 'REWORK');

CREATE TABLE decision (
	id SERIAL PRIMARY KEY,
	decision_id INTEGER NOT NULL REFERENCES application(id) ON DELETE CASCADE,
	decision decision_t NOT NULL,
	reason TEXT NOT NULL,
	approved_amount INTEGER CHECK (approved_amount > 0),
	approved_term INTEGER CHECK (approved_term > 0),
	approved_rate NUMERIC(5, 2) CHECK (approved_rate >= 0 AND approved_rate <= 100),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);