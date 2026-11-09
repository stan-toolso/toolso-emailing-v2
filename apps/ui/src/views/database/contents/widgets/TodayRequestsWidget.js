import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import ChartLineSimple from '../../../charts/ChartLineSimple';
import gql from 'graphql-tag';
import { useQuery } from '@apollo/client';

export default () => {
  const { data, loading } = useQuery(
    gql`
      query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String, $filter: JSON) {
        dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType, filter: $filter) {
          dimensionsStats {
            byDayStats {
              day
              stats {
                request
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        fromDate: moment().add(-10, 'days').format('YYYY-MM-DD'),
        toDate: moment().format('YYYY-MM-DD'),
        dimensionType: null,
        filter: {}
      }
    }
  );

  let today = moment().format('YYYY-MM-DD');
  let todayRequests = 0;
  let dataPoints = [];
  if (data) {
    let stats = data.dimensionDelivStats.dimensionsStats.length > 0 ? data.dimensionDelivStats.dimensionsStats[0].byDayStats : [];
    for (let item of stats) {
      if (item.day === today) {
        todayRequests = item.stats.request;
      }
    }
    for (let i = 0; i <= 7; i++) {
      let currentDay = moment()
        .add(-7 + i, 'days')
        .format('YYYY-MM-DD');
      let currentInscriptions = 0;

      for (let item of stats) {
        if (item.day === currentDay) {
          currentInscriptions = item.stats.request;
        }
      }
      dataPoints.push(currentInscriptions);
    }
  }

  if (loading) {
    return (
      <div className="card text-white bg-gradient-primary" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="primary" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CWidgetDropdown
      color="gradient-primary"
      header={todayRequests.toString()}
      text="Today requests"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="primary"
          options={{ elements: { line: { borderWidth: 2.5 } } }}
          label="Requests"
          labels="requests"
        />
      }
    ></CWidgetDropdown>
  );
};
