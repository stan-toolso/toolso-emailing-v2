import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import ChartLineSimple from '../../charts/ChartLineSimple';
import { gql, useQuery } from '@apollo/client';
import moment from 'moment-timezone';
import { formatFloat, roundFloat } from '../../util';

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
  let avgScore = 0;
  let dataPoints = [];
  if (data) {
    let lastStats = data.contactStats && data.contactStats.length > 0 ? data.contactStats[0] : null;
    if (lastStats && lastStats.stats && lastStats.stats.contactByActivityScores && lastStats.stats.contactByStatus && lastStats.stats.contactByStatus.workable) {
      for (let score in lastStats.stats.contactByActivityScores) {
        avgScore += score * lastStats.stats.contactByActivityScores[score];
      }
      avgScore = avgScore / lastStats.stats.contactByStatus.workable;
    }
    if (data.contactStats) {
      for (let item of data.contactStats) {
        let value = 0;
        if (item.stats && item.stats.contactByActivityScores && item.stats.contactByStatus && item.stats.contactByStatus.workable) {
          for (let score in item.stats.contactByActivityScores) {
            value += score * item.stats.contactByActivityScores[score];
          }
          value = value / item.stats.contactByStatus.workable;
        }

        dataPoints.unshift(roundFloat(value));
      }
    }
  }

  return (
    <CWidgetDropdown
      color="gradient-warning"
      header={formatFloat(avgScore)}
      text="Average score"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="info"
          options={{ elements: { line: { borderWidth: 2 } } }}
          label="Average score"
          labels="Average score"
        />
      }
    ></CWidgetDropdown>
  );
};
