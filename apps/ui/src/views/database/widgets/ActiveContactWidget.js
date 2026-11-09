import React from 'react';
import { CWidgetDropdown, CSpinner } from '@coreui/react';
import ChartLineSimple from '../../charts/ChartLineSimple';

const MIN_SCORE = 51;
export default (props) => {
  const lastContactStats = props.lastContactStats;
  const contactStatsHistory = props.contactStatsHistory;

  if (!lastContactStats || !lastContactStats.stats) {
    return <></>;
  }
  let activeContacts = 0;
  if ('contactByActivityScores' in lastContactStats.stats) {
    for (let score = MIN_SCORE; score <= 100; score++) {
      if (score.toString() in lastContactStats.stats.contactByActivityScores) {
        activeContacts += lastContactStats.stats.contactByActivityScores[score.toString()];
      }
    }
  }
  let dataPoints = [];
  if (contactStatsHistory) {
    for (let item of contactStatsHistory) {
      let value = 0;
      for (let score = MIN_SCORE; score <= 100; score++) {
        if (score.toString() in item.stats.contactByActivityScores) {
          value += item.stats.contactByActivityScores[score.toString()];
        }
      }
      dataPoints.unshift(value);
    }
  }

  if (props.loading) {
    return (
      <div className="card text-white bg-gradient-warning" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CWidgetDropdown
      color="gradient-warning"
      header={activeContacts.toString()}
      text="Active contacts"
      footerSlot={
        <ChartLineSimple
          className="mt-3"
          style={{ height: '70px' }}
          dataPoints={dataPoints}
          backgroundColor="rgba(255,255,255,.2)"
          pointHoverBackgroundColor="warning"
          options={{ elements: { line: { borderWidth: 2.5 } } }}
          label="Active contacts"
          labels="contacts"
        />
      }
    ></CWidgetDropdown>
  );
};
