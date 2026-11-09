import { gql, useQuery } from '@apollo/client';
import { CSelect } from '@coreui/react';
import React, { useEffect, useState } from 'react';

export default ({ sendingConfigId, setSendingConfigId }) => {
  const [sendingConfigs, setSendingConfigs] = useState([]);

  const { data } = useQuery(gql`
    query sendingConfigs {
      sendingConfigs {
        id
        name
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setSendingConfigs(data.sendingConfigs);
    }
  }, [data, setSendingConfigs]);

  return (
    <CSelect
      size="sm"
      value={sendingConfigId ? sendingConfigId : ''}
      onChange={(event) => {
        let value = parseInt(event.target.value);
        if (!value) {
          setSendingConfigId(null);
        } else {
          let sendingConfig = sendingConfigs.filter((s) => {
            return parseInt(s.id) === value;
          })[0];
          setSendingConfigId(sendingConfig.id);
        }
      }}
    >
      <option value=""> -- Select your sendingConfig --</option>
      {sendingConfigs.map((item, index) => {
        return (
          <option key={index} value={item.id}>
            {item.name}
          </option>
        );
      })}
    </CSelect>
  );
};
