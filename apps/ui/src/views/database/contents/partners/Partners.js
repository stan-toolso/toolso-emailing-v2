import { gql, useQuery, useMutation } from '@apollo/client';
import { CButton, CCard, CCardBody, CCardHeader, CCol, CInput, CLink, CRow, CSpinner } from '@coreui/react';
import React, { useContext, useEffect, useState } from 'react';
import Pagination from '../../../common/Pagination';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import PartnerCreateModal from './PartnerCreateModal';

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({});
  const [showModalCreation, setShowModalCreation] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const [deletePartner] = useMutation(gql`
    mutation deletePartner($id: ID!) {
      deletePartner(id: $id)
    }
  `);

  const { data, loading, refetch } = useQuery(
    gql`
      query partners($limit: Int, $offset: Int, $filter: JSON) {
        partners(limit: $limit, offset: $offset, filter: $filter) {
          total
          partners {
            id
            name
            validatorsEmails
            defaultMessage
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset,
        filter: filter
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.partners.total);
    }
  }, [setTotal, data]);

  const partners = !loading && data ? data.partners.partners : [];

  return (
    <>
      <PartnerCreateModal
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
              Partners
              <CButton
                size="sm"
                color="primary"
                className="float-right"
                onClick={() => {
                  setShowModalCreation(true);
                }}
              >
                New Partner
              </CButton>
            </CCardHeader>
            <CCardBody>
              <>
                <div className="mb-0 p-2" style={{ height: '50px' }}>
                  <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
                </div>

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>
                        <div style={{ width: '50px' }}>ID</div>
                      </th>
                      <th>
                        <div style={{ width: '150px' }}>Name</div>
                      </th>
                      <th style={{ width: '100%' }}>
                        <div style={{ width: '100%' }}>Emails</div>
                      </th>
                      <th>
                        <div style={{ width: '50px' }}></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td></td>
                      <td>
                        {' '}
                        <CInput
                          value={filter.name ? filter.name : ''}
                          onChange={(event) => {
                            setFilter({ ...filter, name: event.target.value });
                          }}
                          className="form-control"
                          size="sm"
                        />
                      </td>

                      <td></td>
                    </tr>
                  </tbody>
                  {loading && (
                    <tbody>
                      <tr>
                        <td colSpan={3}>
                          <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                            <CSpinner animation="grow" color="secondary" />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  )}

                  {!loading && partners && partners.length === 0 && (
                    <tbody>
                      <tr>
                        <td colSpan={3}>
                          <div style={{ textAlign: 'center', padding: '30px 0px' }}>No result</div>
                        </td>
                      </tr>
                    </tbody>
                  )}
                  {!loading && partners && partners.length > 0 && (
                    <tbody>
                      {partners.map((partner) => {
                        return (
                          <tr key={partner.id}>
                            <td>{partner.id}</td>
                            <td>
                              <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/partners/${partner.id}`}>{partner.name}</CLink>
                            </td>
                            <td>{partner.validatorsEmails}</td>
                            <td>
                              <i
                                className="pt-3 fas fa-trash"
                                onClick={() => {
                                  deletePartner({ variables: { id: partner.id } });
                                  refetch();
                                }}
                                style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block' }}
                              ></i>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  )}
                </table>

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
