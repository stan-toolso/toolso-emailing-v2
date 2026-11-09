import React, { useState, useEffect, useCallback } from 'react';

import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';
import BlacklistedContactTable from './BlacklistedContactTable';
import BlacklistContactModal from './BlacklistContactModal';

const BLACKLISTED_CONTACTS = gql`
  query blacklistedContacts($limit: Int, $offset: Int, $filter: JSON) {
    blacklistedContacts(limit: $limit, offset: $offset, filter: $filter) {
      total
      limit
      offset
      blacklistedContacts {
        id
        email
        md5
        sha1
      }
    }
  }
`;

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  const [filter, setFilter] = useState({});
  const [blacklistedContacts, setBlacklistedContacts] = useState([]);

  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  const updateFilter = useCallback(
    (newFilter) => {
      setFilter({ ...newFilter });
    },
    [setFilter]
  );

  const { loading, data, refetch } = useQuery(BLACKLISTED_CONTACTS, {
    variables: {
      limit: limit,
      offset: offset,
      filter: filter
    }
  });

  useEffect(() => {
    (async () => {
      let variables = {
        limit: limit,
        offset: offset,
        filter: filter
      };
      await refetch(variables);
    })();
  }, [filter, limit, offset, refetch]);

  useEffect(() => {
    if (data) {
      setTotal(data.blacklistedContacts.total);
      setBlacklistedContacts(data.blacklistedContacts.blacklistedContacts);
    }
  }, [setTotal, setBlacklistedContacts, data]);

  return (
    <CRow>
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Blacklisted Contacts
            <CButton
              size="sm"
              color="primary"
              className="float-right mx-1"
              onClick={() => {
                setShowBlacklistModal(true);
                refetch();
              }}
            >
              Blacklist Contact
            </CButton>
          </CCardHeader>
          <CCardBody className="p-0">
            <BlacklistContactModal
              show={showBlacklistModal}
              toggle={() => {
                setShowBlacklistModal(false);
                refetch();
              }}
            />

            <>
              <div className="mb-0 p-2">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
              </div>

              <BlacklistedContactTable loading={loading} blacklistedContacts={blacklistedContacts} filter={filter} setFilter={updateFilter} />
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
