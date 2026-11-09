const log = require('../../util/log').getLogger('ContentPut');
const moment = require('moment-timezone');

let formats = ['YYYY-MM-DD', 'YYYY/MM/DD', moment.ISO_8601];

let _contentService = null;
module.exports = async (req, res) => {
  let timezone = null;
  if (!_contentService) {
    const ContentService = require('../../services/ContentService');
    _contentService = new ContentService();
    const { getCachedSettings } = require('../../services/SettingsService');
    timezone = (await getCachedSettings(['timezone'])).timezone;
  }

  req.body.id = req.params.content_id;
  if (req.body.startDate) {
    if (moment.tz(req.body.startDate, formats, timezone).isValid()) {
      req.body.startDate = moment.tz(req.body.startDate, formats, timezone).startOf('day').toDate();
    }
  }
  if (req.body.endDate) {
    if (moment.tz(req.body.endDate, formats, timezone).isValid()) {
      req.body.endDate = moment.tz(req.body.endDate, formats, timezone).endOf('day').toDate();
    }
  }

  log.debug(`Put content received ${JSON.stringify(req.body)}`);
  let content = await _contentService.updateCompleteContent(req.body);

  res.json({
    status: content ? 'ok' : 'ko',
    content: content
  });
};
