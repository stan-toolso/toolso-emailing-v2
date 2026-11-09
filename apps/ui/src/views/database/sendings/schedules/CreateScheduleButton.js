import React from 'react';
import { gql, useMutation } from '@apollo/client';
import { CButton, CSpinner } from '@coreui/react';

export default ({ defaultType, defaultName, onCreated }) => {
  const [createSchedule, { loading }] = useMutation(gql`
    mutation CreateSchedule($name: String!, $type: String!) {
      createSchedule(name: $name, type: $type) {
        id
        name
        isActive
        type
        config
        scheduleDate
        rate
        status
        sendingConfig {
          id
          name
        }
      }
    }
  `);

  return (
    <CButton
      className="my-2"
      color="primary"
      size="sm"
      onClick={async () => {
        let schedule = await createSchedule({
          variables: {
            name: defaultName,
            type: defaultType
          }
        });
        if (onCreated) {
          onCreated(schedule.data.createSchedule);
        }
      }}
    >
      {loading && <CSpinner color="secondary" />}Create new {defaultType} schedule
    </CButton>
  );
};
