import React, { useState, useEffect } from 'react';

import { useQuery } from '@apollo/client';

import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';

import InscriptionTable from './InscriptionTable';
import RangeDatePicker from '../../../common/RangeDatePicker';
import { CCol, CRow } from '@coreui/react';

const CONTACT_INSCRIPTIONS = gql`
  query contactInscriptions($limit: Int, $offset: Int, $filter: JSON) {
    contactInscriptions(limit: $limit, offset: $offset, filter: $filter) {
      total
      limit
      offset
      contactInscriptions {
        id
        inscriptionDate
        fields
        collectUrl
        isFirst
        activated
        contact {
          id
          email
          activated
          status
        }
        source {
          id
          name
        }
        sourceName
      }
    }
  }
`;

export default ({ sourceId }) => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState(sourceId ? { sourceId } : {});
  const [inscriptions, setInscriptions] = useState([]);

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const { loading, data } = useQuery(CONTACT_INSCRIPTIONS, {
    variables: {
      limit: limit,
      offset: offset,
      filter: {
        ...filter,
        sourceId,
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null
      }
    },
    skip: !fromDate || !toDate,
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    setOffset(0);
  }, [filter]);

  useEffect(() => {
    if (data) {
      setTotal(data.contactInscriptions.total);
      setInscriptions(data.contactInscriptions.contactInscriptions);
    } else {
      setInscriptions([]);
      setTotal(0);
    }
  }, [setTotal, setInscriptions, data]);

  return (
    <>
      <CRow className="mb-0">
        <CCol sm="6">
          <RangeDatePicker className="d-flex" defaultRangeType="today" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
        </CCol>

        <CCol sm="6">
          <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
        </CCol>
      </CRow>

      <InscriptionTable loading={loading} inscriptions={inscriptions} showContactInfo={true} showSource={!sourceId} filter={filter} setFilter={setFilter} />

      <div className="mt-2">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </>
  );
};
