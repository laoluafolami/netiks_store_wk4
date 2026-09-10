--
-- PostgreSQL database dump
--

\restrict 1JmUeKssA7UPLlhwoj3rsVdNDH94XdavyWjS0xgncwziwsCVrAs4tVgrrcmZSvo

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

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

ALTER TABLE IF EXISTS ONLY identity.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY catalog.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE IF EXISTS ONLY catalog.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
DROP INDEX IF EXISTS vendor.ix_vendor_stores_slug;
DROP INDEX IF EXISTS vendor.ix_vendor_stores_owner_id;
DROP INDEX IF EXISTS identity.ix_identity_users_email;
DROP INDEX IF EXISTS identity.ix_identity_auth_sessions_user_id;
DROP INDEX IF EXISTS identity.ix_identity_auth_sessions_refresh_token_hash;
DROP INDEX IF EXISTS catalog.ix_catalog_products_store_id;
DROP INDEX IF EXISTS catalog.ix_catalog_products_slug;
DROP INDEX IF EXISTS catalog.ix_catalog_products_owner_id;
DROP INDEX IF EXISTS catalog.ix_catalog_products_category_id;
DROP INDEX IF EXISTS catalog.ix_catalog_orders_store_id;
DROP INDEX IF EXISTS catalog.ix_catalog_orders_product_id;
DROP INDEX IF EXISTS catalog.ix_catalog_orders_payment_reference;
DROP INDEX IF EXISTS catalog.ix_catalog_orders_owner_id;
DROP INDEX IF EXISTS catalog.ix_catalog_orders_buyer_email;
DROP INDEX IF EXISTS catalog.ix_catalog_categories_slug;
ALTER TABLE IF EXISTS ONLY vendor.stores DROP CONSTRAINT IF EXISTS stores_slug_key;
ALTER TABLE IF EXISTS ONLY vendor.stores DROP CONSTRAINT IF EXISTS stores_pkey;
ALTER TABLE IF EXISTS ONLY public.vendor_alembic_version DROP CONSTRAINT IF EXISTS vendor_alembic_version_pkc;
ALTER TABLE IF EXISTS ONLY public.identity_alembic_version DROP CONSTRAINT IF EXISTS identity_alembic_version_pkc;
ALTER TABLE IF EXISTS ONLY public.catalog_alembic_version DROP CONSTRAINT IF EXISTS catalog_alembic_version_pkc;
ALTER TABLE IF EXISTS ONLY identity.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY identity.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY identity.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_refresh_token_hash_key;
ALTER TABLE IF EXISTS ONLY identity.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_pkey;
ALTER TABLE IF EXISTS ONLY catalog.products DROP CONSTRAINT IF EXISTS products_slug_key;
ALTER TABLE IF EXISTS ONLY catalog.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY catalog.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY catalog.orders DROP CONSTRAINT IF EXISTS orders_payment_reference_key;
ALTER TABLE IF EXISTS ONLY catalog.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE IF EXISTS ONLY catalog.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE IF EXISTS ONLY catalog.categories DROP CONSTRAINT IF EXISTS categories_name_key;
DROP TABLE IF EXISTS vendor.stores;
DROP TABLE IF EXISTS public.vendor_alembic_version;
DROP TABLE IF EXISTS public.identity_alembic_version;
DROP TABLE IF EXISTS public.catalog_alembic_version;
DROP TABLE IF EXISTS identity.users;
DROP TABLE IF EXISTS identity.auth_sessions;
DROP TABLE IF EXISTS catalog.products;
DROP TABLE IF EXISTS catalog.orders;
DROP TABLE IF EXISTS catalog.categories;
DROP SCHEMA IF EXISTS vendor;
DROP SCHEMA IF EXISTS identity;
DROP SCHEMA IF EXISTS catalog;
--
-- Name: catalog; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA catalog;


ALTER SCHEMA catalog OWNER TO postgres;

--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA identity;


ALTER SCHEMA identity OWNER TO postgres;

--
-- Name: vendor; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA vendor;


ALTER SCHEMA vendor OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.categories (
    id character varying(36) NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(140) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE catalog.categories OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.orders (
    id character varying(36) NOT NULL,
    product_id character varying(36) NOT NULL,
    store_id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    buyer_name character varying(120) NOT NULL,
    buyer_email character varying(255) NOT NULL,
    buyer_phone character varying(40),
    shipping_address text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    payment_method character varying(40) DEFAULT 'demo-card'::character varying NOT NULL,
    payment_reference character varying(80) NOT NULL,
    status character varying(40) DEFAULT 'paid'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE catalog.orders OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.products (
    id character varying(36) NOT NULL,
    store_id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    category_id character varying(36) NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(180) NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    sku character varying(80) NOT NULL,
    status character varying(40) DEFAULT 'draft'::character varying NOT NULL,
    featured_image_url character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sold_quantity integer DEFAULT 0 NOT NULL
);


ALTER TABLE catalog.products OWNER TO postgres;

--
-- Name: auth_sessions; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE identity.auth_sessions (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    refresh_token_hash character varying(64) NOT NULL,
    user_agent text,
    ip_address character varying(64),
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE identity.auth_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE identity.users (
    id character varying(36) NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'vendor'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE identity.users OWNER TO postgres;

--
-- Name: catalog_alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.catalog_alembic_version OWNER TO postgres;

--
-- Name: identity_alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identity_alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.identity_alembic_version OWNER TO postgres;

--
-- Name: vendor_alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.vendor_alembic_version OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: vendor; Owner: postgres
--

CREATE TABLE vendor.stores (
    id character varying(36) NOT NULL,
    owner_id character varying(36) NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(140) NOT NULL,
    description character varying(500) NOT NULL,
    contact_email character varying(255) NOT NULL,
    phone character varying(40),
    logo_url character varying(255),
    banner_url character varying(255),
    status character varying(40) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE vendor.stores OWNER TO postgres;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

COPY catalog.categories (id, name, slug, description, created_at, updated_at) FROM stdin;
62b82329-d54c-417e-a3f3-835ad5883d30	Carry Goods	carry-goods	Travel-ready organizers, sleeves, and carry goods designed for everyday work.	2026-08-20 07:50:06.421694+00	2026-08-20 07:50:06.421694+00
9104ee59-95a4-4cdd-9833-53d8123b18d3	Workspace Audio	workspace-audio	Desktop speakers, headphones, and calm studio accessories.	2026-08-20 07:50:06.709363+00	2026-08-20 07:50:06.709363+00
e8a41780-e49b-4a9b-864b-83c39be70d12	Desk Setup	desk-setup	Desk setup tools, monitor accessories, and minimalist workspace pieces.	2026-08-20 07:50:06.928983+00	2026-08-20 07:50:06.928983+00
42cea3f7-1a7e-4651-8f22-fff15c285ec6	Casual Shoes	shoes	New Fashion Men's Four Seasons Comfy Casual Running Shoes	2026-08-20 12:00:04.506034+00	2026-08-20 12:00:04.506034+00
9dc50212-83a8-4b0f-9b08-4804271636d6	Wristwatch	wristwatch	NAVIFORCE Men's Luxury Sports Quartz Watch - Waterproof, Genuine Leather	2026-08-20 12:08:34.279587+00	2026-08-20 12:08:34.279587+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

COPY catalog.orders (id, product_id, store_id, owner_id, buyer_name, buyer_email, buyer_phone, shipping_address, quantity, unit_price, total_price, payment_method, payment_reference, status, created_at) FROM stdin;
1a494957-ecf9-4b7f-a865-46024185ab16	74b5fe79-a0be-4bb1-9d6f-3d600a4898d7	50004c27-b0ca-4b82-add3-e3f1576f64c6	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	Naomi Cole	naomi.cole@example.com	+1 415 555 0198	14 Mercer Lane, Brooklyn, NY 11201	2	149.99	299.98	demo-card-ending-4242	DEMO-321820	paid	2026-08-20 07:50:07.126169+00
b4713c47-29ab-4785-871b-fb09415ae386	e0d248f8-c329-4aaa-8a9c-b82e7affed43	50004c27-b0ca-4b82-add3-e3f1576f64c6	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	Owen Hart	owen.hart@example.com	+1 646 555 0112	62 Pine Street, Seattle, WA 98101	1	219.00	219.00	demo-card-ending-1881	DEMO-727531	paid	2026-08-20 07:50:07.149832+00
f340ed83-1e93-4396-935c-4c134616aa2c	fd974b11-98a9-429d-ba8d-2607c95ee1bb	4a236822-b5fb-4b3c-be2b-2ab378cad0a6	102a67e7-e3a2-41c7-bfd9-2eb957610432	Sara Nguyen	sara.nguyen@example.com	+1 310 555 0174	2214 Olive Avenue, Santa Monica, CA 90405	3	68.00	204.00	demo-card-ending-3005	DEMO-851848	paid	2026-08-20 07:50:07.167232+00
c551a1a7-7ece-4c2d-8ed7-9c7726984616	94c0e455-28b3-4049-bf43-95db7da3423c	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	Poju Oyekan	poyekan@gmail.com	+1 415 555 0198	14 Mercer Lane, Brooklyn, NY 11201	10	349.99	3499.90	demo-card-ending-4242	DEMO-171038	paid	2026-08-20 13:41:19.448771+00
975c5f37-81bc-4514-bbb2-3e1d81ea13e3	d0df34cc-1cb4-4417-9362-007837070548	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	Naomi Cole	naomi.cole@example.com	+1 415 555 0198	14 Mercer Lane, Brooklyn, NY 11201	12	289.99	3479.88	demo-card-ending-4242	DEMO-947433	paid	2026-08-20 13:42:29.759865+00
70178e9c-4e50-403e-a074-05388b1d1dd3	94c0e455-28b3-4049-bf43-95db7da3423c	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	Naomi Cole	naomi.cole@example.com	+1 415 555 0198	14 Mercer Lane, Brooklyn, NY 11201	3	349.99	1049.97	demo-card-ending-4242	DEMO-765547	paid	2026-09-08 08:12:14.205739+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: catalog; Owner: postgres
--

COPY catalog.products (id, store_id, owner_id, category_id, name, slug, description, price, currency, stock_quantity, sku, status, featured_image_url, created_at, updated_at, sold_quantity) FROM stdin;
fbbe4551-b078-4d3c-a650-919fc8372660	4a236822-b5fb-4b3c-be2b-2ab378cad0a6	102a67e7-e3a2-41c7-bfd9-2eb957610432	62b82329-d54c-417e-a3f3-835ad5883d30	Metro Laptop Sleeve	metro-laptop-sleeve	Structured laptop sleeve with a soft-lined interior, magnetic closure, and enough padding for everyday commuting.	92.00	USD	16	HPS-SLV-205	published	https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:06.613484+00	2026-08-20 07:50:06.613484+00	0
f76c7721-8995-4f6a-96e6-7c5aa29c3921	297cd655-3df0-4bc1-b0ca-0831236d3563	1d726894-f85a-4c83-8a6a-618643bfcd0d	e8a41780-e49b-4a9b-864b-83c39be70d12	Glass Monitor Riser	glass-monitor-riser	Tempered glass riser with brushed aluminum legs, sized for a monitor, keyboard storage, and a cleaner desktop profile.	124.00	USD	11	CAC-RIS-310	published	https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:07.020388+00	2026-08-20 07:50:07.020388+00	0
8530dda3-b0b9-4bf0-aa06-54749e86cac9	297cd655-3df0-4bc1-b0ca-0831236d3563	1d726894-f85a-4c83-8a6a-618643bfcd0d	e8a41780-e49b-4a9b-864b-83c39be70d12	Fjord Task Lamp	fjord-task-lamp	Dimmable table lamp with a warm tone, compact footprint, and gentle light spread for late evening work sessions.	89.50	USD	14	CAC-LMP-118	published	https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:07.094322+00	2026-08-20 07:50:07.094322+00	0
74b5fe79-a0be-4bb1-9d6f-3d600a4898d7	50004c27-b0ca-4b82-add3-e3f1576f64c6	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	9104ee59-95a4-4cdd-9833-53d8123b18d3	Slate Wireless Headphones	slate-wireless-headphones	Balanced over-ear headphones with a matte finish, wireless playback, and comfort tuned for long editing sessions.	149.99	USD	10	NAC-WH-001	published	https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:06.788923+00	2026-08-20 07:50:07.126169+00	2
e0d248f8-c329-4aaa-8a9c-b82e7affed43	50004c27-b0ca-4b82-add3-e3f1576f64c6	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	9104ee59-95a4-4cdd-9833-53d8123b18d3	Northline Desk Speaker Pair	northline-desk-speaker-pair	Compact stereo desk speakers with a warm low end, clean vocal detail, and simple front-facing controls.	219.00	USD	7	NAC-SP-220	published	https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:06.829867+00	2026-08-20 07:50:07.149832+00	1
fd974b11-98a9-429d-ba8d-2607c95ee1bb	4a236822-b5fb-4b3c-be2b-2ab378cad0a6	102a67e7-e3a2-41c7-bfd9-2eb957610432	62b82329-d54c-417e-a3f3-835ad5883d30	Canvas Tech Organizer	canvas-tech-organizer	Waxed canvas organizer with elastic loops, zipped mesh, and room for chargers, earbuds, and small notebooks.	68.00	USD	17	HPS-ORG-101	published	https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80	2026-08-20 07:50:06.566774+00	2026-08-20 07:50:07.167232+00	3
38e2a404-3f0f-4d65-a771-f386ded77bff	4a236822-b5fb-4b3c-be2b-2ab378cad0a6	102a67e7-e3a2-41c7-bfd9-2eb957610432	62b82329-d54c-417e-a3f3-835ad5883d30	Large-capacity Nylon Backpack	backpack	Large-capacity Nylon Backpack with Stylish Letter Pattern - a Versatile School and Travel Bag for Boys and Girls, Featuring a Casual and Durable Design, Multiple Compartments, Adjustable Shoulder Straps, and the Perfect Back-to-school Gift	180.99	USD	18	SLATE-WH-001	published	/media/935a48eb-a3fb-4fe5-8ee7-1fe7142a04ca.png	2026-08-20 09:05:31.563491+00	2026-08-20 09:05:31.563491+00	0
b095a279-f9db-4d0f-a193-786e09ae6a44	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	9dc50212-83a8-4b0f-9b08-4804271636d6	NAVIFORCE Men's Luxury Sports Quartz Watch	watch	NAVIFORCE Men's Luxury Sports Quartz Watch - Waterproof, Genuine Leather Strap, Dual Display with Date	549.99	USD	22	OLATE-WH-001	published	/media/737d6eb6-998f-4455-967a-12a9a821505c.png	2026-08-20 12:09:51.576665+00	2026-08-20 12:09:51.576665+00	0
d0df34cc-1cb4-4417-9362-007837070548	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	9104ee59-95a4-4cdd-9833-53d8123b18d3	ZEALOT S32 10W Wireless Speaker	sound	ZEALOT S32 10W Wireless Speaker, Portable with Deep Bass, TWS Dual Pairing Support, 1800mAh Battery, 8-Hour Gaming Time with Loud Stereo Sound	289.99	USD	18	iLATE-WH-001	published	/media/49f38524-1e4a-4a9f-b56d-25dc1a4b6c57.png	2026-08-20 12:13:47.539647+00	2026-08-20 13:42:29.759865+00	12
94c0e455-28b3-4049-bf43-95db7da3423c	0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	62b82329-d54c-417e-a3f3-835ad5883d30	Soft-Soled Comfort Shoes	shoes	Men'S Shoes: Non-Slip, Healthcare, Soft-Soled Comfort Shoes with Arch Support	349.99	USD	5	SHOE-YH-001	published	/media/4afbad36-5e1c-4ab6-8168-6cb4a3363561.png	2026-08-20 12:04:01.058174+00	2026-09-08 08:12:14.205739+00	13
\.


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: identity; Owner: postgres
--

COPY identity.auth_sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, revoked_at, last_used_at, created_at, updated_at) FROM stdin;
fdcc2d7f-ac99-41fe-a1be-bd1c6d3fe821	102a67e7-e3a2-41c7-bfd9-2eb957610432	66f87b24e3d780315e0076545fe89e1f91096c45b58e0f88eacb477bb24b8a69	python-httpx/0.28.1	172.18.0.9	2026-09-03 07:50:06.268225+00	\N	\N	2026-08-20 07:50:06.267517+00	2026-08-20 07:50:06.267517+00
f9b97fa8-6a34-45d4-82ac-cfaf88e628d7	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	a68ef239925d2fe302b2b9b1471493b604b20efc641c82ac4ab21924555c0f6f	python-httpx/0.28.1	172.18.0.9	2026-09-03 07:50:06.643264+00	\N	\N	2026-08-20 07:50:06.642775+00	2026-08-20 07:50:06.642775+00
d7b496f2-4e1a-440a-a3c3-d53284014d5f	1d726894-f85a-4c83-8a6a-618643bfcd0d	e3050172e52ab1a5f6b269c5058f49ac68d72584b762033f986ff8093354aeb1	python-httpx/0.28.1	172.18.0.9	2026-09-03 07:50:06.86349+00	\N	\N	2026-08-20 07:50:06.863031+00	2026-08-20 07:50:06.863031+00
2c2fbd3d-f568-48e0-9f42-f400383788db	102a67e7-e3a2-41c7-bfd9-2eb957610432	e0279f138cea956a15d24f4b5ef048be442c5bfc6d4da5c078330e9ad92c615f	python-httpx/0.28.1	172.18.0.9	2026-09-03 08:26:51.461025+00	\N	\N	2026-08-20 08:26:51.45437+00	2026-08-20 08:26:51.45437+00
ffa3395d-139d-43b1-9bca-e0add3d2f204	102a67e7-e3a2-41c7-bfd9-2eb957610432	88045f862da1bed7a84be6edc764a9ac22ff2631dfa5658412c2875bede5e139	python-httpx/0.28.1	172.18.0.9	2026-09-03 08:58:00.404025+00	\N	\N	2026-08-20 08:58:00.393003+00	2026-08-20 08:58:00.393003+00
7adb0f06-731d-49aa-b0a9-a6551b14c99d	de2be636-34c1-4fbe-a606-bfee6676bd40	fef1b4c31d51ab1ebe34f8dfee18c205c2c98b35046bfc4edcd0b812cda8210d	python-httpx/0.28.1	172.18.0.9	2026-09-03 11:57:34.323322+00	\N	\N	2026-08-20 11:57:34.322317+00	2026-08-20 11:57:34.322317+00
90fb31cc-fb62-4817-92f2-f6aa10eb230e	de2be636-34c1-4fbe-a606-bfee6676bd40	50f12c48fa072c0f474355ffc64014492044b9cc5409b80903397063fddc836c	python-httpx/0.28.1	172.18.0.9	2026-09-03 13:38:09.445954+00	\N	\N	2026-08-20 13:38:09.435012+00	2026-08-20 13:38:09.435012+00
7e696cc6-93ef-4220-b379-e8cd42d40678	de2be636-34c1-4fbe-a606-bfee6676bd40	4aca966c10cca85fc2a256e99e290ec964dcd4aea30add987d7b155229535f85	python-httpx/0.28.1	172.18.0.9	2026-09-03 13:43:02.166672+00	\N	\N	2026-08-20 13:43:02.155801+00	2026-08-20 13:43:02.155801+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: identity; Owner: postgres
--

COPY identity.users (id, full_name, email, password_hash, role, is_active, created_at, updated_at) FROM stdin;
102a67e7-e3a2-41c7-bfd9-2eb957610432	Maya Brooks	maya.brooks@demo-netiks.com	$pbkdf2-sha256$29000$NKaU8l5rTclZK2Us5dz7fw$lMOhB4bkPLVTmtlU2UyFUatDV8PhOlgA9HeH7ZcwUTk	vendor	t	2026-08-20 07:50:06.249543+00	2026-08-20 07:50:06.249543+00
4ba4cebe-85a3-417a-8d2e-d8d7943bc512	Julian Mercer	julian.mercer@demo-netiks.com	$pbkdf2-sha256$29000$Xcu5VypljBGCEKLUutf6nw$/sTm.ySe2g6PBBYBDS0MfEN54ItFMDs6nZ.et0WX3K8	vendor	t	2026-08-20 07:50:06.632882+00	2026-08-20 07:50:06.632882+00
1d726894-f85a-4c83-8a6a-618643bfcd0d	Elena Park	elena.park@demo-netiks.com	$pbkdf2-sha256$29000$T8nZ27vX.t.bs3auFUJoLQ$1VLD1JwXckfQi34XPVsWqIz0BUpJj3Id0gRB6H5kQRo	vendor	t	2026-08-20 07:50:06.852748+00	2026-08-20 07:50:06.852748+00
de2be636-34c1-4fbe-a606-bfee6676bd40	Olaoluwa Afolami	laoluafolami@outlook.com	$pbkdf2-sha256$29000$QchZS.ndO4dwTgnhHCNESA$vB7I/Slao80UN2W6.5xAzUMFdJXBEVgSBBa1jeMHbZs	vendor	t	2026-08-20 11:57:34.288913+00	2026-08-20 11:57:34.288913+00
\.


--
-- Data for Name: catalog_alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.catalog_alembic_version (version_num) FROM stdin;
20260616_0002
\.


--
-- Data for Name: identity_alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.identity_alembic_version (version_num) FROM stdin;
20260614_0002
\.


--
-- Data for Name: vendor_alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_alembic_version (version_num) FROM stdin;
20260614_0001
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: vendor; Owner: postgres
--

COPY vendor.stores (id, owner_id, name, slug, description, contact_email, phone, logo_url, banner_url, status, created_at, updated_at) FROM stdin;
4a236822-b5fb-4b3c-be2b-2ab378cad0a6	102a67e7-e3a2-41c7-bfd9-2eb957610432	Harbor & Pine Supply	harbor-and-pine-supply	Thoughtful travel accessories and everyday carry pieces for people who move between meetings, airports, and focused work blocks.	maya.brooks@demo-netiks.com	\N	\N	\N	active	2026-08-20 07:50:06.364786+00	2026-08-20 07:50:06.364786+00
50004c27-b0ca-4b82-add3-e3f1576f64c6	4ba4cebe-85a3-417a-8d2e-d8d7943bc512	Northline Audio Co.	northline-audio-co	Compact audio gear for desks, studios, and quiet work corners where clean sound matters as much as the setup.	julian.mercer@demo-netiks.com	\N	\N	\N	active	2026-08-20 07:50:06.671555+00	2026-08-20 07:50:06.671555+00
297cd655-3df0-4bc1-b0ca-0831236d3563	1d726894-f85a-4c83-8a6a-618643bfcd0d	Cedar & Circuit	cedar-and-circuit	Desk objects that make a workspace calmer and more intentional, from risers to lighting and ceramic accents.	elena.park@demo-netiks.com	\N	\N	\N	active	2026-08-20 07:50:06.899297+00	2026-08-20 07:50:06.899297+00
0dd3153d-9ca5-457d-8371-dcc42398708e	de2be636-34c1-4fbe-a606-bfee6676bd40	WestBrook Supplies	westbrooksupplies	Thoughtful desk tools, travel tech, and calm everyday accessories for focused work.	laoluafolami@outlook.com	\N	\N	\N	active	2026-08-20 11:58:41.565914+00	2026-08-20 11:58:41.565914+00
\.


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: orders orders_payment_reference_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_payment_reference_key UNIQUE (payment_reference);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.auth_sessions
    ADD CONSTRAINT auth_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: catalog_alembic_version catalog_alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_alembic_version
    ADD CONSTRAINT catalog_alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: identity_alembic_version identity_alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identity_alembic_version
    ADD CONSTRAINT identity_alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: vendor_alembic_version vendor_alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_alembic_version
    ADD CONSTRAINT vendor_alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: vendor; Owner: postgres
--

ALTER TABLE ONLY vendor.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_slug_key; Type: CONSTRAINT; Schema: vendor; Owner: postgres
--

ALTER TABLE ONLY vendor.stores
    ADD CONSTRAINT stores_slug_key UNIQUE (slug);


--
-- Name: ix_catalog_categories_slug; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_categories_slug ON catalog.categories USING btree (slug);


--
-- Name: ix_catalog_orders_buyer_email; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_orders_buyer_email ON catalog.orders USING btree (buyer_email);


--
-- Name: ix_catalog_orders_owner_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_orders_owner_id ON catalog.orders USING btree (owner_id);


--
-- Name: ix_catalog_orders_payment_reference; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_orders_payment_reference ON catalog.orders USING btree (payment_reference);


--
-- Name: ix_catalog_orders_product_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_orders_product_id ON catalog.orders USING btree (product_id);


--
-- Name: ix_catalog_orders_store_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_orders_store_id ON catalog.orders USING btree (store_id);


--
-- Name: ix_catalog_products_category_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_products_category_id ON catalog.products USING btree (category_id);


--
-- Name: ix_catalog_products_owner_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_products_owner_id ON catalog.products USING btree (owner_id);


--
-- Name: ix_catalog_products_slug; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_products_slug ON catalog.products USING btree (slug);


--
-- Name: ix_catalog_products_store_id; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ix_catalog_products_store_id ON catalog.products USING btree (store_id);


--
-- Name: ix_identity_auth_sessions_refresh_token_hash; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX ix_identity_auth_sessions_refresh_token_hash ON identity.auth_sessions USING btree (refresh_token_hash);


--
-- Name: ix_identity_auth_sessions_user_id; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX ix_identity_auth_sessions_user_id ON identity.auth_sessions USING btree (user_id);


--
-- Name: ix_identity_users_email; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX ix_identity_users_email ON identity.users USING btree (email);


--
-- Name: ix_vendor_stores_owner_id; Type: INDEX; Schema: vendor; Owner: postgres
--

CREATE INDEX ix_vendor_stores_owner_id ON vendor.stores USING btree (owner_id);


--
-- Name: ix_vendor_stores_slug; Type: INDEX; Schema: vendor; Owner: postgres
--

CREATE INDEX ix_vendor_stores_slug ON vendor.stores USING btree (slug);


--
-- Name: orders orders_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE RESTRICT;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE RESTRICT;


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 1JmUeKssA7UPLlhwoj3rsVdNDH94XdavyWjS0xgncwziwsCVrAs4tVgrrcmZSvo

