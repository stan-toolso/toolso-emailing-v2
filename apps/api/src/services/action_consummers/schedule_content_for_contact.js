const ContactScheduleService = require('../ContactScheduleService');

let _contactScheduleService = null;
const getContactScheduleService = async () => {
  if (_contactScheduleService) {
    return _contactScheduleService;
  } else {
    _contactScheduleService = new ContactScheduleService();
    return _contactScheduleService;
  }
};

module.exports = async (payload) => {
  await (await getContactScheduleService()).scheduleContentToContactWithIds(payload.s, payload.c);
};
