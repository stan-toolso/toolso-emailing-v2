let _actionService = null;

module.exports = async (payload) => {
  if (!_actionService) {
    const ActionService = require('../ActionService');
    _actionService = new ActionService();
  }

  await _actionService.newActions(payload.type, payload.payloads);
};
