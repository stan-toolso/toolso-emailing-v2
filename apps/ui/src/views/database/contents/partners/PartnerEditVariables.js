import React, { useState } from 'react';
import { CCol, CRow, CButton, CFormGroup, CInput, CSpinner, CLabel } from '@coreui/react';
import Alert from 'react-bootstrap/Alert';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { toast } from 'react-toastify';

export default ({ partner }) => {
  let initalVariables = [];
  if (partner.variables) {
    initalVariables = Object.keys(partner.variables).map((key) => {
      return { key, value: partner.variables[key] };
    });
  }

  const [variables, setVariables] = useState(initalVariables);
  const [showHelp, setShowHelp] = useState(localStorage.getItem('help_closed.editPartnerVariables') ? false : true);

  const [updateVariables, { loading: updating }] = useMutation(gql`
    mutation updatePartner($partner: JSON!) {
      updatePartner(partner: $partner) {
        id
        name
        variables
      }
    }
  `);

  const setVariableKey = (index, key) => {
    let newVariables = [...variables];
    variables[index].key = key;
    setVariables(newVariables);
  };

  const setVariableValue = (index, value) => {
    let newVariables = [...variables];
    variables[index].value = value;
    setVariables(newVariables);
  };

  const addVariable = () => {
    let newVariables = [...variables];
    newVariables.push({ key: '', value: '' });
    setVariables(newVariables);
  };

  const removeVariable = (index) => {
    let newVariables = [...variables];
    newVariables.splice(index, 1);
    setVariables(newVariables);
  };

  return (
    <>
      {showHelp && (
        <Alert
          variant="info"
          onClose={() => {
            setShowHelp(false);
            localStorage.setItem('help_closed.editPartnerVariables', 1);
          }}
          dismissible
        >
          <Alert.Heading>Discover Partner Variables !</Alert.Heading>
          <ul>
            <li>
              You can define <strong>partner variables</strong> that can be used in your templates.
            </li>
            <li>For example if you specify a variable called &quot;partnerName&quot; you can use it via the code &quot;&#123;&#123;partner.partnerName&#125;&#125;&quot; in your templates</li>
          </ul>
        </Alert>
      )}
      <CRow className="mb-3">
        <CCol xl={12}>
          <CButton
            size="sm"
            color="primary"
            onClick={() => {
              addVariable();
            }}
          >
            Add Variable
          </CButton>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          {variables && variables.length > 0 && (
            <>
              <CRow>
                <CCol lg="3" md="4">
                  <CLabel>
                    <strong>Name</strong>
                  </CLabel>
                </CCol>
                <CCol lg="4" md="5">
                  <CLabel>
                    <strong>Value</strong>
                  </CLabel>
                </CCol>
                <CCol lg="4" md="5">
                  <CLabel>
                    <strong>Template Code</strong>
                  </CLabel>
                </CCol>
              </CRow>
              {variables.map((variable, index) => {
                return (
                  <CFormGroup row key={index}>
                    <CCol lg="3" md="4">
                      <CInput
                        size="sm"
                        type="text"
                        value={variable.key}
                        onChange={(event) => {
                          setVariableKey(index, event.target.value);
                        }}
                        placeholder="name"
                      />
                    </CCol>
                    <CCol lg="4" md="5">
                      <CInput
                        size="sm"
                        type="text"
                        value={variable.value}
                        onChange={(event) => {
                          setVariableValue(index, event.target.value);
                        }}
                        placeholder="value"
                      />
                    </CCol>
                    <CCol md="2">
                      <CLabel>{`{{partner.${variable.key}}}`}</CLabel>
                    </CCol>
                    <CCol xl="1">
                      <i
                        className="fa fa-lg  fa-trash  text-danger mt-1"
                        style={{}}
                        onClick={(event) => {
                          removeVariable(index);
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
              let variablesObject = {};
              variables.map((variable) => {
                if (variable.key) {
                  variablesObject[variable.key] = variable.value;
                }
              });
              let result = await updateVariables({
                variables: {
                  partner: {
                    id: partner.id,
                    variables: variablesObject
                  }
                }
              });
              if (result && result.data && result.data.updatePartner) {
                toast.success(`Partner ${partner.name} variables have been updated`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              } else {
                toast.error('Failed to update partner variables', {
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
