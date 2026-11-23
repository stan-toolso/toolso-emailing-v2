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
| `ad` de format `dem` (base **ads**, secret `toolso-ads`) dont le groupe cible le produit (`ad_group.support_settings.productIds`, vide = tous) et dont publicité, groupe et campagne sont actifs (`--include-disabled` sinon) | `Content` type `marketing` | HTML = `ad.content.html` rendu avec `ad.*`, `ad_group.*`, `campaign.*`, `product.*` résolus, encadré par `settings.header` / `settings.footer` de la version active du contenu media de type `dem` ; sujet, nom d'expéditeur et pré-en-tête de la publicité. `Content.category` = annonceur ; `config.media` garde campagne, groupe, partenaire et paramètre de clic partenaire. Comme media, le paramètre du partenaire (`ts_click_field=ts_click_value`) est ajouté à chaque lien, sauf s'il dépend de l'identifiant de clic `tsclid` (généré par la redirection media, sans équivalent v2) |
| `ad` de format `dem_template` | `Content` type `marketing` | gabarit = version active du contenu media de type `dem_template` du produit, rendu avec `ad.*` (contenu, `ad.link` = destination, `ad.image.src` absolu via `emailingRedirectionLink`) ; sans gabarit actif, la publicité est comptée `noTemplate` |

Rendu partiel (`renderKeeping`) : seules les variables propres à media sont résolues ; `{{contact.*}}`, `{{unsubLink}}`,
`{{mirrorLink}}`, `{{pixelConsentLink}}`, `{{#now}}…{{/now}}`, `{{urlEncode}}`, `{{genderFormat}}`, `{{dobFormat}}` sont
conservés tels quels (même vocabulaire côté v2) et rendus à l'envoi. `contact.fields.x` devient `contact.customFields.x` ;
`{{tsclid}}` / `__tsclid__` et les crochets `[ad …]` (publicités natives insérées par media, pas d'équivalent) sont retirés ;
`{{dateFormat}}` et `{{contact.age}}` n'existent pas en v2 (balises listées dans `keptTags` du résumé, à corriger dans l'UI) ;
une section inversée `{{^x}}` sur une variable conservée est rendue vide (`droppedInverted`).

**Liens de désabonnement** : après la bascule, tout lien de désabonnement d'un mail v2 doit désabonner **dans la v2**.
Les liens de désabonnement media écrits en dur (pied de page DEM du produit, publicité, gabarit `dem_template`) sont
remplacés à la conversion par `{{{unsubLink}}}` (`replaceMediaUnsubLinks`, compteur `unsubLinksReplaced`) :

| Lien reconnu | Exemple |
|---|---|
| lien marqué `toolso:unsub` (media : le clic suivi enregistre le désabonnement puis redirige) | `<a href="…" toolso:no-track toolso:unsub>` |
| `settings.emailingUnsubUrl` du produit et ce qui commence par elle (media y ajoute `?kid=…&el=…`) | `https://news.<site>/desinscription` |
| domaine `unsubscribe.<domaine du produit>` (page de désabonnement du site) | `https://unsubscribe.<site>/?email={{contact.email}}` |
| `<domaine du produit ou sous-domaine>/<slug>` des pages media de gabarit `unsub` du produit (défaut `desinscription`) | `https://news.<site>/desinscription` |

Domaines du produit : `product.main_domain`, hôtes de `siteUrl`, `emailingRedirectionLink`, `emailingUnsubUrl` (sans
`www.`, plus leur domaine parent pour les deux derniers). Les attributs sont gardés : `toolso:unsub` a le même sens en v2
(clic suivi = désabonnement immédiat, puis page `/unsub` de l'instance). Les variables media `{{unsubLink}}` /
`{{pixelConsentLink}}` portent le même nom en v2 et sont conservées. Ne sont **pas** touchés : les liens d'opposition au
pixel de suivi hébergés par le client sur un autre domaine (ex. outil d'opt-out du client), à revoir à la main si besoin.

Idempotent : `Content.config.media = { type: article | dem, id, product }` ; un contenu déjà repris est ignoré, sauf les
DEM avec `--update-dems` (version par défaut recalculée : HTML, objet, préentête, expéditeur ; contenus
`config.media.manual` exclus) — à utiliser après une correction de la conversion. Les DEM tenues par l'import des campagnes
(§ 7) sont mises à jour d'elles-mêmes au passage suivant (empreinte changée). Les
contenus sont créés inactifs, sans planification, sans partenaire v2 ni revenus.

```bash
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --contents --ads-secret toolso-ads --dry-run
# hors AWS : le secret pointe vers le proxy RDS (VPC seulement) → lire la base ads sur son cluster
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --product <produit> --contents --ads-secret toolso-ads-readonly \
  --ads-host <cluster de la base ads> --dry-run
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
   désabonnement des gabarits (media : `settings.emailingUnsubUrl` → v2 : `/unsub` de l'instance ; les liens en dur des
   DEM reprises sont convertis, § 1 bis). Vérifier qu'aucun lien de désabonnement media ne reste dans les contenus :
   ```sql
   SELECT count(*) AS dem_media,
          count(*) FILTER (WHERE v.html ~* 'https?://(unsubscribe\.|[^"''[:space:]]*/desinscription)') AS lien_media_desabonnement,
          count(*) FILTER (WHERE v.html LIKE '%{{{unsubLink}}}%') AS avec_unsublink
     FROM "Content" c JOIN "ContentVersion" v ON v."contentId" = c.id
    WHERE c.config->'media' IS NOT NULL;   -- attendu : lien_media_desabonnement = 0
   ```
   En-tête `List-Unsubscribe` des envois v2 : `<mailto:…>` (réglage `unsubscribeMailto`, expéditeur ou routeur) et
   `<lien /unsub de l'instance>`, avec `List-Unsubscribe-Post: List-Unsubscribe=One-Click` ; tout POST sur ce lien
   (corps `List-Unsubscribe=One-Click`, urlencoded ou multipart) désabonne dans la v2.
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

## 5 bis. Transition : synchronisation des statuts media → v2 (`--sync-statuses`, job `sync_media_statuses`)

Après la bascule d'un produit, les liens de désabonnement des mails **déjà envoyés par media**, les retours de l'ESP
(plaintes, hard bounces) et parfois de nouvelles inscriptions arrivent encore dans la base media. La reprise relancée
n'ajoute que les nouveaux e-mails ; la synchronisation, elle, rejoue les changements dans l'instance v2. À garder active
**au moins 60 jours** après la dernière bascule de l'instance.

Ce qui est relu à chaque passage (produits de `MEDIA_PRODUCTS`, base media en lecture seule) :

| Source media | Effet dans la v2 |
|---|---|
| `contact_history` `emailing_unsub` / `complaint` / `hard_bounce` / `contact_bounce` (id > curseur, plus recouvrement par date) | `ContactEvent` du même type |
| `email` : drapeaux `unsubcribed`, `complainted`, `hard_bounced` des envois des 60 derniers jours modifiés depuis le dernier passage | `ContactEvent` (filet de sécurité : media écrit normalement aussi l'historique) |
| `contact.email_status` `unsub` / `complaint` / `hard_bounce` modifié | événement « garanti » s'il manque (même règle que la reprise) |
| `contact.email_status = blacklisted` | `Contact.status = blacklisted` |
| `blacklisted_contact` (globale) modifiée | `BlacklistedContact` |
| `inscription` d'un contact déjà présent dans la v2 | `ContactInscription` (réinscription : le contact redevient envoyable si son désabonnement est antérieur) |
| contacts media d'id > curseur | reprise standard (`migrateFromMedia`), désactivable par `MEDIA_STATUS_SYNC_NEW_CONTACTS=0` quand le relais d'API est actif |

Puis le statut des contacts touchés est **recalculé tout de suite** (`ContactStatusService`, comme le worker) : un contact
désabonné dans media n'est plus envoyable dès la fin du passage.

Règles :

- rapprochement par **e-mail** normalisé (un contact créé dans la v2 par une autre voie est aussi mis à jour) ;
- **idempotent** : chaque événement rejoué porte `details.media = { product, kind, key, date }` (clé `h:<id historique>`,
  `e:<id envoi>:<type>`, `s:<id contact>:<statut>`) ; un événement avec la même clé, ou du même type à moins de 10 minutes
  (événements créés par la reprise), n'est pas recréé ; relancer un passage ou un rattrapage complet (`--full`) ne crée
  rien en double ;
- un désabonnement **antérieur à la dernière inscription v2** est ignoré (compté `stale`) : il ne compte pas dans la v2 ;
- date de l'événement : la date media, sauf si elle précède le dernier événement déjà intégré au cache `ContactEvents` du
  contact (le recalcul ne relit que les événements postérieurs) : l'événement est alors daté du passage, la date media
  restant dans `details.media.date` et `requestDate` ;
- **curseur** : ligne `Settings` `mediaStatusSync` (JSON : par produit dernier id d'historique et de contact lus, date du
  dernier passage, compteurs du dernier passage). Les lectures par date reprennent 60 minutes avant le dernier passage.
  Sans curseur (premier passage), tout est relu : rattrapage complet, sans doublon.

Activation (une fois par instance, après la bascule) :

```bash
# source et produits : écrits par bin/set-media-source.sh (MEDIA_DATABASE_URL, MEDIA_PRODUCTS dans le .env de l'instance)
sudo bin/migrate-from-media.sh <uid> --sync-statuses --dry-run     # simulation (transaction annulée, curseur inchangé)
sudo bin/migrate-from-media.sh <uid> --sync-statuses               # premier passage (rattrapage complet)
sudo sh -c 'echo MEDIA_STATUS_SYNC=1 >> instances/<uid>/.env' && sudo bin/compose.sh <uid> up -d scheduler
sudo bin/migrate-from-media.sh <uid> --sync-statuses --show-cursor  # dernier passage et ses compteurs
```

Le job `sync_media_statuses` tourne alors **toutes les heures** (minute 25, `config/schedules.json`) dans le scheduler de
l'instance, sous le verrou du scheduler (le script manuel prend le même verrou). Désactivation : retirer
`MEDIA_STATUS_SYNC` (ou `JOBS_DISABLED=sync_media_statuses`) puis redémarrer le scheduler. Sans `MEDIA_STATUS_SYNC=1`, le job
ne fait rien.

Mesures (produit pilote, ~7 200 contacts, 6 400 événements d'historique, base media distante) : rattrapage complet 2 min 20
(0 doublon après la reprise), passage incrémental 3,5 s.

## 6. Référence rapide

| Commande | Rôle |
|---|---|
| `deploy/bin/migrate-from-media.sh <uid> [--media-instance <nom> \| --source-url <url>] --list-products` | produits de la base media |
| `… --product <p>[,<p>…] --inventory` | volumes repris / non repris, expéditeurs, paramètres |
| `… --product <p>[,<p>…] --dry-run [--since-days N]` | conversion simulée (transaction annulée) |
| `… --product <p>[,<p>…] [--dump] [--since-days N] [--skip-blacklist] [--skip-messages] [--batch-size N] [--yes]` | reprise |
| `apps/api/scripts/migrate-from-media.js` (dans le conteneur `api`, `MEDIA_DATABASE_URL` dans l'environnement) | conversion proprement dite |
| `apps/api/src/migration/mediaDatabase.js` | règles de correspondance ; test `test/integration/migrate-from-media.test.js` (schéma media de test : `test/fixtures/media-schema.sql`) |
| `… --product <p> --contents [--articles-only \| --dems-only] [--ads-secret toolso-ads [--ads-host <cluster>] \| --ads-url <url>] [--all-articles] [--include-disabled] [--since-days N] [--dry-run]` | articles et DEM → contenus v2 inactifs |
| `apps/api/scripts/migrate-contents-from-media.js` (`MEDIA_DATABASE_URL`, `ADS_DATABASE_URL`) | conversion des contenus |
| `… --api-keys [--dry-run]` | clés d'API media seules (API de transition, § 8) ; aussi reprises par la reprise des contacts sauf `--skip-api-keys` |
| `apps/api/src/api/mediaCompat/` | API de transition `/v1/…` ; test `test/integration/media-compat.test.js` |
| `deploy/media-relay/0001-relais-v2.patch` | relais côté media (réglage produit `v2RelayUrl`) |
| `apps/api/src/migration/mediaContents.js` | gabarit d'article, rendu partiel Mustache, règles DEM ; test `test/integration/migrate-contents-from-media.test.js` (schéma ads de test : `test/fixtures/ads-schema.sql`) |
| `… --sync-statuses [--product <p>] [--dry-run] [--full] [--no-new-contacts] [--no-recalculate] [--email-flags-days N] [--show-cursor]` | transition : statuts, blacklist, réinscriptions, nouveaux contacts media → v2 (job `sync_media_statuses` si `MEDIA_STATUS_SYNC=1`) |
| `apps/api/src/migration/mediaStatusSync.js`, `apps/api/scripts/sync-statuses-from-media.js` | synchronisation ; test `test/integration/sync-statuses-from-media.test.js` |
| `deploy/bin/set-media-source.sh <uid> --media-instance <nom> --product <p> [--ads-secret <s> [--ads-host <h>]] \| --check \| --unset` | source media de l'instance (`MEDIA_DATABASE_URL`, `MEDIA_PRODUCTS`, `ADS_DATABASE_URL` dans son `.env`), § 7 |
| job `media_campaigns_import` (scheduler, toutes les heures) ; `apps/api/scripts/import-media-campaigns.js [--dry-run]` | import régulier des campagnes DEM (§ 7) ; règles dans `apps/api/src/migration/mediaCampaigns.js`, test `test/integration/media-campaigns-import.test.js` |
| `deploy/bin/media-compare.sh --media-instance <nom> --migrated <uid>=<p>[@date] --witness <p> [--weeks N] [--format csv\|json\|table] [--revenue ca.csv]` | tableau comparatif hebdomadaire base migrée / témoins (§ 9) |
| `deploy/bin/sync-statuses-to-media.sh <uid> --since <bascule> [--inscriptions-csv \| --apply --write-secret <s>]` | retour arrière : désabonnements, plaintes, bounces v2 → media (§ 9) ; `apps/api/src/migration/mediaReverseSync.js`, test `test/integration/sync-statuses-to-media.test.js` |

## 7. Transition : import régulier des campagnes (DEM) et source media de l'instance

Tant que les campagnes sont gérées dans toolso-ads (base commune à tous les sites media), chaque instance issue d'un
produit media importe elle-même les DEM disponibles pour ce produit : les sites basculés et les sites témoins restés sur
media reçoivent ainsi les mêmes campagnes.

### Source media de l'instance

Convention commune aux jobs de transition (import des campagnes, synchronisation des statuts…) : trois variables dans le
`.env` de l'instance (mode 600), écrites par `set-media-source.sh` à partir des secrets AWS (rien n'est affiché) :

| Variable | Contenu |
|---|---|
| `MEDIA_DATABASE_URL` | base media (secret `media-<instance media>`), `?sslmode=no-verify` par défaut |
| `MEDIA_PRODUCTS` | uid(s) du ou des produits media de l'instance, séparés par des virgules |
| `ADS_DATABASE_URL` | base ads (secret `--ads-secret`, hôte remplacé par `--ads-host` : le proxy RDS n'est joignable que dans le VPC AWS) |

```bash
sudo bin/set-media-source.sh <uid> --media-instance <nom> --product <produit> \
  --ads-secret toolso-ads-readonly --ads-host <cluster de la base ads>   # recrée les conteneurs de l'instance
sudo bin/set-media-source.sh <uid> --check     # hôtes et produits (identifiants masqués)
sudo bin/set-media-source.sh <uid> --unset     # fin de la transition : les jobs ne font plus rien
```

Les connexions sont ouvertes en lecture seule (`default_transaction_read_only`), mais le compte du secret peut avoir plus
de droits : préférer un compte réellement en lecture seule quand il existe.

### Job `media_campaigns_import`

Planifié **toutes les heures** (`25 * * * *` UTC, `config/schedules.json`) dans le scheduler de l'instance (verrou
PostgreSQL, journal de l'instance, configuration de son `.env`), plutôt qu'un cron hôte : rien à installer par instance,
et il ne fait rien sans les trois variables ci-dessus. Horaire plutôt que quotidien : media choisit la publicité au moment
de chaque envoi ; une campagne coupée dans toolso-ads est ainsi désactivée dans l'heure. Désactivation : `JOBS_DISABLED=media_campaigns_import`.

À chaque passage, pour les publicités `dem` / `dem_template` qui ciblent un produit de `MEDIA_PRODUCTS` :

| Publicité dans media | Contenu v2 |
|---|---|
| disponible (règles ci-dessous), jamais importée | `Content` marketing **actif** créé (HTML converti comme en § 1 bis) |
| disponible, déjà importée (ou reprise par `--contents`) | mis à jour si le HTML, l'objet, les filtres… ont changé ; réactivé (sauf contenu suspendu par la v2) |
| plus disponible (désactivée, archivée, terminée, hors période, plafond quotidien atteint…) | désactivé |
| supprimée ou ne ciblant plus le produit | désactivé |
| jamais disponible | pas importée |

Règles de disponibilité reprises de media (`AdService` filtre `available` + `bestAd`, heure de Paris) : publicité
`enabled` et de statut `active` / `learning` / `limited` ; groupe `enabled` et `active` ; campagne `enabled` ; annonceur du
client (paramètre media `advertisers`) ou campagne `public` d'un autre annonceur ; période `distribution_settings.period`
(MM-JJ, à cheval sur l'année possible), `start` et `end` ; `ad_group.support_settings.productIds` ; `ad.support_settings.slotNames` ;
`daily_capping_requests` comparé à `ad_group.today_requests`.

Traduits en réglages v2 : jours de diffusion (`distribution_settings.days`) → filtre de contenu `daysInclude` ; audience du
groupe (`audience_settings` : âge, sexe, préfixes de code postal, date de naissance, ESP, champ du contact, arbres `and`)
→ `Content.config.filters` ; `weight` → `config.weight` ; `end` → `Content.endDate`. Sans équivalent : plafonds totaux
(`capping_requests`, `capping_impressions`, `capping_clicks`) et plafonds quotidiens de clics / impressions, calculés par
media sur ses statistiques (compte rendu `unsupported`, la publicité reste active) ; audience non traduisible (`or` à
plusieurs branches, `email_status`) : contenu créé **inactif** (`unavailable.audience`), à régler à la main.

**utm** : media ne calcule pas les utm, ils sont écrits dans les liens des publicités :
`utm_campaign={{campaign.id}}-{{ad_group.id}}-{{ad.id}}&utm_source={{product.uid}}` (relevé du 23/11/2026 : 558 liens sur
676 portant un `utm_campaign`, les autres sont des valeurs fixes de l'annonceur). La conversion les résout avec les mêmes
valeurs que media à l'envoi (identifiants media, uid du produit media), par exemple `utm_campaign=3631-59640-59838&utm_source=<produit>`.
Ce que media ajoute à la redirection d'un clic (`tsclid`) n'est pas reproduit.

**Désabonnement** : les liens de désabonnement media du pied de page DEM et des publicités deviennent `{{{unsubLink}}}`
(règles du § 1 bis, compteur `unsubLinksReplaced` : liens remplacés dans les contenus créés ou mis à jour par le passage).
Recette du 23/11/2026 sur l'instance pilote : 57 DEM mises à jour, 114 liens remplacés (2 par DEM, pied de page du produit),
plus aucun lien media de désabonnement (requête du § 4).

Mode d'envoi (`MEDIA_CAMPAIGNS_SCHEDULES` dans le `.env`) : `none` (défaut) = **sans envoi**, les contenus sont créés et
tenus à jour mais rattachés à aucune planification (avant la bascule) ; `<id>[,<id>…]` = chaque contenu importé est
rattaché à ces planifications v2 (créneaux DEM), à régler le jour de la bascule.

Garde-fous : un contenu dont `config.media.manual` vaut `true` n'est plus touché par l'import (repris à la main) ;
`config.media.sync` garde l'empreinte, la date, la disponibilité et les raisons du dernier passage.

```bash
# simulation (transaction annulée), compte rendu JSON avec quelques contenus et leurs utm
bin/compose.sh <uid> run --rm --no-deps api node scripts/import-media-campaigns.js --dry-run --samples 10
# passage réel immédiat (sinon : à la prochaine heure)
bin/compose.sh <uid> run --rm --no-deps api node scripts/run-job.js media_campaigns_import
bin/psql.sh <uid> -c "SELECT \"isActive\", count(*) FROM \"Content\" WHERE config->'media'->>'type' = 'dem' GROUP BY 1"
```

## 8. API de transition (appels faits à media pour un produit basculé)

Après la bascule, les sites et le CRM du client continuent un temps d'appeler l'API REST de media
(`https://<api media>/v1/…`, servie par l'EC2 de l'instance media : nginx → Express `backend/bin/api.js`, port 4000 ; ni
API Gateway ni ALB). Deux pièces, à combiner :

1. **Dans la v2, une API compatible** (`apps/api/src/api/mediaCompat/`) : mêmes routes, mêmes clés, mêmes réponses JSON
   que media, sous `https://<serveur>/api/<uid>/v1/…` (ou à la racine d'un domaine de suivi `https://lk.<domaine>/v1/…`).
   Pour l'appelant, seule la base de l'URL change.
2. **Dans media, un relais** (`deploy/media-relay/0001-relais-v2.patch`, middleware `relayToV2` placé après les filtres
   d'accès) : pour un produit dont le réglage `v2RelayUrl` est renseigné (`https://<serveur>/api/<uid>`), l'appel est
   transmis tel quel à `<v2RelayUrl>/v1/…` et la réponse de la v2 renvoyée. Réglage vide : comportement inchangé. Si la v2
   ne répond pas (10 s, `V2_RELAY_TIMEOUT_MS`, ou erreur 5xx), media traite l'appel comme avant ; la synchronisation des
   statuts media → v2 et la reprise relancée rattrapent alors ces appels.

Le relais permet de basculer sans attendre le client ; la v2 compatible permet ensuite au client de changer d'URL à son
rythme et d'arrêter media. Le relais ne peut pas se faire devant media (pas de répartiteur, et les routes `/v1/source/…`
ne désignent le produit que par la clé de la source, parfois dans le corps).

| Route media (`/v1/…`) | Accès | Effet dans la v2 | Réponse (comme media) |
|---|---|---|---|
| `POST /:product_uid/contacts/` | clé `ApiKey` (en-tête `apikey` / `api-key`) | `InscriptionService` : contact créé ou mis à jour (champs connus → colonnes, autres champs et objet `fields` → `customFields`), inscription avec `collect_ip` / `collect_url`, source retrouvée par `source_name` (utm, sans casse) ou créée ; filtres v2 (ESP dangereux, motifs, blacklist) | `contact_accepted` + `contact` / `invalid_payload` / `inscription_refused` |
| `GET /:product_uid/contacts/check?email=` | clé | mêmes filtres, sans écriture | `inscription_acceptable` / `inscription_refused` |
| `GET /:product_uid/contacts/:email` | clé | lecture | contact au format media (`email_status` : `workable` → `active`, `removed` → `archived`) / `contact_not_found` |
| `DELETE /:product_uid/contacts/` (`{ email }`) | clé | `removeContactWithEmail` | `ok` / `contact_not_found` |
| `POST /:product_uid/unsubscriptions/` (`{ email, reason?, ip?, … }`) | clé | événement `unsub` (détails conservés) puis statut recalculé ; une nouvelle inscription l'annule, comme media | `ok` / `Contact not found` |
| `POST /:product_uid/contacts/pixel_tracking_consent` | clé | `pixelTrackingConsent` + historique | `pixel_tracking_consent_updated` |
| `POST /source/contacts/`, `GET /source/contacts/check` | clé de la source (en-tête ou corps `apikey`) | champs de la source (`apiFields` : obligatoires, validateurs, valeurs manuelles), inscription rattachée à la source | `contact_accepted` / `campaign_disabled` / `invalid_payload` / `no_api_key` / `invalid_api_key` |
| `GET /contacts/export?fields=&unique_fields=&filter=` | clé | CSV de tous les contacts de l'instance ; colonnes media et `fields.<champ>` | CSV ; filtre autre que `product_id` / `productIds` refusé (`unsupported_filter`, 400) |
| `POST /ad/click/conversion` | aucun | **transférée à media** (`MEDIA_CONVERSION_URL`) : les conversions portent sur les publicités media (`tsclid`, base ads commune) | réponse de media ; sans URL : 503 |

Produits servis : `MEDIA_PRODUCT_UIDS` (défaut `RESOURCE_UID`) ; un autre `:product_uid` répond `unauthorized`.
Les clés `ApiKey` de media (table `api_key`, globale à la base media) sont reprises avec `permissions.scope = media-compat` :
elles n'ouvrent que `/v1/…` (ni le GraphQL ni les routes v2). Les clés des sources sont reprises avec les sources.

Écarts connus : les filtres d'inscription media `crmInscriptionDefaultFilters` (réglage produit) et `settings.filters`
d'une source (dédoublonnage, plafonds, plages horaires) ne sont pas appliqués (la v2 applique ses propres filtres et
`apiSettings.filters` de la source) ; `source_id` (id media) n'est pas reconnu (utiliser `source_name`) ; `id` du contact
renvoyé = id v2 ; `collect_user_agent` / `collect_site_name` ne sont pas conservés ; un jeton d'utilisateur media n'est pas
accepté (les clés d'API, si).

Mise en service pour un produit (à J, étape « relais d'API ») :

```bash
# 1. sur le serveur de bases : clés d'API media dans l'instance (avant d'activer le relais), puis vérification
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --api-keys --dry-run
sudo bin/migrate-from-media.sh <uid> --media-instance <nom> --api-keys
#    .env de l'instance : MEDIA_PRODUCT_UIDS=<produit media> si différent de l'uid,
#    MEDIA_CONVERSION_URL=https://<api media>/v1/ad/click/conversion ; redémarrer l'api
curl -s -H "apikey: <clé>" "https://<serveur>/api/<uid>/v1/<produit>/contacts/check?email=test@exemple.com"
# 2. dans media (patch déployé une fois) : réglage du produit, pris en compte sous 5 minutes (cache des réglages)
#    INSERT INTO settings (name, value, product_id, created_at, updated_at)
#      VALUES ('v2RelayUrl', 'https://<serveur>/api/<uid>', <id produit>, now(), now());
# retour arrière : DELETE FROM settings WHERE name = 'v2RelayUrl' AND product_id = <id produit>;
```

Suivi : journal de l'api v2 (`MediaCompat`), journal media (`relayToV2` : appels relayés, replis locaux).

## 9. Suivi d'un produit basculé et retour arrière

Pendant la période d'observation (3 à 4 semaines), un produit basculé est comparé chaque semaine à des produits **témoins**
restés sur media, et peut revenir sur media tant qu'il n'a pas été validé. Le produit n'est jamais supprimé de media pendant
cette période.

### Tableau comparatif hebdomadaire (`media-compare.sh`)

```bash
sudo bin/media-compare.sh --media-instance <instance media> \
  --migrated <uid>=<produit>[@AAAA-MM-JJ] [--migrated …] --witness <produit témoin> [--witness …] \
  [--weeks 8] [--format csv|json|table] [--revenue ca.csv] [--output fichier]
```

Lecture seule des deux côtés (transaction en lecture seule imposée), quelques secondes. Une ligne par produit et par
semaine (lundi → dimanche, fuseau de la plateforme) :

| Colonne | Contenu |
|---|---|
| `role`, `instance`, `source` | `migrated` / `witness` ; instance v2 ; d'où viennent les chiffres : `media` (témoins, et produit migré avant sa bascule), `v2` (après), `media+v2` (semaine de la bascule, additionnés) |
| `sends`, `delivered`, `opens`, `clicks` | envois (hors BAT), délivrés, ouvertures et clics **uniques** par envoi |
| `unsubs`, `complaints`, `hard_bounces`, `soft_bounces` | désabonnements, plaintes, hard bounces (+ contact bounces) et soft bounces rattachés à ces envois |
| `open_rate`, `click_rate`, `click_to_open`, `unsub_rate`, `complaint_rate`, `hard_bounce_rate` | en % des envois (clics / ouvertures pour `click_to_open`) |
| `revenue`, `revenue_per_1000` | CA de la semaine fourni par le client (`--revenue`, CSV `produit,AAAA-MM-JJ (lundi),montant`), CA pour 1 000 envois ; vides sans fichier |

Les chiffres sont comptés **par semaine d'envoi** (cohorte) et à partir des mêmes drapeaux des deux côtés : table `email`
de media, table `ContactContent` de la v2 (un envoi par ligne, mêmes drapeaux ; la reprise n'y écrit rien, donc pas de
double compte). Date de bascule : `@AAAA-MM-JJ`, ou par défaut le premier envoi v2 de l'instance (les envois v2 antérieurs,
tests compris, sont exclus quand la date est donnée). Un produit migré sans envoi v2 est lu entièrement dans media.

### Synchronisation inverse v2 → media (`sync-statuses-to-media.sh`)

Pendant que la v2 sert le produit, les désabonnements, plaintes et bounces n'arrivent plus dans media. Avant de rendre le
produit à media, on les y reporte, comme media les aurait enregistrés lui-même :

| Événement v2 (depuis la bascule) | Dans media |
|---|---|
| `unsub` | `contact.email_status = unsub`, `contact_history` `emailing_unsub` |
| `complaint` | `email_status = complaint`, `emailing_complaint` |
| `hard_bounce`, `contact_bounce` | `email_status = hard_bounce`, `emailing_hard_bounce` / `emailing_contact_bounce` |

et, pour chaque contact modifié, suppression de ses envois programmés non partis (`email.done = false`), comme media.

- Seuls les événements **nés dans la v2** comptent : date ≥ `--since` (bascule), ni rejoués depuis media par la
  synchronisation media → v2 (`details.media`), ni repris (`details.origin = toolso-media`).
- Désabonnement antérieur à la dernière inscription v2 du contact (réinscription) : ignoré, comme dans le statut v2.
- Statut media jamais affaibli (`active`/`new`/`archived` < `unsub` < `hard_bounce` < `complaint` < `blacklisted`) : un contact
  déjà au moins aussi bloqué n'est pas touché ; le script est relançable sans doublon. Rapprochement par e-mail normalisé.
- `contact_history.details` = `{ origin: "toolso-emailing-v2", instance, v2EventId, previousStatus }` : les reports se
  retrouvent (et s'annulent au besoin) par `details->>'origin'`.
- Contacts **inscrits ou réinscrits dans la v2 depuis la bascule** : comptés dans le résumé (`inscriptions` : absents de media,
  bloqués dans media) et exportés par `--inscriptions-csv`, pour être réimportés par l'API d'inscription de media. Le script
  ne crée aucun contact dans media.

```bash
sudo bin/sync-statuses-to-media.sh <uid> --since <AAAA-MM-JJ[THH:MM]>               # simulation (défaut), lecture seule
sudo bin/sync-statuses-to-media.sh <uid> --since <date> --inscriptions-csv          # CSV (mode 600) dans BACKUP_DIR/media-migration/
sudo bin/sync-statuses-to-media.sh <uid> --since <date> --apply --write-secret <secret du compte limité>
```

Source de lecture : `MEDIA_DATABASE_URL` et `MEDIA_PRODUCTS` du `.env` de l'instance (§ 7), ou `--media-instance` /
`--product`. **Écriture** : jamais avec la source de lecture ni avec le compte administrateur `postgres` (refusé) ; il faut
un compte media limité, rangé dans un secret AWS (`host`, `port`, `database`, `username`, `password`) :

```sql
-- sur la base media, par un administrateur, avec l'accord du responsable de la plateforme
CREATE ROLE emailing_v2_rollback LOGIN PASSWORD '<généré, rangé dans le secret>';
GRANT CONNECT ON DATABASE <base> TO emailing_v2_rollback;
GRANT USAGE ON SCHEMA public TO emailing_v2_rollback;
GRANT SELECT ON product, contact, contact_history, email TO emailing_v2_rollback;
GRANT UPDATE (email_status, updated_at) ON contact TO emailing_v2_rollback;
GRANT INSERT ON contact_history TO emailing_v2_rollback;
GRANT USAGE ON SEQUENCE contact_history_id_seq TO emailing_v2_rollback;
GRANT DELETE ON email TO emailing_v2_rollback;
-- après le retour arrière : DROP ROLE emailing_v2_rollback; (et suppression du secret)
```

Le code est inclus dans l'image `api` ; sur une image plus ancienne, le script monte les fichiers du dépôt en lecture seule.

### Procédure de retour arrière (un produit)

À décider avec le client ; de préférence juste après un créneau, pour ne pas couper un envoi en cours. Au jour J de la
bascule, avoir noté la liste des créneaux media actifs du produit
(`SELECT id, name FROM email_slot WHERE product_id = <id> AND is_active`), qu'on réactive à l'identique.

1. **Arrêter les envois v2** : dans l'interface de l'instance, désactiver toutes les planifications (ou
   `bin/psql.sh <uid> -c 'UPDATE "Schedule" SET "isActive" = false WHERE "isActive"'` en notant les ids) ; vérifier qu'aucun
   envoi n'est en cours (`bin/compose.sh <uid> run --rm --no-deps api node scripts/queue-status.js`).
2. **Rendre l'API à media** : retirer le relais du produit dans media
   (`DELETE FROM settings WHERE name = 'v2RelayUrl' AND product_id = <id>` ; § 8). Les inscriptions et
   désabonnements arrivent de nouveau dans media.
3. **Arrêter les jobs de transition** de l'instance : `MEDIA_STATUS_SYNC=0` et
   `JOBS_DISABLED=media_campaigns_import,sync_media_statuses` dans son `.env`, puis `bin/compose.sh <uid> up -d scheduler`.
4. **Simulation** de la synchronisation inverse : `sync-statuses-to-media.sh <uid> --since <bascule>` ; relire les volumes
   (`byStatus`, `samples`, `alreadyBlocked`, `inscriptions`).
5. **Report réel** : `--apply --write-secret <compte limité>`, puis relancer la simulation : `toUpdate` doit valoir 0.
6. **Inscriptions v2** : `--inscriptions-csv`, puis réimport dans media par son API d'inscription (même source, mêmes
   champs) ; contrôle : `inscriptions.missingInMedia` à 0 à la simulation suivante.
7. **Réactiver les créneaux media** relevés à J (`UPDATE email_slot SET is_active = true WHERE id IN (…)`, ou interface
   media), puis vérifier le premier envoi (volumes comparables à la semaine précédant la bascule, `media-compare.sh`).
8. Conserver l'instance v2 telle quelle (analyse) ; la supprimer plus tard avec `bin/remove-database.sh <uid>`. Retirer le
   compte d'écriture limité.

Contrôles après retour arrière (SQL media) : pas de contact du produit `active`/`new` parmi les désabonnés v2 (relancer la
simulation : `toUpdate = 0`) ; `SELECT count(*) FROM contact_history WHERE details->>'origin' = 'toolso-emailing-v2'`
égal à `updated` du report.
