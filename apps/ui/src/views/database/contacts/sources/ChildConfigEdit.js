import React, { useState } from 'react';
import { CButton, CCard, CCardHeader, CCardBody, CCardFooter } from '@coreui/react';

import ChildConfigEditor from './ChildConfigEditor';

export default (props) => {
  let forceUpdate = props.forceUpdate;
  let source = props.source;
  let updateContactSource = props.updateContactSource;
  const [filter, setFilter] = useState(source.childConfig ?? {});

  let updateChildConfig = (newFilter) => {
    setFilter(newFilter);
  };

  return (
    <>
      <CCard
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <CCardHeader>Affectation Rules</CCardHeader>
        <CCardBody>
          <ChildConfigEditor filter={filter} setFilter={updateChildConfig} />
        </CCardBody>
        <CCardFooter>
          <CButton
            size="sm"
            color="danger"
            className="ml-1 mr-1"
            onClick={(event) => {
              event.stopPropagation();
              source.editRulesMode = false;
              forceUpdate();
            }}
          >
            Cancel
          </CButton>
          <CButton
            size="sm"
            color="primary"
            className="ml-1 mr-1"
            onClick={async (event) => {
              event.stopPropagation();
              await updateContactSource({
                variables: {
                  source: {
                    id: source.id,
                    childConfig: filter
                  }
                }
              });
              source.editRulesMode = false;
              forceUpdate();
            }}
          >
            Save
          </CButton>
        </CCardFooter>
      </CCard>
    </>
  );
};
