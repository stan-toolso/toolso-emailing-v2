import React, { useState, useContext, useCallback } from 'react';
import { CButton, CCol, CFormGroup, CTextarea, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner, CSelect } from '@coreui/react';
import { useSelector } from 'react-redux';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default (props) => {
  const contentToSuspend = props.contentToSuspend;
  const show = props.show;
  const toggle = props.toggle;
  const user = useSelector((state) => state.user);
  const enterprise = useSelector((state) => state.entreprise);

  const [loading, setLoading] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('Bad Deliverability');
  const [additionalText, setAdditionalText] = useState();
  let suspendedBy = user?.email;

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const suspend = useCallback(() => {
    (async () => {
      setLoading(true);
      let query = {
        mutation: gql`
          mutation suspendContent($contentId: ID!, $suspensionReason: String!, $additionalText: String, $enterpriseId: ID) {
            suspendContent(contentId: $contentId, suspensionReason: $suspensionReason, additionalText: $additionalText, enterpriseId: $enterpriseId) {
              id
              suspended
            }
          }
        `,
        variables: {
          contentId: contentToSuspend.id,
          suspensionReason: suspensionReason,
          additionalText: additionalText,
          enterpriseId: enterprise.id
        }
      };
      try {
        let result = await emailingDatabaseApiContext.doMutation(query);
        if (result && result.data && result.data.suspendContent.suspended) {
          contentToSuspend.suspended = true;
          toggle();
        }
      } catch (err) {
        toast.error('cannot suspend content', {
          position: toast.POSITION.BOTTOM_RIGHT
        });
        console.error(err);
      }
      setLoading(false);
    })();
  }, [emailingDatabaseApiContext, suspensionReason, additionalText, suspendedBy, contentToSuspend, toggle, setLoading]);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>{`Content suspension "${contentToSuspend.name}"`}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol lg="8">
            <CFormGroup>
              <CLabel htmlFor="name">Choose suspension reason</CLabel>
              <CSelect
                className="form-control mr-1 mt-1"
                size="sm"
                value={suspensionReason}
                onChange={(event) => {
                  setSuspensionReason(event.target.value);
                }}
              >
                <option value="Bad Deliverability" key="deliv">
                  Bad Deliverability
                </option>
                <option value="Inappropriate Content" key="inapropriate_content">
                  Inappropriate Content
                </option>
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol lg="12">
            <CFormGroup>
              <CLabel htmlFor="name">Additional Text</CLabel>
              <CTextarea
                id="name"
                value={additionalText}
                onChange={(event) => {
                  setAdditionalText(event.target.value);
                }}
                rows="5"
              ></CTextarea>
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton color="info" onClick={suspend}>
          {loading && <CSpinner color="secondary" />}
          Suspend
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
