const { getValidDelivStats } = require('../scoring/contentDelivStats');
const { getQualityScore } = require('../scoring/qualityScore');

function qualityScoreScorer(content, params, contact) {
  if ('noClickOptimisationBeforeActivation' in params && !contact.activated) {
    let delivStats = content.content.lastDelivStats;
    return (100 * (delivStats.unique_open ? delivStats.unique_open : 0)) / delivStats.request;
  }

  const defaultQualiscore = 50;

  let delivStats = getValidDelivStats(content, params.onlyReferenceContactsForComplaintsAndUnsubs);

  return delivStats ? getQualityScore(delivStats) : defaultQualiscore;
}

module.exports = qualityScoreScorer;
