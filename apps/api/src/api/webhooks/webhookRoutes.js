const express = require('express');
const log = require('../../util/log').getLogger('Webhooks');
const { handleWebhook } = require('./webhookHandlers');
const { handleFblComplaint } = require('./fblComplaintHandler');

/**
 * Webhooks des fournisseurs (ex-Lambda `ses_webhook` derrière API Gateway) :
 *   POST /webhooks/ses | /webhooks/sib | /webhooks/toolso  (alias historiques /ses, /sib, /toolso)
 *   POST /webhooks/fbl : plainte FBL (mail brut), ex-événement `FblComplaint` de la file track_events
 * Le corps est lu brut (SNS envoie du JSON avec un Content-Type text/plain).
 */
const router = express.Router();
const rawBody = express.text({ type: () => true, limit: '20mb' });

const handle = (routerName) => async (req, res) => {
  try {
    const result = await handleWebhook(routerName, req.body);
    res.status(200).send(typeof result === 'string' ? result : 'OK');
  } catch (err) {
    log.error(`Webhook ${routerName} failed`, err);
    res.status(500).send('Error');
  }
};

for (const name of ['ses', 'sib', 'toolso']) {
  router.post(`/webhooks/${name}`, rawBody, handle(name));
  router.post(`/${name}`, rawBody, handle(name));
}

router.post('/webhooks/fbl', rawBody, async (req, res) => {
  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await handleFblComplaint(event);
    res.status(200).send('OK');
  } catch (err) {
    log.error('FBL webhook failed', err);
    res.status(500).send('Error');
  }
});

module.exports = { router };
