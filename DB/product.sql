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