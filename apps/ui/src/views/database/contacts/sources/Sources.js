import React, { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import Pagination from '../../../common/Pagination';
import SourceTable from './SourceTable';
import SourceCreateModal from './SourceCreateModal';
import AllSourcesInscritipionStatsCard from './stats/AllSourcesInscritipionStatsCard';

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [showModalCreation, setShowModalCreation] = useState(false);

  const { loading, data, refetch } = useQuery(
    gql`
      query contactSources($limit: Int!, $offset: Int!, $filter: JSON) {
        contactSources(limit: $limit, offset: $offset, filter: $filter) {
          total
          limit
          offset
          filter
          sources {
            id
            name
            utmSource
            apiEnabled
            parentSourceId
          }
        }
      }
    `,
    {
      variables: {
        limit,
        offset,
        filter: {}
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.contactSources.total);
    }
  }, [data, setTotal]);

  return (
    <>
      <SourceCreateModal
        show={showModalCreation}
        toggle={() => {
          setShowModalCreation(false);
          refetch();
        }}
      />
      <CRow>
        <CCol xl={12}>
          <CCard>
            <CCardHeader>
              Sources
              <CButton
                size="sm"
                color="primary"
                className="float-right"
                onClick={() => {
                  setShowModalCreation(true);
                }}
              >
                New Source
              </CButton>
            </CCardHeader>
            <CCardBody className="p-0">
              <>
                <div className="mb-0 px-2">
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
                </div>

                <SourceTable loading={loading} contacts={data ? data.contactSources.sources?.filter((source) => !source.parentSourceId) : []} />
                <div className="mb-0 px-2">
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
                </div>
              </>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <AllSourcesInscritipionStatsCard />
        </CCol>
      </CRow>
    </>
  );
};
