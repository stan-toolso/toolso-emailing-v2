import { gql, useMutation, useQuery } from '@apollo/client';
import { CButton, CCard, CCardBody, CCardFooter, CCardHeader, CCol, CLink, CRow, CSpinner } from '@coreui/react';
import React, { useContext, useEffect, useState } from 'react';
import Pagination from '../../../common/Pagination';
import moment from 'moment-timezone';
import { formatInteger } from '../../../common/util';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import ExclusionListCreateModal from './ExclusionListCreateModal';
import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css

export default () => {
  const [showModalCreation, setShowModalCreation] = useState(false);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { data, loading, refetch } = useQuery(
    gql`
      query exclusionLists($limit: Int, $offset: Int, $filter: JSON) {
        exclusionLists(limit: $limit, offset: $offset, filter: $filter) {
          total
          exclusionLists {
            id
            name
            field
            updatedAt
            stats
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset,
        filter: {}
      }
    }
  );
  const [deleteExclusionList] = useMutation(gql`
    mutation EeleteExclusionList($exclusionListId: ID!) {
      deleteExclusionList(exclusionListId: $exclusionListId)
    }
  `);

  useEffect(() => {
    if (data) {
      setTotal(data.exclusionLists.total);
    }
  }, [setTotal, data]);

  const exclusionLists = !loading && data ? data.exclusionLists.exclusionLists : [];

  return (
    <>
      <ExclusionListCreateModal
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
              Exclusion Lists
              <CButton
                size="sm"
                color="primary"
                className="float-right"
                onClick={() => {
                  setShowModalCreation(true);
                }}
              >
                Add exclusion list
              </CButton>
            </CCardHeader>
            <CCardBody className="p-0">
              <>
                <div className="mb-0 p-2">
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
                </div>
                {loading && (
                  <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                    <CSpinner animation="grow" color="secondary" />
                  </div>
                )}
                {!loading && exclusionLists && (
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Field</th>
                        <th>Contacts</th>
                        <th>Last update date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exclusionLists.map((exclusionList) => {
                        return (
                          <tr key={exclusionList.id}>
                            <td>{exclusionList.id}</td>
                            <td>
                              <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/exclusionLists/${exclusionList.id}`}>{exclusionList.name}</CLink>
                            </td>
                            <td>{exclusionList.field}</td>
                            <td>{exclusionList.stats ? formatInteger(exclusionList.stats.count) : 0}</td>
                            <td>{moment(exclusionList.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                            <td>
                              <i
                                className="pl-2 pr-1 fas  fa-trash"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  confirmAlert({
                                    customUI: ({ onClose }) => {
                                      return (
                                        <CCard className="card-accent-danger">
                                          <CCardHeader>Are you sure?</CCardHeader>
                                          <CCardBody>
                                            <p>You want to delete this exclusion list?</p>
                                          </CCardBody>
                                          <CCardFooter>
                                            <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                                              No
                                            </CButton>
                                            <CButton
                                              color="danger"
                                              className="px-5"
                                              onClick={async () => {
                                                await deleteExclusionList({ variables: { exclusionListId: exclusionList.id } });
                                                await refetch();
                                                onClose();
                                              }}
                                            >
                                              Yes, Delete it!
                                            </CButton>
                                          </CCardFooter>
                                        </CCard>
                                      );
                                    }
                                  });
                                }}
                              ></i>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <div className="mb-0 p-2">
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
                </div>
              </>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
};
