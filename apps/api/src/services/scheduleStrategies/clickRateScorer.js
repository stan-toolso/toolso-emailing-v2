const { getValidDelivStats } = require('../scoring/contentDelivStats');

function clickRateScorer(content) {
  let delivStats = getValidDelivStats(content);
  return (delivStats.unique_click ? delivStats.unique_click : 0) / delivStats.request;
}

module.exports = clickRateScorer;
