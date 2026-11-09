# Aperçu Skipper (toute la pile sur un port)

`.skipper/preview.json` lance `node tools/preview/start.js` après `node tools/preview/install.js`.

- `install.js` : `npm install` dans `apps/api`, `apps/access`, `apps/ui`, puis build statique de l'UI (CPU limités à 2 et
  `--max-old-space-size=700` pour tenir dans 1 Gio ; `PREVIEW_REBUILD_UI=1` pour forcer un nouveau build).
- `start.js` : PostgreSQL 17 embarqué (`.preview-data/pg`, conservé), schémas (`sync-model`), super-utilisateur
  `admin@example.com` / `preview-admin`, base `demo`, access sur 4000, api `ROLE=all` sur 4001, puis `server.js` sur `$PORT` :
  UI statique + proxy `/access/graphql` et `/api/demo/…` (même découpage que nginx en production).
- Aucun mail n'est envoyé (pas de `SMTP_URL`) ; les mails sont journalisés.

En local : `PORT=3000 node tools/preview/start.js` puis http://localhost:3000.
