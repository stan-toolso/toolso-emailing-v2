import React, { useState } from 'react';
import { CCard, CCardBody, CCardHeader, CSpinner, CSelect } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';

import { InscriptionStatsRow } from './InscriptionStatsRow';
import RangeDatePicker from '../../../common/RangeDatePicker';
import { InscriptionStatsFields, InscriptionStatsFieldsSelector } from './InscriptionStatsFieldsSelector';

export default ({ source }) => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  let subSourceModeEnabled = source?.childSources && source?.childSources.length > 0;
  const [mode, setMode] = useState(subSourceModeEnabled ? 'subSource' : 'esp');

  const [fields, setFields] = useState([InscriptionStatsFields.uniqueInscriptions, InscriptionStatsFields.uniqueActivation]);

  const { loading, data } = useQuery(
    gql`
      query lastInscriptionStats($fromInscriptionDate: String!, $toInscriptionDate: String!) {
        lastInscriptionStats(fromInscriptionDate: $fromInscriptionDate, toInscriptionDate: $toInscriptionDate) {
          id
          date
          inscriptionDate
          stats
        }
      }
    `,
    {
      variables: {
        fromInscriptionDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toInscriptionDate: toDate ? toDate.format('YYYY-MM-DD') : null
      },
      skip: !fromDate || !toDate
    }
  );

  const getLabel = (item) => {
    return mode === 'esp' ? item : source.childSources.find((source) => source.id === item)?.name;
  };

  let dates = [];
  if (fromDate && toDate) {
    let currentDate = toDate.clone();
    while (currentDate >= fromDate) {
      dates.push(currentDate.clone());
      currentDate.add(-1, 'days');
    }
  }

  let itemList;
  if (data && data.lastInscriptionStats) {
    switch (mode) {
      case 'esp':
        itemList = extractEspsList(data.lastInscriptionStats, source);
        break;
      case 'subSource':
        itemList = extractSubSourcesList(data.lastInscriptionStats, source);
        break;
      default:
        itemList = [];
    }
  }

  return (
    <CCard>
      <CCardHeader>
        {!subSourceModeEnabled && (
          <>
            <div className="d-flex ">
              <InscriptionStatsFieldsSelector fields={fields} setFields={setFields} />
              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last20Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            </div>
          </>
        )}
        {subSourceModeEnabled && (
          <>
            <div className="d-flex ">
              <CSelect
                size="sm"
                style={{ maxWidth: '170px', marginRight: '3px' }}
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                }}
              >
                <option key={'subSource'} value={'subSource'}>
                  By Sub Source
                </option>
                <option key={'esp'} value={'esp'}>
                  By Esp
                </option>
              </CSelect>
              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last20Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            </div>
            <InscriptionStatsFieldsSelector fields={fields} setFields={setFields} />
          </>
        )}
      </CCardHeader>
      <CCardBody className="p-0">
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}
        {!loading && (
          <div className="table-responsive">
            <table className="table table-sm m-0 stats-table table-bordered " style={{ width: 181 + 141 + dates.length * 67 + 'px' }}>
              <thead>
                <tr>
                  <th>
                    <div style={{ width: '180px', padding: '1px 2px 1px 10px' }}>{mode === 'esp' ? 'Esp' : 'Sub Source'} </div>
                  </th>
                  <th>
                    <div style={{ width: '140px', padding: '1px 2px' }}></div>
                  </th>
                  <th className="text-left">
                    <div style={{ width: '66px', padding: '1px 2px', fontWeight: 'bold' }}>TOTAL</div>
                  </th>
                  {dates.map((date) => {
                    return (
                      <th className="text-left" key={date}>
                        <div style={{ width: '66px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {!loading && data && (
                <InscriptionStatsRow showLabel={true} itemId={null} subStats={null} label={'TOTAL'} inscriptionStats={data.lastInscriptionStats} dates={dates} fields={fields} source={source} />
              )}

              {!loading &&
                data &&
                itemList.map((item, index) => {
                  return (
                    <InscriptionStatsRow
                      key={index}
                      itemId={item}
                      subStats={mode}
                      showLabel={true}
                      label={getLabel(item)}
                      inscriptionStats={data.lastInscriptionStats}
                      dates={dates}
                      fields={fields}
                      source={source}
                    />
                  );
                })}
            </table>
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

function extractEspsList(lastInscriptionStats, source) {
  if (!lastInscriptionStats) {
    return [];
  }
  let esps = {};

  for (let item of lastInscriptionStats) {
    let byEsp = source?.id ? item.stats.inscriptionBySources[source.id]?.inscriptionByEsps : item.stats.inscriptionByEsps;
    if (byEsp) {
      for (let esp in byEsp) {
        esps[esp] = true;
      }
    }
  }
  esps = Object.keys(esps);

  esps.sort((a, b) => {
    return totalEspInscription(a, lastInscriptionStats, source) > totalEspInscription(b, lastInscriptionStats, source) ? -1 : 1;
  });
  return esps;
}

function totalEspInscription(esp, lastInscriptionStats, source) {
  if (!lastInscriptionStats) {
    return 0;
  }
  let sum = 0;
  for (let item of lastInscriptionStats) {
    let byEsp = source?.id ? item.stats.inscriptionBySources[source.id]?.inscriptionByEsps : item.stats.inscriptionByEsps;
    if (byEsp) {
      let stats = esp in byEsp ? byEsp[esp] : null;
      if (stats) {
        sum += stats.count;
      }
    }
  }
  return sum;
}

function extractSubSourcesList(lastInscriptionStats, source) {
  if (!lastInscriptionStats) {
    return [];
  }
  let subSourcesIds = {};

  for (let item of lastInscriptionStats) {
    let bySubSources = source?.id ? item.stats.inscriptionBySources[source.id]?.inscriptionBySubSources : item.stats.inscriptionBySubSources;
    if (bySubSources) {
      for (let subSourceid in bySubSources) {
        subSourcesIds[subSourceid] = true;
      }
    }
  }
  subSourcesIds = Object.keys(subSourcesIds);

  subSourcesIds.sort((a, b) => {
    return totalSubSourceInscription(a, lastInscriptionStats, source) > totalSubSourceInscription(b, lastInscriptionStats, source) ? -1 : 1;
  });
  return subSourcesIds;
}

function totalSubSourceInscription(subSourceId, lastInscriptionStats, source) {
  if (!lastInscriptionStats) {
    return 0;
  }
  let sum = 0;
  for (let item of lastInscriptionStats) {
    let bySubSources = source?.id ? item.stats.inscriptionBySources[source.id]?.inscriptionBySubSources : item.stats.inscriptionBySubSources;
    if (bySubSources) {
      let stats = subSourceId in bySubSources ? bySubSources[subSourceId] : null;
      if (stats) {
        sum += stats.count;
      }
    }
  }
  return sum;
}
