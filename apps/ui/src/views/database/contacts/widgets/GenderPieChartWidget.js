import React from 'react';
import { CSpinner, CCard, CCardHeader, CCardBody } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import { CChartPie } from '@coreui/react-chartjs';

function getGenderLabel(gender) {
  if (gender === 'm') {
    return 'male';
  } else if (gender === 'f') {
    return 'female';
  } else {
    return 'undetermined';
  }
}

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
  let gendersList = [];
  if (data && data.lastContactStats && data.lastContactStats.stats && data.lastContactStats.stats.contactByGenders) {
    for (let gender in data.lastContactStats.stats.contactByGenders) {
      gendersList.push({
        gender,
        count: data.lastContactStats.stats.contactByGenders[gender]
      });
    }
  }
  gendersList.sort((a, b) => (a.count < b.count ? 1 : -1));

  let datasets = [
    {
      backgroundColor: ['#41B883', '#E46651', '#00D8FF', '#DD1B16'],
      data: []
    }
  ];
  let labels = [];

  gendersList.forEach((item) => {
    labels.push(getGenderLabel(item.gender));
    datasets[0].data.push(item.count);
  });
  var options = {
    responsive: true,
    maintainAspectRatio: true
  };

  return (
    <CCard>
      <CCardHeader>Gender repartition</CCardHeader>
      <CCardBody>
        <CChartPie type="pie" datasets={datasets} labels={labels} options={options} />
      </CCardBody>
    </CCard>
  );
};
