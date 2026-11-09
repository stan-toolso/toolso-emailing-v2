#!/bin/bash
# Exécuté une seule fois par l'image postgres, à la création du volume de données :
# crée le rôle applicatif « access » (mot de passe ACCESS_DB_PASSWORD, env/postgres.env)
# et lui donne la base « access » créée par POSTGRES_DB.
set -euo pipefail
: "${ACCESS_DB_PASSWORD:?ACCESS_DB_PASSWORD manquant dans env/postgres.env}"
psql -v ON_ERROR_STOP=1 -v pw="$ACCESS_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'SQL'
  CREATE ROLE access LOGIN PASSWORD :'pw';
  ALTER DATABASE access OWNER TO access;
  ALTER SCHEMA public OWNER TO access;
SQL
