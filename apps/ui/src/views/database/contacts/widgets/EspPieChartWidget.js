import React from 'react';
import { CSpinner, CCard, CCardHeader, CCardBody } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import { CChartPie } from '@coreui/react-chartjs';

export default () => {
  const { loading, data } = useQuery(gql`
    query lastContactStats {
      lastContactStats {
        id
        date
        stats
      }
    }
  `);

  if (loading) {
    return (
      <div className="card text-white bg-gradient-info" style={{ textAlign: 'center', height: '160px' }}>
        <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
      </div>
    );
  }
  let esps = [];
  if (data && data.lastContactStats && data.lastContactStats.stats && data.lastContactStats.stats.contactByEsps) {
    for (let esp in data.lastContactStats.stats.contactByEsps) {
      esps.push({
        esp: esp,
        count: data.lastContactStats.stats.contactByEsps[esp]
      });
    }
  }
  esps.sort((a, b) => (a.count < b.count ? 1 : -1));

  var other = {
    esp: 'Other',
    count: 0
  };
  for (var i = 4; i < esps.length; i++) {
    other.count += esps[i].count;
  }
  esps = esps.slice(0, 4);
  if (other.count > 0) {
    esps.push(other);
  }

  let datasets = [
    {
      backgroundColor: ['#41B883', '#E46651', '#00D8FF', '#DD1B16'],
      data: []
    }
  ];
  let labels = [];

  esps.forEach((item) => {
    labels.push(item.esp);
    datasets[0].data.push(item.count);
  });
  var options = {
    responsive: true,
    maintainAspectRatio: true
  };

  return (
    <CCard>
      <CCardHeader>Esps repartition</CCardHeader>
      <CCardBody>
        <CChartPie type="pie" datasets={datasets} labels={labels} options={options} />
      </CCardBody>
    </CCard>
  );
};
