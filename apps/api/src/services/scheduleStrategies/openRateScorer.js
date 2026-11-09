const { getValidDelivStats } = require('../scoring/contentDelivStats');

function openRateScorer(content) {
  let delivStats = getValidDelivStats(content);

  return (delivStats.unique_open ? delivStats.unique_open : 0) / delivStats.request;
}

module.exports = openRateScorer;
