const ActionService = require('../ActionService');
const ContactService = require('../ContactService');
const ActionType = require('../ActionType');
const log = require('../../util/log').getLogger('scan_contact_to_update_status');

const MAX_WAITING_ACTIONS = 1000;
const CONTACT_UPDATE_SIZE = 500;

let _actionService = null;
let _contactService = null;

module.exports = async () => {
  if (!_actionService) {
    _actionService = new ActionService();
    _contactService = new ContactService();
  }

  let waitingActions = await _actionService.countActions();
  if (waitingActions > MAX_WAITING_ACTIONS) {
    log.info(`We have to much waiting actions (${waitingActions}). We skip this scan`);
    return;
  }

  await tagNextContactsToUpdateAndCreateActions();
};

const tagNextContactsToUpdateAndCreateActions = async () => {
  let contacts = await _contactService.scanContactsToUpdate(CONTACT_UPDATE_SIZE);
  log.debug(`Find ${contacts.length} contacts to update. We send them in SQS`);

  let payloads = [];
  for (let contact of contacts) {
    payloads.push({ contactId: contact.id });
  }
  await _actionService.newActionsWithPackage(ActionType.update_contact_status, payloads);
  if (contacts.length == CONTACT_UPDATE_SIZE) {
    await tagNextContactsToUpdateAndCreateActions();
  } else {
    log.info('No more contacts to update');
  }
};
