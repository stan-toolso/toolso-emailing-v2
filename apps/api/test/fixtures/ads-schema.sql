-- Sous-ensemble de la base ads de toolso-media (secret toolso-ads ; modèles backend/services/storage/models/ads/*.js) :
-- les tables lues par src/migration/mediaContents.js pour les DEM. Types déduits des modèles (pas de schéma SQL dans le dépôt media).
CREATE TABLE advertiser (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    disabled boolean,
    public boolean,
    settings jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE partner (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    advertiser_id integer,
    ts_click_field character varying(255),
    ts_click_value character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE campaign (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    status character varying(255),
    enabled character varying(255),
    public boolean,
    advertiser_id integer,
    stats jsonb,
    archived boolean,
    last_stats jsonb,
    demographic_stats jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE ad_group (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    status character varying(255),
    enabled boolean,
    support character varying(255),
    advertiser_id integer,
    campaign_id integer,
    partner_id integer,
    category_id integer,
    stats jsonb,
    audience_settings jsonb,
    support_settings jsonb,
    distribution_settings jsonb,
    revenue_settings jsonb,
    public boolean,
    customs jsonb,
    last_stats jsonb,
    demographic_stats jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE ad (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    status character varying(255),
    enabled character varying(255),
    advertiser_id integer,
    ad_group_id integer,
    campaign_id integer,
    format character varying(255),
    content jsonb,
    destination jsonb,
    stats jsonb,
    public boolean,
    support_settings jsonb,
    last_stats jsonb,
    demographic_stats jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);
