import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import ChartLineSimple from '../../charts/ChartLineSimple';

export default (props) => {
  const lastInscriptionStats = props.lastInscriptionStats;
  let today = moment().format('YYYY-MM-DD');
  let todayInscriptions = 0;
  let dataPoints = [];
  if (lastInscriptionStats) {
    for (let item of lastInscriptionStats) {
      if (item.inscriptionDate === today) {
        todayInscriptions = item.stats.count;
      }
    }
    for (let i = 0; i <= 7; i++) {
      let currentDay = moment()
        .add(-7 + i, 'days')
        .format('YYYY-MM-DD');
      let currentInscriptions = 0;

      for (let item of lastInscriptionStats) {
        if (item.inscriptionDate === currentDay) {
          currentInscriptions = item.stats.count;
        }
      }
      dataPoints.push(currentInscriptions);
    }
  }

  if (props.loading) {
    return (
      <div className="card text-white bg-gradient-primary" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CWidgetDropdown
      color="gradient-primary"
      header={todayInscriptions.toString()}
      text="Today inscriptions"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="primary"
          options={{ elements: { line: { borderWidth: 2.5 } } }}
          label="Inscriptions"
          labels="contacts"
        />
      }
    ></CWidgetDropdown>
  );
};
