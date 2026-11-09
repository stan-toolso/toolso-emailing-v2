const log = require('../../util/log').getLogger('ExecuteStrategy');

const ScheduleContentStrategies = require('./ScheduleContentStrategies');
const clickRateScorer = require('./clickRateScorer');
const qualityScoreScorer = require('./qualityScoreScorer');
const openAndClickRateScorer = require('./openAndClickRateScorer');
const openRateScorer = require('./openRateScorer');
const recommendationScorer = require('./recommendationScorer');
const eCpmScorer = require('./eCpmScorer');
const unsubScorer = require('./unsubScorer');

function getWeightedRate(item, params) {
  let dateReceptionPenaltyPowFactor = params.dateReceptionPenaltyPowFactor;
  let timesReceptionPenaltyMultipicator = params.timesReceptionPenaltyMultipicator;
  let powFactor = params.powFactor;

  let weight = item.content.content.config && 'weight' in item.content.content.config ? item.content.content.config.weight : 1;
  let occurences = item.content.count;

  let weightedRate = Math.max(0.0005, item.rate);

  let dateReceptionPenalty = occurences ? 10000 / Math.pow(1 + item.content.lastOccurenceDays, dateReceptionPenaltyPowFactor) : 0;
  let timesReceptionPenalty =
    (Math.pow(Math.E, occurences * timesReceptionPenaltyMultipicator) - Math.pow(Math.E, -occurences * timesReceptionPenaltyMultipicator)) /
    (Math.pow(Math.E, occurences * timesReceptionPenaltyMultipicator) + Math.pow(Math.E, -occurences * timesReceptionPenaltyMultipicator));
  let occurencePenalty = dateReceptionPenalty + timesReceptionPenalty;
  weightedRate = weightedRate / (1 + occurencePenalty);
  weightedRate = Math.pow(weightedRate, powFactor);
  weightedRate = (1 + (Math.min(1, weight) - 1) / 10) * weightedRate;
  return weightedRate;
}

function getDefaultStrategyType() {
  return ScheduleContentStrategies.qualityScore;
}

function getDefaultParams() {
  return getParams(null, getScorer(getDefaultStrategyType()));
}

function getScorer(contentStrategyType) {
  var scorer;
  if (!contentStrategyType) {
    contentStrategyType = getDefaultStrategyType();
  }
  switch (contentStrategyType) {
    case ScheduleContentStrategies.bestOpen:
      scorer = openRateScorer;
      break;
    case ScheduleContentStrategies.bestClick:
      scorer = clickRateScorer;
      break;
    case ScheduleContentStrategies.qualityScore:
      scorer = qualityScoreScorer;
      break;
    case ScheduleContentStrategies.bestOpenAndClick:
      scorer = openAndClickRateScorer;
      break;
    case ScheduleContentStrategies.recommendation:
      scorer = recommendationScorer;
      break;

    case ScheduleContentStrategies.eCpmScore:
      scorer = eCpmScorer;
      break;
    case ScheduleContentStrategies.unsubScore:
      scorer = unsubScorer;
      break;
    default:
      log.error(`ERROR : strategy Unknown ${contentStrategyType}`);
      scorer = getScorer(getDefaultStrategyType());
      break;
  }

  return scorer;
}

function getParams(params, scorer) {
  if (!params) {
    params = {};
  }
  let defaultPowFactor = scorer.name === qualityScoreScorer.name ? 4 : 1.2;
  params.powFactor = params.powFactor ? params.powFactor : defaultPowFactor;

  params.dateReceptionPenaltyPowFactor = params.dateReceptionPenaltyPowFactor ? params.dateReceptionPenaltyPowFactor : 5;
  params.timesReceptionPenaltyMultipicator = params.timesReceptionPenaltyMultipicator ? params.timesReceptionPenaltyMultipicator : 0.15;

  return params;
}

async function executeStrategy(sortedContents, allContents, contentStrategyType, contactScheduleParams, contact) {
  let rates = [];

  let learningContents = [];

  var scorer = getScorer(contentStrategyType);
  var params = getParams(contactScheduleParams, scorer);

  let avgRateForAllContent = 0;
  let requestsAllContent = 0;
  for (let contentId in allContents) {
    let content = allContents[contentId];
    if (content.content && content.content.lastDelivStats && content.content.lastDelivStats.request) {
      if (params.onlyReferenceContactsForComplaintsAndUnsubs && content.content.externalStats === undefined) {
        content.content.externalStats = await content.content.getExternalStats();
      }
      let rate = await scorer(content, params, contact, allContents);
      if (rate) {
        avgRateForAllContent = (avgRateForAllContent * requestsAllContent + rate * content.content.lastDelivStats.request) / (requestsAllContent + content.content.lastDelivStats.request);
        requestsAllContent += content.content.lastDelivStats.request;
      }
    }
  }

  for (let content of sortedContents) {
    let item = {
      id: content.content.id,
      content,
      rate: null,
      weightedRate: null
    };

    if (contentStrategyType === ScheduleContentStrategies.qualityScoreByEsp || contentStrategyType === ScheduleContentStrategies.eCpmScore) {
      if (content.content) {
        let rate = await scorer(content, params, contact, allContents);
        if (rate) {
          item.rate = rate;

          item.weightedRate = getWeightedRate(item, params);
        } else {
          learningContents.push(item);
        }
      }
    } else {
      const learningModeMaximumRequestCount = 150;
      if (content.content && content.content.delivStats && content.content.delivStats.request > learningModeMaximumRequestCount) {
        let rate = await scorer(content, params, contact, allContents);
        item.rate = rate;
        item.weightedRate = getWeightedRate(item, params);
      } else if (content.content) {
        learningContents.push(item);
      }
    }

    rates.push(item);
  }
  for (let item of rates) {
    if (item.rate == null) {
      item.rate = avgRateForAllContent;

      let weightedRate = getWeightedRate(item, params);
      item.weightedRate = weightedRate;
    }
  }
  let numberOfReceivedNewContents = learningContents.filter((learingContent) => learingContent.content.count > 0).length;
  let minOldContentsforLearningContentsLimitation = 3;
  if (rates.length > learningContents.length + minOldContentsforLearningContentsLimitation) {
    rates = rates.filter((item) => !learningContents.map((item) => item.id).includes(item.id));
  } else {
    if (rates.length > numberOfReceivedNewContents + minOldContentsforLearningContentsLimitation) {
      rates = rates.filter(
        (item) =>
          !learningContents
            .filter((learingContent) => learingContent.content.count > 0)
            .map((item) => item.id)
            .includes(item.id)
      );
    }
  }

  learningContents = learningContents.filter((item) => item.content.count == 0);

  let totalWeightedRate = 0;
  for (let item of rates) {
    totalWeightedRate += item.weightedRate;
  }

  if (rates.length > 3) {
    rates = rates.sort((a, b) => {
      if (a.weightedRate < b.weightedRate) {
        return 1;
      } else {
        return -1;
      }
    });

    //on compte combien on doit en garder. Au minimum 3, plus les suivants si ils ont les mêmes scores que le 3ième
    let badRates = rates.slice(3);
    rates = rates.slice(0, 3);
    rates = [
      ...rates,
      ...badRates.filter((item) => {
        return item.weightedRate == rates[2].weightedRate;
      })
    ];

    //si on a aucun "bon contenu", on privilégie les nouveaux contenus
    //sinon on garde que 10% du volume pour les nouveaux contenus
    let weightForNewContents = 0.1;
    let learningRate = (weightForNewContents * totalWeightedRate) / learningContents.length;
    for (let learningItem of learningContents) {
      if (rates.indexOf(learningItem) >= 0) {
        continue;
      }
      learningItem.rate = learningRate;
      let weight = learningItem.content.content.config && 'weight' in learningItem.content.content.config ? learningItem.content.content.config.weight : 1;
      let weightedRate = weight * learningRate;
      learningItem.weightedRate = weightedRate;
      rates.push(learningItem);
    }
  }

  totalWeightedRate = 0;
  for (let item of rates) {
    totalWeightedRate += item.weightedRate;
  }

  let rand = Math.random() * totalWeightedRate;
  let cursor = 0;
  let bestContent = null;
  for (let item of rates) {
    if (cursor > rand) {
      break;
    }
    bestContent = item.content;
    cursor += item.weightedRate;
  }
  if (!totalWeightedRate || !bestContent) {
    //choose a random one
    bestContent = sortedContents[Math.floor(Math.random() * sortedContents.length)];
  }

  return bestContent.content;
}

module.exports = { executeStrategy, getDefaultStrategyType, getDefaultParams };
