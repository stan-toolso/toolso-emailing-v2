import { CButton, CCard, CCardBody, CCardFooter, CCardHeader } from '@coreui/react';
import React from 'react';
import { confirmAlert } from 'react-confirm-alert';

export const confirmContactsRemove = (contacts, removeContacts) => {
  confirmAlert({
    customUI: ({ onClose }) => {
      return (
        <CCard className="card-accent-danger">
          <CCardHeader>Are you sure?</CCardHeader>
          <CCardBody>
            <p>You want to remove theses contacts ?</p>
            <ul>
              {contacts.map((contact, index) => {
                return <li key={index}>{contact.email}</li>;
              })}
            </ul>
          </CCardBody>
          <CCardFooter>
            <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
              No
            </CButton>
            <CButton
              color="danger"
              className="px-5"
              onClick={async () => {
                await removeContacts();
                onClose();
              }}
            >
              Yes, Remove it!
            </CButton>
          </CCardFooter>
        </CCard>
      );
    }
  });
};
