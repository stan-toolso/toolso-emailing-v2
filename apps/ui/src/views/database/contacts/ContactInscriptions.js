import React, { useState, useEffect } from 'react';
import { CSpinner } from '@coreui/react';

import { gql, useQuery } from '@apollo/client';
import InscriptionTable from './inscriptions/InscriptionTable';
import Pagination from '../../common/Pagination';

export default ({ contactId }) => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [inscriptions, setInscriptions] = useState([]);

  const { loading, data } = useQuery(
    gql`
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
      setTotal(data.contactInscriptions.total);
      setInscriptions(data.contactInscriptions.contactInscriptions);
    }
  }, [setTotal, setInscriptions, data]);

  return (
    <div>
      <h2>Inscriptions</h2>
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0px' }}>
          <CSpinner animation="grow" color="secondary" />
        </div>
      )}
      {!loading && (
        <>
          <InscriptionTable loading={false} inscriptions={inscriptions} showContactInfo={false} showStatus={false} />
        </>
      )}

      <div className="mb-0">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </div>
  );
};
