const log = require('../../util/log').getLogger('ContentPost');
const moment = require('moment-timezone');

let _contentService = null;
let _scheduleService = null;

let formats = ['YYYY-MM-DD', 'YYYY/MM/DD', moment.ISO_8601];

module.exports = async (req, res) => {
  let timezone = null;
  if (!_contentService) {
    const ContentService = require('../../services/ContentService');
    const ScheduleService = require('../../services/ScheduleService');
    _contentService = new ContentService();
    _scheduleService = new ScheduleService();
    const { getCachedSettings } = require('../../services/SettingsService');
    timezone = (await getCachedSettings(['timezone'])).timezone;
  }

  log.debug(`New content received ${JSON.stringify(req.body)}`);

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

  let content = await _contentService.createCompleteContent(req.body);

  if (req.body.scheduleIds) {
    let scheduleIds = req.body.scheduleIds.split(',');
    for (let scheduleId of scheduleIds) {
      scheduleId = scheduleId.trim();
      let schedule = await _scheduleService.findWithId(scheduleId);
      if (schedule) {
        await content.addSchedule(schedule);
      }
    }
  }

  res.json({
    status: content ? 'ok' : 'ko',
    content: content
  });
};
