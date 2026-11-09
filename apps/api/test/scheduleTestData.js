function getRecurrentSchedule() {
  var result = {
    id: 1869,
    name: 'Alerte 09h00 New Site',
    type: 'recurrent',
    status: 'waiting',
    statusDetails: null,
    statusLastDate: null,
    isActive: true,
    uniqueContent: true,
    config: {},
    scheduleDate: '20221003',
    rate: 'day',
    uid: null,
    parentId: null
  };
  result.changed = () => {};
  result.getSendingConfig = () => {
    return {
      espConfigs: [
        {
          senders: [
            {
              minScoreByEsp: { default: 45, yahoo: 49.93, bouygues: 49.25, aol: 51.58, apple: 67.2 },
              senderId: '5',
              weight: 100,
              autoUpdates: {
                default: { enabled: false, minOpenRate: 17 },
                gmail: { enabled: true, minOpenRate: 20 },
                yahoo: { enabled: true, minOpenRate: 16 },
                orange: { enabled: true, minOpenRate: 20 },
                free: { enabled: true, minOpenRate: 20 },
                sfr: { enabled: true, minOpenRate: 20 },
                bouygues: { enabled: true, minOpenRate: 16 },
                aol: { enabled: true, minOpenRate: 16 },
                laposte: { enabled: true, minOpenRate: 20 },
                apple: { enabled: true, minOpenRate: 16 },
                hotmail: { enabled: true, minOpenRate: 20 }
              }
            }
          ],
          esps: ['yahoo', 'bouygues', 'aol', 'apple'],
          default: true
        },
        {
          senders: [
            { minScoreByEsp: { gmail: 0.01 }, autoUpdates: { gmail: { enabled: true, minOpenRate: 15 } }, senderId: '5', weight: 33 },
            { minScoreByEsp: { gmail: 0.01 }, autoUpdates: { gmail: { enabled: true, minOpenRate: 15 } }, senderId: '7', weight: 33 },
            { minScoreByEsp: { gmail: 0.01 }, autoUpdates: { gmail: { enabled: true, minOpenRate: 15 } }, senderId: '8', weight: 34 }
          ],
          esps: ['gmail'],
          default: false
        },
        {
          senders: [
            {
              minScoreByEsp: { orange: 59.03, sfr: 93.55, free: 90.29, laposte: 54.79, hotmail: 65.71 },
              autoUpdates: {
                orange: { enabled: true, minOpenRate: 17 },
                sfr: { enabled: true, minOpenRate: 17 },
                free: { enabled: true, minOpenRate: 17 },
                laposte: { enabled: true, minOpenRate: 17 },
                hotmail: { enabled: true, minOpenRate: 17 }
              },
              senderId: '7',
              weight: 100
            }
          ],
          esps: ['orange', 'free', 'sfr', 'laposte', 'hotmail'],
          default: false
        }
      ]
    };
  };
  return result;
}
exports.getRecurrentSchedule = getRecurrentSchedule;
