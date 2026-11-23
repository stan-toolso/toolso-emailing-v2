const mockNewAction = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/ActionService', () => jest.fn().mockImplementation(() => ({ newAction: mockNewAction })));

const { harakaEventToPayload, classifyHarakaBounce, handleWebhook } = require('../../src/api/webhooks/webhookHandlers');

// événements tels que les publie le greffon Haraka (router/toolso-app.js de toolso-media)
const mail = { ts: 1764000000000, from: 'news@example.com', to: 'contact@example.org', messageId: 'A1B2C3D4-0000-4000-8000-000000000001' };
const bounce = (rcpt, message) => ({
  type: 'emailing_bounce',
  ts: 1764000000500,
  mail,
  bounce: { error: {}, message: message || null, details: rcpt ? [{ original: '<contact@example.org>', ...rcpt }] : [] }
});

describe('Webhook routeur Toolso : événements natifs du greffon Haraka', () => {
  beforeEach(() => mockNewAction.mockClear());

  test('livraison', () => {
    const p = harakaEventToPayload({ type: 'emailing_delivered', ts: 1764000000500, mail });
    expect(p).toMatchObject({ email: 'contact@example.org', eventType: 'delivered', ts: 1764000000500, messageId: mail.messageId });
  });

  test('bounce 5.1.1 (adresse inexistante) : hard bounce', () => {
    const p = harakaEventToPayload(bounce({ dsn_status: '5.1.1', dsn_smtp_response: '550 5.1.1 user unknown' }));
    expect(p).toMatchObject({ eventType: 'hard_bounce', messageId: mail.messageId, email: 'contact@example.org' });
    expect(p.details.dsnStatus).toBe('5.1.1');
  });

  test('classement repris de media', () => {
    expect(classifyHarakaBounce(bounce({ dsn_status: '5.1.2' }).bounce)).toBe('hard_bounce');
    expect(classifyHarakaBounce(bounce({ dsn_status: '5.2.2' }).bounce)).toBe('contact_bounce');
    expect(classifyHarakaBounce(bounce({ dsn_status: '5.7.1' }).bounce)).toBe('soft_bounce');
    expect(classifyHarakaBounce(bounce({ dsn_status: '4.4.1' }).bounce)).toBe('soft_bounce');
    expect(classifyHarakaBounce(bounce(null, '550 5.1.1 <x@y>: Recipient address rejected').bounce)).toBe('hard_bounce');
    expect(classifyHarakaBounce(bounce(null, 'connection refused').bounce)).toBe('soft_bounce');
    // faux hard bounces Orange / tous les MX en échec
    expect(classifyHarakaBounce(bounce({ dsn_status: '5.2.0', dsn_smtp_response: '550 5.2.0 OFR_506 ...' }).bounce)).toBe('soft_bounce');
    expect(classifyHarakaBounce(bounce({ dsn_status: '5.1.1', message: 'Error: Too many failures (Tried all MXs)' }).bounce)).toBe('soft_bounce');
  });

  test('événement incomplet ou inconnu : ignoré', () => {
    expect(harakaEventToPayload({ type: 'emailing_bounce', mail: { to: 'a@b.c' } })).toBeNull();
    expect(harakaEventToPayload({ type: 'emailing_other', mail })).toBeNull();
  });

  test('POST /webhooks/toolso : insert_contact_event mis en file', async () => {
    const res = await handleWebhook('toolso', JSON.stringify(bounce({ dsn_status: '5.1.1' })));
    expect(res).toBe('OK');
    expect(mockNewAction).toHaveBeenCalledWith('insert_contact_event', expect.objectContaining({ eventType: 'hard_bounce', messageId: mail.messageId }));
  });

  test('format SES historique toujours accepté', async () => {
    const res = await handleWebhook(
      'toolso',
      JSON.stringify({ eventType: 'Bounce', mail: { to: 'a@b.c', messageId: 'm1', timestamp: '2026-11-23T10:00:00Z' }, bounce: { bounceType: 'Permanent', bounceSubType: 'General', timestamp: '2026-11-23T10:00:00Z' } })
    );
    expect(res).toBe('OK');
    expect(mockNewAction).toHaveBeenCalledWith('insert_contact_event', expect.objectContaining({ eventType: 'hard_bounce', messageId: 'm1' }));
  });
});
