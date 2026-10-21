--
-- PostgreSQL database dump
--

\restrict R2xhPHkpAJdwjud3EXqHBZd8QrPyBaLhyQ7iJ9YhPHyE4QjeZdzmXo51RcxImkO

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
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reg; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: application; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: business; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: decision; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: finances; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--



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
-- PostgreSQL database dump complete
--

\unrestrict R2xhPHkpAJdwjud3EXqHBZd8QrPyBaLhyQ7iJ9YhPHyE4QjeZdzmXo51RcxImkO

