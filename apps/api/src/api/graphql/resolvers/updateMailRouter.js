const log = require('../../../util/log').getLogger('updateMailRouter');

let _mailRouterService = null;
module.exports = async (parent, { mailRouter }, context, info) => {
  if (!_mailRouterService) {
    let MailRouterService = require('../../../services/MailRouterService');
    _mailRouterService = new MailRouterService();
  }

  log.debug(`Update mail router ${mailRouter.id}`);
  return await _mailRouterService.update(mailRouter);
};
