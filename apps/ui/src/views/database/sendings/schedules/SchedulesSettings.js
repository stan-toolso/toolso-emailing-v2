import { gql, useQuery, useMutation } from '@apollo/client';
import { CButton, CFormGroup, CLabel, CSpinner } from '@coreui/react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import React, { useEffect, useState } from 'react';
import SchedulesSelector from './SchedulesSelector';

export default () => {
  const [defaultSchedulesByType, setDefaultSchedulesByType] = useState({});

  const { data, loading, refetch } = useQuery(
    gql`
      query getSettings($names: [String]!) {
        getSettings(names: $names)
      }
    `,
    {
      variables: {
        names: ['defaultSchedulesByType']
      }
    }
  );

  const [updateSettings, { loading: saving }] = useMutation(
    gql`
      mutation updateSettings($settings: JSON!) {
        updateSettings(settings: $settings)
      }
    `
  );

  useEffect(() => {
    if (data && data.getSettings && data.getSettings.defaultSchedulesByType) {
      setDefaultSchedulesByType(JSON.parse(JSON.stringify(data.getSettings.defaultSchedulesByType)));
    }
  }, [data, setDefaultSchedulesByType]);
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0px' }}>
        <CSpinner animation="grow" color="secondary" />
      </div>
    );
  }

  return (
    <>
      {['marketing', 'newsletter'].map((type) => {
        let scheduleIds = defaultSchedulesByType && type in defaultSchedulesByType ? defaultSchedulesByType[type] : [];
        return (
          <Row key={type}>
            <Col>
              <CFormGroup row>
                <Col md="2">
                  <CLabel htmlFor="apiKey" className="pt-0 font-weight-bold">
                    Default schedules for {type} contents
                  </CLabel>
                </Col>
                <Col md="10">
                  <SchedulesSelector
                    scheduleIds={scheduleIds}
                    setScheduleIds={(value) => {
                      defaultSchedulesByType[type] = value;
                      setDefaultSchedulesByType({ ...defaultSchedulesByType });
                    }}
                    types={['recurrent']}
                  />
                </Col>
              </CFormGroup>
            </Col>
          </Row>
        );
      })}
      <Row>
        <Col>
          <CButton
            color="primary"
            onClick={async () => {
              await updateSettings({
                variables: {
                  settings: {
                    defaultSchedulesByType
                  }
                }
              });
              refetch();
            }}
          >
            {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Save
          </CButton>
        </Col>
      </Row>
    </>
  );
};
