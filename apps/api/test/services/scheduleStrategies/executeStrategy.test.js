var rewire = require('rewire');
const ExecuteStrategy = rewire('../../../src/services/scheduleStrategies/executeStrategy');
const qualityScoreScorer = require('../../../src/services/scheduleStrategies/qualityScoreScorer');
const { executeStrategy } = require('../../../src/services/scheduleStrategies/executeStrategy');
const ScheduleContentStrategies = require('../../../src/services/scheduleStrategies/ScheduleContentStrategies');
const { getGoodContent, getBadContent, getGoodNewContent } = require('../../contentTestData');
const { getContact } = require('../../contactTestData');

beforeEach(() => {
  jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  jest.spyOn(global.Math, 'random').mockRestore();
});

test('default scorer is qualityScore with a powFactor of 4', () => {
  const getScorer = ExecuteStrategy.__get__('getScorer');
  let defaultScorer = getScorer();
  expect(defaultScorer.name).toBe(qualityScoreScorer.name);

  const getParams = ExecuteStrategy.__get__('getParams');
  let params = getParams({}, defaultScorer);
  expect(params.powFactor).toBe(4);
});

test('execute qualiscore strategy', async () => {
  let goodContent = getGoodContent();
  let badContent = getBadContent();
  let theContact = getContact();

  var allContents = getAllContents([badContent, goodContent]);
  var sortedContents = Object.values(allContents);

  let result = await executeStrategy(sortedContents, allContents, ScheduleContentStrategies.qualityScore, {}, theContact);
  expect(result).toEqual(goodContent);
});

test('execute recommendation strategy', async () => {
  let goodContent = getGoodContent();
  let badContent = getBadContent();
  let theContact = getContact();
  theContact.recommendations = {};
  theContact.recommendations[badContent.id] = 5;
  theContact.recommendations[goodContent.id] = 0.1;

  var allContents = getAllContents([badContent, goodContent]);
  let result = await executeStrategy(Object.values(allContents), allContents, ScheduleContentStrategies.recommendation, {}, theContact);
  expect(result).toEqual(badContent);
});

test('execute recommendation strategy when no Reco switch to bestOpenAndClick', async () => {
  let goodContent = getGoodContent();
  let badContent = getBadContent();
  let theContact = getContact();

  var allContents = getAllContents([badContent, goodContent]);
  let result = await executeStrategy(Object.values(allContents), allContents, ScheduleContentStrategies.recommendation, {}, theContact);
  expect(result).toEqual(goodContent);
});

function getAllContents(contents) {
  var allContents = {};
  contents.map((content) => (allContents[content.id] = { content, contentVersion: 0, count: 0, lastOccurenceDays: null }));
  return allContents;
}

test('learning mode has max 10% on new contents', async () => {
  let badOldContent1 = { ...getBadContent(), id: 1 };
  let badOldContent2 = { ...getBadContent(), id: 2 };
  let badOldContent3 = { ...getBadContent(), id: 3 };
  let badOldContent4 = { ...getBadContent(), id: 4 };
  let goodOldContent1 = { ...getGoodContent(), id: 6 };

  let veryGoodNewContent1 = { ...getGoodNewContent(), id: 7 };
  let veryGoodNewContent2 = { ...getGoodNewContent(), id: 8 };

  let theContact = getContact();

  var allContents = getAllContents([badOldContent1, badOldContent2, badOldContent3, badOldContent4, goodOldContent1, veryGoodNewContent1, veryGoodNewContent2]);

  jest.spyOn(global.Math, 'random').mockReturnValue(0.89);
  let result = await executeStrategy(Object.values(allContents), allContents, ScheduleContentStrategies.qualityScore, {}, theContact);
  expect(result).not.toEqual(veryGoodNewContent1);
  expect(result).not.toEqual(veryGoodNewContent2);

  //New contents are only availables when random is higher than 0.9 (10% of volume)
  jest.spyOn(global.Math, 'random').mockReturnValue(0.91);
  result = await executeStrategy(Object.values(allContents), allContents, ScheduleContentStrategies.qualityScore, {}, theContact);
  expect(result).toEqual(veryGoodNewContent1);

  jest.spyOn(global.Math, 'random').mockReturnValue(0.99);
  result = await executeStrategy(Object.values(allContents), allContents, ScheduleContentStrategies.qualityScore, {}, theContact);
  expect(result).toEqual(veryGoodNewContent2);
});
