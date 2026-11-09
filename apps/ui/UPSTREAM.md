# apps/ui — origine et adaptations

| | |
|---|---|
| Dépôt d'origine | https://gitlab.com/toolso/toolso-emailing-ui |
| Branche / commit | `master` @ `b8342394bbecffe3bad53ab8cfc6e0e69cd8edc3` (2026-09-01, « content settings: Max schedule defaults to 0 (unlimited) ») |
| Importé le | 2026-11-09, par copie de l'instantané (sans `.git`, sans `node_modules`) |
| Stack | Create React App 4 (`react-scripts` 4.0.3, webpack 4), React 17, CoreUI 3, Apollo Client 3, HashRouter |

**Règle du projet : l'interface reste strictement identique** (aucun changement visuel ni fonctionnel). Seules la configuration des endpoints, le build et le packaging ont été touchés. Tout le reste (`src/`, `public/`, `cypress/`, `features/`, `.gitlab-ci.yml`, `README.md`, `CRA.md`) est la copie conforme de l'instantané ; `.gitlab-ci.yml` n'est plus utilisé (il déployait sur S3/CloudFront) et n'est conservé que comme trace.

## Fichiers ajoutés ou modifiés par rapport à l'instantané

| Fichier | Nature | Pourquoi |
|---|---|---|
| `.env.production` | ajouté | `REACT_APP_ACCESS_API_ENDPOINT=/access/graphql` : l'access API est appelée en chemin relatif, même origine (voir ci-dessous). **Ne pas** définir `REACT_APP_API_ENDPOINT` : l'endpoint de chaque base vient de l'access API. |
| `.nvmrc` | ajouté | Node 22. |
| `package.json` | modifié (1 ligne) | script `build` = `NODE_OPTIONS=--openssl-legacy-provider react-scripts build` (webpack 4 utilise `md4`, retiré d'OpenSSL 3 → indispensable sur Node ≥ 17). Aucune dépendance ajoutée ni retirée ; `package-lock.json` inchangé. |
| `Dockerfile` | ajouté | build multi-étapes `node:22-alpine` → `nginx:1.27-alpine` (voir « Build et image »). |
| `nginx.default.conf` | ajouté | configuration nginx minimale (écoute 80, `try_files $uri /index.html`, cache long sur `/static/`, gzip). La stack `deploy/` monte sa configuration complète par-dessus. |
| `.dockerignore` | ajouté | exclut `node_modules`, `build`, `cypress`, `features`, `.git`. |
| `UPSTREAM.md` | ajouté | ce document. |

`.gitignore` d'origine conservé : il exclut `/node_modules`, `/build`, `/coverage`, `.env.local`, `.env.*.local`. `.env.production` est volontairement commité (il ne contient aucun secret).

## Endpoints

### Access API (authentification, entreprises, bases)

`src/services/AccessManager/AccessManager.js` : constante `ACCESS_MANAGER_END_POINT`, valeur par défaut `https://accessapi.toolso.io/graphql`, remplacée au build par `process.env.REACT_APP_ACCESS_API_ENDPOINT` si défini. Les trois clients Apollo du fichier (`getClient`, `getSignedClient`, `doSignedQuery`) utilisent cette constante : **tout appel à l'access API passe par elle**. Aucune autre référence à `accessapi`, `execute-api` ou `amazonaws` dans `src/` ni `public/`.

Avec `.env.production`, l'UI appelle donc `POST /access/graphql` sur sa propre origine ; nginx proxifie vers `access:4000/graphql` (contrat d'architecture). Vérifié sur le build : le bundle `main.*.js` contient `/access/graphql`, et en navigateur headless le formulaire de connexion envoie bien `POST http://<origine>/access/graphql` (mutation `authWithPassword`, `content-type: application/json`).

Le JWT est stocké dans `localStorage` sous la clé `JWT_TOKEN` et envoyé en en-tête `authorization: Bearer <jwt>`.

### API emailing de chaque base

`src/services/EmailingDatabaseApi.js` : construit à partir de l'objet `database` renvoyé par la requête `me { emailingDatabases { id uid name apiEndpoint } }` de l'access API (`src/services/StateService.js`). `database.apiEndpoint` est **absolu** (`https://<hôte>/api/<uid>` dans l'instance autonome) ; l'UI y ajoute :

- `/graphql` : client Apollo avec `createUploadLink` (`apollo-upload-client`), en-tête `authorization: Bearer <jwt>`. Aucune mutation n'utilise le scalaire `Upload` côté UI : le multipart GraphQL n'est pas sollicité, mais le lien est en place.
- `buildUrl(path)` : `${apiEndpoint}${path}?jwt_token=<jwt>` (ou `&jwt_token=` si `path` a déjà une query string). Voir « Liens avec jeton ».

`REACT_APP_API_ENDPOINT`, s'il est défini au build, remplace `database.apiEndpoint` pour **toutes** les bases (usage développement local, script `npm run local`). Il n'est pas défini dans `.env.production`.

### URL absolues restantes dans le code (inventaire exhaustif)

| Fichier | URL | Rôle | Décision |
|---|---|---|---|
| `src/services/AccessManager/AccessManager.js:4` | `https://accessapi.toolso.io/graphql` | valeur par défaut de l'endpoint access, **inactive** dès que `REACT_APP_ACCESS_API_ENDPOINT` est défini (c'est le cas en production). Reste présente dans le bundle comme chaîne morte. | conservée (code identique) |
| `src/services/CampaignManagerApi.js:4` | `https://campaign-manager.toolso.io` | service « Campaign Manager » (pseudo-base `campaign-manager`, écrans `src/views/campaigns/*` et `src/views/home/HomeCampaigns.js`) : appels GraphQL cross-origin directs depuis le navigateur, avec le même JWT. | **voulu**, inchangé |
| `public/index.html:16` | `https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.6.0/clipboard.js` | bibliothèque `clipboard.js` chargée depuis un CDN (boutons « copier », `src/views/common/ClipboardElement.js`). Le navigateur de l'utilisateur doit atteindre cdnjs. | inchangé |
| `src/views/charts/Charts.js:12` | `http://www.chartjs.org` | lien `<a>` d'une page de démonstration du template CoreUI, **non routée** (absente de `routes.js` / `emailingRoutes.js`). | inchangé, sans effet |
| `src/serviceWorker.js:40` | `https://goo.gl/SC7cgQ` | commentaire / `console.log` du service worker CRA (non enregistré en production par défaut). | sans effet |

Aucune URL `execute-api`, `amazonaws`, `cloudfront`, `s3` dans `src/` ni `public/`.

## Liens avec jeton et liens absolus construits par l'UI

| Où | URL construite | Méthode / contexte | Attendu côté API autonome |
|---|---|---|---|
| `src/views/database/contents/edit/ContentEditPreview.js:96` | `buildUrl('/content/<contentId>/version/<versionId>/preview?ts=<timestamp>')` → `<apiEndpoint>/content/<id>/version/<vid>/preview?ts=…&jwt_token=<jwt>` | `<iframe src>` : GET navigateur, **sans** en-tête `authorization` (le jeton est dans la query string) | route `GET /content/:content_id/version/:version_id/preview` avec `TokenMiddleware` lisant `req.query.jwt_token` (déjà le cas dans l'API d'origine, `src/api/middlewares/TokenMiddleware.js:31`), renvoyant du HTML affichable dans une iframe (pas de `X-Frame-Options: DENY` ; `SAMEORIGIN` convient puisque `/api/<uid>` est sur la même origine que l'UI) |
| `src/views/database/contacts/sources/SourceEditApi.js:76` | `${database.apiEndpoint}/source/contact/inscription` | **texte affiché** (documentation de l'API source pour les intégrateurs), pas de requête | `apiEndpoint` doit être l'URL publique absolue de l'API de la base, car cette valeur est recopiée par des tiers |
| `src/services/EmailingDatabaseApi.js:65` | `buildUrl(path)` | seul usage : l'iframe ci-dessus | — |

`buildUrl` est le **seul** endroit où l'UI place `jwt_token` dans une URL. Il n'y a ni `window.open`, ni `location.href` vers l'API, ni lien `<a href>` absolu généré dynamiquement :

- **Exports de contacts** (`src/views/database/contacts/ExportContactsModal.js`) : mutation GraphQL seulement ; le lien de téléchargement est envoyé **par e-mail par l'API** (toast « You will receive the download link by email »). L'URL du fichier (`FILES_PUBLIC_URL`) est donc entièrement du ressort de l'API.
- **BAT / validations** (`src/views/database/contents/edit/ContentEditBats.js`, `src/views/campaigns/CampaignEditBats.js`) : mutations GraphQL seulement ; les liens de validation `/bat/:uid/:versionId/validate` sont dans les e-mails envoyés par l'API.
- **Pixel consent, désabonnement, miroir, tracking** : aucune référence dans l'UI ; ces URL ne vivent que dans les e-mails générés par l'API.
- Les `CLink target="_blank"` (`InscriptionDetail.js`, `DelivStats.js`, `IncomeLabel.js`, `BatsTable.js`) pointent vers des routes **internes** du HashRouter (`/#/<uid>/…`).

## Contrat upload (listes d'exclusion / d'inclusion)

Composants : `src/views/database/contacts/exclusionLists/ExclusionList.js` et `src/views/database/contacts/inclusionLists/InclusionList.js` (identiques à deux détails près, signalés ci-dessous). Bibliothèque : `react-s3-uploader` 5.0.0 (`node_modules/react-s3-uploader/s3upload.js`), composant `<ReactS3Uploader>` rendu comme `<input type="file" accept="*/*">`, upload automatique à la sélection (`autoUpload` par défaut).

### Étape 1 — obtention de l'URL de dépôt (mutation GraphQL sur l'API de la base)

```graphql
mutation generateUploadUrl($fileName: String!, $fileType: String!) {
  generateUploadUrl(fileName: $fileName, fileType: $fileType)   # type JSON
}
```

- `fileName` = `file.name` **brut** (non « scrubbé », peut contenir espaces et accents).
- `fileType` = `'text/csv'` en dur pour les listes d'exclusion ; `file.type` du navigateur pour les listes d'inclusion (souvent `text/csv`, mais `application/vnd.ms-excel` sous Windows/Excel, ou chaîne vide).
- L'UI passe **l'objet JSON renvoyé tel quel** (`result.data.generateUploadUrl`) à la bibliothèque : c'est le `signResult`. Dans l'API d'origine (`src/api/graphql/resolvers/generateUploadUrl.js` + `S3Service.getUploadUrl`) il vaut :

```json
{ "signedUrl": "<URL présignée S3 PUT, 5 min>", "s3Key": "<uuid>_<fileName>", "fileName": "<fileName>" }
```

Champs du `signResult` effectivement lus :

| Champ | Lu par | Usage |
|---|---|---|
| `signedUrl` | `s3upload.js` | **obligatoire** : URL cible du PUT (absolue ou relative à l'origine de l'UI, le navigateur la résout) |
| `headers` | `s3upload.js` | **optionnel** : objet d'en-têtes supplémentaires ajoutés au PUT (fusionnés, puis écrasés par les `uploadRequestHeaders` du composant, comparaison insensible à la casse). Permet par exemple d'exiger `authorization: Bearer <jwt>` sur le PUT en le renvoyant ici. |
| `s3Key` | `onFinish` dans ExclusionList/InclusionList | repassé tel quel à la mutation d'étape 3 |
| `fileName` | `onFinish` | repassé tel quel à la mutation d'étape 3 |
| `publicUrl` | aucun | seulement dans le `console.log` par défaut de la bibliothèque, non utilisé |

### Étape 2 — dépôt du fichier (requête XHR du navigateur)

- **Méthode** : `PUT` sur `signResult.signedUrl`, via `XMLHttpRequest` (`withCredentials` non positionné → pas de cookies).
- **Corps** : le fichier **brut** (`xhr.send(file)`), pas de multipart, pas d'encodage.
- **En-têtes envoyés** (dans cet ordre de résolution, les derniers gagnent) :
  1. `content-type: <fileType>` où `fileType = file.type || mime.lookup(file.name)` ;
  2. `content-disposition: attachment; filename="<fileName scrubbé>"` (`contentDisposition="auto"`, non-image → `attachment` ; scrub = suppression de tout caractère hors `[\w\d_\-.]`) ;
  3. `signResult.headers` s'il est présent ;
  4. `uploadRequestHeaders` du composant : `x-amz-acl: public-read` (les deux listes) et `Content-Type: text/csv` (listes d'exclusion seulement).
  
  Donc en pratique : `content-type` (`text/csv` pour l'exclusion ; type du navigateur pour l'inclusion), `content-disposition`, `x-amz-acl: public-read`, plus les éventuels `headers` renvoyés à l'étape 1. **Aucun en-tête `authorization`** n'est envoyé sauf si l'API le renvoie dans `signResult.headers` : l'URL doit donc porter elle-même son autorisation (par ex. `…/uploads/<s3Key>?jwt_token=<jwt>` construite par l'API, qui connaît le jeton de l'appelant via `context.encryptedToken`, ou une signature HMAC à durée limitée) **ou** l'API renvoie `headers: { authorization: "Bearer <jwt>" }`.
- **Succès attendu** : code HTTP **200 ou 201** (`successResponses`). Le corps de la réponse est ignoré. Tout autre code → `onError('Upload error: <status>')` et l'UI remet le compteur à zéro (toast d'erreur absent : seulement `console.log`).
- **Progression** : `xhr.upload.onprogress` (`lengthComputable`) → affichage `(xx%)` ; aucune exigence serveur.
- **CORS** : la bibliothèque n'impose rien de particulier, mais le PUT envoie des en-têtes non simples (`content-disposition`, `x-amz-acl`, éventuellement `authorization`) : si `signedUrl` est **sur une autre origine** que l'UI, le navigateur fait un préflight `OPTIONS` et le serveur doit répondre `Access-Control-Allow-Origin` (origine de l'UI ou `*`), `Access-Control-Allow-Methods: PUT`, `Access-Control-Allow-Headers: content-type, content-disposition, x-amz-acl[, authorization]`. Avec `signedUrl` sur **la même origine** (`https://<hôte>/api/<uid>/uploads/…`, cas nominal de l'instance autonome), il n'y a aucun préflight ni en-tête CORS à gérer. Le middleware `cors()` d'Express d'origine (reflet des en-têtes demandés) couvre de toute façon le cas cross-origin.
- **Clé** : `s3Key = <uuid>_<fileName brut>` dans l'API d'origine ; si l'API autonome met la clé dans le chemin de l'URL, elle doit l'encoder (`encodeURIComponent`) et la décoder à la réception, car `fileName` peut contenir espaces/accents.

### Étape 3 — déclenchement de l'import (mutation GraphQL)

```graphql
mutation uploadExclusionListFile($exclusionListId: ID!, $s3Key: String!, $fileName: String!) {
  uploadExclusionListFile(exclusionListId: $exclusionListId, s3Key: $s3Key, fileName: $fileName) { id }
}
# idem uploadInclusionListFile(inclusionListId, s3Key, fileName) { id }
```

avec `s3Key = signResult.s3Key` et `fileName = signResult.fileName`. L'API autonome doit donc retrouver le fichier déposé à l'étape 2 à partir de ce `s3Key` (le remplaçant du bucket `emailing_tmp_files`). L'UI affiche ensuite « CSV file has been uploaded. Import process started. » et relance le rafraîchissement pendant 5 minutes.

### Résumé pour l'API autonome

`generateUploadUrl` doit renvoyer `{ signedUrl, s3Key, fileName }` (+ `headers` optionnel) ; `PUT <signedUrl>` avec corps brut doit répondre 200/201 et stocker le fichier sous `s3Key` ; `uploadExclusionListFile` / `uploadInclusionListFile` doivent lire ce fichier par `s3Key`. Les en-têtes `x-amz-acl` et `content-disposition` doivent être tolérés (ignorés). L'UI n'a besoin d'aucune modification.

## Build et image

Prérequis : Node 22 (`.nvmrc`), `npm ci` (lockfile v2 d'origine, passe sans modification : 2310 paquets). Le `postinstall` de `cypress` télécharge un binaire (~200 Mo) : dans l'image Docker, `CYPRESS_INSTALL_BINARY=0` l'évite.

```sh
npm ci
npm run build            # = NODE_OPTIONS=--openssl-legacy-provider react-scripts build → build/
CI=true npm test -- --watchAll=false
npm run lint
```

Résultats du 2026-11-09 (Node 22.23.4, npm 10.9.9) : build OK (`The build folder is ready to be deployed`, `homepage: "."` → chemins d'assets relatifs, 34 Mo avec les source maps), `npm test` 1 suite / 1 test OK (`src/App.test.js`), `npm run lint` 0 erreur, 0 avertissement. Les avertissements Sass « Using / for division » viennent de CoreUI 3 et sont sans effet.

**Mémoire** : le build CRA 4 a besoin d'environ 1,5 à 2 Go (webpack + `terser-webpack-plugin` lance `os.cpus().length - 1` workers de minification). Dans un environnement plafonné à 1 Go, il échoue avec « The build failed because the process exited too early » (OOM kill). Contournement sans toucher au code : limiter le nombre de CPU vus par Node (par exemple un préchargement `--require` qui tronque `os.cpus()` à 2) ou donner plus de mémoire au conteneur de build.

`Dockerfile` : étape `build` (`node:22-alpine`, `npm ci`, `npm run build`), puis `nginx:1.27-alpine` avec `build/` dans `/usr/share/nginx/html` et `nginx.default.conf` dans `/etc/nginx/conf.d/default.conf`. L'image n'embarque aucun secret et aucune variable d'exécution : tout est figé au build (`.env.production`).

Vérification locale du build : servi en statique (équivalent `serve -s build`), `GET /` → 200 `text/html`, bundles `/static/js/main.*.js` → 200 `application/javascript`, `GET /login` → `index.html` (fallback) ; en Chromium headless la page de connexion (`/#/login`) s'affiche, et la soumission du formulaire envoie `POST /access/graphql` en relatif.
