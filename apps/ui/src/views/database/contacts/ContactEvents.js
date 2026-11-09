import React, { useState, useEffect } from 'react';
import { CSpinner } from '@coreui/react';

import { gql, useQuery } from '@apollo/client';
import Pagination from '../../common/Pagination';
import EventTable from './events/EventTable';

export default ({ contactId }) => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [events, setEvents] = useState([]);

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
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset,
        filter: {
          contactId
        }
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.contactEvents.total);
      setEvents(data.contactEvents.events);
    }
  }, [setTotal, setEvents, data]);

  return (
    <div>
      <h2>Events</h2>
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0px' }}>
          <CSpinner animation="grow" color="secondary" />
        </div>
      )}
      {!loading && (
        <>
          <EventTable loading={false} events={events} showContactInfo={false} />
        </>
      )}

      <div className="mb-0">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </div>
  );
};
