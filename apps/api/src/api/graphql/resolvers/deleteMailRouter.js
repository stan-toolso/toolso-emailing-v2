const log = require('../../../util/log').getLogger('deleteMailRouter');

let _mailRouterService = null;
module.exports = async (parent, { mailRouterId }, context, info) => {
  if (!_mailRouterService) {
    let MailRouterService = require('../../../services/MailRouterService');
    _mailRouterService = new MailRouterService();
  }

  log.debug(`Delete mail router ${mailRouterId}`);
  if (await _mailRouterService.delete(mailRouterId)) {
    return 'ok';
  } else {
    return 'ko';
  }
};
