import React, { useState, useEffect } from 'react';

import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import EventTable from './EventTable';
import Pagination from '../../../common/Pagination';
import RangeDatePicker from '../../../common/RangeDatePicker';

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState({});

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const { loading, data } = useQuery(
    gql`
      query contactEvents($limit: Int, $offset: Int, $filter: JSON) {
        contactEvents(limit: $limit, offset: $offset, filter: $filter) {
          total
          limit
          offset

          events {
            id
            type
            date
            messageId
            content {
              name
            }
            schedule {
              name
            }
            contact {
              id
              email
            }
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset,
        filter: {
          ...filter,
          fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
          toDate: toDate ? toDate.format('YYYY-MM-DD') : null
        }
      },
      skip: !fromDate || !toDate,
      fetchPolicy: 'network-only'
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.contactEvents.total);
      setEvents(data.contactEvents.events);
    }
  }, [setTotal, setEvents, data]);

  return (
    <CRow>
      <CCol xl={12}>
        <CCard>
          <CCardHeader>Contact Events</CCardHeader>
          <CCardBody className="px-0">
            <>
              <CRow className="mb-0">
                <CCol sm="6">
                  <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="today" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
                </CCol>

                <CCol sm="6">
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
                </CCol>
              </CRow>

              <EventTable loading={loading} events={events} showContactInfo={true} filter={filter} setFilter={setFilter} />

              <div className="mb-0 p-2">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
              </div>
            </>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
