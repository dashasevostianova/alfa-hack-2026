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