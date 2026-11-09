const { getCachedSettings } = require('../SettingsService');

const getCommonHeaders = async (mailRouter, mail, senderConfig, content, schedule) => {
  let { unsubscribeMailto, listId } = await getCachedSettings(['unsubscribeMailto', 'listId']);
  if (senderConfig.sender && senderConfig.sender.unsubscribeMailto) {
    unsubscribeMailto = senderConfig.sender.unsubscribeMailto;
  }
  if (mailRouter.config && mailRouter.config.unsubscribeMailto) {
    unsubscribeMailto = mailRouter.config.unsubscribeMailto;
  }
  let unsubMailTo = unsubscribeMailto ? `<mailto:${unsubscribeMailto}?subject=unsubscribe#${mail.mirrorId}>,` : '';

  let headers = {
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Unsubscribe': `${unsubMailTo} <${mail.unsubLink}>`
  };
  if (content) {
    headers['Feedback-ID'] = `${process.env.RESOURCE_UID}-${content.id}:${process.env.RESOURCE_UID}::${senderConfig.sender.id}`;
  }

  if (listId) {
    headers['List-Id'] = listId;
  }
  return headers;
};

module.exports = {
  getCommonHeaders
};
