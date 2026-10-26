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