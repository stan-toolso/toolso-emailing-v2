const getQualityScore = (stats, clickWeight = 30, openWeight = 1, useOpensInsteadOfRequestsForRate = false) => {
  var lambda = 30;
  if (!stats || !stats.request) {
    return null;
  }

  let requestsOrOpens = useOpensInsteadOfRequestsForRate ? stats.unique_open : stats.request;
  let refRequestsOrOpens = useOpensInsteadOfRequestsForRate ? stats.ref_unique_open : stats.ref_requests;

  if (!requestsOrOpens) {
    return null;
  }

  let unsubCount = refRequestsOrOpens ? ((stats.ref_unsubcribed ?? 0) * requestsOrOpens * 1.0) / refRequestsOrOpens : stats.unsub;
  let complaintCount = refRequestsOrOpens ? ((stats.complainted ?? 0) * requestsOrOpens * 1.0) / refRequestsOrOpens : stats.complaint;

  var activityRate = (openWeight * stats.unique_open + clickWeight * stats.unique_click - 10 * unsubCount - 60 * (complaintCount + (stats.content_bounce ?? 0))) / (22 * requestsOrOpens);
  //var contactRate = stats.contact_scores / (100 * requestsOrOpens);
  var contactRate = 0.5;
  var normalizedRate = 2 * ((29 * activityRate + 1 - contactRate) / 30) - 0.1;
  var result = 1 / (1 + Math.pow(Math.E, -lambda * normalizedRate));
  return result * 100;
};

module.exports = module.exports = {
  getQualityScore
};
