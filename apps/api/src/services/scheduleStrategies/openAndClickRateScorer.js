const { getValidDelivStats } = require('../scoring/contentDelivStats');

function openAndClickRateScorer(content, params) {
  let delivStats = getValidDelivStats(content, params.onlyReferenceContactsForComplaintsAndUnsubs);

  let rate = delivStats.unique_open ? delivStats.unique_open : 0;
  rate += 30 * (delivStats.unique_click ? delivStats.unique_click : 0);
  rate -= 5 * (delivStats.unsub ? delivStats.unsub : 0);
  rate -= 15 * (delivStats.complaint ? delivStats.complaint : 0);
  rate = rate / delivStats.request;
  return rate;
}

module.exports = openAndClickRateScorer;
