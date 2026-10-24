CREATE TABLE finances (
	id SERIAL PRIMARY KEY,
	revenue INTEGER CHECK (revenue >= 0),
	net_profit INTEGER,
	account_statements TEXT,
	tax_arrears INTEGER,
	current_loans INTEGER,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);