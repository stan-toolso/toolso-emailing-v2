const log = require('../util/log').getLogger('Action executor');
const ActionType = require('../services/ActionType');

const consumers = {
  [ActionType.insert_contact_event]: () => require('../services/action_consummers/insert_contact_event'),
  [ActionType.insert_contact_message]: () => require('../services/action_consummers/insert_contact_message'),
  [ActionType.update_contact_status]: () => require('../services/action_consummers/update_contact_status'),
  [ActionType.remove_contact]: () => require('../services/action_consummers/remove_contact'),
  [ActionType.schedule_content_for_contact]: () => require('../services/action_consummers/schedule_content_for_contact'),
  [ActionType.package_action]: () => require('../services/action_consummers/package_action'),
  [ActionType.upload_exclusion_list]: () => require('../services/action_consummers/upload_exclusion_list'),
  [ActionType.upload_inclusion_list]: () => require('../services/action_consummers/upload_inclusion_list'),
  [ActionType.export_contacts]: () => require('../services/action_consummers/export_contacts'),
  [ActionType.log_payload]: () => require('../services/action_consummers/log_payload'),
  [ActionType.send_content_for_contact]: () => require('../services/action_consummers/send_content_for_contact'),
  [ActionType.track_event]: () => require('../services/action_consummers/track_event')
};

/**
 * Exécute une action de la file (ex-`handlers/action.js` et `handlers/huge_action.js`).
 * @param {{type: string, payload: object}} action
 */
const executeAction = async (action) => {
  if (!action || !action.type) {
    log.error('No action to execute ... ');
    return;
  }
  if (action.type === ActionType.update_sending_config_scores) {
    log.warn(`Action of type ${action.type} STOPPED`);
    return;
  }
  const consumer = consumers[action.type];
  if (!consumer) {
    log.warn(`Action of type ${action.type} not implemented`);
    return;
  }
  const startTs = Date.now();
  log.debug(`Execute action of type ${action.type}`);
  await consumer()(action.payload);
  log.debug(`End action with type ${action.type}. Execution time ${Date.now() - startTs}ms `);
};

module.exports = { executeAction };
