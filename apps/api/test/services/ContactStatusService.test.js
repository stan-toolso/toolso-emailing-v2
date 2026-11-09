const ContactStatusService = require('../../src/services/ContactStatusService');
const sequelize = require('../../src/storage/sequelize');
jest.mock('../../src/storage/sequelize');
const ContactStatus = require('../../src/storage/models/ContactStatus');

let contactStatusService = null;
beforeEach(async () => {
  process.env.LOG_LEVEL = 'ALL';
  sequelize.get = () => {
    return { models: { Settings: { findAll: () => [] } } };
  };
  jest.useFakeTimers();
  jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
  contactStatusService = new ContactStatusService();
});

test('contact without Clicks has an average score', async () => {
  let theContact = getContact();
  let score = contactStatusService.getClickQualityScore(theContact, []);
  expect(score).toBe(75);
});

test('perfect contact has very good score', async () => {
  let theContact = getContact();
  theContact.stats.request = 20;
  theContact.stats.click = 2;
  theContact.stats.unique_click = 2;
  let score = contactStatusService.getClickQualityScore(theContact, []);
  expect(score > 95).toBeTruthy();
});

test('contact with no captcha validation has a law score', async () => {
  let theContact = getContact();
  theContact.stats.click = 10;
  theContact.stats.unique_click = 10;
  theContact.stats.click_validation_asked = 10;
  theContact.stats.click_validation_checked = 0;
  let score = contactStatusService.getClickQualityScore(theContact, []);
  expect(score < 50).toBeTruthy();
});

test('contact with problematic click vs request ratio has an average score', async () => {
  let theContact = getContact();
  theContact.stats.request = 10;
  theContact.stats.click = 10;
  theContact.stats.unique_click = 10;
  theContact.stats.click_validation_asked = 10;
  theContact.stats.click_validation_checked = 10;
  let score = contactStatusService.getClickQualityScore(theContact, []);
  expect(score >= 50).toBeTruthy();
  expect(score <= 80).toBeTruthy();
});

test('contact with anormal click delay has an average score', async () => {
  let theContact = getContact();
  let score = contactStatusService.getClickQualityScore(theContact, getEvents());
  expect(score <= 85).toBeTruthy();
});

function getContact() {
  return {
    email: 'stanboude@gmail.com',
    segment: 1,
    esp: 'gmail',
    firstname: 'Stan',
    lastname: 'Giraudet',
    activityScore: 60,
    status: ContactStatus.workable,
    changed: () => {},
    save: () => {},
    stats: { request: 4, click: 0, unique_click: 0 }
  };
}

function getEvents() {
  return [
    {
      id: 1215909439,
      date: '2023-02-03T07:41:17.263Z',
      requestDate: '2023-02-03T07:36:17.263Z',
      type: 'click',
      messageId: '32E78AD9-432A-4435-8A4E-EB79D81E20E4',
      esp: 'gmail',
      isUnique: null,
      details: {
        totalContents: 23,
        totalContentsTypes: ['marketing'],
        totalContentsForContact: 21,
        totalNewContentsForContact: 14,
        totalNewContentsForContactByType: {
          marketing: 14
        },
        totalContentsForContactWithScores: 21,
        totalNewContentsForContactWithScores: 14,
        bestContentCount: 0
      },
      activityScore: 95.65,
      createdAt: '2023-02-03T07:41:17.520Z',
      updatedAt: '2023-02-03T07:43:34.344Z',
      contactId: 1663497,
      senderId: 22,
      ipAddressId: 22,
      sourceId: 5,
      inscriptionId: 3205170,
      contentId: 7176,
      contentVersionId: 17972,
      scheduleId: 1
    },
    {
      id: 1215909439,
      date: '2023-02-03T07:41:17.263Z',
      requestDate: '2023-02-03T07:41:17.263Z',
      type: 'click',
      messageId: '32E78AD9-432A-4435-8A4E-EB79D81E20E4',
      esp: 'gmail',
      isUnique: null,
      details: {
        totalContents: 23,
        totalContentsTypes: ['marketing'],
        totalContentsForContact: 21,
        totalNewContentsForContact: 14,
        totalNewContentsForContactByType: {
          marketing: 14
        },
        totalContentsForContactWithScores: 21,
        totalNewContentsForContactWithScores: 14,
        bestContentCount: 0
      },
      activityScore: 95.65,
      createdAt: '2023-02-03T07:41:17.520Z',
      updatedAt: '2023-02-03T07:43:34.344Z',
      contactId: 1663497,
      senderId: 22,
      ipAddressId: 22,
      sourceId: 5,
      inscriptionId: 3205170,
      contentId: 7176,
      contentVersionId: 17972,
      scheduleId: 1
    },
    {
      id: 1215909439,
      date: '2023-02-03T07:41:17.263Z',
      requestDate: '2023-02-03T07:41:17.263Z',
      type: 'click',
      messageId: '32E78AD9-432A-4435-8A4E-EB79D81E20E4',
      esp: 'gmail',
      isUnique: null,
      details: {
        totalContents: 23,
        totalContentsTypes: ['marketing'],
        totalContentsForContact: 21,
        totalNewContentsForContact: 14,
        totalNewContentsForContactByType: {
          marketing: 14
        },
        totalContentsForContactWithScores: 21,
        totalNewContentsForContactWithScores: 14,
        bestContentCount: 0
      },
      activityScore: 95.65,
      createdAt: '2023-02-03T07:41:17.520Z',
      updatedAt: '2023-02-03T07:43:34.344Z',
      contactId: 1663497,
      senderId: 22,
      ipAddressId: 22,
      sourceId: 5,
      inscriptionId: 3205170,
      contentId: 7176,
      contentVersionId: 17972,
      scheduleId: 1
    },
    {
      id: 1215909439,
      date: '2023-02-03T07:41:17.263Z',
      requestDate: '2023-02-03T07:41:17.263Z',
      type: 'click',
      messageId: '32E78AD9-432A-4435-8A4E-EB79D81E20E4',
      esp: 'gmail',
      isUnique: null,
      details: {
        totalContents: 23,
        totalContentsTypes: ['marketing'],
        totalContentsForContact: 21,
        totalNewContentsForContact: 14,
        totalNewContentsForContactByType: {
          marketing: 14
        },
        totalContentsForContactWithScores: 21,
        totalNewContentsForContactWithScores: 14,
        bestContentCount: 0
      },
      activityScore: 95.65,
      createdAt: '2023-02-03T07:41:17.520Z',
      updatedAt: '2023-02-03T07:42:34.344Z',
      contactId: 1663497,
      senderId: 22,
      ipAddressId: 22,
      sourceId: 5,
      inscriptionId: 3205170,
      contentId: 7176,
      contentVersionId: 17972,
      scheduleId: 1
    },
    {
      id: 1215909439,
      date: '2023-02-03T07:41:17.263Z',
      requestDate: '2023-02-03T07:41:17.263Z',
      type: 'click',
      messageId: '32E78AD9-432A-4435-8A4E-EB79D81E20E4',
      esp: 'gmail',
      isUnique: null,
      details: {
        totalContents: 23,
        totalContentsTypes: ['marketing'],
        totalContentsForContact: 21,
        totalNewContentsForContact: 14,
        totalNewContentsForContactByType: {
          marketing: 14
        },
        totalContentsForContactWithScores: 21,
        totalNewContentsForContactWithScores: 14,
        bestContentCount: 0
      },
      activityScore: 95.65,
      createdAt: '2023-02-03T07:41:17.520Z',
      updatedAt: '2023-02-03T07:43:34.344Z',
      contactId: 1663497,
      senderId: 22,
      ipAddressId: 22,
      sourceId: 5,
      inscriptionId: 3205170,
      contentId: 7176,
      contentVersionId: 17972,
      scheduleId: 1
    }
  ];
}
