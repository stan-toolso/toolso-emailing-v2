import { gql, useQuery } from '@apollo/client';
import { CSelect } from '@coreui/react';
import React, { useEffect, useState } from 'react';

export default ({ mailRouterId, setMailRouter }) => {
  const [mailRouters, setMailRouters] = useState([]);

  const { data } = useQuery(gql`
    query mailRouters {
      mailRouters {
        id
        name
        type
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setMailRouters(data.mailRouters);
    }
  }, [data, setMailRouters]);

  return (
    <CSelect
      size="sm"
      value={mailRouterId ? mailRouterId : ''}
      onChange={(event) => {
        let value = parseInt(event.target.value);
        if (!value) {
          setMailRouter(null);
        } else {
          let mailRouter = mailRouters.filter((s) => {
            return parseInt(s.id) === value;
          })[0];
          setMailRouter(mailRouter);
        }
      }}
    >
      <option value=""> -- Select your mailRouter --</option>
      {mailRouters.map((item, index) => {
        return (
          <option key={index} value={item.id}>
            {item.name}
          </option>
        );
      })}
    </CSelect>
  );
};
