import React, { useState } from 'react';

import { calculateAndFormatPercent, calculatePercent, formatFloat, formatInteger, getValueColors } from '../../../common/util';
import { InscriptionStatsLabels, InscriptionStatsFields } from './InscriptionStatsFieldsSelector';
import { SubdimensionSelector } from '../../sendings/deliv/SubdimensionSelector';

export const InscriptionStatsRow = ({ subStats, itemId, label, showLabel, inscriptionStats, dates, fields, source }) => {
  const [subDimensionType, setSubDimensionType] = useState('');
  let subDimensionEsp = subDimensionType === 'esp';
  let subDimensionSubSource = subDimensionType === 'subSource';

  let esps = new Set();
  let volumeByEsp = {};
  let subSources = new Set();
  let subSourceLabels = {};
  let volumeBySubSource = {};

  let statsByDates = {};
  let statsByEspDates = {};
  let statsBySubSourcesDates = {};

  let sums = {
    count: 0,
    actives: 0,
    news: 0,
    newActives: 0,
    uniqueCount: 0,
    uniqueNews: 0,
    uniqueActives: 0,
    uniqueNewActives: 0,
    unique_click: 0,
    request: 0
  };

  if (subDimensionEsp) {
    sums.byEsps = {};
  }
  if (subDimensionSubSource) {
    sums.bySubSources = {};
  }

  for (let item of inscriptionStats) {
    let stats = null;
    if (itemId === null) {
      stats = source?.id ? item.stats.inscriptionBySources[source?.id] : item.stats;
    } else if (subStats === 'esp') {
      let byEsp = source?.id ? item.stats.inscriptionBySources[source?.id]?.inscriptionByEsps : item.stats.inscriptionByEsps;
      if (byEsp) {
        stats = itemId in byEsp ? byEsp[itemId] : null;
      } else {
        stats = null;
      }
    } else if (subStats === 'source') {
      stats = itemId in item.stats.inscriptionBySources ? item.stats.inscriptionBySources[itemId] : null;
      if (subDimensionEsp && stats?.inscriptionByEsps) {
        Object.values(stats.inscriptionByEsps).map((espStat) => {
          esps.add(espStat.name);
          if (!(espStat.name in volumeByEsp)) {
            volumeByEsp[espStat.name] = 0;
          }
          volumeByEsp[espStat.name] += espStat.count;
          return espStat;
        });
      }

      if (subDimensionSubSource && stats?.inscriptionBySubSources) {
        for (let sourceId in stats.inscriptionBySubSources) {
          let subSourceStat = stats.inscriptionBySubSources[sourceId];
          subSources.add(sourceId);
          subSourceLabels[sourceId] = subSourceStat.name;
          if (!(sourceId in volumeBySubSource)) {
            volumeBySubSource[sourceId] = 0;
          }
          volumeBySubSource[sourceId] += subSourceStat.count;
        }
      }
    } else if (subStats === 'subSource') {
      let bySubSource = source?.id ? item.stats.inscriptionBySources[source?.id]?.inscriptionBySubSources : item.stats.inscriptionBySubSources;
      if (bySubSource) {
        stats = itemId in bySubSource ? bySubSource[itemId] : null;
      } else {
        stats = null;
      }
    }
    if (stats) {
      statsByDates[item.inscriptionDate] = { ...stats };
      if (subDimensionEsp) {
        statsByEspDates[item.inscriptionDate] = { ...stats.inscriptionByEsps };
      }
      if (subDimensionSubSource) {
        statsBySubSourcesDates[item.inscriptionDate] = { ...stats.inscriptionBySubSources };
      }
      sums.count += stats.count;
      sums.news += stats.news ? stats.news : 0;
      sums.actives += stats.actives ? stats.actives : 0;
      sums.newActives += stats.newActives ? stats.newActives : 0;
      sums.uniqueCount += stats.uniqueCount ? stats.uniqueCount : 0;
      sums.uniqueNews += stats.uniqueNews ? stats.uniqueNews : 0;
      sums.uniqueActives += stats.uniqueActives ? stats.uniqueActives : 0;
      sums.uniqueNewActives += stats.uniqueNewActives ? stats.uniqueNewActives : 0;
      sums.unique_click += stats.eventStats && stats.eventStats.unique_click ? stats.eventStats.unique_click : 0;
      sums.request += stats.eventStats && stats.eventStats.request ? stats.eventStats.request : 0;
      if (subDimensionEsp && stats.inscriptionByEsps) {
        Object.values(stats.inscriptionByEsps).map((espStat) => {
          if (!sums.byEsps[espStat.name]) {
            sums.byEsps[espStat.name] = {};
          }
          sums.byEsps[espStat.name].count = (sums.byEsps[espStat.name].count ?? 0) + espStat.count;
          sums.byEsps[espStat.name].news = (sums.byEsps[espStat.name].news ?? 0) + espStat.news;
          sums.byEsps[espStat.name].actives = (sums.byEsps[espStat.name].actives ?? 0) + espStat.actives;
          sums.byEsps[espStat.name].newActives = (sums.byEsps[espStat.name].newActives ?? 0) + espStat.newActives;
          sums.byEsps[espStat.name].uniqueCount = (sums.byEsps[espStat.name].uniqueCount ?? 0) + espStat.uniqueCount;
          sums.byEsps[espStat.name].uniqueNews = (sums.byEsps[espStat.name].uniqueNews ?? 0) + espStat.uniqueNews;
          sums.byEsps[espStat.name].uniqueActives = (sums.byEsps[espStat.name].uniqueActives ?? 0) + espStat.uniqueActives;
          sums.byEsps[espStat.name].couuniqueNewActivesnt = (sums.byEsps[espStat.name].uniqueNewActives ?? 0) + espStat.uniqueNewActives;
          sums.byEsps[espStat.name].unique_click = (sums.byEsps[espStat.name].count ?? 0) + espStat.unique_click;
          sums.byEsps[espStat.name].request = (sums.byEsps[espStat.name].count ?? 0) + espStat.request;

          return espStat;
        });
      }

      if (subDimensionSubSource && stats.inscriptionBySubSources) {
        for (let sourceId in stats.inscriptionBySubSources) {
          let subSourceStat = stats.inscriptionBySubSources[sourceId];
          if (!sums.bySubSources[sourceId]) {
            sums.bySubSources[sourceId] = {};
          }
          sums.bySubSources[sourceId].count = (sums.bySubSources[sourceId].count ?? 0) + subSourceStat.count;
          sums.bySubSources[sourceId].news = (sums.bySubSources[sourceId].news ?? 0) + subSourceStat.news;
          sums.bySubSources[sourceId].actives = (sums.bySubSources[sourceId].actives ?? 0) + subSourceStat.actives;
          sums.bySubSources[sourceId].newActives = (sums.bySubSources[sourceId].newActives ?? 0) + subSourceStat.newActives;
          sums.bySubSources[sourceId].uniqueCount = (sums.bySubSources[sourceId].uniqueCount ?? 0) + subSourceStat.uniqueCount;
          sums.bySubSources[sourceId].uniqueNews = (sums.bySubSources[sourceId].uniqueNews ?? 0) + subSourceStat.uniqueNews;
          sums.bySubSources[sourceId].uniqueActives = (sums.bySubSources[sourceId].uniqueActives ?? 0) + subSourceStat.uniqueActives;
          sums.bySubSources[sourceId].couuniqueNewActivesnt = (sums.bySubSources[sourceId].uniqueNewActives ?? 0) + subSourceStat.uniqueNewActives;
          sums.bySubSources[sourceId].unique_click = (sums.bySubSources[sourceId].count ?? 0) + subSourceStat.unique_click;
          sums.bySubSources[sourceId].request = (sums.bySubSources[sourceId].count ?? 0) + subSourceStat.request;
        }
      }
    }
  }

  const ByEsp = ({ esp, fields, dates }) => {
    return fields.map((field, index) => {
      return (
        <tr key={field}>
          {index === 0 && (
            <td rowSpan={fields.length}>
              <div style={{ width: '200px', padding: '5px 2px 0px 10px', height: 5 + 17 * fields.length + 'px' }}>
                <i className="fas fa-caret-right px-2"></i>
                {esp}
              </div>
            </td>
          )}
          <td>
            <div style={{ width: '140px', padding: '1px 2px' }}>{InscriptionStatsLabels[field]}</div>
          </td>
          <td>
            <div style={{ width: '66px', padding: '1px 2px', height: '21px', fontWeight: 'bold' }}>{extractTotalValue(sums.byEsps[esp], field)}</div>
          </td>
          {dates.map((date) => {
            let statValues = {};
            Object.keys(statsByEspDates).map((date) => {
              statValues[date] = statsByEspDates[date][esp];
              return date;
            });
            let { backgroundColor, color, formatedValue } = extractStatsValue(statValues, date, field, sums.byEsps[esp], dates);
            return (
              <td key={date}>
                <div style={{ width: '66px', padding: '1px 2px', backgroundColor, color, height: '21px' }}> {formatedValue}</div>
              </td>
            );
          })}
        </tr>
      );
    });
  };

  const BySubSource = ({ subSource, fields, dates }) => {
    return fields.map((field, index) => {
      return (
        <tr key={field}>
          {index === 0 && (
            <td rowSpan={fields.length}>
              <div style={{ width: '200px', padding: '5px 2px 0px 10px', height: 5 + 17 * fields.length + 'px' }}>
                <i className="fas fa-caret-right px-2"></i>
                {subSourceLabels[subSource]}
              </div>
            </td>
          )}
          <td>
            <div style={{ width: '140px', padding: '1px 2px' }}>{InscriptionStatsLabels[field]}</div>
          </td>
          <td>
            <div style={{ width: '66px', padding: '1px 2px', height: '21px', fontWeight: 'bold' }}>{extractTotalValue(sums.bySubSources[subSource], field)}</div>
          </td>
          {dates.map((date) => {
            let statValues = {};
            Object.keys(statsBySubSourcesDates).map((date) => {
              statValues[date] = statsBySubSourcesDates[date][subSource];
              return date;
            });
            let { backgroundColor, color, formatedValue } = extractStatsValue(statValues, date, field, sums.bySubSources[subSource], dates);
            return (
              <td key={date}>
                <div style={{ width: '66px', padding: '1px 2px', backgroundColor, color, height: '21px' }}> {formatedValue}</div>
              </td>
            );
          })}
        </tr>
      );
    });
  };

  let availableSubDimensions = { esp: { label: 'Esp', value: 'esp' } };
  if (source?.childSources?.length > 0) {
    availableSubDimensions.subSource = { label: 'Sub Source', value: 'subSource' };
  }

  return (
    <tbody className={itemId !== null ? '' : 'font-weight-bold'}>
      {fields.map((field, index) => {
        return (
          <tr key={field}>
            {showLabel && index === 0 && (
              <td rowSpan={fields.length}>
                <div style={{ width: '200px', padding: '5px 2px 0px 10px', height: 5 + 17 * fields.length + 'px' }}>
                  {itemId != null && subStats !== 'esp' && subStats !== 'subSource' && (
                    <SubdimensionSelector filter={{ sourceId: itemId }} subDimensionType={subDimensionType} setSubDimensionType={setSubDimensionType} dimensions={availableSubDimensions} />
                  )}

                  {label}
                </div>
              </td>
            )}
            <td>
              <div style={{ width: '140px', padding: '1px 2px' }}>{InscriptionStatsLabels[field]}</div>
            </td>
            <td>
              <div style={{ width: '66px', padding: '1px 2px', height: '21px', fontWeight: 'bold' }}>{extractTotalValue(sums, field)}</div>
            </td>
            {dates.map((date) => {
              let { backgroundColor, color, formatedValue } = extractStatsValue(statsByDates, date, field, sums, dates);

              return (
                <td key={date}>
                  <div style={{ width: '66px', padding: '1px 2px', backgroundColor, color, height: '21px' }}> {formatedValue}</div>
                </td>
              );
            })}
          </tr>
        );
      })}

      {subDimensionEsp &&
        esps &&
        [...esps]
          .sort((a, b) => {
            return volumeByEsp[b] - volumeByEsp[a];
          })
          .map((esp) => {
            return <ByEsp esp={esp} fields={fields} dates={dates} key={esp} />;
          })}

      {subDimensionSubSource &&
        subSources &&
        [...subSources]
          .sort((a, b) => {
            return volumeBySubSource[b] - volumeBySubSource[a];
          })
          .map((subSource) => {
            return <BySubSource subSource={subSource} fields={fields} dates={dates} key={subSource} />;
          })}
    </tbody>
  );
};

const extractTotalValue = (sums, field) => {
  let formatedValue = '';
  switch (field) {
    case 'inscriptions':
      formatedValue = formatInteger(sums.count);
      break;
    case 'uniqueInscriptions':
      formatedValue = formatInteger(sums.uniqueCount);
      break;
    case 'news':
      formatedValue = formatInteger(sums.news);
      break;
    case 'activations':
      formatedValue = formatInteger(sums.actives);
      break;

    case 'uniqueActivations':
      formatedValue = formatInteger(sums.uniqueActives);
      break;
    case 'newActivations':
      formatedValue = formatInteger(sums.newActives);
      break;
    case 'activation':
      formatedValue = calculateAndFormatPercent(sums.actives, sums.count);
      break;
    case 'uniqueActivation':
      formatedValue = calculateAndFormatPercent(sums.uniqueActives, sums.uniqueCount);
      break;
    case 'newsRate':
      formatedValue = calculateAndFormatPercent(sums.news, sums.count);
      break;
    case 'newActivation':
      formatedValue = calculateAndFormatPercent(sums.newActives, sums.news);
      break;

    case InscriptionStatsFields.uniqueClicks:
      formatedValue = formatInteger(sums.unique_click);
      break;

    case InscriptionStatsFields.uniqueClickRate:
      formatedValue = sums.count ? formatFloat(sums.unique_click / sums.count) : '';
      break;
    case InscriptionStatsFields.requests:
      formatedValue = formatInteger(sums.request);
      break;
    case InscriptionStatsFields.requestsByInscription:
      formatedValue = sums.count ? formatFloat(sums.request / sums.count) : '';
      break;
    default:
      break;
  }
  return formatedValue;
};

const extractStatsValue = (statsByDates, date, field, sums, dates) => {
  let formatedDate = date.format('YYYY-MM-DD');
  let dateStats = statsByDates && formatedDate in statsByDates ? statsByDates[formatedDate] : null;
  let formatedValue = '';
  let colors = { backgroundColor: '#FFF', color: '#000' };

  let inscriptions = dateStats && dateStats.count ? dateStats.count : 0;
  let uniqueInscriptions = dateStats && dateStats.uniqueCount ? dateStats.uniqueCount : 0;
  let actives = dateStats && dateStats.actives ? dateStats.actives : 0;
  let uniqueActives = dateStats && dateStats.uniqueActives ? dateStats.uniqueActives : 0;
  let newActives = dateStats && dateStats.newActives ? dateStats.newActives : 0;
  let news = dateStats && dateStats.news ? dateStats.news : 0;

  let uniqueClicks = dateStats && dateStats.eventStats && dateStats.eventStats.unique_click ? dateStats.eventStats.unique_click : 0;
  let requests = dateStats && dateStats.eventStats && dateStats.eventStats.request ? dateStats.eventStats.request : 0;

  switch (field) {
    case 'inscriptions':
      formatedValue = formatInteger(inscriptions);
      colors = getValueColors(sums.count / dates.length, inscriptions);
      break;
    case 'uniqueInscriptions':
      formatedValue = formatInteger(uniqueInscriptions);
      colors = getValueColors(sums.uniqueCount / dates.length, uniqueInscriptions);
      break;

    case 'activations':
      formatedValue = formatInteger(actives);
      colors = getValueColors(sums.actives / dates.length, actives);
      break;
    case 'uniqueActivations':
      formatedValue = formatInteger(uniqueActives);
      colors = getValueColors(sums.uniqueActives / dates.length, uniqueActives);
      break;
    case 'newActivations':
      formatedValue = formatInteger(newActives);
      colors = getValueColors(sums.newActives / dates.length, newActives);
      break;

    case 'news':
      formatedValue = formatInteger(news);
      colors = getValueColors(sums.news / dates.length, news);
      break;
    case 'activation':
      formatedValue = calculateAndFormatPercent(actives, inscriptions);
      colors = getValueColors(calculatePercent(sums.actives, sums.count), calculatePercent(actives, inscriptions));
      break;

    case 'uniqueActivation':
      formatedValue = calculateAndFormatPercent(uniqueActives, uniqueInscriptions);
      colors = getValueColors(calculatePercent(sums.uniqueActives, sums.uniqueCount), calculatePercent(uniqueActives, uniqueInscriptions));
      break;

    case 'newsRate':
      formatedValue = calculateAndFormatPercent(news, inscriptions);
      colors = getValueColors(calculatePercent(sums.news, sums.count), calculatePercent(news, inscriptions));
      break;
    case 'newActivation':
      formatedValue = calculateAndFormatPercent(newActives, news);
      colors = getValueColors(calculatePercent(sums.newActives, sums.news), calculatePercent(newActives, news));
      break;

    case InscriptionStatsFields.uniqueClicks:
      formatedValue = formatInteger(uniqueClicks);
      colors = getValueColors(sums.unique_click / dates.length, uniqueClicks);
      break;

    case InscriptionStatsFields.uniqueClickRate:
      formatedValue = inscriptions ? formatFloat(uniqueClicks / inscriptions) : '';
      colors = getValueColors(sums.count ? sums.unique_click / sums.count : 0, inscriptions ? uniqueClicks / inscriptions : 0);
      break;

    case InscriptionStatsFields.requests:
      formatedValue = formatInteger(requests);
      colors = getValueColors(sums.requests / dates.length, requests);
      break;

    case InscriptionStatsFields.requestsByInscription:
      formatedValue = inscriptions ? formatFloat(requests / inscriptions) : '';
      colors = getValueColors(sums.count ? sums.requests / sums.count : 0, inscriptions ? requests / inscriptions : 0);
      break;

    default:
      break;
  }
  return { ...colors, formatedValue };
};
