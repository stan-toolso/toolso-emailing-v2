import { CButton, CCard, CCardBody, CCardHeader } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';

import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { confirmContactsRemove } from './confirmContactsRemove';
import { ContactTable } from './ContactTable';

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
        blacklisted
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

const REMOVE_CONTACT = gql`
  mutation REMOVE_CONTACT($id: ID!) {
    removeContact(id: $id)
  }
`;

let currentContacts = [];
let currentTotal = 0;
let currentFilter = null;
const loadingDatabases = {};

const isLoading = () => {
  for (let database in loadingDatabases) {
    if (loadingDatabases[database]) {
      return true;
    }
  }
  return false;
};

export default () => {
  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const [total, setTotal] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [tableFilter, setTableFilter] = useState({});
  const [resultsWanted, setResultsWanted] = useState(false);

  const setAndActiveFilter = (aFilter) => {
    setResultsWanted(true);
    setTableFilter(aFilter);
  };

  let hasOneElementSelect = contacts
    ? contacts.filter((contact) => {
        return contact.checked;
      }).length > 0
    : false;

  const onResult = useCallback(
    (resultFilter, database, resultContacts, resultTotal) => {
      if (resultFilter !== currentFilter) {
        return;
      }
      if (!loadingDatabases[database.uid]) {
        return;
      }

      resultContacts = JSON.parse(JSON.stringify(resultContacts));
      for (let contact of resultContacts) {
        contact.database = database;
      }
      currentContacts = [...currentContacts, ...resultContacts];

      currentTotal += resultTotal;
      loadingDatabases[database.uid] = false;

      setContacts(currentContacts);
      setTotal(currentTotal);
    },
    [setContacts, setTotal]
  );

  useEffect(() => {
    if (emailingDatabases && resultsWanted) {
      const filter = {
        type: 'and',
        children: []
      };
      for (let key in tableFilter) {
        if (tableFilter[key]) {
          switch (key) {
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

      const tableFilterRef = JSON.stringify(tableFilter);
      if (tableFilterRef === currentFilter && isLoading()) {
        //loading is already processing.
        return;
      }
      currentFilter = tableFilterRef;
      for (let database of emailingDatabases) {
        loadingDatabases[database.uid] = true;
      }
      currentContacts = [];
      currentTotal = 0;
      setContacts([]);

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: CONTACTS,
          variables: {
            limit: 100,
            offset: 0,
            filter
          }
        });
        if (result && result.data) {
          onResult(tableFilterRef, database, result.data.contacts.contacts, result.data.contacts.total);
        }
      });
    }
  }, [emailingDatabases, tableFilter, resultsWanted, setContacts, onResult]);

  const reload = useCallback(() => {
    currentFilter = null;
    setTableFilter({ ...tableFilter });
  }, [tableFilter, setTableFilter]);

  const removeContacts = useCallback(
    async (contactsToRemove) => {
      await Promise.all(
        contactsToRemove.map((contact) => {
          return new Promise((resolve) => {
            new EmailingDatabaseApi(contact.database)
              .doMutation({
                mutation: REMOVE_CONTACT,
                variables: {
                  id: contact.id
                }
              })
              .finally((result) => {
                console.log(result);
                resolve();
              });
          });
        })
      );
      reload();
    },
    [reload]
  );

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex ">
          <div>Contact search</div>
        </div>
      </CCardHeader>
      <CCardBody className="p-0">
        <div className="pl-2">
          <CButton
            size="sm"
            color="danger"
            className="float-left mr-1 my-1 "
            onClick={async () => {
              let contactsToRmove = contacts.filter((contact) => {
                return contact.checked;
              });
              confirmContactsRemove(contactsToRmove, () => {
                removeContacts(contactsToRmove);
              });
            }}
            disabled={!hasOneElementSelect}
          >
            Remove contacts
          </CButton>
        </div>
        <ContactTable
          isLoading={isLoading}
          total={total}
          contacts={contacts}
          setContacts={setContacts}
          removeContacts={removeContacts}
          filter={tableFilter}
          setAndActiveFilter={setAndActiveFilter}
          reload={reload}
        />
      </CCardBody>
    </CCard>
  );
};
