const { unwrapSns } = require('../../src/api/webhooks/webhookHandlers');

describe('Webhook SES : enveloppe SNS', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('un événement SES brut passe tel quel', async () => {
    const event = { eventType: 'Bounce', mail: { destination: ['a@b.c'] } };
    expect(await unwrapSns(event)).toEqual({ event });
  });

  test('SubscriptionConfirmation : appelle SubscribeURL sur un hôte SNS', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await unwrapSns({
      Type: 'SubscriptionConfirmation',
      TopicArn: 'arn:aws:sns:eu-west-1:1:t',
      SubscribeURL: 'https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&Token=x'
    });
    expect(res).toEqual({ done: 'Subscribed' });
    expect(global.fetch).toHaveBeenCalledWith('https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&Token=x');
  });

  test('SubscriptionConfirmation : refuse un hôte qui n’est pas SNS', async () => {
    global.fetch = jest.fn();
    for (const url of ['https://evil.example.com/?x', 'http://sns.eu-west-1.amazonaws.com/?x', 'https://sns.eu-west-1.amazonaws.com.evil.io/']) {
      expect(await unwrapSns({ Type: 'SubscriptionConfirmation', SubscribeURL: url })).toEqual({ done: 'Ignored' });
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('Notification SNS non brute : renvoie l’événement SES de Message', async () => {
    const ses = { eventType: 'Complaint', mail: { destination: ['a@b.c'] } };
    expect(await unwrapSns({ Type: 'Notification', Message: JSON.stringify(ses) })).toEqual({ event: ses });
  });
});
