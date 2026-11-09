import React from 'react';
import { CSpinner, CCard, CCardHeader, CCardBody, CRow, CCol, CCallout } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import { formatInteger } from '../../../util';
import { CChartBar } from '@coreui/react-chartjs';

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

  let range_18_25 = 0;
  let range_26_40 = 0;
  let range_41_55 = 0;
  let range_56Plus = 0;

  let datasets = [
    {
      label: 'Ages',
      backgroundColor: '#f87979',
      data: []
    }
  ];

  let labels = [];
  if (data && data.lastContactStats && data.lastContactStats.stats && data.lastContactStats.stats.contactByAges) {
    let contactByAges = data.lastContactStats.stats.contactByAges;
    for (var i = 0; i <= 100; i++) {
      labels.push(i.toString());
      if (i.toString() in contactByAges) {
        datasets[0].data.push(contactByAges[i.toString()]);
      } else {
        datasets[0].data.push(0);
      }
    }

    for (let age in contactByAges) {
      if (parseInt(age) <= 25) {
        range_18_25 += contactByAges[age];
      } else if (parseInt(age) <= 40) {
        range_26_40 += contactByAges[age];
      } else if (parseInt(age) <= 55) {
        range_41_55 += contactByAges[age];
      } else if (parseInt(age) > 55) {
        range_56Plus += contactByAges[age];
      }
    }
  }

  return (
    <CCard>
      <CCardHeader>Age repartition</CCardHeader>
      <CCardBody>
        <CRow>
          <CCol sm="6" lg="3">
            <CCallout color="info">
              <small className="text-muted">18 to 25</small>
              <br />
              <strong className="h4">{formatInteger(range_18_25)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="danger">
              <small className="text-muted">26 to 40</small>
              <br />
              <strong className="h4">{formatInteger(range_26_40)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="warning">
              <small className="text-muted">41 to 55</small>
              <br />
              <strong className="h4">{formatInteger(range_41_55)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="success">
              <small className="text-muted">56+</small>
              <br />
              <strong className="h4">{formatInteger(range_56Plus)}</strong>
            </CCallout>
          </CCol>
        </CRow>
        <CRow>
          <CCol sm="12" lg="12">
            <CChartBar
              type="bar"
              datasets={datasets}
              labels={labels}
              options={{
                tooltips: {
                  enabled: true
                },
                scales: {
                  xAxes: [
                    {
                      categoryPercentage: 1.0,
                      barPercentage: 1.0
                    }
                  ]
                },
                maintainAspectRatio: false
              }}
              style={{ height: '300px' }}
              height={300}
            ></CChartBar>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};
