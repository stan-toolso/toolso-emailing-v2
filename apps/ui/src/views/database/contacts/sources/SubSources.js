import React, { useState, useContext } from 'react';
import { CButton, CCol, CCard, CCardHeader, CCardBody, CRow } from '@coreui/react';
import SourceCreateModal from './SourceCreateModal';
import { useHistory } from 'react-router-dom';
import { gql } from '@apollo/client';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import SourceTable from './SourceTable';

export default ({ source, refetch }) => {
  const [showModalCreation, setShowModalCreation] = useState(false);
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <>
      <SourceCreateModal
        show={showModalCreation}
        toggle={() => {
          setShowModalCreation(false);
          refetch();
        }}
        parentSource={source}
      />
      <CRow>
        <CCol xl={12}>
          {source.defaultChildSource && (
            <CButton
              size="sm"
              color="primary"
              onClick={async () => {
                setShowModalCreation(true);
              }}
            >
              Create Sub Source
            </CButton>
          )}
          {!source.defaultChildSource && !source.parentSourceId && (
            <CButton
              size="sm"
              color="primary"
              onClick={async () => {
                let createdItem = await emailingDatabaseApiContext.doMutation({
                  mutation: gql`
                    mutation enableChildSource($sourceId: ID!) {
                      enableChildSource(sourceId: $sourceId) {
                        id
                      }
                    }
                  `,
                  variables: {
                    sourceId: parseInt(source.id)
                  }
                });
                history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/sources/edit/${createdItem?.data?.enableChildSource?.id}/subSources`);
                refetch();
              }}
            >
              Enable Child Sources
            </CButton>
          )}
        </CCol>
      </CRow>
      {source.defaultChildSource && (
        <CRow className={'my-2'}>
          <CCol xl={12}>
            <CCard>
              <CCardHeader>Sub Sources</CCardHeader>
              <CCardBody className="p-0">
                <SourceTable contacts={source?.childSources ? source.childSources : []} parentSource={source} refetch={refetch} />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}
    </>
  );
};
