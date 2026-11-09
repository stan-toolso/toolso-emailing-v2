import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import { gql, useQuery } from '@apollo/client';
import ChartLineSimple from '../../../../charts/ChartLineSimple';
import { calculateAndFormatPercent, calculatePercent, roundFloat } from '../../../../common/util';

export default ({ source }) => {
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
        fromInscriptionDate: moment().add(-10, 'days').format('YYYY-MM-DD'),
        toInscriptionDate: moment().format('YYYY-MM-DD')
      }
    }
  );

  const lastInscriptionStats = data ? data.lastInscriptionStats : null;

  let today = moment().format('YYYY-MM-DD');
  let todayInscriptions = 0;
  let todayNews = 0;
  let dataPoints = [];
  if (lastInscriptionStats) {
    for (let item of lastInscriptionStats) {
      if (item.inscriptionDate === today && item.stats.inscriptionBySources) {
        todayInscriptions = source.id in item.stats.inscriptionBySources ? item.stats.inscriptionBySources[source.id].count : 0;
        todayNews = source.id in item.stats.inscriptionBySources && item.stats.inscriptionBySources[source.id].news ? item.stats.inscriptionBySources[source.id].news : 0;
      }
    }
    for (let i = 0; i <= 7; i++) {
      let currentDay = moment()
        .add(-7 + i, 'days')
        .format('YYYY-MM-DD');
      let currentInscriptions = 0;
      let currentNews = 0;

      for (let item of lastInscriptionStats) {
        if (item.inscriptionDate === currentDay && item.stats.inscriptionBySources) {
          currentInscriptions = source.id in item.stats.inscriptionBySources ? item.stats.inscriptionBySources[source.id].count : 0;
          currentNews = source.id in item.stats.inscriptionBySources && item.stats.inscriptionBySources[source.id].news ? item.stats.inscriptionBySources[source.id].news : 0;
        }
      }
      dataPoints.push(roundFloat(calculatePercent(currentNews, currentInscriptions)));
    }
  }

  if (loading) {
    return (
      <div className="card text-white bg-gradient-primary" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CWidgetDropdown
      color="gradient-warning"
      header={calculateAndFormatPercent(todayNews, todayInscriptions)}
      text="Today news rate"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="primary"
          options={{ elements: { line: { borderWidth: 2.5 } } }}
          label="News Rate"
          labels="new rate"
        />
      }
    ></CWidgetDropdown>
  );
};
