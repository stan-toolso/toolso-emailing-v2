const openAndClickRateScorer = require('./openAndClickRateScorer');

const minNoteCoeff = 0.5;

function recommendationScorer(content, params, contact) {
  if (!contact || !contact.recommendations || !Object.keys(contact.recommendations).length) {
    return openAndClickRateScorer(content, params, contact);
  }
  if (Object.keys(contact.recommendations).includes(content.content.id.toString())) {
    return contact.recommendations[content.content.id];
  } else {
    return minNoteCoeff * Math.min(...Object.values(contact.recommendations));
  }
}

module.exports = recommendationScorer;
