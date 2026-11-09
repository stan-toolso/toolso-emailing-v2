import React, { useState } from 'react';
import { CCol, CRow, CFormGroup, CLabel, CInput, CTextarea } from '@coreui/react';

export const ContactComponent = ({ contact, removeContact }) => {
  const [validatorsEmails, setValidatorsEmails] = useState(contact?.validatorsEmails ? contact?.validatorsEmails : '');
  const [contactDefaultMessage, setContactDefaultMessage] = useState(contact?.defaultMessage ? contact?.defaultMessage : '');
  const [show, setShow] = useState(contact?.show ? contact?.show : false);

  return (
    <tbody>
      <tr
        style={{ cursor: 'pointer' }}
        onClick={() => {
          setShow(!show);
        }}
      >
        <td>{contact?.validatorsEmails}</td>
        <td>
          <div className="px-2" style={{ width: '70px', float: 'right' }}>
            <i className={`fas fa-chevron-${show ? 'up' : 'down'}`}></i>
            <i
              className="fa fa-lg  fa-trash  text-danger ml-4"
              style={{}}
              onClick={(event) => {
                removeContact();
                event.stopPropagation();
              }}
            ></i>
          </div>
        </td>
      </tr>
      {show && (
        <tr className="bg-light text-dark">
          <td colSpan={2}>
            <CRow>
              <CCol xl={12}>
                <CFormGroup>
                  <CLabel htmlFor="validatorsEmails">Validators emails (comma separated)</CLabel>
                  <CInput
                    size="sm"
                    type="text"
                    id="validatorsEmails"
                    placeholder="Validators emails"
                    required
                    value={validatorsEmails}
                    onChange={(event) => {
                      setValidatorsEmails(event.target.value);
                      contact.validatorsEmails = event.target.value;
                    }}
                  />
                </CFormGroup>
              </CCol>
            </CRow>
            <CRow>
              <CCol xl={12}>
                <CFormGroup>
                  <CLabel htmlFor="defaultMessage">Default bat message</CLabel>
                  <CTextarea
                    size="sm"
                    id="message"
                    placeholder="Default bat message"
                    style={{ height: '100px' }}
                    value={contactDefaultMessage}
                    onChange={(event) => {
                      setContactDefaultMessage(event.target.value);
                      contact.defaultMessage = event.target.value;
                    }}
                  />
                </CFormGroup>
              </CCol>
            </CRow>
          </td>
        </tr>
      )}
    </tbody>
  );
};
