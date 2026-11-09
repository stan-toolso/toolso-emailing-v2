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

  let more80 = 0;
  let more60 = 0;
  let more40 = 0;
  let more20 = 0;

  let datasets = [
    {
      label: 'Scores',
      backgroundColor: '#f87979',
      data: []
    }
  ];

  let labels = [];
  if (data && data.lastContactStats && data.lastContactStats.stats && data.lastContactStats.stats.contactByActivityScores) {
    let contactByActivityScores = data.lastContactStats.stats.contactByActivityScores;
    for (var i = 0; i <= 100; i++) {
      labels.push(i.toString());
      if (i.toString() in contactByActivityScores) {
        datasets[0].data.push(contactByActivityScores[i.toString()]);
      } else {
        datasets[0].data.push(0);
      }
    }

    for (let score in contactByActivityScores) {
      if (parseInt(score) >= 80) {
        more80 += contactByActivityScores[score];
      }
      if (parseInt(score) >= 60) {
        more60 += contactByActivityScores[score];
      }
      if (parseInt(score) >= 40) {
        more40 += contactByActivityScores[score];
      }
      if (parseInt(score) >= 20) {
        more20 += contactByActivityScores[score];
      }
    }
  }

  return (
    <CCard>
      <CCardHeader>Score repartition</CCardHeader>
      <CCardBody>
        <CRow>
          <CCol sm="6" lg="3">
            <CCallout color="info">
              <small className="text-muted">Score &gt; 80</small>
              <br />
              <strong className="h4">{formatInteger(more80)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="danger">
              <small className="text-muted">Score &gt; 60</small>
              <br />
              <strong className="h4">{formatInteger(more60)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="warning">
              <small className="text-muted">Score &gt; 40</small>
              <br />
              <strong className="h4">{formatInteger(more40)}</strong>
            </CCallout>
          </CCol>
          <CCol sm="6" lg="3">
            <CCallout color="success">
              <small className="text-muted">Score &gt; 20</small>
              <br />
              <strong className="h4">{formatInteger(more20)}</strong>
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
