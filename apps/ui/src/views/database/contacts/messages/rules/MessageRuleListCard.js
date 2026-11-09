import React, { useContext } from 'react';

import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import MessageRuleList from './MessageRuleList';
import { gql, useMutation } from '@apollo/client';
import EmailingDatabaseApiContext from '../../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';

export default () => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();
  const [createContactMessageRule] = useMutation(gql`
    mutation createContactMessageRule($name: String) {
      createContactMessageRule(name: $name) {
        id
      }
    }
  `);

  return (
    <CRow>
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            Message Rules
            <CButton
              size="sm"
              color="primary"
              className="float-right"
              onClick={async () => {
                let rule = await createContactMessageRule();
                history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/messages/rules/list/${rule.data.createContactMessageRule.id}`);
              }}
            >
              New Rule
            </CButton>
          </CCardHeader>
          <CCardBody>
            <MessageRuleList />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};
