const getEstimateOpeners = (stats) => {
  if (!stats?.request) {
    return null;
  }

  let result = Math.round(stats.unique_open + (stats.unique_proxy_loaded * stats.unique_open) / stats.request);
  return result;
};

const getQualityScore = (stats) => {
  var lambda = 30;
  if (!stats || !stats.request) {
    return null;
  }
  var activityRate = (stats.unique_open + 30 * stats.unique_click - 5 * stats.unsub - 15 * stats.complaint) / (22 * stats.request);
  var contactRate = stats.contact_scores / (100 * stats.request);
  var normalizedRate = 2 * ((29 * activityRate + 1 - contactRate) / 30) - 0.1;
  var result = 1 / (1 + Math.pow(Math.E, -lambda * normalizedRate));
  return Math.round(result * 100);
};

module.exports = module.exports = {
  getEstimateOpeners,
  getQualityScore
};
