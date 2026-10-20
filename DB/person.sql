CREATE TABLE person (
	id SERIAL PRIMARY KEY,
    reg_id BIGINT NOT NULL REFERENCES reg(id) ON DELETE CASCADE,
    firstname TEXT NOT NULL,
	lastname TEXT NOT NULL,
	patronymic TEXT NOT NULL,
    birth_date DATE NOT NULL CHECK (birth_date <= current_date - interval '18 years'),
	citizenship TEXT NOT NULL DEFAULT 'RU',
	passport_series VARCHAR(4) NOT NULL CHECK (passport_series ~ '^[0-9]{4}$'),
    passport_number VARCHAR(6) NOT NULL CHECK (passport_number ~ '^[0-9]{6}$'),
    passport_issued_by TEXT,
    passport_issued_date DATE,
    passport_dept_code TEXT CHECK (passport_dept_code ~ '^[0-9]{3}-[0-9]{3}$'),
    phone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);