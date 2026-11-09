import React, { useState } from 'react';
import { CCol, CRow, CButton, CInput, CSpinner, CFormGroup, CLabel } from '@coreui/react';

import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';
import Alert from 'react-bootstrap/Alert';

export default ({ partner }) => {
  let initalKitMapping = partner?.kitMapping
    ? Object.keys(partner.kitMapping).map((key) => {
        return { key, value: partner.kitMapping[key] };
      })
    : [];
  const [kitMapping, setKitMapping] = useState(initalKitMapping);
  const [showHelp, setShowHelp] = useState(localStorage.getItem('help_closed.editMappingKitVariables') ? false : true);

  const [updateVariables, { loading: updating }] = useMutation(gql`
    mutation updatePartner($partner: JSON!) {
      updatePartner(partner: $partner) {
        id
        name
        kitMapping
      }
    }
  `);

  const setKitMappingVariableKey = (index, key) => {
    let newKitMapping = [...kitMapping];
    kitMapping[index].key = key;
    setKitMapping(newKitMapping);
  };

  const setKitMappingVariableValue = (index, value) => {
    let newKitMapping = [...kitMapping];
    kitMapping[index].value = value;
    setKitMapping(newKitMapping);
  };

  const addKitMappingVariable = () => {
    let newKitMapping = [...kitMapping];
    newKitMapping.push({ key: '', value: '' });
    setKitMapping(newKitMapping);
  };

  const removeKitMappingVariable = (index) => {
    let newVariables = [...kitMapping];
    newVariables.splice(index, 1);
    setKitMapping(newVariables);
  };

  return (
    <>
      {showHelp && (
        <Alert
          variant="info"
          onClose={() => {
            setShowHelp(false);
            localStorage.setItem('help_closed.editMappingKitVariables', 1);
          }}
          dismissible
        >
          <Alert.Heading>Discover Kit Mapping Variables !</Alert.Heading>
          <ul>
            <li>You can define your own mappings for the partner kit</li>
            <li>For example if you to replace &quot;-s(%)&quot; by &quot;-s(2148)&quot; just put &quot;-s(%)&quot; as string to replace and &quot;-s(2148)&quot; as replacement</li>
            <li>This mappings can be applied during template edition of a content via the Button &quot;Apply Kit Mapping&quot; </li>
            <li>This mappings will also be automatically used each time a new campaign is associated via the Campaigns screen on this database on this partner.</li>
          </ul>
        </Alert>
      )}

      <CRow className="mb-3">
        <CCol xl={12}>
          <CButton
            size="sm"
            color="primary"
            onClick={() => {
              addKitMappingVariable();
            }}
          >
            Add Kit Variable
          </CButton>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          {kitMapping && kitMapping.length > 0 && (
            <>
              <CRow>
                <CCol lg="3" md="4" sm="5">
                  <CLabel>
                    <strong>string to replace</strong>
                  </CLabel>
                </CCol>
                <CCol lg="4" md="5" sm="6">
                  <CLabel>
                    <strong>replacement</strong>
                  </CLabel>
                </CCol>
              </CRow>
              {kitMapping.map((variable, index) => {
                return (
                  <CFormGroup row key={index}>
                    <CCol lg="3" md="4" sm="5">
                      <CInput
                        size="sm"
                        type="text"
                        value={variable.key}
                        onChange={(event) => {
                          setKitMappingVariableKey(index, event.target.value);
                        }}
                        placeholder="string to replace"
                      />
                    </CCol>
                    <CCol lg="4" md="5" sm="6">
                      <CInput
                        size="sm"
                        type="text"
                        value={variable.value}
                        onChange={(event) => {
                          setKitMappingVariableValue(index, event.target.value);
                        }}
                        placeholder="replacement"
                      />
                    </CCol>
                    <CCol xl="1">
                      <i
                        className="fa fa-lg  fa-trash  text-danger mt-1"
                        style={{}}
                        onClick={(event) => {
                          removeKitMappingVariable(index);
                          event.stopPropagation();
                        }}
                      ></i>
                    </CCol>
                  </CFormGroup>
                );
              })}
            </>
          )}
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CButton
            color="info"
            onClick={async () => {
              let mappingKitObject = {};
              kitMapping.map((kitMappingVariable) => {
                if (kitMappingVariable.key) {
                  mappingKitObject[kitMappingVariable.key] = kitMappingVariable.value;
                }
              });
              let result = await updateVariables({
                variables: {
                  partner: {
                    id: partner.id,
                    kitMapping: mappingKitObject
                  }
                }
              });
              if (result && result.data && result.data.updatePartner) {
                toast.success(`Partner  Kit mappping has been updated`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              } else {
                toast.error('Failed to update kit mapping variables', {
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
