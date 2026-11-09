const ecpmScore = (stats, eCpm) => {
  //TODO : Peut etre le merger avec qualityScore car c'est du code duppliqué modulo les constantes quui différentent et qui seront à terme variabilisées.
  var lambda = 30;
  if (!stats || !stats.request) {
    return null;
  }

  let unsubCount = stats.ref_requests ? ((stats.ref_unsubcribed ?? 0) * stats.request * 1.0) / stats.ref_requests : stats.unsub;
  let complaintCount = stats.ref_requests ? ((stats.complainted ?? 0) * stats.request * 1.0) / stats.ref_requests : stats.complaint;

  var activityRate = eCpm + (4 * (stats.unique_open - 3 * unsubCount - 15 * (complaintCount + (stats.content_bounce ?? 0)))) / stats.request;
  var contactRate = stats.contact_scores / (100 * stats.request);
  var normalizedRate = 2 * ((activityRate + 1 - contactRate) / 30) - 0.1;
  var result = 1 / (1 + Math.pow(Math.E, -lambda * normalizedRate));
  return result * 100;
};
module.exports = module.exports = {
  ecpmScore
};
