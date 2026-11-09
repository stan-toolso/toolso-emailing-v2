const InscriptionService = require('../../src/services/InscriptionService');

const sequelize = require('../../src/storage/sequelize');
jest.mock('../../src/storage/sequelize');

let parentSourceConfig = {
  id: 1,
  defaultChildSourceId: 12,
  getChildSources: () => allSources.filter((source) => source.id !== 1)
};

let _inscriptionService = null;

let allSources = [
  { id: 1, defaultChildSourceId: 12, getChildSources: () => allSources.filter((source) => source.id !== 1) },
  {
    id: 11,
    parentSourceId: 1,
    childConfig: {
      type: 'and',
      children: [
        {
          type: 'collectUrl',
          operator: 'is',
          value: 'https://sejour-magique.plein2kdo.com/sponso'
        },
        {
          type: 'esp',
          operator: 'is',
          value: 'gmail'
        }
      ]
    },
    getChildSources: () => []
  },
  {
    id: 12,
    parentSourceId: 1,
    getChildSources: () => []
  },
  {
    id: 13,
    parentSourceId: 1,
    childConfig: {
      type: 'collectUrl',
      operator: 'startsWith',
      value: 'https://www.super-fute.com/inscription-P1/'
    },
    getChildSources: () => []
  },
  {
    id: 14,
    parentSourceId: 1,
    childConfig: {
      type: 'or',
      children: [
        {
          type: 'collectUrl',
          operator: 'is',
          value: 'https://sejour-magique.plein2kdo.com/sponso'
        },
        {
          type: 'esp',
          operator: 'is',
          value: 'orange'
        }
      ]
    },
    getChildSources: () => []
  },
  {
    id: 15,
    parentSourceId: 1,
    childConfig: {
      type: 'collectUrl',
      operator: 'regExp',
      value: '(.*)a=(2778235|2789209)(.*)'
    },
    getChildSources: () => []
  }
];

beforeAll(() => {
  sequelize.get = () => {
    return {
      models: {
        ContactSource: { findAll: () => allSources.filter((source) => source.parentSourceId), findByPk: (id) => allSources.find((source) => source.id === id) },
        Contact: { findAll: () => null }
      }
    };
  };
  _inscriptionService = new InscriptionService();
  clearInterval(_inscriptionService.contactScheduleService._timer);
});

test('and rule', async () => {
  let result = await _inscriptionService.getChildSource(parentSourceConfig, 'toto@gmail.com', 'https://sejour-magique.plein2kdo.com/sponso', '192.168.0.1');
  expect(result?.id).toBe(11);
});

test('get default Child when no rule match', async () => {
  let result = await _inscriptionService.getChildSource(parentSourceConfig, 'toto@gmail.com', 'collectUrl.com/toto', '192.168.0.1');
  expect(result?.id).toBe(12);
});

test('collectUrl startsWith', async () => {
  let result = await _inscriptionService.getChildSource(
    parentSourceConfig,
    'toto@hotmail.com',
    'https://www.super-fute.com/inscription-P1/?c_id=adwords&utm_source=adwords&utm_campaign=adwords&utm_medium=adwords&gclid=EAIaIQobChMI2em09oTc9AIVE5-FCh1fLgPuEAEYASAAEgIOJ_D_BwE',
    '192.168.0.1'
  );
  expect(result?.id).toBe(13);
});

test('esp and or', async () => {
  let result = await _inscriptionService.getChildSource(parentSourceConfig, 'toto@orange.fr', 'collectUrl.com/toto', '192.168.0.1');
  expect(result?.id).toBe(14);
});

test('collectUrl regexp', async () => {
  let result = await _inscriptionService.getChildSource(parentSourceConfig, 'toto@hotmail.com', 'wwww.cdiscountcom/a=2778235', '192.168.0.1');
  expect(result?.id).toBe(15);
});
