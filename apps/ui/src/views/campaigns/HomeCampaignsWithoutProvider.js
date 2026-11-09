import { CCard, CCardBody, CCardHeader, CInput, CSelect, CButton, CInputGroup, CInputGroupAppend, CInputGroupText } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useEffect, useState } from 'react';
import { CampaignsFields, CampaignsTable } from './CampaignsTable';
import { AllContentTypes } from '../database/contents/ContentsTypes';
import { useQuery } from '@apollo/client';
import Pagination from '../common/Pagination';
import { useSelector } from 'react-redux';
import CreateCampaignModal from './CreateCampaignModal';

export default () => {
  const [name, setName] = useState('');
  const [nameRequested, setNameRequested] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [sortField, setSortField] = useState('id');
  const [order, setOrder] = useState('desc');
  const [type, setType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [showModalCreation, setShowModalCreation] = useState(false);
  const enterprise = useSelector((state) => state.entreprise);

  const { loading, data, refetch } = useQuery(
    gql`
      query GetAllCampaigns($enterprise_id: Int!, $offset: Int, $limit: Int, $name: String) {
        getAllCampaigns(enterprise_id: $enterprise_id, offset: $offset, limit: $limit, name: $name) {
          campaigns {
            id
            name
            start_date
            contents {
              enterprise_id
              emailing_database_uid
              content_id
            }
            is_active
            end_date
            config
            type
            deliv_stats
          }
          total
        }
      }
    `,
    {
      variables: {
        enterprise_id: parseInt(enterprise.id),
        offset: offset,
        limit: limit,
        name: nameRequested
      }
    }
  );

  useEffect(() => {
    if (data && data.getAllCampaigns) {
      setCampaigns(data.getAllCampaigns.campaigns);
      setTotal(data.getAllCampaigns.total);
    }
  }, [setCampaigns, setTotal, data]);

  var filteredCampaigns = FilterCampaigns(campaigns, type);
  return (
    <>
      <CreateCampaignModal
        enterpriseId={enterprise?.id}
        show={showModalCreation}
        toggle={() => {
          refetch();
          setShowModalCreation(false);
        }}
      />
      <CCard>
        <CCardHeader>
          Campaigns{' '}
          <CButton
            size="sm"
            color="primary"
            className="float-right"
            onClick={() => {
              setShowModalCreation(true);
            }}
          >
            Create Campaign
          </CButton>
        </CCardHeader>
        <CCardHeader>
          <span className="d-flex flex-fill justify-content-end">
            <CSelect
              style={{ display: 'inline-block', width: '110px' }}
              className="form-control mr-2"
              size="sm"
              onChange={(event) => {
                setStatusFilter(event.target.value);
              }}
              value={statusFilter}
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
                setType(event.target.value);
              }}
              value={type}
            >
              {Object.keys(AllContentTypes).map((key) => {
                return (
                  <option value={key} key={key}>
                    {AllContentTypes[key]}
                  </option>
                );
              })}
            </CSelect>
            <CInputGroup style={{ marginRight: '10px' }}>
              <CInput
                value={name}
                style={{ padding: '0px 3px' }}
                placeholder="Search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setNameRequested(name);
                  }
                }}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="form-control"
                size="sm"
              />
              <CInputGroupAppend>
                <CInputGroupText>
                  <i
                    className="fas fa-search cursor-pointer"
                    onClick={() => {
                      setNameRequested(name);
                    }}
                  ></i>
                </CInputGroupText>
              </CInputGroupAppend>
            </CInputGroup>
          </span>
          <div className="mt-3 mb-0 d-flex flex-fill justify-content-end">
            <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
          </div>
        </CCardHeader>
        <CCardBody className="p-0 mt-0">
          <CampaignsTable
            loading={loading}
            campaigns={filteredCampaigns}
            fields={[
              CampaignsFields.id,
              CampaignsFields.name,
              CampaignsFields.databases,
              CampaignsFields.request,
              CampaignsFields.openers,
              CampaignsFields.unique_click,
              CampaignsFields.unsub,
              CampaignsFields.bounces
            ]}
            sortField={sortField}
            setSortField={setSortField}
            sortOrder={order}
            setSortOrder={setOrder}
            showTotal={false}
            statusFilter={statusFilter}
          />
          <div className="mt-2">
            <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} showSelectPageSection={true} />
          </div>
        </CCardBody>
      </CCard>
    </>
  );
};

function FilterCampaigns(campaigns, type) {
  return (
    campaigns &&
    campaigns.filter((item) => {
      if (type && item.type !== type) {
        return false;
      }
      return true;
    })
  );
}
