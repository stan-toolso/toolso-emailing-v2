const ScheduleService = require('../../src/services/ScheduleService');
const ActionType = require('../../src/services/ActionType');

const ContactScheduleService = require('../../src/services/ContactScheduleService');
jest.mock('../../src/services/ContactScheduleService');

const SendingConfigService = require('../../src/services/SendingConfigService');
jest.mock('../../src/services/SendingConfigService');

const ContactService = require('../../src/services/ContactService');
jest.mock('../../src/services/ContactService');

const ContentSender = require('../../src/services/ContentSender');
jest.mock('../../src/services/ContentSender');

const ActionService = require('../../src/services/ActionService');
jest.mock('../../src/services/ActionService');

const { getRecurrentSchedule } = require('../scheduleTestData');
const { getContact } = require('../contactTestData');
const { getGoodContent, getBadContent } = require('../contentTestData');

const sequelize = require('../../src/storage/sequelize');
jest.mock('../../src/storage/sequelize');

var scheduleService;

beforeEach(async () => {
  process.env.AWS_SDK_LOAD_CONFIG = false;
  process.env.LOG_LEVEL = 'ALL';

  mockSendingConfigService();
  mockContactService();
  mockContactScheduleService();
  mockContentSender();
  mockActionService();

  sequelize.get = () => {
    return { models: { Settings: { findAll: () => [] } } };
  };

  let batchSize = 2;
  let maxConcurrency = 1;
  scheduleService = new ScheduleService(batchSize, maxConcurrency);
});

test('send Schedule Test V2 mode', async () => {
  let dryRun = true;
  let schedule = getRecurrentSchedule();
  await scheduleService._sendScheduleV2(schedule, dryRun);
  expect(newActionsWithPackage).toHaveBeenCalledTimes(2);
  expect(newActionsWithPackage).toHaveBeenNthCalledWith(1, ActionType.send_content_for_contact, expect.anything());
  expect(newActionsWithPackage).toHaveBeenNthCalledWith(2, ActionType.send_content_for_contact, expect.anything());

  expect(newActionsWithPackage.mock.calls[0][1]).toHaveLength(2);
  expect(newActionsWithPackage.mock.calls[1][1]).toHaveLength(1);
});

function mockSendingConfigService() {
  let filterOfSendingConfig = { type: 'or', children: [] };

  SendingConfigService.mockImplementation(() => {
    return {
      getFilterOfSendingConfig: () => {
        return filterOfSendingConfig;
      }
    };
  });
}

function mockContactScheduleService() {
  let content1 = getGoodContent();
  let content2 = getBadContent();
  let theVersion = { id: 1 };
  let resolveContentResult = {};
  resolveContentResult[content1.id] = { content: content1, contentVersion: theVersion, count: 0, lastOccurenceDays: null };
  resolveContentResult[content2.id] = { content: content2, contentVersion: theVersion, count: 0, lastOccurenceDays: null };

  ContactScheduleService.mockImplementation(() => {
    return {
      resolve_contents: () => {
        return resolveContentResult;
      },
      retrieveContentForContact: () => {
        return { bestContent: { contentId: getGoodContent().id }, details: {} };
      }
    };
  });
}

function mockContactService() {
  let contact1 = getContact();
  contact1.id = 1;
  let contact2 = getContact();
  contact2.id = 2;
  let contact3 = getContact();
  contact3.id = 3;
  ContactService.mockImplementation(() => {
    return {
      findAll: (offset) => {
        if (offset == 0) {
          return [contact1, contact2, contact3];
        } else {
          return [];
        }
      }
    };
  });
}

function mockContentSender() {
  ContentSender.mockImplementation(() => {
    return {
      extractSenderConfigForContact: () => {
        return { minScoreByEsp: { default: 10 }, autoUpdates: { default: { enabled: false, minOpenRate: 19 } }, senderId: '7', weight: 33 };
      }
    };
  });
}

var newActionsWithPackage = jest.fn();
function mockActionService() {
  ActionService.mockImplementation(() => {
    return {
      newActionsWithPackage: newActionsWithPackage
    };
  });
}
