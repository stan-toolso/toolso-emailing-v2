import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';
import TemplatesTable from './TemplatesTable';
import TemplateCreateModal from './TemplateCreateModal';

const TEMPLATES = gql`
  query contentTemplates($limit: Int, $offset: Int, $filter: JSON) {
    contentTemplates(limit: $limit, offset: $offset, filter: $filter) {
      total
      contentTemplates {
        id
        name
        html
        subject
        frenchEspsSubject
        senderName
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
  const [templateToClone, setTemplateToClone] = useState(null);

  const { loading, data, refetch } = useQuery(TEMPLATES, {
    variables: {
      limit,
      offset,
      filter: {}
    }
  });

  useEffect(() => {
    if (data) {
      setTotal(data.contentTemplates.total);
    }
  }, [data, setTotal]);

  return (
    <CRow>
      <TemplateCreateModal
        show={showModalCreation}
        templateToClone={templateToClone}
        toggle={() => {
          setShowModalCreation(false);
          refetch();
        }}
      />
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Templates
            <CButton
              size="sm"
              color="primary"
              className="float-right"
              onClick={() => {
                setShowModalCreation(true);
              }}
            >
              New Template
            </CButton>
          </CCardHeader>
          <CCardBody>
            <>
              <div className="mb-0">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
              </div>
              <TemplatesTable
                loading={loading}
                templates={data ? data.contentTemplates.contentTemplates : []}
                cloneTemplate={(template) => {
                  setTemplateToClone(template);
                  setShowModalCreation(true);
                }}
              />
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
