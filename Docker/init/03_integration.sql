-- Additive storage for the questionnaire before a credit product is selected.
-- Run against existing databases too; no destructive changes to existing tables.
CREATE TABLE IF NOT EXISTS integration_profile (
    reg_id INTEGER PRIMARY KEY REFERENCES reg(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO product(name, description, min_amount, max_amount, min_term, max_term, rate)
SELECT 'Кредит для бизнеса', 'Лимиты учебной конфигурации. Актуальная ставка загружается с сайта банка.',
       100000, 10000000, 6, 60, NULL
WHERE NOT EXISTS (SELECT 1 FROM product);
