import React, { useState, useEffect } from 'react';

import { useQuery } from '@apollo/client';

import gql from 'graphql-tag';
import Pagination from '../../../../common/Pagination';

import MessageRuleTable from './MessageRuleTable';
import { CCol, CRow } from '@coreui/react';

const RULES = gql`
  query contactMessageRules($limit: Int, $offset: Int, $filter: JSON) {
    contactMessageRules(limit: $limit, offset: $offset, filter: $filter) {
      total
      limit
      offset
      rules {
        id
        name
        enabled
        filter
        actions
      }
    }
  }
`;

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [rules, setRules] = useState([]);

  const { loading, data } = useQuery(RULES, {
    variables: {
      limit,
      offset,
      filter: {}
    },
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    if (data) {
      setTotal(data.contactMessageRules.total);
      setRules(JSON.parse(JSON.stringify(data.contactMessageRules.rules)));
    } else {
      setRules([]);
      setTotal(0);
    }
  }, [setTotal, setRules, data]);

  return (
    <>
      <CRow className="mb-0">
        <CCol sm="6"></CCol>

        <CCol sm="6">
          <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
        </CCol>
      </CRow>

      <MessageRuleTable loading={loading} rules={rules} />

      <div className="mt-2">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </>
  );
};
