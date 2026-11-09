import React, { useState } from 'react';
import { CCol, CRow, CButton, CSpinner } from '@coreui/react';

import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';
import { ContactComponent } from './ContactComponent';

export default ({ partner }) => {
  const [contacts, setContacts] = useState(partner.contacts && partner.contacts.list ? JSON.parse(JSON.stringify(partner.contacts.list)) : []);

  const [updatePartner, { loading: updating }] = useMutation(gql`
    mutation updatePartner($partner: JSON!) {
      updatePartner(partner: $partner) {
        id
        name
        validatorsEmails
        defaultMessage
      }
    }
  `);

  const removeContact = (index) => {
    return () => {
      let newContacts = [...contacts];
      newContacts.splice(index, 1);
      setContacts(newContacts);
    };
  };

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Emails</th>
            <th style={{ width: '140px' }}>
              <CButton
                color="success"
                size="sm"
                onClick={() => {
                  setContacts([...contacts, { show: true, defaultMessage: partner.defaultMessage }]);
                }}
              >
                Add new contact
              </CButton>
            </th>
          </tr>
        </thead>

        {contacts.map((contact, index) => {
          return <ContactComponent key={index} contact={contact} removeContact={removeContact(index)} />;
        })}
      </table>

      <CRow>
        <CCol xl={12}>
          <CButton
            color="info"
            size="sm"
            onClick={async () => {
              contacts.map((contact) => {
                contact.show = false;
              });
              let result = await updatePartner({
                variables: {
                  partner: {
                    id: partner.id,
                    contacts: {
                      list: contacts
                        .filter((contact) => contact.validatorsEmails)
                        .map((contact) => {
                          return { validatorsEmails: contact.validatorsEmails, defaultMessage: contact.defaultMessage };
                        })
                    }
                  }
                }
              });
              if (result && result.data && result.data.updatePartner) {
                toast.success(`Partner ${name} has been updated`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              } else {
                toast.error('Failed to update partner', {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }
            }}
          >
            {updating && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Update
          </CButton>
        </CCol>
      </CRow>
    </>
  );
};
