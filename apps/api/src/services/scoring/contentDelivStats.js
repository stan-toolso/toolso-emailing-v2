const getValidDelivStats = (content, useReferenceForComplaints = true) => {
  let stats = content.content.lastDelivStats;
  let minRequestCount = 150;

  if (!stats || !stats.request || stats.request < minRequestCount) {
    stats = content.content.delivStats;
  }

  if (stats && stats.request >= minRequestCount) {
    if (useReferenceForComplaints && content.content.externalStats) {
      stats.ref_unsubcribed = content.content.externalStats.ref_unsubcribed;
      stats.ref_complainted = content.content.externalStats.ref_complainted;
      stats.ref_requests = content.content.externalStats.ref_requests;
    }
    return stats;
  }

  return null;
};

const getValidDelivStatsForEsp = (content, esp, minRequest = 150) => {
  let lastDelivStatsByEsp = content.content.lastDelivStatsByEsp;
  if (lastDelivStatsByEsp) {
    let statOfEsp = lastDelivStatsByEsp[esp];
    if (statOfEsp && statOfEsp.request > minRequest) {
      return statOfEsp;
    }
  }
  return null;
};

const getDelivStatsForEsp = (content, esp) => {
  let lastDelivStatsByEsp = content.content.lastDelivStatsByEsp;
  if (lastDelivStatsByEsp) {
    return lastDelivStatsByEsp[esp];
  }
  return null;
};

module.exports = {
  getValidDelivStats,
  getValidDelivStatsForEsp,
  getDelivStatsForEsp
};
