import React from 'react';
import { CSpinner } from '@coreui/react';
import { CChartLine } from '@coreui/react-chartjs';

const options = {
  responsive: true,
  tooltips: {
    enabled: true
  },
  maintainAspectRatio: false,
  aspectRatio: 1,
  scales: {
    yAxes: [
      {
        stacked: true
      }
    ]
  }
};

let wantedStatuses = [
  { id: 'archived', label: 'Archived', color: 'rgba(0, 216, 255, 0.7)', fill: true },
  { id: 'workable', label: 'Workable', color: 'rgba(65, 184, 131, 0.7)', fill: '-1' },
  { id: 'new', label: 'New', color: '#f6960b', fill: '-1' },
  { id: 'unsub', label: 'Unsub', color: 'rgba(228, 102, 81, 0.7)', fill: '-1' },
  { id: 'complaint', label: 'Complaint', color: 'rgba(221, 27, 22, 0.7)', fill: '-1' },
  { id: 'hard_bounce', label: 'Hard bounce', color: 'rgba(249, 177, 21,0.7)', fill: '-1' }
];

const datasets = (statsByDates) => {
  let statsReorderedByDateAsc = Object.values(statsByDates).slice(0).reverse();

  return wantedStatuses.map((wantedStatus) => {
    return {
      label: wantedStatus.label,
      data: Object.values(statsReorderedByDateAsc).map((statsByDate) => statsByDate.contactByStatus[wantedStatus.id]),
      lineTension: 0.1,
      borderCapStyle: 'butt',
      borderDash: [],
      borderDashOffset: 0.0,
      backgroundColor: wantedStatus.color,
      borderJoinStyle: 'miter',
      fill: wantedStatus.fill
    };
  });
};

export default ({ dates, loading, statsByDates }) => {
  return (
    <>
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0px' }}>
          <CSpinner animation="grow" color="secondary" />
        </div>
      )}
      {!loading && (
        <div className="chart-container" style={{ height: '400px', padding: '10px 0px' }}>
          <CChartLine
            type="line"
            datasets={datasets(statsByDates)}
            labels={dates
              .slice(0)
              .reverse()
              .map((date) => date.format('DD/MM'))}
            options={options}
          />
        </div>
      )}
    </>
  );
};
