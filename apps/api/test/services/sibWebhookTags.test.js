const { isSibEventForOtherBase, handleSibEvent } = require('../../src/api/webhooks/webhookHandlers');

describe('Webhook Brevo : compte partagé entre plusieurs bases', () => {
  const uid = process.env.RESOURCE_UID;
  beforeAll(() => {
    process.env.RESOURCE_UID = 'guide';
  });
  afterAll(() => {
    process.env.RESOURCE_UID = uid;
  });

  test('événement de cette base (tls_<uid>) : traité', () => {
    expect(isSibEventForOtherBase({ event: 'delivered', tags: ['tls_guide', 'toolso', 'schedule_3'] })).toBe(false);
    expect(isSibEventForOtherBase({ event: 'delivered', tag: 'tls_guide' })).toBe(false);
  });

  test('autre instance v2 ou toolso-media : ignoré', () => {
    expect(isSibEventForOtherBase({ event: 'hard_bounce', tags: ['tls_autre', 'toolso'] })).toBe(true);
    expect(isSibEventForOtherBase({ event: 'spam', tags: ['product_1', 'slot_3', 'email_1', 'uid_client'] })).toBe(true);
    expect(isSibEventForOtherBase({ event: 'spam', tag: ['uid_client'] })).toBe(true);
  });

  test('sans étiquette : traité comme avant', () => {
    expect(isSibEventForOtherBase({ event: 'delivered' })).toBe(false);
    expect(isSibEventForOtherBase({ event: 'delivered', tags: [] })).toBe(false);
  });

  test('handleSibEvent répond OK sans rien enregistrer pour une autre base', async () => {
    await expect(handleSibEvent({ body: JSON.stringify({ event: 'unsubscribed', email: 'a@b.c', tags: ['uid_client'] }) })).resolves.toBe('OK');
  });
});
