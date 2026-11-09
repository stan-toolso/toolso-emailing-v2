process.env.AWS_SDK_LOAD_CONFIG = false;
const ContactScheduleService = require('../../src/services/ContactScheduleService');
const { getGoodContent, getBadContent } = require('../contentTestData');
const { getContact } = require('../contactTestData');
const ScheduleContentStrategies = require('../../src/services/scheduleStrategies/ScheduleContentStrategies');
const { getRecurrentSchedule } = require('../scheduleTestData');
const sequelize = require('../../src/storage/sequelize');
jest.mock('../../src/storage/sequelize');
const { setSetting } = require('../../src/services/SettingsService');
const moment = require('moment-timezone');

function getSchedule() {
  return {
    id: 3,
    name: 'Alerte 12h30',
    isActive: true,
    config: {
      filter: { type: '', activated: true },
      contentStrategies: [
        { type: ScheduleContentStrategies.bestClick, params: { dateReceptionPenaltyPowFactor: 5 }, segment: { from: 51, to: 60 } },
        { type: ScheduleContentStrategies.bestOpen, params: { dateReceptionPenaltyPowFactor: 5 }, segment: { from: 61, to: 70 }, esps: ['gmail'] },
        { type: ScheduleContentStrategies.bestOpenAndClick, params: { dateReceptionPenaltyPowFactor: 5 }, esps: ['hotmail'] },
        { type: ScheduleContentStrategies.recommendation, name: 'frites', segment: { from: 2, to: 3, name: 'bestClick' } }
      ]
    }
  };
}
var contactScheduleService;

beforeEach(async () => {
  process.env.LOG_LEVEL = 'ALL';
  sequelize.get = () => {
    return { models: { Settings: { findAll: () => [] }, ActivationConfig: { findAll: () => [], findOne: () => null } } };
  };
  jest.useFakeTimers();
  jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
  contactScheduleService = new ContactScheduleService();
});

afterEach(() => {
  jest.spyOn(global.Math, 'random').mockRestore();
});

function setAllSegment(contact, segmentValue) {
  contact.segment = segmentValue;
  contact.segmentByFeatures.bestOpenAndClick = segmentValue;
  contact.segmentByFeatures.bestOpen = segmentValue;
  contact.segmentByFeatures.bestClick = segmentValue;
}

test('get Appropriate Strat by Segment', async () => {
  let theContact = getContact();
  setAllSegment(theContact, 52);

  const executeStrategyMock = jest.fn();

  await contactScheduleService._select_best_content(getAllContents(), getSchedule(), theContact, getAllContents(), executeStrategyMock);
  expect(executeStrategyMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), ScheduleContentStrategies.bestClick, expect.anything(), expect.anything());
});

test('get Appropriate Strat by Segment With overrided segmentName', async () => {
  let theContact = getContact();
  setAllSegment(theContact, 2);

  const executeStrategyMock = jest.fn();

  await contactScheduleService._select_best_content(getAllContents(), getSchedule(), theContact, getAllContents(), executeStrategyMock);
  expect(executeStrategyMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), ScheduleContentStrategies.recommendation, expect.anything(), expect.anything());
});

test('get Appropriate Strat by Esp and Segment', async () => {
  let theContact = getContact();
  setAllSegment(theContact, 62); // 62 segment and gmail is assigned to bestOpen strategy
  const executeStrategyMock = jest.fn();

  await contactScheduleService._select_best_content(getAllContents(), getSchedule(), theContact, getAllContents(), executeStrategyMock);
  expect(executeStrategyMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), ScheduleContentStrategies.bestOpen, expect.anything(), expect.anything());
});

test('get Appropriate Strat when ESP match, but wrong segment', async () => {
  let theContact = getContact();
  theContact.segment = 50;
  theContact.esp = 'gmail';
  theContact.email = 'toto@gmail.com';
  const executeStrategyMock = jest.fn();

  await contactScheduleService._select_best_content(getAllContents(), getSchedule(), theContact, getAllContents(), executeStrategyMock);
  expect(executeStrategyMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), null, expect.anything(), expect.anything());
});

test('get Appropriate Strat by Esp', async () => {
  let theContact = getContact();
  theContact.esp = 'hotmail';
  theContact.email = 'toto@hotmail.com';
  theContact.segment = 62; // 62 segment and hotmail is assigned to bestOpen strategy
  const executeStrategyMock = jest.fn();

  await contactScheduleService._select_best_content(getAllContents(), getSchedule(), theContact, getAllContents(), executeStrategyMock);
  expect(executeStrategyMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), ScheduleContentStrategies.bestOpenAndClick, expect.anything(), expect.anything());
});

function getAllContents() {
  var allContents = {};
  allContents[getBadContent().id] = { content: getBadContent(), contentVersion: 0, count: 0, lastOccurenceDays: null };
  allContents[getGoodContent().id] = { content: getGoodContent(), contentVersion: 0, count: 0, lastOccurenceDays: null };
  return allContents;
}

test('retrieve Best Content for Contact', async () => {
  let dryMode = true;
  let senderConfig = { minScoreByEsp: { default: 10 }, autoUpdates: { default: { enabled: false, minOpenRate: 19 } }, senderId: '7', weight: 33 };
  var contact = getContact();
  contact.getContactContents = () => {
    return [];
  };

  let bestContentResult = await contactScheduleService.retrieveContentForContact(getRecurrentSchedule(), contact, getAllContents(), senderConfig, dryMode);
  expect(bestContentResult?.bestContent).not.toBeNull();
  expect(bestContentResult?.bestContent).not.toBeUndefined();
});

test('no content when marketing pressure is too high', async () => {
  let dryMode = true;
  let senderConfig = { minScoreByEsp: { default: 10 }, autoUpdates: { default: { enabled: false, minOpenRate: 19 } }, senderId: '7', weight: 33 };
  var contact = getContact();
  const moment = require('moment-timezone');
  const { getCachedSettings } = require('../../src/services/SettingsService');
  let { timezone } = await getCachedSettings(['timezone']);
  setSetting('complaintReductionPolicyLevel', { default: 0, gmail: 5 });
  contact.getContactContents = () => {
    return [
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-1, 'hour') },
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-2, 'hour') },
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-3, 'hour') },
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-4, 'hour') },
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-5, 'hour') },
      { contactId: contact.id, contentId: 1, createdAt: moment.tz(timezone).add(-6, 'hour') }
    ];
  };
  let schedule = getRecurrentSchedule();
  contact.stats = { unique_open: 0 };
  let result = await contactScheduleService.retrieveContentForContact(schedule, contact, getAllContents(), senderConfig, dryMode);
  expect(result?.bestContent).toBeUndefined();
});

test('test DobFilters (period)', async () => {
  let stanContact = getContact();

  let contentForJuneGuys = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'dob', subtype: 'period', subType: 'period', from: '06-01', to: '06-30' }] } };
  let contentForJulyGuys = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'dob', subtype: 'period', subType: 'period', from: '07-01', to: '07-31' }] } };
  let contentForCapricornGuys = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'dob', subtype: 'period', subType: 'period', from: '12-22', to: '01-19' }] } };

  let stanEligibleForJuneContent = await contactScheduleService._is_content_match_contact(contentForJuneGuys, stanContact);
  let stanEligibleForJulyContent = await contactScheduleService._is_content_match_contact(contentForJulyGuys, stanContact);

  expect(stanEligibleForJuneContent).toBe(false);
  expect(stanEligibleForJulyContent).toBe(true);

  let remiContact = getContact();
  remiContact.dob = '1984-12-25';
  let remiEligibleForCapricornContent = await contactScheduleService._is_content_match_contact(contentForCapricornGuys, remiContact);

  expect(remiEligibleForCapricornContent).toBe(true);
});

test('test DobFilters (birthday)', async () => {
  let birthdayContact = { ...getContact(), dob: moment().add(-20, 'years') };
  let nonBirthdayContact = { ...getContact(), dob: moment().add(-20, 'years').add(1, 'day') };

  let birthdayContent = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'dob', subtype: 'period', subType: 'birthday' }] } };

  let eligibleForBirthdayGuy = await contactScheduleService._is_content_match_contact(birthdayContent, birthdayContact);
  let eligibleForLambdaGuy = await contactScheduleService._is_content_match_contact(birthdayContent, nonBirthdayContact);

  expect(eligibleForLambdaGuy).toBe(false);
  expect(eligibleForBirthdayGuy).toBe(true);
});

test('test customFieldFilter (test ==)', async () => {
  let okContact = { ...getContact(), customFields: { test: 'ok' } };
  let koContact = { ...getContact(), customFields: { test: 'ko' } };

  let okContent = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'fieldValue', field: 'customFields', customField: 'test', operator: '=', value: 'ok' }] } };

  let eligibleForOkGuy = await contactScheduleService._is_content_match_contact(okContent, okContact);
  let eligibleForKoGuy = await contactScheduleService._is_content_match_contact(okContent, koContact);

  expect(eligibleForKoGuy).toBe(false);
  expect(eligibleForOkGuy).toBe(true);
});

test('test customFieldFilter (test !=)', async () => {
  let okContact = { ...getContact(), customFields: { test: 'ok' } };
  let koContact = { ...getContact(), customFields: { test: 'ko' } };

  let okContent = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'fieldValue', field: 'customFields', customField: 'test', operator: '!=', value: 'ok' }] } };

  let eligibleForOkGuy = await contactScheduleService._is_content_match_contact(okContent, okContact);
  let eligibleForKoGuy = await contactScheduleService._is_content_match_contact(okContent, koContact);

  expect(eligibleForKoGuy).toBe(true);
  expect(eligibleForOkGuy).toBe(false);
});

test('test customFieldFilter (firstname ==)', async () => {
  let okContact = { ...getContact(), firstname: 'stan' };
  let koContact = { ...getContact(), firstname: 'pierre' };

  let okContent = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'fieldValue', field: 'firstname', operator: '=', value: 'stan' }] } };

  let eligibleForOkGuy = await contactScheduleService._is_content_match_contact(okContent, okContact);
  let eligibleForKoGuy = await contactScheduleService._is_content_match_contact(okContent, koContact);

  expect(eligibleForKoGuy).toBe(false);
  expect(eligibleForOkGuy).toBe(true);
});

test('test customFieldFilter (firstname LIKE)', async () => {
  let okContact = { ...getContact(), firstname: 'stanislas' };
  let koContact = { ...getContact(), firstname: 'pierre' };

  let okContent = { ...getGoodContent(), config: { filters: [{ id: 1, type: 'fieldValue', field: 'firstname', operator: 'LIKE', value: 'stan' }] } };

  let eligibleForOkGuy = await contactScheduleService._is_content_match_contact(okContent, okContact);
  let eligibleForKoGuy = await contactScheduleService._is_content_match_contact(okContent, koContact);

  expect(eligibleForKoGuy).toBe(false);
  expect(eligibleForOkGuy).toBe(true);
});

test('test DobFilters do not short-circuit following filters (exclusionList, age)', async () => {
  let stanContact = getContact();
  contactScheduleService.exclusionListService.isContactExcluded = jest.fn(async () => true);

  let dobThenExclusion = {
    ...getGoodContent(),
    config: {
      filters: [
        { id: 1, type: 'dob', subType: 'period', from: '07-01', to: '07-31' },
        { id: 2, type: 'exclusionList', exclusionListId: 8 }
      ]
    }
  };
  let dobThenAge = {
    ...getGoodContent(),
    config: {
      filters: [
        { id: 1, type: 'dob', subType: 'period', from: '07-01', to: '07-31' },
        { id: 2, type: 'age', minAge: 120 }
      ]
    }
  };

  expect(await contactScheduleService._is_content_match_contact(dobThenExclusion, stanContact)).toBe(false);
  expect(contactScheduleService.exclusionListService.isContactExcluded).toHaveBeenCalledWith(stanContact, 8);
  expect(await contactScheduleService._is_content_match_contact(dobThenAge, stanContact)).toBe(false);

  contactScheduleService.exclusionListService.isContactExcluded = jest.fn(async () => false);
  expect(await contactScheduleService._is_content_match_contact(dobThenExclusion, stanContact)).toBe(true);
});

test('test customFieldFilter does not short-circuit following filters (exclusionList)', async () => {
  let okContact = { ...getContact(), firstname: 'stan' };
  contactScheduleService.exclusionListService.isContactExcluded = jest.fn(async () => true);

  let fieldThenExclusion = {
    ...getGoodContent(),
    config: {
      filters: [
        { id: 1, type: 'fieldValue', field: 'firstname', operator: '=', value: 'stan' },
        { id: 2, type: 'exclusionList', exclusionListId: 8 }
      ]
    }
  };

  expect(await contactScheduleService._is_content_match_contact(fieldThenExclusion, okContact)).toBe(false);
});
