import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import ChartLineSimple from '../../charts/ChartLineSimple';
import { gql, useQuery } from '@apollo/client';
import moment from 'moment-timezone';

export default () => {
  const { loading, data } = useQuery(
    gql`
      query contactStats($fromDate: String!, $toDate: String!) {
        contactStats(fromDate: $fromDate, toDate: $toDate) {
          id
          date
          stats
        }
      }
    `,
    {
      variables: {
        fromDate: moment().add(-7, 'days').format('YYYY-MM-DD'),
        toDate: moment().format('YYYY-MM-DD')
      }
    }
  );

  if (loading) {
    return (
      <div className="card text-white bg-gradient-info" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }
  let workables = 0;
  let dataPoints = [];
  if (data) {
    let lastStats = data.contactStats && data.contactStats.length > 0 ? data.contactStats[0] : null;
    if (lastStats) {
      workables = 'workable' in lastStats.stats.contactByStatus ? lastStats.stats.contactByStatus['workable'] : 0;
    }
    if (data.contactStats) {
      for (let item of data.contactStats) {
        let value = 'workable' in item.stats.contactByStatus ? item.stats.contactByStatus['workable'] : 0;

        dataPoints.unshift(value);
      }
    }
  }

  return (
    <CWidgetDropdown
      color="gradient-info"
      header={workables.toString()}
      text="Workable contacts"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="info"
          options={{ elements: { line: { borderWidth: 2 } } }}
          label="Workable contacts"
          labels="contacts"
        />
      }
    ></CWidgetDropdown>
  );
};
