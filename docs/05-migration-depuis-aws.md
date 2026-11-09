# Migration d'une base depuis AWS

Plan de bascule d'une base emailing de la plateforme AWS (compte 169229979870, région eu-west-1) vers
une instance autonome (`docs/04-deploiement.md`). Relevé AWS du 2026-11-09. Une base (`uid`) à la fois ;
les autres bases continuent de tourner sur AWS pendant ce temps.

Ce qui est repris : la base PostgreSQL (RDS → `emailing_<uid>`), la base access (utilisateurs,
entreprises, bases ; une seule fois, à la première migration), le secret JWT, les miroirs des mails
récents (DynamoDB + S3 → table `Mirror`, facultatif), les événements arrivés sur AWS pendant la bascule
(file SQS → file d'actions). Ce qui n'est pas repris : `toolso-emailing-tmp-files` (CSV temporaires,
exports), les journaux CloudWatch, la base `pg_toolso_usage` (facturation Toolso) et Campaign Manager.

## 1. Pourquoi une fenêtre d'interruption

La base RDS est copiée par `pg_dump` puis restaurée : tout ce qui est écrit dans RDS après le début
du dump est perdu pour l'instance. Il n'existe pas de « dump différentiel » PostgreSQL : rejouer les
écritures faites entre-temps supposerait une réplication logique (publication sur RDS, paramètre
`rds.logical_replication` + redémarrage de l'instance RDS, droits `rds_replication`, un abonnement
par table), ce qui n'est pas préparé sur ces instances et n'a pas été retenu. On **gèle donc la base
côté AWS** avant le dump et on la **rouvre sur l'instance** après la restauration.

Pendant le gel :

- plus d'envoi, plus de job planifié, plus d'accès UI/API à cette base (les autres bases ne sont pas
  touchées) ; les appels REST des sites du client (inscriptions par clé API, `/v2/…`) échouent ;
- les webhooks des ESP (routeur Toolso, Brevo, SES) et le tracking AWS (`lk.*` → `tracking_api` →
  file `track_events` → `track_events` → file `actions_<uid>`) continuent d'arriver sur AWS : la Lambda
  `<uid>_ses_webhook` les transforme en actions dans la file SQS `actions_<uid>`. Comme le
  consommateur `<uid>_action` est désactivé, ces actions **s'accumulent dans SQS** (rétention 4 jours)
  et sont **rejouées dans l'instance** après la bascule (`replay-sqs-actions.sh`). Rien n'est perdu de
  ce côté tant que le rejeu a lieu sous 4 jours.
- seules les écritures faites directement dans RDS par les Lambdas encore actives seraient perdues :
  c'est pour cela que `<uid>_api` et `<uid>_job` sont bloquées et que la file est vidée **avant** le dump.

Durée du gel = dump + restauration + `sync-model` + vérifications + rebranchement. Ordres de grandeur
(RDS db.t4g.xlarge → serveur dédié, réseau eu-west-1 → Paris, `pg_restore -j 2` à `-j 4`) :

| Taille de la base (RDS) | Dump `-Fc` | Restauration (données + index) | Gel total à prévoir |
|---|---|---|---|
| 10 Go | 10–20 min | 15–30 min | 1 h |
| 100 Go | 1–2 h | 1,5–3 h | 5 h (nuit) |
| 500 Go (une instance RDS de 1 To héberge plusieurs bases) | 5–8 h | 6–12 h | 24 h (week-end), ou découper par base |

Mesurer avant : `migrate-from-aws.sh <uid> --dump-only` s'exécute sans gel (le dump est cohérent, mais
périmé) et donne la durée réelle du dump et la taille du fichier ; la restauration de ce dump d'essai
avec `--restore-only` donne la durée de restauration. **Faire cette répétition** quelques jours avant.

## 2. Prérequis

Sur le serveur (une fois) :

- plateforme installée et en TLS (`install.sh`, `tls.sh issue`), DNS de `PUBLIC_HOST` en place ;
- CLI AWS v2 et `jq` : `snap install aws-cli --classic` (ou l'installeur officiel) et `apt-get install -y jq` ;
- un profil AWS **en lecture** pour l'opérateur (`aws configure --profile migration` puis
  `export AWS_PROFILE=migration`), avec au minimum : `secretsmanager:GetSecretValue` sur
  `pg_toolso_emailing_<uid>`, `pg_toolso_access`, `jwt_secret` ; `dynamodb:Scan` et `DescribeTable`
  sur `toolso-emailing-mirrors` ; `s3:GetObject` sur `toolso-emailing-mirror-body/*` ;
  `sqs:GetQueueUrl`, `GetQueueAttributes`, `ReceiveMessage`, `DeleteMessage` sur `actions_<uid>` ;
  `sts:GetCallerIdentity`. Les scripts ne font aucune écriture AWS en dehors de la suppression des
  messages SQS rejoués (`replay-sqs-actions.sh`, confirmée).
- accès réseau à RDS : les deux instances sont `PubliclyAccessible` dans le groupe de sécurité
  `sg-ea0927b6` ; **autoriser l'IP publique du serveur** sur le port 5432 (action humaine, compte AWS
  avec droits d'écriture) :
  `aws ec2 authorize-security-group-ingress --group-id sg-ea0927b6 --protocol tcp --port 5432 --cidr <IP>/32`
  (vérifier : `aws ec2 describe-security-groups --group-ids sg-ea0927b6`). Tester ensuite avec `--dump-only`.
- espace disque : `BACKUP_DIR/aws-migration/` reçoit les dumps (20 à 40 % de la taille de la base) ;
  `/var/lib/toolso-emailing/postgres` reçoit la base restaurée (≈ taille RDS).

Côté AWS, par une personne disposant des droits d'écriture (console ou CLI) : les commandes de gel et de
retour arrière du §4. Repérer d'avance l'UUID de la correspondance SQS → Lambda :
`aws lambda list-event-source-mappings --function-name <uid>_action --query 'EventSourceMappings[].UUID'`.

Côté client / DNS : baisser le TTL des domaines de tracking (`lk.*`) à 300 s au moins 24 h avant ;
prévenir que la base sera indisponible pendant la fenêtre et qu'aucun envoi ne doit y être programmé
(`SELECT id, name, "sendDate" FROM "Schedule" WHERE "sendDate" BETWEEN … ORDER BY 3` sur RDS ou dans l'UI).

## 3. Inventaire de la base à migrer

À remplir avant la bascule (lecture seule, aucun secret affiché) :

| Élément | Où le trouver |
|---|---|
| `uid`, instance RDS, nom de la base | `aws secretsmanager describe-secret --secret-id pg_toolso_emailing_<uid>` (métadonnées) ; `aws rds describe-db-instances` ; le script lit `host/port/database/username/password` dans le secret |
| Taille de la base | `migrate-from-aws.sh <uid> --dump-only` l'affiche ; ou `pg_database_size` via psql sur RDS |
| Routeurs de mail et leurs webhooks | UI → base → ESP ; ou après restauration le script affiche `MailRouter.config->>'webhookEndpoint'` |
| Domaines de tracking | réglage `trackingDomain` (Settings) et `Sender.trackingDomain` ; affichés par le script après restauration ; DNS actuel : CNAME vers l'API Gateway `y40bsa1lt9…` |
| Clés API utilisées par les sites du client | table `ApiKey` (migrée telle quelle) ; les sites appellent aujourd'hui `https://<api-gateway>/…` ou `https://api…toolso.io/<uid>/…` : relever l'URL exacte pour la remplacer |
| Utilisateurs de la base | access : `EmailingDatabase` → `Entreprise` → `UserEntreprise` ; repris avec `--access` |
| Volume de miroirs | `aws dynamodb describe-table --table-name toolso-emailing-mirrors` (33,6 M d'items, 9,2 Go toutes bases) ; une base active produit quelques centaines de milliers d'items sur 30 jours |

## 4. Déroulement

Notation : **[AWS]** = commande à lancer par une personne avec droits d'écriture sur le compte AWS ;
**[serveur]** = `sudo` sur le nouveau serveur, depuis le dépôt (`deploy/bin/…`).

### J-7 à J-1 : préparation (sans gel)

1. **[serveur]** `jwt-secret-from-aws.sh` — reprend `jwt_secret` dans `env/access.env` (et dans les
   instances existantes), sans l'afficher. **À faire avant toute configuration dans l'UI** : ce secret
   signe les jetons de connexion, chiffre `MailRouter.credentials` (identifiants des ESP) et certains
   réglages, et sert de clé aux liens de tracking et de désabonnement des mails déjà envoyés. Une base
   restaurée avec un autre secret ne peut plus envoyer (identifiants ESP illisibles) ni traiter les
   clics des anciens mails. Puis `compose.sh platform up -d access`.
2. **[serveur]** créer l'instance vide : `add-database.sh <uid> "<nom>" "<entreprise>" lk.<domaine>`
   avec `--skip-register` si la base access d'AWS va être reprise (la déclaration viendra avec elle),
   sans `--skip-register` sinon (la base est déclarée dans l'access local, l'administrateur invité par
   mail). Le certificat tracking échouera tant que le DNS pointe vers AWS : normal, `--no-tls` ou
   ignorer l'avertissement.
3. **[serveur]** répétition : `migrate-from-aws.sh <uid> --dump-only` (durée, taille, accès RDS), puis
   `migrate-from-aws.sh <uid> --restore-only <dump> --no-start` (durée de restauration, erreurs
   éventuelles de `pg_restore`, `sync-model`). L'instance reste arrêtée. Vérifier le login UI et la
   lecture des données avec `compose.sh <uid> up -d api` puis `stop` — **ne pas démarrer les workers ni le
   scheduler** sur une copie périmée (ils enverraient les schedules en attente).
4. Baisser le TTL DNS des `lk.*` ; fixer la fenêtre avec le client ; vérifier qu'aucun envoi n'est programmé dedans.

### Jour J : gel côté AWS (≈ 10 min) [AWS]

Les règles EventBridge sont **communes à toutes les bases** (une règle par job, cible `emailing_jobs`
qui invoque `<uid>_job` pour chaque base `enabled`) : ne pas les désactiver. Le gel se fait par base :

```bash
# 1. plus de jobs planifiés ni d'envois (les invocations asynchrones par emailing_jobs sont rejetées)
aws lambda put-function-concurrency --function-name <uid>_job --reserved-concurrent-executions 0
# 2. plus d'écriture par l'UI / l'API (API Gateway répond 5xx/429 : la base est indisponible)
aws lambda put-function-concurrency --function-name <uid>_api --reserved-concurrent-executions 0
# 3. laisser la file se vider : les actions déjà produites finissent de s'écrire dans RDS
watch -n 10 aws sqs get-queue-attributes --queue-url $(aws sqs get-queue-url --queue-name actions_<uid> --query QueueUrl --output text) \
   --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible
# 4. quand les deux compteurs sont à 0 : désactiver le consommateur ; les webhooks suivants s'accumulent dans SQS
aws lambda update-event-source-mapping --uuid <UUID de actions_<uid> → <uid>_action> --enabled false
```

Ne pas toucher à `<uid>_ses_webhook` (elle doit continuer à recevoir les événements des ESP) ni à
`huge_actions` (partagée ; un export en cours pour cette base finit dans S3 et sera simplement perdu).

### Jour J : copie des données [serveur]

```bash
sudo deploy/bin/migrate-from-aws.sh <uid> --access --no-start       # --access seulement à la première base migrée
```

Le script, dans l'ordre : lit le secret RDS, vérifie la connexion, compte les lignes de la source
(`Contact`, `ContactInscription`, `ContactEvent`, `ContactMessage`, `Schedule`, `Content`, …), `pg_dump -Fc`
(conteneur `postgres:17`, même version que RDS 17.9) dans `BACKUP_DIR/aws-migration/`, arrête la stack,
supprime et recrée `emailing_<uid>`, crée le rôle `grafanareader` et l'extension `pg_trgm`,
`pg_restore --no-owner --no-privileges --role=emailing_<uid> -j 2` (`--jobs 4` sur un serveur à l'aise),
`ANALYZE`, `npm run sync-model` (ajoute `ActionQueue`, `Mirror`, recrée les vues), recompte les lignes
et affiche l'écart, liste les routeurs (webhooks) et domaines de tracking. Avec `--access`, il fait de
même pour `pg_toolso_access` → base `access` puis pointe `apiEndpoint` de chaque instance locale vers
`https://<hôte>/api/<uid>` et passe `enabled=false` sur toutes les autres bases (restées sur AWS).

Les dumps restent dans `BACKUP_DIR/aws-migration/` (0700) : ce sont les sauvegardes de référence de la
bascule, à conserver jusqu'au nettoyage AWS.

Si l'access est repris : le superutilisateur créé par `install.sh` disparaît ; les comptes et mots de
passe d'AWS sont repris tels quels (bcrypt), ainsi que les jetons en cours si le secret JWT a été
repris. `compose.sh platform exec access npm run create-superuser -- …` recrée un superutilisateur si besoin.

### Jour J : miroirs (facultatif, 15 à 60 min) [serveur]

```bash
sudo deploy/bin/migrate-mirrors.sh <uid>                     # métadonnées des miroirs non expirés (mirrorId → messageId, destinataire, sujet)
sudo deploy/bin/migrate-mirrors.sh <uid> --with-bodies       # + corps HTML depuis S3 (long : un objet par mail)
```

Le scan DynamoDB lit toute la table (9 Go) quel que soit le filtre : 15 à 60 min selon `--segments`
(4 par défaut), ≈ 1 M d'unités de lecture (≈ 0,30 $). L'import (conteneur `api`, `scripts/import-mirrors.js`)
est un upsert, relançable. `--days N` limite aux mails des N derniers jours.

**Alternative recommandée si le temps manque : ne pas migrer.** Les miroirs expirent en 30 jours (TTL
DynamoDB, purge `database_cleaner` en v2). Les mails déjà envoyés pointent vers l'ancienne page miroir
AWS (`https://vl0deu0vq8.execute-api.eu-west-1.amazonaws.com/<mirrorId>`), qui continue de fonctionner
tant que la Lambda `mirror_api`, DynamoDB et S3 existent : les corps ne servent donc à rien sur
l'instance (d'où `--with-bodies` facultatif). Ce que la migration apporte : le rattachement des clics,
ouvertures et désabonnements des anciens mails (reçus via `lk.*` une fois le DNS basculé) à leur
`messageId` (`getMessageIdFromMirrorId`). Sans elle, ces événements sont tout de même enregistrés sur
le contact, sans lien avec le message d'origine, pendant 30 jours au plus.

### Jour J : ouverture de l'instance [serveur]

1. `compose.sh <uid> up -d` (api, worker, worker_huge, scheduler). `curl -s https://<hôte>/api/<uid>/health`.
2. Login UI, ouvrir la base, vérifier contacts / contenus / schedules / ESP (identifiants déchiffrés :
   la page ESP s'affiche sans erreur) ; envoyer un **BAT** depuis un contenu existant.
3. DNS : faire pointer chaque domaine de tracking (`lk.*`) vers le serveur (A/AAAA ou CNAME vers
   `PUBLIC_HOST`), puis `tls.sh issue-tracking <uid>` dès que le DNS a propagé. Vérifier une ouverture
   (pixel) et un clic depuis le BAT : `psql.sh <uid> -c 'select type, count(*) from "ActionQueue" group by 1'`
   puis les `ContactEvent` du contact de test.
4. Webhooks : chaque ESP doit appeler `https://<hôte>/api/<uid>/webhooks/{toolso|sib|ses}`
   (alias `/toolso`, `/sib`, `/ses`, et `/webhooks/fbl` pour les plaintes FBL) :
   - **routeur Toolso (MTA)** : `MailRouter.config.webhookEndpoint` de chaque routeur de type `toolso`
     (page ESP de l'UI, ou `psql.sh <uid>` :
     `UPDATE "MailRouter" SET config = jsonb_set(config::jsonb, '{webhookEndpoint}', '"https://<hôte>/api/<uid>/webhooks/toolso"')::json WHERE type = 'toolso';`),
     et la configuration correspondante côté MTA si l'URL de rappel y est aussi enregistrée (équipe Toolso) ;
   - **Brevo** : tableau de bord Brevo → Transactionnel → Webhooks → remplacer l'URL par
     `…/api/<uid>/webhooks/sib` (événements delivered, opened, click, hard/soft bounce, spam, unsubscribe, blocked) ;
     en v1 un dispatcher unique triait par tag `tls_<uid>` : ici chaque base a sa propre URL ;
   - **SES** (si un routeur `ses` est utilisé) : abonner `https://<hôte>/api/<uid>/webhooks/ses` au
     topic SNS des notifications du domaine expéditeur (`aws sns subscribe --protocol https …`) et
     confirmer l'abonnement (l'URL `SubscribeURL` apparaît dans `logs.sh <uid> api`). Aucun abonnement
     SNS https de production n'a été relevé le 2026-11-09.
   Envoyer un **webhook de test** (événement de test depuis Brevo, ou un `curl -X POST` d'un payload
   relevé dans les logs AWS) et vérifier `ContactEvent`.
5. Sites du client : remplacer l'URL de l'API emailing par `https://<hôte>/api/<uid>` (mêmes clés API).
6. Rejeu des événements arrivés sur AWS pendant la fenêtre, après le rebranchement des webhooks :
   `replay-sqs-actions.sh <uid>` lit la file `actions_<uid>` (rétention 4 jours), insère les actions
   dans `ActionQueue` (conteneur `api`, `scripts/enqueue-actions.js`) et supprime les messages de SQS
   après confirmation. Relancer après quelques heures : les ESP qui n'avaient pas encore la nouvelle
   URL ont pu continuer d'alimenter AWS.

### J+1 à J+30 : observation

- Les envois programmés partent (`Schedule`, `logs.sh <uid> scheduler`), la file reste faible
  (`queue-status`), les statistiques (`update_contents_stats`, `ScheduleReport`) se remplissent,
  les bounces / plaintes arrivent par webhook.
- Les anciens mails continuent de renvoyer vers l'ancien miroir AWS et, pour les liens trackés,
  vers `lk.*` désormais servi par l'instance (clé AES = secret JWT repris : indispensable).
- `backup.sh` tourne (cron) et inclut la base migrée.

## 5. Retour arrière

Tant que le nettoyage AWS n'a pas eu lieu, la plateforme AWS est intacte (données figées à l'instant du gel) :

1. **[serveur]** `compose.sh <uid> stop worker worker_huge scheduler` (l'api peut rester en lecture),
   ou `compose.sh <uid> stop`.
2. **[AWS]** réactiver : `aws lambda delete-function-concurrency --function-name <uid>_api`,
   idem `<uid>_job`, `aws lambda update-event-source-mapping --uuid <UUID> --enabled true` (les
   messages SQS non rejoués sont alors traités par AWS ; ceux déjà rejoués dans l'instance ont été supprimés).
3. DNS `lk.*` → CNAME d'origine (API Gateway), webhooks ESP → URL d'origine, sites du client → ancienne API.
4. Si l'access avait été repris : les bases restées sur AWS ont été passées `enabled=false` dans
   l'access **local** seulement ; l'access AWS n'a pas bougé. Remettre l'UI sur `accessapi.toolso.io` /
   `emailing.toolso.io` pour les utilisateurs.

Les événements de contacts (ouvertures, clics, désabonnements, inscriptions) enregistrés par
l'instance entre l'ouverture et le retour arrière ne sont pas reportés sur AWS : limiter la période
d'observation avant décision définitive (24 à 72 h), ou accepter cette perte.

## 6. Nettoyage AWS (après observation, actions humaines)

Par base migrée : `aws lambda delete-function` pour `<uid>_api`, `<uid>_action`, `<uid>_job`,
`<uid>_ses_webhook` ; l'API Gateway de la base ; `aws sqs delete-queue` pour `actions_<uid>` ;
`aws secretsmanager delete-secret --secret-id pg_toolso_emailing_<uid> --recovery-window-in-days 30` ;
`DROP DATABASE` sur RDS après un instantané (`aws rds create-db-snapshot`). Dans l'access AWS,
`enabled=false` sur la base.

Quand toutes les bases d'une instance RDS sont migrées : instantané final puis
`aws rds delete-db-instance --skip-final-snapshot false`. Quand toutes les bases sont migrées : table
DynamoDB `toolso-emailing-mirrors`, buckets `toolso-emailing-mirror-body`, `toolso-emailing-tmp-files`
(après expiration des liens d'export), Lambdas `tracking_api`, `track_events`, `mirror_api`,
`emailing_jobs`, `huge_actions`, règles EventBridge, secrets `jwt_secret` et `pg_toolso_access` (dernier,
quand plus aucun client n'utilise `accessapi.toolso.io`).

## 7. Risques et points d'attention

| Risque | Parade |
|---|---|
| Secret JWT différent entre AWS et l'instance → ESP inutilisables, anciens liens de tracking indéchiffrables | `jwt-secret-from-aws.sh` **avant** toute configuration ; `--check` avant la bascule |
| Écritures dans RDS pendant le dump (gel incomplet) | ordre du §4 : `_job` et `_api` à 0 **puis** file vide **puis** mapping désactivé **puis** dump ; comparer les comptages source / instance affichés par le script |
| Événements ESP / tracking pendant la fenêtre | accumulés dans SQS (4 jours) → `replay-sqs-actions.sh` ; rebrancher les webhooks et le DNS dans la foulée |
| Appels REST des sites du client pendant la fenêtre (inscriptions) | perdus (5xx côté API Gateway) : fenêtre courte, heure creuse, prévenir le client ; les sites doivent passer à la nouvelle URL au moment de l'ouverture |
| Export en cours (`huge_actions`) ou upload CSV en cours au gel | perdu : ne pas lancer d'export / import dans l'heure précédant le gel |
| `pg_restore` signale des erreurs | « already exists » (extension) est normal ; toute autre erreur est affichée et demande confirmation ; journal `*.restore.log` à côté du dump |
| Durée sous-estimée | répétition `--dump-only` / `--restore-only` ; `--jobs 4` ; ne restaurer que la base, pas les miroirs, pendant la fenêtre |
| Disque plein | dump ≈ 20–40 % de la base, base restaurée ≈ 100 % ; `df -h` affiché par le script |
| Base access reprise plusieurs fois | ne reprendre l'access **qu'une fois** (première base) ; pour les suivantes, `migrate-from-aws.sh <uid>` sans `--access` puis `compose.sh platform exec access npm run set-database-endpoint -- --uid <uid> --api-base https://<hôte>/api` |
| Utilisateurs des bases non migrées | ils restent sur `emailing.toolso.io` (AWS) ; dans l'access local ces bases sont `enabled=false` (invisibles) ; les deux UI coexistent jusqu'à la dernière migration |
| Anciens mails : lien miroir | pointe vers AWS (`vl0deu0vq8…`) pendant 30 jours : ne pas supprimer `mirror_api`, DynamoDB et S3 avant |
| DNS `lk.*` en cache | TTL baissé à l'avance ; pendant la propagation, les clics vont encore au tracking AWS → file SQS → rejeu |

## 8. Référence rapide des scripts

| Script | Rôle | Appels AWS |
|---|---|---|
| `deploy/bin/jwt-secret-from-aws.sh [--check]` | `jwt_secret` → `env/access.env` + `instances/*/.env` | `secretsmanager:GetSecretValue` |
| `deploy/bin/migrate-from-aws.sh <uid> [--dump-only \| --restore-only <f>] [--access] [--no-start] [--skip-checks] [--jobs n]` | RDS → `emailing_<uid>` (+ `pg_toolso_access` → `access`, `apiEndpoint`/`enabled`) | `secretsmanager:GetSecretValue` ; connexion PostgreSQL à RDS |
| `deploy/bin/migrate-mirrors.sh <uid> [--days N] [--with-bodies] [--segments N] [--export-only \| --import-only]` | DynamoDB/S3 → table `Mirror` | `dynamodb:Scan`, `s3:GetObject` |
| `deploy/bin/replay-sqs-actions.sh <uid> [--max N] [--keep]` | SQS `actions_<uid>` → `ActionQueue` | `sqs:ReceiveMessage`, `sqs:DeleteMessage` |
| `apps/api/scripts/import-mirrors.js`, `apps/api/scripts/enqueue-actions.js` | conversion / insertion côté instance (lancés dans le conteneur `api`) | aucun |
| `apps/access/scripts/set-database-endpoint.js` | `apiEndpoint` / `enabled` des bases dans l'access | aucun |
| `deploy/bin/migrate-from-media.sh <uid> --product <p> …` | base **toolso-media** (autre plateforme) → `emailing_<uid>`, par conversion : voir `docs/06-migration-depuis-media.md` | `secretsmanager:GetSecretValue` (`media-<nom>`, eu-west-3) ; connexion PostgreSQL au cluster media |

Tous les scripts `deploy/bin/*.sh` sont `set -euo pipefail`, relançables, et ne manipulent les secrets
qu'en variables (jamais affichés, jamais sur une ligne de commande visible dans `ps`).
