# Migration d'une base depuis toolso-media

Reprise des contacts d'une base **toolso-media** (https://gitlab.com/toolso/toolso-media : plateforme médias / newsletters,
PostgreSQL sur RDS Aurora eu-west-3, une base par client — secrets `media-<nom>`, liste des noms dans
`backend/build/update_model_all.js` du dépôt media — et dans chaque base un `product` par média) vers une instance autonome
(`docs/04-deploiement.md`). Relevé du schéma media au 2026-11-09 (`backend/build/schemas/0-0-2.sql` … `0-0-67.sql`).

Un produit media ≈ une base emailing : on reprend un produit (ou plusieurs produits fusionnés, les doublons d'e-mail
étant ignorés) dans **une** instance (`emailing_<uid>`), créée au préalable avec `bin/add-database.sh`. L'instance peut
être vide (cas nominal) ou déjà contenir des contacts : ceux dont l'e-mail existe déjà ne sont pas touchés.

Contrairement à la reprise depuis AWS (`docs/05`), il ne s'agit pas d'une copie de base mais d'une **conversion** :
les deux modèles diffèrent (media : `contact.product_id`, `email_status`, historique dans `contact_history` et `email` ;
v2 : `Contact.status` recalculé à partir des `ContactEvent`). La conversion est faite par
`apps/api/scripts/migrate-from-media.js`, lancé dans le conteneur `api` de l'instance par
`deploy/bin/migrate-from-media.sh`, en lecture seule sur la base media.

## 1. Ce qui est repris

| media (source) | v2 (cible) | Règles |
|---|---|---|
| `product` | choix `--product <uid>[,<uid>…]` | obligatoire si la base media a plusieurs produits |
| `contact_source` du produit | `ContactSource` | retrouvée par **nom** si elle existe déjà ; `utm_source`, `api_key` (clé conservée telle quelle, sauf conflit → vide), `api_enabled`, `api_fields`, `api_settings` |
| `contact` du produit | `Contact` | e-mail normalisé (minuscules, validé ; invalides ignorés) ; `firstname`, `lastname`, `street`, `zipcode`, `city`, `phone`, `gender` (→ `m`/`f`), `dob` (AAAA-MM-JJ sinon vide) ; `fields` + `country` → `customFields`, plus `customFields.media = { product, id }` (provenance) ; `esp`, `md5`/`sha1`/`sha256` recalculés par la v2 ; `segment` aléatoire 1-100 ; `stats` = `stats.emailing` (compteurs vie entière, mêmes clés que les types d'événement v2) ; `activityScore` = `scores.emailing.activityScore` ; `pixel_tracking_consent` ; dates de création/modification conservées |
| `email_status` | `status` | `new`→`new`, `active`→`workable` (ou `new` si aucune ouverture/clic/proxy dans les stats : non activé), `unsub`, `complaint`, `hard_bounce` → identiques, `contact_bounce`→`archived` (`statusDetail.reason`), `archived`, `blacklisted` ; `activated` = ouverture, clic ou proxy_loaded > 0 ; `nextStatusUpdateDate` vide → le job `scan_contact_to_update_status` repasse sur chaque contact repris |
| `inscription` | `ContactInscription` | `inscripted_at`, `collect_ip`, `source_name`, `collect_url`, `fields`, `is_new`→`isFirst`, `isFirstToday` recalculé dans le fuseau de l'instance (`TZ`), `activated` (stats de l'inscription, ou activation du contact pour la dernière), `stats.emailing` ; `lastInscriptionId` / `lastSourceId` du contact = la plus récente. **Un contact sans inscription reçoit une inscription synthétique** (`sourceName = toolso-media`, date = création du contact) : la v2 supprime les contacts sans inscription |
| `email` (envois des `--since-days` derniers jours, défaut 90) | `ContactEvent` | un `request` par envoi (`sent_at`, `messageId`), puis selon les drapeaux : `open` (`opened_at`), `click`, `proxy_loaded`, `soft_bounce`, `contact_bounce`, `content_bounce` (`bounceSubType=ContentRejected`), `hard_bounce`, `unsub`, `complaint` ; `inscriptionId`/`sourceId` = inscription en cours à la date de l'événement ; `isUnique` pour open/click/proxy_loaded |
| `contact_history` (`emailing_unsub`, `emailing_complaint`, `emailing_hard_bounce`, `emailing_contact_bounce`, toute la période) | `ContactEvent` | dédoublonné à la minute avec les événements issus de `email` |
| statut `unsub` / `complaint` / `hard_bounce` sans événement correspondant | `ContactEvent` **garanti** | créé à la date `last_status_update` (sinon `updated_at`) ; pour `unsub`, daté juste après la dernière inscription si nécessaire — c'est la règle v2 : un `unsub` ne compte que s'il est postérieur à la dernière inscription |
| — | `ContactEvents` (cache) | prérempli avec les événements créés : les stats vie entière reprises ne sont pas recomptées par la v2 |
| `blacklisted_contact` (global à la base media) | `BlacklistedContact` | par empreintes `md5`/`sha1`/`sha256` (media ne stocke pas l'e-mail) ; `history.blacklists` conservé ou créé (`origin: toolso-media`) ; fusionné avec une entrée existante |
| `contact_message` | `ContactMessage` | `received_at`, expéditeur, destinataire, sujet → titre, texte (ou body/html), extrait ; `pending` non envoyé → `pending`, sinon `done` |

Après la reprise, la v2 recalcule statut et score de chaque contact à partir des événements, exactement comme pour un
contact natif. Le test `apps/api/test/integration/migrate-from-media.test.js` vérifie que les statuts `unsub`,
`hard_bounce` et `workable` repris sont conservés par `ContactStatusService` et que les stats ne sont pas doublées.

Les contacts non envoyables (`unsub`, `complaint`, `hard_bounce`, `archived`, `blacklisted`) ont
`lastWorkableStatusDate` = date de la reprise : la v2 les purge `contact_days_in_archive` jours plus tard, comme un
contact natif entré dans ce statut le jour de la bascule.

## 1 bis. Contenus : articles et DEM → `Content` (option `--contents`)

Les mails media sont construits à l'envoi (gabarit Mustache + meilleurs articles + publicités) ; la v2 envoie des
`Content` fixes. La reprise convertit donc chaque article et chaque DEM en un contenu v2 **inactif**, à activer et à
rattacher à une planification dans l'UI.

| media | v2 | Règles |
|---|---|---|
| `article` du produit (`status = published`, `distribution_settings.emailing_enabled` ≠ false ; `--all-articles` pour tout, `--since-days N` pour les récents) | `Content` type `newsletter` + `ContentVersion` rattachée au `ContentTemplate` « Article – <produit> » | Le gabarit est créé une fois par produit (HTML générique : en-tête, image, titre, résumé, bouton « Lire l'article », pied avec `{{{unsubLink}}}` et `{{{mirrorLink}}}`) : le modifier dans l'UI change tous les articles repris. Les données sont dans `templateVariables` : `content.title`, `content.subject` (`email_subject` sinon titre), `content.preview_text`, `content.link` (`link`, champ personnalisé `articleLinkCustomField`, `url`, sinon `siteUrl/slug`), `content.cta_url`, `content.short_resume` / `long_resume` (texte, 100 / 200 caractères comme media), `content.description`, `content.body` (HTML complet de l'article), `content.image_url` / `image_w400` (`imgBaseUrl` ou `siteUrl` + `/imgs/max|400x400/<slug>.webp`, sinon `featured_image.url`), `content.categories`, `content.customs`, `content.site_url`, `content.product_name`. `Content.category` = première catégorie media |
| `ad` de format `dem` (base **ads**, secret `toolso-ads`) dont le groupe cible le produit (`ad_group.support_settings.productIds`, vide = tous) et dont publicité, groupe et campagne sont actifs (`--include-disabled` sinon) | `Content` type `marketing` | HTML = `ad.content.html` rendu avec `ad.*`, `ad_group.*`, `campaign.*`, `product.*` résolus, encadré par `settings.header` / `settings.footer` de la version active du contenu media de type `dem` ; sujet, nom d'expéditeur et pré-en-tête de la publicité. `Content.category` = annonceur ; `config.media` garde campagne, groupe, partenaire et paramètre de clic partenaire (`ts_click_field`, non appliqué) |
| `ad` de format `dem_template` | `Content` type `marketing` | gabarit = version active du contenu media de type `dem_template` du produit, rendu avec `ad.*` (contenu, `ad.link` = destination, `ad.image.src` absolu via `emailingRedirectionLink`) ; sans gabarit actif, la publicité est comptée `noTemplate` |

Rendu partiel (`renderKeeping`) : seules les variables propres à media sont résolues ; `{{contact.*}}`, `{{unsubLink}}`,
`{{mirrorLink}}`, `{{pixelConsentLink}}`, `{{#now}}…{{/now}}`, `{{urlEncode}}`, `{{genderFormat}}`, `{{dobFormat}}` sont
conservés tels quels (même vocabulaire côté v2) et rendus à l'envoi. `contact.fields.x` devient `contact.customFields.x` ;
`{{tsclid}}` / `__tsclid__` et les crochets `[ad …]` (publicités natives insérées par media, pas d'équivalent) sont retirés ;
`{{dateFormat}}` et `{{contact.age}}` n'existent pas en v2 (balises listées dans `keptTags` du résumé, à corriger dans l'UI) ;
une section inversée `{{^x}}` sur une variable conservée est rendue vide (`droppedInverted`).

Idempotent : `Content.config.media = { type: article | dem, id, product }` ; un contenu déjà repris est ignoré. Les
contenus sont créés inactifs, sans planification, sans partenaire v2 ni revenus.

```bash
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --contents --ads-secret toolso-ads --dry-run
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --contents --ads-secret toolso-ads
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --contents --articles-only --since-days 180
```

Après la reprise, dans l'UI : relire le gabarit « Article – <produit> » (Gabarits), vérifier quelques contenus (aperçu, BAT),
puis activer et planifier. Les images restent hébergées sur le site media (`imgBaseUrl`) et les liens pointent vers lui.

## 2. Ce qui n'est pas repris (listé par `--inventory`)

- **Expéditeurs** (`email_sender` : nom, adresse, `router`, `config` avec identifiants ESP) et **configurations d'envoi**
  (`email_sending_config`) : à recréer dans l'UI (Routeurs, Expéditeurs, Configurations d'envoi). Les identifiants ESP sont
  chiffrés différemment des deux côtés et les routeurs media (Brevo, SES, routeur Toolso) n'ont pas les mêmes options.
- **Newsletters dynamiques, slots, publicités natives** (`email_content` hors DEM, `email_slot*`, `[ad …]`, bannières) : le
  modèle éditorial media (newsletter composée à l'envoi des meilleurs articles et publicités) n'a pas d'équivalent dans
  les `Content`/`Schedule` de la v2. Les articles et les DEM sont repris un par un en contenus fixes (§ 1 bis).
- **Stats agrégées** (`email_stats`, `contacts_stats`, `inscription_stats`, `contact_stats`, `*_stats`) : les stats v2 se
  reconstruisent à partir des événements (`update_contact_event_stats_aggregates`, `update_contacts_stats`…) ; l'historique
  agrégé media reste consultable dans media.
- **Utilisateurs** (`user`) et **clés d'API d'administration** (`api_key`) : les comptes de l'instance sont dans l'access
  (`bin/add-database.sh --admin`, UI Accès).
- **Paramètres** (`settings`) : seuls `timezone`, `emailingUnsubUrl`, `espsMaxNewRequests`, `emailingRedirectionLink`,
  `clientUid`, `clientName`, `siteUrl` sont affichés pour information.
- `email` au-delà de la fenêtre `--since-days`, `contact_history` hors statut (ouvertures, clics, pages vues),
  `contact_session`, `lead`, `form*`, `event`, `history`.

## 3. Prérequis

- Instance créée et démarrée : `sudo bin/add-database.sh <uid> "<nom>" "<entreprise>" [domaines de tracking…]` (schéma à
  jour : `sync-model` est lancé par ce script). `TZ` du `.env` de l'instance = fuseau du produit media (`settings.timezone`,
  généralement `Europe/Paris`) : il sert au calcul de `isFirstToday`.
- Accès à la base media depuis les conteneurs du serveur (groupe de sécurité du cluster RDS `toolso-media-1`, eu-west-3 :
  autoriser l'IP publique du serveur sur 5432). Deux façons de donner la connexion :
  - `--media-instance <nom>` : le script lit le secret AWS `media-<nom>` (celui que lit `DatabaseClient.js` de media), avec
    le CLI `aws` et `jq` sur l'hôte, un profil ayant `secretsmanager:GetSecretValue`, région `MEDIA_AWS_REGION` (défaut
    `eu-west-3`) ;
  - `--source-url postgres://utilisateur:motdepasse@hôte:5432/base` (ou variable `MEDIA_DATABASE_URL` exportée), par
    exemple pour une copie locale de la base media.
  La connexion est chiffrée ; par défaut le certificat n'est pas vérifié (`--ssl-mode no-verify`, équivalent de
  `PGSSLMODE=require`) : passer `--ssl-mode require` si la CA RDS est installée dans l'image `api`.
- Un compte media en **lecture seule** suffit (le script force `default_transaction_read_only`).

## 4. Déroulement

### Inventaire et simulation (sans écriture, relançables)

```bash
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --list-products
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --inventory
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --dry-run
```

`--inventory` affiche les volumes repris / non repris, les contacts par statut, les expéditeurs à recréer et les paramètres
utiles. `--dry-run` exécute toute la conversion dans une transaction annulée et affiche les compteurs qu'aurait produits la
reprise (contacts créés / déjà présents / e-mails invalides / doublons, inscriptions synthétisées, événements garantis…).

### Reprise

Media continue de fonctionner pendant la reprise (lecture seule côté media) ; on choisit en revanche le moment où les
**formulaires d'inscription et les envois** basculent, car tout ce qui arrive dans media après la lecture d'un contact n'est
pas repris. Ordre conseillé :

1. Côté media : désactiver les envois du produit (slots / configurations d'envoi inactifs) et, si possible, les formulaires
   (ou les faire pointer vers l'instance : voir étape 4).
2. Reprise, avec archive de la base media :

   ```bash
   sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --dump
   ```

   Le script affiche l'inventaire, demande confirmation, fait le `pg_dump -Fc` de la base media dans
   `BACKUP_DIR/media-migration/` (`--dump`, archive seulement : il n'est pas restauré), puis lance la conversion par lots de
   1 000 contacts (`--batch-size`), chaque lot dans une transaction. Journal dans `BACKUP_DIR/media-migration/migrate_<uid>_<date>.log`,
   résumé JSON en fin d'exécution. Ordre de grandeur : quelques milliers de contacts par minute, dominé par la lecture des
   envois récents (`email`, index `(contact_id, sent_at)`).
3. Vérifier :

   ```bash
   bin/psql.sh <uid> -c 'SELECT status, count(*) FROM "Contact" GROUP BY 1 ORDER BY 1'
   bin/psql.sh <uid> -c 'SELECT count(*) FROM "ContactInscription"'
   bin/psql.sh <uid> -c 'SELECT type, count(*) FROM "ContactEvent" GROUP BY 1 ORDER BY 1'
   bin/psql.sh <uid> -c 'SELECT count(*) FROM "Contact" WHERE "customFields"->'"'"'media'"'"'->>'"'"'product'"'"' = '"'"'<produit>'"'"''
   ```

   Les totaux par statut doivent correspondre à l'inventaire (aux e-mails invalides et doublons près : lignes `invalidEmail`,
   `duplicates`, `existing` du résumé). Le job `scan_contact_to_update_status` (scheduler) recalcule ensuite statut et score
   de chaque contact repris (`nextStatusUpdateDate` vide) ; pour forcer un premier passage :
   `bin/compose.sh <uid> run --rm --no-deps api node scripts/run-job.js scan_contact_to_update_status`.
4. Côté instance : recréer les expéditeurs et routeurs (identifiants ESP), les configurations d'envoi, les contenus et
   planifications ; régler le domaine de tracking (`TRACKING_HOSTS`, DNS, `bin/tls.sh issue-tracking`), l'URL de
   désabonnement des gabarits (media : `settings.emailingUnsubUrl` → v2 : `/unsub` de l'instance).
5. Basculer les inscriptions : les sources reprises gardent leur `api_key` ; les formulaires et l'API d'inscription du site
   pointent désormais sur `https://<hôte>/api/<uid>/…` (voir `docs/04-deploiement.md`). Les inscriptions arrivées dans media
   entre la reprise et la bascule peuvent être rattrapées en relançant la reprise : seuls les **nouveaux** e-mails sont
   ajoutés (les contacts déjà repris ne sont pas mis à jour).

### Relance et retour arrière

- La reprise est relançable à l'identique : un contact déjà présent (même e-mail) est ignoré avec ses inscriptions,
  événements et messages ; les sources sont retrouvées par nom ; la blacklist est fusionnée (l'historique est ré-ajouté à
  chaque passage).
- Pour annuler une reprise dans une instance **vide avant la reprise** : `sudo bin/remove-database.sh <uid>` puis
  `bin/add-database.sh`. Dans une instance déjà peuplée, supprimer les contacts repris par provenance :

  ```sql
  DELETE FROM "Contact" WHERE "customFields"->'media'->>'product' = '<produit>';
  -- ContactEvent, ContactEvents, ContactInscription, ContactMessage suivent par cascade ou par contactId orphelin
  ```

  (les `ContactSource` et `BlacklistedContact` créés sont à retirer à la main si besoin). Media n'a pas été modifié.

## 5. Risques et points d'attention

- **Statuts dérivés des événements** : la v2 ne stocke pas le statut comme une donnée de référence ; elle le recalcule.
  C'est pourquoi un événement `unsub`/`complaint`/`hard_bounce` est toujours créé quand media porte ce statut (ligne
  `events.guaranteed` du résumé). Un contact `unsub` dans media dont la dernière inscription est postérieure au
  désabonnement reçoit un `unsub` daté juste après l'inscription : il reste désabonné (media le considérait désabonné).
- **Activation et archivage** : la v2 archive un contact non activé après `contact_max_days_to_activate` jours, et un
  contact sans activité depuis `contact_max_inactive_days`. Les contacts `active` media sans ouverture/clic/proxy dans
  `stats.emailing` arrivent en `new` non activés ; ceux dont la dernière activité est ancienne seront archivés au premier
  recalcul, comme ils l'auraient été dans la v2. Régler ces paramètres (UI Paramètres) avant la reprise si l'on veut
  être plus tolérant le temps de la transition.
- **Fenêtre des envois** : 90 jours par défaut (fenêtre de score de la v2 : 8 semaines ; cache des événements :
  `max(contact_max_inactive_days, 90)` jours). `--since-days 0` ne reprend que les événements de statut (reprise plus
  rapide, scores repartant de la valeur reprise).
- **ESP** : recalculé par la v2 (listes de domaines légèrement différentes : media connaît `protonmail` et `email_fr`,
  la v2 `aol`).
- **Doublons** : un même e-mail présent dans plusieurs produits repris n'est créé qu'une fois (premier produit dans l'ordre
  de `--product`, plus petit id) ; le statut retenu est celui de cette occurrence. Vérifier l'ordre si un produit a des
  désabonnements que l'autre n'a pas.
- **Secret du README media** : le dépôt toolso-media contient un jeton GitLab en clair (`README.md`, `backend/NEW_SERVER.md`) ;
  il n'est pas utilisé ici et doit être révoqué (voir la tâche sécurité du projet).

## 6. Référence rapide

| Commande | Rôle |
|---|---|
| `deploy/bin/migrate-from-media.sh <uid> [--media-instance <nom> \| --source-url <url>] --list-products` | produits de la base media |
| `… --product <p>[,<p>…] --inventory` | volumes repris / non repris, expéditeurs, paramètres |
| `… --product <p>[,<p>…] --dry-run [--since-days N]` | conversion simulée (transaction annulée) |
| `… --product <p>[,<p>…] [--dump] [--since-days N] [--skip-blacklist] [--skip-messages] [--batch-size N] [--yes]` | reprise |
| `apps/api/scripts/migrate-from-media.js` (dans le conteneur `api`, `MEDIA_DATABASE_URL` dans l'environnement) | conversion proprement dite |
| `apps/api/src/migration/mediaDatabase.js` | règles de correspondance ; test `test/integration/migrate-from-media.test.js` (schéma media de test : `test/fixtures/media-schema.sql`) |
| `… --product <p> --contents [--articles-only \| --dems-only] [--ads-secret toolso-ads \| --ads-url <url>] [--all-articles] [--include-disabled] [--since-days N] [--dry-run]` | articles et DEM → contenus v2 inactifs |
| `apps/api/scripts/migrate-contents-from-media.js` (`MEDIA_DATABASE_URL`, `ADS_DATABASE_URL`) | conversion des contenus |
| `apps/api/src/migration/mediaContents.js` | gabarit d'article, rendu partiel Mustache, règles DEM ; test `test/integration/migrate-contents-from-media.test.js` (schéma ads de test : `test/fixtures/ads-schema.sql`) |
