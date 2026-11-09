import React, { useState, useEffect, useCallback } from 'react';

import { useQuery } from '@apollo/client';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton, CInput, CInputGroup, CInputGroupAppend, CInputGroupText, CSelect } from '@coreui/react';

import ContentTable from './ContentTable';
import CreateContentModal from './CreateContentModal';
import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';
import { AllContentTypes } from '../ContentsTypes';
import PartnersSelector from '../partners/PartnersSelector';

const CONTENTS = gql`
  query contents($limit: Int, $offset: Int, $filter: JSON) {
    contents(limit: $limit, offset: $offset, filter: $filter) {
      total
      contents {
        id
        name
        isActive
        startDate
        endDate
        config
        type
        createdAt
        suspended
        suspensionReason
        partner {
          id
          name
        }
        defaultVersion {
          id
          subject
          contentTemplate {
            id
          }
        }
        schedules {
          id
          name
        }
        delivStats {
          request
          unique_open
          unique_click
          unsub
          complaint
        }
        incomesStats
        externalStats {
          ref_requests
          ref_opened
          ref_unsubscribed
          ref_complainted
        }
      }
    }
  }
`;

export default () => {
  const [contents, setContents] = useState([]);
  const [showModalCreation, setShowModalCreation] = useState(false);
  const [contentToClone, setContentToClone] = useState(null);

  const [offset, setOffset] = useState(localStorage.getItem('allContentsOffset') ? parseInt(localStorage.getItem('allContentsOffset')) : 0);
  const [limit, setLimit] = useState(localStorage.getItem('allContentsLimit') ? parseInt(localStorage.getItem('allContentsLimit')) : 20);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState(localStorage.getItem('allContentsName') ? localStorage.getItem('allContentsName') : '');
  const [filter, setFilter] = useState(localStorage.getItem('allContentsFilter') ? JSON.parse(localStorage.getItem('allContentsFilter')) : {});

  const { loading, data, refetch } = useQuery(CONTENTS, {
    variables: {
      limit,
      offset,
      filter
    }
  });

  useEffect(() => {
    setOffset(0);
  }, [filter]);

  useEffect(() => {
    if (data) {
      setContents(JSON.parse(JSON.stringify(data.contents.contents)));
      setTotal(data.contents.total);
    }
  }, [data, setTotal]);

  const forceUpdate = useCallback(() => {
    setContents([...contents]);
  }, [contents, setContents]);

  const hasPartner =
    contents.filter((c) => {
      return c.partner && c.partner.id;
    }).length > 0;

  const hasIncomes =
    contents.filter((c) => {
      return c.incomesStats && c.incomesStats.total != null;
    }).length > 0;
  return (
    <CRow>
      <CreateContentModal
        show={showModalCreation}
        contentToClone={contentToClone}
        toggle={() => {
          refetch();
          setShowModalCreation(false);
        }}
      />
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Contents
            <CButton
              size="sm"
              color="primary"
              className="float-right"
              onClick={() => {
                setShowModalCreation(true);
              }}
            >
              Create content
            </CButton>
          </CCardHeader>
          <CCardBody>
            <>
              <CRow className="mb-2">
                <CCol sm="12" lg="12">
                  <CSelect
                    style={{ display: 'inline-block', width: '110px' }}
                    className="form-control mr-2"
                    size="sm"
                    onChange={(event) => {
                      let newFilter = filter;
                      if (event.target.value === 'activ') {
                        newFilter = { ...filter, isActive: true };
                      } else if (event.target.value === 'inactiv') {
                        newFilter = { ...filter, isActive: false };
                      } else {
                        newFilter = { ...filter, isActive: undefined };
                      }
                      localStorage.setItem('allContentsFilter', JSON.stringify(newFilter));
                      setFilter(newFilter);
                    }}
                    value={filter.isActive ? 'activ' : filter.isActive === false ? 'inactiv' : ''}
                  >
                    <option value="">All Status</option>
                    <option value="activ">Activ</option>
                    <option value="inactiv">Inactiv</option>
                  </CSelect>

                  <CSelect
                    style={{ display: 'inline-block', width: '120px' }}
                    className="form-control mr-2"
                    size="sm"
                    onChange={(event) => {
                      let newFilter = { ...filter, type: event.target.value ?? undefined };
                      localStorage.setItem('allContentsFilter', JSON.stringify(newFilter));
                      setFilter(newFilter);
                    }}
                    value={filter.type ? filter.type : ''}
                  >
                    {Object.keys(AllContentTypes).map((key) => {
                      return (
                        <option value={key} key={key}>
                          {AllContentTypes[key]}
                        </option>
                      );
                    })}
                  </CSelect>

                  <div style={{ display: 'inline-block', width: '180px' }} className="mr-2">
                    <PartnersSelector
                      partnerId={filter.partnerId}
                      setPartnerId={(partnerId) => {
                        let newFilter = { ...filter, partnerId: partnerId ?? undefined };
                        localStorage.setItem('allContentsFilter', JSON.stringify(newFilter));
                        setFilter(newFilter);
                      }}
                    />
                  </div>
                  <div style={{ display: 'inline-block', width: '300px' }}>
                    <CInputGroup size="sm">
                      <CInput
                        value={name}
                        onChange={(event) => {
                          let newName = event.target.value;
                          localStorage.setItem('allContentsName', newName);
                          let newFilter = { ...filter, name: newName?.length > 0 ? newName : undefined };
                          localStorage.setItem('allContentsFilter', JSON.stringify(newFilter));
                          setName(newName);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            let newFilter = { ...filter, name: name?.length > 0 ? name : undefined };
                            setFilter(newFilter);
                          }
                        }}
                        className="form-control"
                        size="sm"
                      />
                      <CInputGroupAppend>
                        <CInputGroupText>
                          <i
                            className="fas fa-search cursor-pointer"
                            onClick={() => {
                              let newFilter = { ...filter, name: name?.length > 0 ? name : undefined };
                              setFilter(newFilter);
                            }}
                          ></i>
                        </CInputGroupText>
                      </CInputGroupAppend>
                    </CInputGroup>
                  </div>
                  {Object.keys(filter).length > 0 && (
                    <div style={{ display: 'inline-block', width: '110px' }} className="ml-2">
                      <CButton
                        size="sm"
                        color="danger"
                        onClick={() => {
                          localStorage.setItem('allContentsName', '');
                          setName('');
                          localStorage.setItem('allContentsFilter', JSON.stringify({}));
                          setFilter({});
                        }}
                      >
                        <i className="fas fa-trash mr-2" />
                        Clear Filters
                      </CButton>
                    </div>
                  )}
                </CCol>
              </CRow>
              <div className="mb-0">
                <Pagination
                  offset={offset}
                  limit={limit}
                  total={total}
                  setOffset={(newOffset) => {
                    localStorage.setItem('allContentsOffset', newOffset);
                    setOffset(newOffset);
                  }}
                  setLimit={(newLimit) => {
                    localStorage.setItem('allContentsLimit', newLimit);
                    setLimit(newLimit);
                  }}
                />
              </div>
              <ContentTable
                loading={loading}
                contents={contents}
                forceUpdate={forceUpdate}
                cloneContent={(content) => {
                  setContentToClone(content);
                  setShowModalCreation(true);
                }}
                showPartner={hasPartner}
                showEcpm={hasIncomes}
                refetch={refetch}
                showRefComplaints
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
