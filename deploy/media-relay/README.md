# Relais toolso-media → Toolso Emailing v2

`0001-relais-v2.patch` : commit à appliquer sur le dépôt toolso-media (https://gitlab.com/toolso/toolso-media, branche
principale au 2026-11-07, `e60af9f`) — `git am deploy/media-relay/0001-relais-v2.patch`.

- `backend/api/rest/relayToV2.js` : middleware placé après les filtres d'accès des routes REST `/v1/…` (inscription,
  vérification, lecture, suppression, désabonnement, consentement pixel, routes source, export). Pour un produit dont le
  réglage `v2RelayUrl` est renseigné, l'appel est transmis à `<v2RelayUrl>/v1/…` (même méthode, clé, corps et paramètres)
  et la réponse de la v2 est renvoyée telle quelle. Sinon, ou si la v2 ne répond pas (`V2_RELAY_TIMEOUT_MS`, 10 s par
  défaut, ou erreur 5xx), media traite l'appel comme avant.
- `backend/config/defaultSettings.json` : réglage `v2RelayUrl` (vide par défaut).
- Non relayés : `/v1/ad/click/conversion` (publicités media) et les webhooks.

Sans réglage renseigné, le patch ne change rien : il peut être déployé avant la première bascule. Activation et retour
arrière par produit : `docs/06-migration-depuis-media.md` § 8.
