--
-- PostgreSQL database dump
--

\restrict ydlKEgLxcVUdDMKMPUQAXIWLarT5gYeZ2JqH6wbzRj6ZIJErfTDqCS3nyDFfpXF

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: app_status_t; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_status_t AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'DOCS_REQUESTED',
    'IN_CHECK',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.app_status_t OWNER TO postgres;

--
-- Name: decision_t; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.decision_t AS ENUM (
    'APPROVED',
    'APPROVED_NEW_TERMS',
    'REJECTED',
    'REWORK'
);


ALTER TYPE public.decision_t OWNER TO postgres;

--
-- Name: legal_form_t; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.legal_form_t AS ENUM (
    'IP',
    'OOO'
);


ALTER TYPE public.legal_form_t OWNER TO postgres;

--
-- Name: purpose_t; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.purpose_t AS ENUM (
    'REPLENISHMENT OF WORKING CAPITAL',
    'PURCHASE OF EQUIPMENT',
    'BUSINESS DEVELOPMENT',
    'RENOVATION OF THE PREMISES'
);


ALTER TYPE public.purpose_t OWNER TO postgres;

--
-- Name: status_t; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_t AS ENUM (
    'ACTIVE',
    'LIQUIDATED',
    'BANKRUPT'
);


ALTER TYPE public.status_t OWNER TO postgres;

--
-- Name: clean_old_drafts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clean_old_drafts() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM application 
    WHERE status = 'DRAFT' 
	AND updated_at < NOW() - INTERVAL '3 days';
END;
$$;


ALTER FUNCTION public.clean_old_drafts() OWNER TO postgres;

--
-- Name: encrypt_password(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.encrypt_password() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.encrypt_password() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: application; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application (
    id integer NOT NULL,
    reg_id bigint NOT NULL,
    product_id integer NOT NULL,
    amount integer NOT NULL,
    term_months integer NOT NULL,
    purpose public.purpose_t NOT NULL,
    status public.app_status_t DEFAULT 'DRAFT'::public.app_status_t NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT application_amount_check CHECK ((amount > 0)),
    CONSTRAINT application_term_months_check CHECK ((term_months > 0))
);


ALTER TABLE public.application OWNER TO postgres;

--
-- Name: application_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.application_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.application_id_seq OWNER TO postgres;

--
-- Name: application_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.application_id_seq OWNED BY public.application.id;


--
-- Name: business; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business (
    id integer NOT NULL,
    reg_id bigint NOT NULL,
    legal_form public.legal_form_t NOT NULL,
    fullname text NOT NULL,
    status public.status_t NOT NULL,
    inn character varying(12) NOT NULL,
    ogrn character varying(15),
    registration_date date NOT NULL,
    address text,
    okved character varying(10) NOT NULL,
    settlement_account character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT business_check CHECK ((((legal_form = 'IP'::public.legal_form_t) AND (length((inn)::text) = 12)) OR ((legal_form = 'OOO'::public.legal_form_t) AND (length((inn)::text) = 10)))),
    CONSTRAINT business_inn_check CHECK (((inn)::text ~ '^([0-9]{10}|[0-9]{12})$'::text)),
    CONSTRAINT business_ogrn_check CHECK (((ogrn)::text ~ '^([0-9]{13}|[0-9]{15})$'::text)),
    CONSTRAINT business_settlement_account_check CHECK (((settlement_account)::text ~ '^[0-9]{20}$'::text))
);


ALTER TABLE public.business OWNER TO postgres;

--
-- Name: business_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_id_seq OWNER TO postgres;

--
-- Name: business_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_id_seq OWNED BY public.business.id;


--
-- Name: decision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.decision (
    id integer NOT NULL,
    decision_id integer NOT NULL,
    decision public.decision_t NOT NULL,
    reason text NOT NULL,
    approved_amount integer,
    approved_term integer,
    approved_rate numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT decision_approved_amount_check CHECK ((approved_amount > 0)),
    CONSTRAINT decision_approved_rate_check CHECK (((approved_rate >= (0)::numeric) AND (approved_rate <= (100)::numeric))),
    CONSTRAINT decision_approved_term_check CHECK ((approved_term > 0))
);


ALTER TABLE public.decision OWNER TO postgres;

--
-- Name: decision_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.decision_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.decision_id_seq OWNER TO postgres;

--
-- Name: decision_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.decision_id_seq OWNED BY public.decision.id;


--
-- Name: finances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finances (
    id integer NOT NULL,
    application_id integer NOT NULL,
    revenue integer NOT NULL,
    net_profit integer NOT NULL,
    account_statements text,
    tax_arrears integer,
    current_loans integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT finances_revenue_check CHECK ((revenue >= 0))
);


ALTER TABLE public.finances OWNER TO postgres;

--
-- Name: finances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.finances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.finances_id_seq OWNER TO postgres;

--
-- Name: finances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.finances_id_seq OWNED BY public.finances.id;


--
-- Name: person; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person (
    id integer NOT NULL,
    reg_id bigint NOT NULL,
    firstname text NOT NULL,
    lastname text NOT NULL,
    patronymic text,
    birth_date date NOT NULL,
    citizenship text NOT NULL,
    passport_series character varying(4) NOT NULL,
    passport_number character varying(6) NOT NULL,
    passport_issued_by text,
    passport_issued_date date,
    passport_dept_code text,
    phone text NOT NULL,
    email text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT person_birth_date_check CHECK ((birth_date <= (CURRENT_DATE - '18 years'::interval))),
    CONSTRAINT person_passport_dept_code_check CHECK ((passport_dept_code ~ '^[0-9]{3}-[0-9]{3}$'::text)),
    CONSTRAINT person_passport_number_check CHECK (((passport_number)::text ~ '^[0-9]{6}$'::text)),
    CONSTRAINT person_passport_series_check CHECK (((passport_series)::text ~ '^[0-9]{4}$'::text))
);


ALTER TABLE public.person OWNER TO postgres;

--
-- Name: person_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_id_seq OWNER TO postgres;

--
-- Name: person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_id_seq OWNED BY public.person.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    min_amount integer NOT NULL,
    max_amount integer NOT NULL,
    min_term integer NOT NULL,
    max_term integer NOT NULL,
    rate numeric(5,2),
    CONSTRAINT product_check CHECK ((max_amount > min_amount)),
    CONSTRAINT product_check1 CHECK ((max_term > min_term)),
    CONSTRAINT product_min_amount_check CHECK ((min_amount > 0)),
    CONSTRAINT product_min_term_check CHECK ((min_term > 0)),
    CONSTRAINT product_rate_check CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)))
);


ALTER TABLE public.product OWNER TO postgres;

--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_id_seq OWNER TO postgres;

--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: reg; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reg (
    id integer NOT NULL,
    login character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL
);


ALTER TABLE public.reg OWNER TO postgres;

--
-- Name: reg_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reg_id_seq OWNER TO postgres;

--
-- Name: reg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reg_id_seq OWNED BY public.reg.id;


--
-- Name: application id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application ALTER COLUMN id SET DEFAULT nextval('public.application_id_seq'::regclass);


--
-- Name: business id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business ALTER COLUMN id SET DEFAULT nextval('public.business_id_seq'::regclass);


--
-- Name: decision id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision ALTER COLUMN id SET DEFAULT nextval('public.decision_id_seq'::regclass);


--
-- Name: finances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finances ALTER COLUMN id SET DEFAULT nextval('public.finances_id_seq'::regclass);


--
-- Name: person id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person ALTER COLUMN id SET DEFAULT nextval('public.person_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: reg id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reg ALTER COLUMN id SET DEFAULT nextval('public.reg_id_seq'::regclass);


--
-- Data for Name: application; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.application (id, reg_id, product_id, amount, term_months, purpose, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: business; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business (id, reg_id, legal_form, fullname, status, inn, ogrn, registration_date, address, okved, settlement_account, created_at) FROM stdin;
\.


--
-- Data for Name: decision; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.decision (id, decision_id, decision, reason, approved_amount, approved_term, approved_rate, created_at) FROM stdin;
\.


--
-- Data for Name: finances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.finances (id, application_id, revenue, net_profit, account_statements, tax_arrears, current_loans, created_at) FROM stdin;
\.


--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.person (id, reg_id, firstname, lastname, patronymic, birth_date, citizenship, passport_series, passport_number, passport_issued_by, passport_issued_date, passport_dept_code, phone, email, created_at) FROM stdin;
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product (id, name, description, min_amount, max_amount, min_term, max_term, rate) FROM stdin;
\.


--
-- Data for Name: reg; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reg (id, login, password_hash) FROM stdin;
\.


--
-- Name: application_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.application_id_seq', 1, false);


--
-- Name: business_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_id_seq', 1, false);


--
-- Name: decision_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.decision_id_seq', 1, false);


--
-- Name: finances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.finances_id_seq', 1, false);


--
-- Name: person_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.person_id_seq', 1, false);


--
-- Name: product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_id_seq', 1, false);


--
-- Name: reg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reg_id_seq', 1, false);


--
-- Name: application application_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_pkey PRIMARY KEY (id);


--
-- Name: business business_inn_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_inn_key UNIQUE (inn);


--
-- Name: business business_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_pkey PRIMARY KEY (id);


--
-- Name: decision decision_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision
    ADD CONSTRAINT decision_pkey PRIMARY KEY (id);


--
-- Name: finances finances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finances
    ADD CONSTRAINT finances_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: product product_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_name_key UNIQUE (name);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: reg reg_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reg
    ADD CONSTRAINT reg_login_key UNIQUE (login);


--
-- Name: reg reg_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reg
    ADD CONSTRAINT reg_pkey PRIMARY KEY (id);


--
-- Name: application trg_application_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_application_updated_at BEFORE UPDATE ON public.application FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: reg trg_encrypt_password; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_encrypt_password BEFORE INSERT OR UPDATE ON public.reg FOR EACH ROW EXECUTE FUNCTION public.encrypt_password();


--
-- Name: application application_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: application application_reg_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_reg_id_fkey FOREIGN KEY (reg_id) REFERENCES public.reg(id) ON DELETE CASCADE;


--
-- Name: business business_reg_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_reg_id_fkey FOREIGN KEY (reg_id) REFERENCES public.reg(id) ON DELETE CASCADE;


--
-- Name: decision decision_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision
    ADD CONSTRAINT decision_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES public.application(id) ON DELETE CASCADE;


--
-- Name: finances finances_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finances
    ADD CONSTRAINT finances_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(id) ON DELETE CASCADE;


--
-- Name: person person_reg_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_reg_id_fkey FOREIGN KEY (reg_id) REFERENCES public.reg(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ydlKEgLxcVUdDMKMPUQAXIWLarT5gYeZ2JqH6wbzRj6ZIJErfTDqCS3nyDFfpXF

