import { gql, useQuery } from '@apollo/client';
import { CSelect } from '@coreui/react';
import React, { useEffect, useState } from 'react';

export default ({ senderId, setSender }) => {
  const [senders, setSenders] = useState([]);

  const { data } = useQuery(gql`
    query senders {
      senders {
        id
        name
        email
        mailRouter {
          id
          name
          type
        }
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setSenders(data.senders);
    }
  }, [data, setSenders]);

  return (
    <CSelect
      size="sm"
      value={senderId ? senderId : ''}
      onChange={(event) => {
        let value = parseInt(event.target.value);
        if (!value) {
          setSender(null);
        } else {
          let sender = senders.filter((s) => {
            return parseInt(s.id) === value;
          })[0];
          setSender(sender);
        }
      }}
    >
      <option value=""> -- Select your sender --</option>
      {senders.map((item, index) => {
        let routerType = item.mailRouter ? `(${item.mailRouter.type})` : '';
        return (
          <option key={index} value={item.id}>
            {item.name} - {item.email} - {routerType}
          </option>
        );
      })}
    </CSelect>
  );
};
