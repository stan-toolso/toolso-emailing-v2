-- Sous-ensemble du schéma toolso-media (backend/build/schemas/0-0-2.sql … 0-0-67.sql, relevé le 2026-11-09) :
-- les tables lues par src/migration/mediaDatabase.js, avec leurs colonnes utiles. Sert aux tests d'intégration.
CREATE TABLE product (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uid character varying(255),
    name character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    website_hosts jsonb,
    main_domain character varying(255),
    disabled boolean,
    client_uid character varying(255)
);

CREATE TABLE contact (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email character varying(255),
    firstname character varying(255),
    lastname character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    product_id integer,
    fields jsonb,
    md5 character varying(255),
    sha1 character varying(255),
    sha256 character varying(255),
    last_inscription_id integer,
    email_status character varying(255),
    stats jsonb,
    scores jsonb,
    next_email_schedule_at timestamp with time zone,
    esp character varying(255),
    gender character varying(3),
    dob character varying(10),
    zipcode character varying(10),
    city character varying(255),
    country character varying(255),
    phone character varying(255),
    street character varying(255),
    last_status_update timestamp with time zone,
    need_status_update boolean DEFAULT false,
    all_stats jsonb,
    pixel_tracking_consent boolean
);
CREATE INDEX contact_email ON contact (email);
CREATE INDEX contact_product_id_esp_email_status ON contact (product_id, esp, email_status);

CREATE TABLE inscription (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inscripted_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    contact_id integer,
    fields jsonb,
    source_name character varying(255),
    email character varying(255),
    product_id integer,
    is_new boolean,
    contact_source_id integer,
    collect_url character varying(500),
    collect_ip character varying(255),
    collect_user_agent character varying(500),
    collect_site_name character varying(255),
    stats jsonb
);
CREATE INDEX inscription_contact_id ON inscription (contact_id);

CREATE TABLE contact_source (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id integer,
    name character varying(255),
    utm_source character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    api_key character varying(255),
    api_enabled boolean,
    api_settings jsonb,
    api_fields jsonb,
    default_email_slot_id integer,
    settings jsonb,
    email_slot_ids jsonb
);

CREATE TABLE contact_history (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id integer,
    contact_id integer,
    type character varying(255),
    details jsonb,
    date timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);
CREATE INDEX contact_history_contact_id ON contact_history (contact_id);

CREATE TABLE email (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contact_id integer,
    product_id integer NOT NULL,
    message_id character varying(255),
    schedule_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    sent_at timestamp with time zone,
    sent boolean DEFAULT false,
    opened boolean,
    clicked boolean,
    delivered boolean,
    soft_bounced boolean,
    contact_bounced boolean,
    content_bounced boolean,
    hard_bounced boolean,
    unsubcribed boolean,
    complainted boolean,
    proxy_loaded boolean,
    sent_failed boolean,
    sent_details jsonb,
    sending_date timestamp with time zone,
    email_content_version_id integer,
    email_content_id integer,
    delivered_at timestamp with time zone,
    done boolean DEFAULT false,
    slot_id integer,
    esp character varying(255),
    opened_at timestamp with time zone,
    email_sender_id integer,
    email_sending_config_id integer,
    activity_score double precision,
    transactional boolean,
    contact_status character varying(15),
    is_bat boolean DEFAULT false
);
CREATE INDEX email_contact_sent_at ON email (contact_id, sent_at);

CREATE TABLE blacklisted_contact (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    md5 character varying(255),
    sha1 character varying(255),
    sha256 character varying(255),
    history jsonb
);

CREATE TABLE contact_message (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    contact_id integer,
    product_id integer NOT NULL,
    "from" character varying(255),
    "to" character varying(255),
    subject character varying(255),
    text text,
    body text,
    html text,
    received_at timestamp with time zone,
    status character varying(255),
    sent boolean DEFAULT false
);

CREATE TABLE settings (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text,
    value text,
    product_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE email_sender (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    email character varying(255),
    sender_name character varying(255),
    reply_to_name character varying(255),
    reply_to_email character varying(255),
    unsubscribe_mail_to character varying(255),
    product_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    router character varying(255),
    config jsonb
);

CREATE TABLE email_sending_config (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id integer,
    name character varying(255),
    config jsonb,
    history jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE email_content (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    archived boolean DEFAULT false,
    product_id integer NOT NULL,
    is_active boolean,
    stats jsonb,
    type character varying(255),
    settings jsonb
);

CREATE TABLE email_template (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    body text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    archived boolean,
    product_id integer NOT NULL,
    design jsonb
);

CREATE TABLE "user" (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email character varying(255),
    firstname character varying(255),
    lastname character varying(255),
    password character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    role character varying(255)
);

-- Contenus (articles, versions de contenu, images, catégories) : lus par src/migration/mediaContents.js
CREATE TABLE email_content_version (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    modified_at timestamp with time zone,
    stats jsonb,
    subject character varying(1000),
    preview_text character varying(255),
    variables jsonb,
    email_content_id integer,
    body text,
    is_active boolean DEFAULT true,
    archived boolean DEFAULT false,
    index integer,
    template_id integer,
    articles jsonb,
    design jsonb,
    ads jsonb,
    settings jsonb,
    sender_name character varying(100)
);

CREATE TABLE image (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug character varying(255),
    product_id integer,
    title character varying(255),
    width integer,
    height integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    alt character varying(255),
    content_type character varying(255),
    advertiser_id integer
);

CREATE TABLE article (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title character varying(255),
    slug character varying(255),
    content text,
    featured_image jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    status character varying(255) DEFAULT 'draft',
    product_id integer NOT NULL,
    modified_at timestamp with time zone,
    published_at timestamp with time zone,
    views integer DEFAULT 0,
    stats jsonb,
    description text,
    keywords jsonb,
    short_description character varying(500),
    content_blocks jsonb,
    main_editor character varying(255),
    featured_image_id integer,
    last_stats jsonb,
    customs jsonb,
    distribution_settings jsonb,
    sync_info jsonb,
    cta_url character varying(500),
    url character varying(255),
    email_subject character varying(255),
    article_template_id integer,
    link character varying(500)
);

CREATE TABLE category (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug character varying(255),
    name character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    content text,
    modified_at timestamp with time zone,
    category_type_id integer
);

CREATE TABLE category_article (
    category_id integer NOT NULL,
    article_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);
