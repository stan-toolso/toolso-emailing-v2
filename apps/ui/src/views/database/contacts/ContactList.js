import React, { useState, useEffect } from 'react';

import { CButton, CCard, CCardBody, CCardHeader, CCol, CLabel, CRow } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Pagination from '../../common/Pagination';
import ContactTable from './ContactTable';
import ContactFilterEditor from './ContactFilterEditor';
import ExportContactsModal from './ExportContactsModal';

const CONTACTS = gql`
  query contacts($limit: Int, $offset: Int, $filter: JSON) {
    contacts(limit: $limit, offset: $offset, filter: $filter) {
      total
      limit
      offset
      contacts {
        id
        email
        firstname
        lastname
        activated
        status
        activityScore
        pixelTrackingConsent
        lastInscription {
          id
          inscriptionDate
          source {
            id
            name
          }
        }
      }
    }
  }
`;

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [contacts, setContacts] = useState([]);

  const [currentContactsFilter, setCurrentContactsFilter] = useState({});
  const [contactsFilter, setContactsFilter] = useState({});
  const [tableFilter, setTableFilter] = useState({});
  const [showExportContactsModal, setShowExportContactsModal] = useState(false);

  const filter = {
    type: 'and',
    children: [currentContactsFilter]
  };
  for (let key in tableFilter) {
    if (tableFilter[key]) {
      switch (key) {
        case 'pixelTrackingConsent':
          filter.children.push({
            type: 'pixelTrackingConsent',
            value: tableFilter[key]
          });
          break;
        case 'email':
        case 'firstname':
        case 'lastname':
        default:
          filter.children.push({
            type: 'fieldValue',
            field: key,
            operator: 'ILIKE',
            value: tableFilter[key]
          });
          break;
      }
    }
  }

  const { loading, data } = useQuery(CONTACTS, {
    variables: {
      limit: limit,
      offset: offset,
      filter
    }
  });

  useEffect(() => {
    if (data) {
      setTotal(data.contacts.total);
      setContacts(data.contacts.contacts);
    }
  }, [setTotal, setContacts, data]);

  useEffect(() => {
    setOffset(0);
  }, [currentContactsFilter, tableFilter]);

  return (
    <CRow>
      <CCol xl={12}>
        <ExportContactsModal
          filter={filter}
          show={showExportContactsModal}
          toggle={() => {
            setShowExportContactsModal(false);
          }}
        />
        <CCard>
          <CCardHeader>Contacts</CCardHeader>
          <CCardBody className="p-0">
            <>
              <div className="my-1 p-2">
                <CLabel>Conditions</CLabel>
                <ContactFilterEditor
                  filter={contactsFilter}
                  setFilter={(newFilter) => {
                    setContactsFilter({ ...newFilter });
                  }}
                />
                <CButton
                  className="mr-2"
                  size="sm"
                  color="primary"
                  onClick={() => {
                    setCurrentContactsFilter(JSON.parse(JSON.stringify(contactsFilter)));
                  }}
                >
                  Search
                </CButton>
                <CButton
                  size="sm"
                  color="success"
                  onClick={() => {
                    setShowExportContactsModal(true);
                  }}
                >
                  CSV Export
                </CButton>
              </div>
              <div className="mb-0 p-2">
                <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
              </div>

              <ContactTable loading={loading} contacts={contacts} filter={tableFilter} setFilter={setTableFilter} />
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
