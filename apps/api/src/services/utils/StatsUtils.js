const EventStats = require('../../storage/models/EventStats');

const appendStats = (a, b) => {
  if (typeof a === 'number') {
    if (typeof b === 'number') {
      return a + b;
    }
    return a;
  } else if (typeof a === 'object') {
    if (typeof b === 'object') {
      for (let key in b) {
        if (!(key in a)) {
          a[key] = JSON.parse(JSON.stringify(b[key]));
        } else {
          a[key] = appendStats(a[key], b[key]);
        }
      }
      return a;
    }
  }
  return a;
};
const extractDelivStatsFromObject = (obj) => {
  let delivStats = {};
  Object.values(EventStats).forEach((item) => {
    delivStats[item] = obj[item];
  });
  return delivStats;
};

module.exports = {
  appendStats,
  extractDelivStatsFromObject
};
