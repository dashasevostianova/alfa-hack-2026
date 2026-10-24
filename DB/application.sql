CREATE TYPE purpose_t AS ENUM ('REPLENISHMENT OF WORKING CAPITAL', 'PURCHASE OF EQUIPMENT', 'BUSINESS DEVELOPMENT', 'RENOVATION OF THE PREMISES');
CREATE TYPE app_status_t AS ENUM ('DRAFT', 'SUBMITTED', 'DOCS_REQUESTED', 'IN_CHECK', 'APPROVED', 'REJECTED');

CREATE TABLE application (
	id SERIAL PRIMARY KEY,
	reg_id BIGINT NOT NULL REFERENCES reg(id) ON DELETE CASCADE,
	product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
	amount INTEGER CHECK (amount > 0),
	term_months INTEGER CHECK (term_months > 0),
	purpose purpose_t,
	status app_status_t NOT NULL DEFAULT 'DRAFT',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	CHECK (
    (status = 'DRAFT') OR 
    (status != 'DRAFT' AND amount IS NOT NULL AND term_months IS NOT NULL AND purpose IS NOT NULL AND product_id IS NOT NULL)
	)
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