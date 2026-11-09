import React, { useState, useContext, useCallback, useEffect } from 'react';
import { CButton, CCol, CModal, CModalBody, CModalFooter, CModalHeader, CRow } from '@coreui/react';
import toPascalCase from './toPascalCase';
import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';
import 'react-confirm-alert/src/react-confirm-alert.css';
import gql from 'graphql-tag';
import JSONPretty from 'react-json-pretty';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const suggestion = props.suggestion;
  const isSuperAdmin = props.isSuperAdmin;
  const [nextStatus, setNextStatus] = useState('');
  const [areYouSure, setAreYouSure] = useState(false);

  let isDraft = suggestion.status === 'draft';

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const getText = (suggestion) => {
    let details = suggestion.details;
    switch (suggestion?.type) {
      case 'increase_contact_volume':
      case 'reduce_contact_volume': {
        let text = `We advice you to change your daily contact volume on ${details.esp}.
        Suggested volume is ${details.suggestedDailyVolume} per day (${(details.suggestedDailyVariation <= 0 ? '' : '+') + details.suggestedDailyVariation}).`;
        return text;
      }
      case 'missing_content': {
        let text = `We advice you to add ${details.typeOfSchedule} contents.
        Missing ${details.missingContents} ${details.contentType} contents for ${details.scheduleName}.`;
        return text;
      }
      default:
        return <JSONPretty id="json-pretty" data={details ?? {}}></JSONPretty>;
    }
  };

  const updateSugestion = useCallback(
    (status) => {
      (async () => {
        let query = {
          mutation: gql`
            mutation Mutation($suggestion: JSON!) {
              updateSuggestion(suggestion: $suggestion) {
                id
                status
              }
            }
          `,
          variables: {
            suggestion: {
              status,
              id: suggestion.id
            }
          }
        };
        let result = await emailingDatabaseApiContext.doMutation(query);
        if (result && result.data) {
          toggle();
        }
      })();
    },
    [emailingDatabaseApiContext, suggestion, toggle]
  );

  useEffect(() => {
    if (nextStatus) {
      updateSugestion(nextStatus);
    }
  }, [nextStatus, updateSugestion]);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>
        {!areYouSure && (
          <>
            Suggestion : {toPascalCase(suggestion?.type)} {toPascalCase(suggestion.unique_id.replace(suggestion.type, ''))}
          </>
        )}
        {areYouSure && <>Are you sure ?</>}
      </CModalHeader>
      <CModalBody>
        <CRow>
          <CCol lg="12">
            {!areYouSure && <div>{getText(suggestion)}</div>}
            {areYouSure && <div>Do you want to ignore this recommendation ?</div>}
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        {isSuperAdmin && isDraft && (
          <CButton
            color="primary"
            onClick={() => {
              setNextStatus('todo');
            }}
          >
            Todo
          </CButton>
        )}

        {isSuperAdmin && isDraft && (
          <CButton
            color="warning"
            onClick={() => {
              setNextStatus('deleted');
            }}
          >
            Delete Draft
          </CButton>
        )}

        {suggestion.status === 'todo' && (
          <>
            <CButton color="light" onClick={toggle}>
              {areYouSure ? 'Cancel' : 'Remind Me Later'}
            </CButton>
            <CButton
              color="danger"
              onClick={() => {
                areYouSure ? setNextStatus('ignored') : setAreYouSure(true);
              }}
            >
              {areYouSure ? 'Yes, Ignore it!' : 'Ignore'}
            </CButton>
          </>
        )}

        {suggestion.status === 'todo' && !areYouSure && (
          <CButton
            color="success"
            onClick={() => {
              setNextStatus('done');
            }}
          >
            Done
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  );
};
