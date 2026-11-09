import React, { useState } from 'react';
import { CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import { InscriptionStatsRow } from '../../inscriptions/InscriptionStatsRow';
import RangeDatePicker from '../../../../common/RangeDatePicker';
import { InscriptionStatsFields, InscriptionStatsFieldsSelector } from '../../inscriptions/InscriptionStatsFieldsSelector';

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [fields, setFields] = useState([InscriptionStatsFields.uniqueInscriptions, InscriptionStatsFields.uniqueActivation]);

  const { data: dataSources } = useQuery(
    gql`
      query contactSources($limit: Int!, $offset: Int!, $filter: JSON) {
        contactSources(limit: $limit, offset: $offset, filter: $filter) {
          sources {
            id
            name
            utmSource
            parentSourceId
            childSources {
              id
              name
            }
          }
        }
      }
    `,
    {
      variables: {
        limit: 1000,
        offset: 0,
        filter: {}
      }
    }
  );

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

  let dates = [];
  if (fromDate && toDate) {
    let currentDate = toDate.clone();
    while (currentDate >= fromDate) {
      dates.push(currentDate.clone());
      currentDate.add(-1, 'days');
    }
  }

  let sortedSources =
    data && dataSources && dataSources.contactSources && dataSources.contactSources.sources
      ? [...dataSources.contactSources.sources, { id: 0, name: 'Unknown' }]
          .filter((source) => !source.parentSourceId)
          .sort((a, b) => {
            return totalSourceInscription(a, data.lastInscriptionStats) > totalSourceInscription(b, data.lastInscriptionStats) ? -1 : 1;
          })
      : [];

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex ">
          <InscriptionStatsFieldsSelector fields={fields} setFields={setFields} />

          <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last20Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
        </div>
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
                    <div style={{ width: '180px', padding: '1px 2px 1px 10px' }}>Source</div>
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
                <InscriptionStatsRow showLabel={true} source={null} itemId={null} subStats={null} label={'TOTAL'} inscriptionStats={data.lastInscriptionStats} dates={dates} fields={fields} />
              )}

              {!loading &&
                data &&
                dataSources &&
                sortedSources.map((source, index) => {
                  return (
                    <InscriptionStatsRow
                      key={index}
                      showLabel={true}
                      label={source.name}
                      source={source}
                      itemId={source.id}
                      subStats={'source'}
                      inscriptionStats={data.lastInscriptionStats}
                      dates={dates}
                      fields={fields}
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

function totalSourceInscription(source, lastInscriptionStats) {
  if (!lastInscriptionStats) {
    return 0;
  }
  let sum = 0;
  for (let item of lastInscriptionStats) {
    let stats = source.id in item.stats.inscriptionBySources ? item.stats.inscriptionBySources[source.id] : null;

    if (stats) {
      sum += stats.count;
    }
  }
  return sum;
}
