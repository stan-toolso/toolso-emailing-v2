function GetFlopScore(delivStats) {
  return delivStats && (delivStats.complaint * 10 + delivStats.unsub) / delivStats.request;
}

function GetTopScore(delivStats) {
  return delivStats && delivStats.unique_click / delivStats.request;
}

module.exports = module.exports = {
  GetFlopScore,
  GetTopScore
};
