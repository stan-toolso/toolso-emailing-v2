const log = require('../../../util/log').getLogger('createMailRouter');

let _mailRouterService = null;
module.exports = async (parent, { name }, context, info) => {
  if (!_mailRouterService) {
    let MailRouterService = require('../../../services/MailRouterService');
    _mailRouterService = new MailRouterService();
  }

  log.debug(`Create mail router ${name}`);
  return await _mailRouterService.createWithName(name);
};
