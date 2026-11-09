const log = require('../../../util/log').getLogger('updateSendingConfigScores');
const ActionType = require('../../../services/ActionType');

let _actionService = null;
module.exports = async (parent, { sendingConfigId }, context, info) => {
  if (!_actionService) {
    let ActionService = require('../../../services/ActionService');
    _actionService = new ActionService();
  }

  log.debug(`Update sending config scores for id ${sendingConfigId}`);

  await _actionService.newAction(ActionType.update_sending_config_scores, {
    id: sendingConfigId
  });
  return 'OK';
};
