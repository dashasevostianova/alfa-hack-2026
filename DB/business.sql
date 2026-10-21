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