const { getValidDelivStats } = require('../scoring/contentDelivStats');
const { ecpmScore } = require('../scoring/ecpmScore');

function ecpmScorer(content, params, contact, allContents) {
  let eCpm = null;

  let delivStats = getValidDelivStats(content, params.onlyReferenceContactsForComplaintsAndUnsubs);
  if (content && content.content && content.content.incomesStats && content.content.incomesStats.last) {
    eCpm = content.content.incomesStats.last.eCpm;
  } else if (delivStats) {
    //on a pas de revenus déclarés. On prend l'ECPM moyen.
    let avgCpc = getAvgCpc(Object.values(allContents));
    eCpm = 1000 * (delivStats.unique_click / delivStats.request) * avgCpc;
  }
  if (eCpm !== null && delivStats) {
    return ecpmScore(delivStats, eCpm);
  } else {
    return null;
  }
}

function getAvgCpc(allContents) {
  let totalClicks = 0;
  let totalEstimatedIncome = 0;
  for (let item of allContents) {
    let content = item.content;
    if (content && content.incomesStats && content.incomesStats.last && content.incomesStats.last.stats && content.incomesStats.last.stats.unique_click) {
      totalClicks += content.incomesStats.last.stats.unique_click;
      totalEstimatedIncome += content.incomesStats.last.estimatedIncome;
    }
  }

  if (totalClicks) {
    return totalEstimatedIncome / totalClicks;
  } else {
    return null;
  }
}
module.exports = ecpmScorer;
