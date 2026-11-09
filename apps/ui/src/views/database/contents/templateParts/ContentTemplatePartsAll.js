import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';
import TemplatePartsTable from './TemplatePartsTable';
import TemplatePartCreateModal from './TemplatePartCreateModal';

const TEMPLATES = gql`
  query contentTemplateParts($limit: Int, $offset: Int, $filter: JSON) {
    contentTemplateParts(limit: $limit, offset: $offset, filter: $filter) {
      total
      contentTemplateParts {
        id
        uid
        name
        createdAt
        updatedAt
      }
    }
  }
`;

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [showModalCreation, setShowModalCreation] = useState(false);

  const { loading, data, refetch } = useQuery(TEMPLATES, {
    variables: {
      limit,
      offset,
      filter: {}
    }
  });

  useEffect(() => {
    if (data) {
      setTotal(data.contentTemplateParts.total);
    }
  }, [data, setTotal]);

  return (
    <CRow>
      <TemplatePartCreateModal
        show={showModalCreation}
        toggle={() => {
          setShowModalCreation(false);
          refetch();
        }}
      />
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Template Part
            <CButton
              size="sm"
              color="primary"
              className="float-right"
              onClick={() => {
                setShowModalCreation(true);
              }}
            >
              New Template Part
            </CButton>
          </CCardHeader>
          <CCardBody>
            <>
              <div className="mb-0">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
              </div>
              <TemplatePartsTable loading={loading} items={data ? data.contentTemplateParts.contentTemplateParts : []} />
              <div className="mt-2">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
              </div>
            </>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
