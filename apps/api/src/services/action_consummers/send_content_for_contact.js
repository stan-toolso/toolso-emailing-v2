let _contactScheduleService = null;
const getContactScheduleService = async () => {
  const ContactScheduleService = require('../ContactScheduleService');
  if (_contactScheduleService) {
    return _contactScheduleService;
  } else {
    _contactScheduleService = new ContactScheduleService();
    return _contactScheduleService;
  }
};

module.exports = async (payload) => {
  await (await getContactScheduleService()).sendContentToContactWithIds(payload.s, payload.ca, payload.ce, payload.details, payload.cs, payload.sc, payload.cst);
};
