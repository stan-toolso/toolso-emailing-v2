import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import ChartLineSimple from '../../charts/ChartLineSimple';
import { formatFloat, formatPercent } from '../../util';

export default (props) => {
  const lastInscriptionStats = props.lastInscriptionStats;
  let today = moment().format('YYYY-MM-DD');
  let todayActivation = '0';
  let dataPoints = [];
  if (lastInscriptionStats) {
    for (let item of lastInscriptionStats) {
      if (item.inscriptionDate === today) {
        let total = item.stats.count;
        let actives = item.stats.actives ? item.stats.actives : 0;
        if (total) {
          todayActivation = formatPercent((actives * 100) / total);
        }
      }
    }
    for (let i = 0; i <= 7; i++) {
      let currentDay = moment()
        .add(-7 + i, 'days')
        .format('YYYY-MM-DD');
      let currentActivation = '0';

      for (let item of lastInscriptionStats) {
        if (item.inscriptionDate === currentDay) {
          let total = item.stats.count;
          let actives = item.stats.actives ? item.stats.actives : 0;
          if (total) {
            currentActivation = formatFloat((actives * 100) / total);
          }
        }
      }
      dataPoints.push(currentActivation);
    }
  }

  if (props.loading) {
    return (
      <div className="card text-white bg-gradient-danger" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CWidgetDropdown
      color="gradient-danger"
      header={todayActivation}
      text="Activation"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="danger"
          options={{ elements: { line: { borderWidth: 2.5 } } }}
          label="Activation"
          labels="Activations"
        />
      }
    ></CWidgetDropdown>
  );
};
