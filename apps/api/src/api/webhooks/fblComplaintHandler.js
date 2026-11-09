const log = require('../../util/log').getLogger('FblComplaintHandler');
const simpleParser = require('mailparser').simpleParser;
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const ActionService = require('../../services/ActionService');
const ActionType = require('../../services/ActionType');

/**
 * Plainte reçue par une boucle de rétroaction (FBL) : le mail de plainte contient le message d'origine.
 * On y retrouve un lien de tracking `/tkc/v1/<clé>/<objet>` pour obtenir le mirrorId, donc le message et le contact.
 * Reprise de `track_events/src/fblComplaintHandler.js`.
 * @param {{message: string, date?: string}} event mail brut (RFC 822) et date de réception
 */
const handleFblComplaint = async (event) => {
  log.info(`FBL Complaint received`);
  const parsed = await simpleParser(event.message);
  const message = parsed.html ? parsed.html : parsed.text;
  if (!message) {
    log.warn('FBL complaint without body');
    return;
  }
  const $ = cheerio.load(message);
  let tckLink = null;
  for (const linkObject of $('a')) {
    let link = $(linkObject).attr('href');
    if (link && link.indexOf('/tkc/v1/') >= 0) {
      tckLink = link;
      break;
    }
    link = $(linkObject).attr('title');
    if (link && link.indexOf('/tkc/v1/') >= 0) {
      tckLink = link;
      break;
    }
  }
  if (!tckLink || tckLink.split('/').length != 7) {
    log.warn('FBL complaint: no tracking link found');
    return;
  }
  const secretKey = tckLink.split('/')[5];
  try {
    const encryptedObj = decodeURIComponent(tckLink.split('/')[6]).replace(/ /g, '');
    const decryptedObj = JSON.parse(CryptoJS.AES.decrypt(encryptedObj, secretKey).toString(CryptoJS.enc.Utf8));
    if (decryptedObj.mirrorId) {
      const timestamp = event.date ? new Date(event.date).getTime() : Date.now();
      await new ActionService().newAction(ActionType.track_event, {
        mirrorId: decryptedObj.mirrorId,
        eventType: 'Complaint',
        timestamp,
        complaintFeedbackType: 'FromFBL'
      });
    }
  } catch (ex) {
    log.error(`Failed to decrypt FBL tracking link ${tckLink}`, ex);
  }
};

module.exports = { handleFblComplaint };
