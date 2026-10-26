-- Additive demo workflow; existing applications/decisions and enums remain intact.
CREATE TABLE IF NOT EXISTS loan_demo_review (
    application_id INTEGER PRIMARY KEY REFERENCES application(id) ON DELETE CASCADE,
    payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS loan_fulfillment (
    application_id INTEGER PRIMARY KEY REFERENCES application(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    contract_pdf BYTEA NOT NULL,
    signed_pdf BYTEA,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
