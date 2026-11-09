const { getOppositeEsps } = require('../../src/services/EspService');

test('test opossite esp Method', async () => {
  let espOppositeList = getOppositeEsps(['yahoo', 'free', 'sfr', 'bouygues', 'aol', 'laposte', 'apple', 'hotmail', 'gmail', 'orange']);

  expect(espOppositeList).toHaveLength(11);
  expect(espOppositeList).toContain('web');
  expect(espOppositeList).toContain('gmx');
  expect(espOppositeList).toContain('freenet');
  expect(espOppositeList).toContain('telenet');
  expect(espOppositeList).toContain('skynet');
  expect(espOppositeList).toContain('libero');
  expect(espOppositeList).toContain('virgilio');
  expect(espOppositeList).toContain('online');
  expect(espOppositeList).toContain('akeonet');
  expect(espOppositeList).toContain('t-online');
  expect(espOppositeList).toContain('unknown');
});
