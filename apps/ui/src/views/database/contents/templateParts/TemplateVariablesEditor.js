import { CCol, CFormGroup, CInput, CRow } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import Mustache from 'mustache';
import { gql, useQuery } from '@apollo/client';

export default ({ variables, setVariables, contentTemplateId }) => {
  const [templateVariables, setTemplateVariables] = useState({});

  const { data } = useQuery(
    gql`
      query contentTemplate($id: ID!) {
        contentTemplate(id: $id) {
          id
          html
          subject
          frenchEspsSubject
          senderName
        }
      }
    `,
    {
      variables: {
        id: contentTemplateId
      },
      skip: !contentTemplateId
    }
  );

  useEffect(() => {
    if (data && data.contentTemplate) {
      var templateVariables = Mustache.parse(data.contentTemplate.html)
        .filter(function (v) {
          return v[0] === 'name' || v[0] === '&';
        })
        .filter(function (v) {
          return v[1].indexOf('content.') === 0;
        })
        .map(function (v) {
          return v[1].substring('content.'.length);
        });

      templateVariables.push(
        ...Mustache.parse(data.contentTemplate.subject)
          .filter(function (v) {
            return v[0] === 'name' || v[0] === '&';
          })
          .filter(function (v) {
            return v[1].indexOf('content.') === 0;
          })
          .map(function (v) {
            return v[1].substring('content.'.length);
          })
      );

      templateVariables.push(
        ...Mustache.parse(data.contentTemplate.senderName)
          .filter(function (v) {
            return v[0] === 'name' || v[0] === '&';
          })
          .filter(function (v) {
            return v[1].indexOf('content.') === 0;
          })
          .map(function (v) {
            return v[1].substring('content.'.length);
          })
      );

      templateVariables.push(
        ...Mustache.parse(data.contentTemplate.frenchEspsSubject)
          .filter(function (v) {
            return v[0] === 'name' || v[0] === '&';
          })
          .filter(function (v) {
            return v[1].indexOf('content.') === 0;
          })
          .map(function (v) {
            return v[1].substring('content.'.length);
          })
      );

      let modified = false;
      let newTemplateVariables = {};
      for (let variable of templateVariables) {
        newTemplateVariables[variable] = true;
        if (!(variable in variables)) {
          variables[variable] = '';
          modified = true;
        }
      }
      if (modified) {
        setVariables({ ...variables });
      }
      setTemplateVariables(newTemplateVariables);
    }
  }, [data, setVariables, variables, setTemplateVariables]);

  const [indexMap] = useState({});
  for (let key in variables) {
    if (!(key in indexMap)) {
      indexMap[key] = Math.round(Math.random() * 10000).toString();
    }
  }
  return (
    <div>
      {Object.keys(variables)
        .filter((variable) => {
          return variable in templateVariables;
        })
        .map((variableKey) => {
          let variableValue = variables[variableKey];

          return (
            <CRow key={indexMap[variableKey]}>
              <CCol xl={12}>
                <CFormGroup row>
                  <CCol md="5">
                    <CInput
                      size="sm"
                      type="text"
                      disabled={true}
                      value={variableKey}
                      onChange={(event) => {
                        indexMap[event.target.value] = indexMap[variableKey];
                        delete indexMap[variableKey];
                        variables[event.target.value] = variableValue;
                        delete variables[variableKey];
                        setVariables({ ...variables });
                      }}
                    />
                  </CCol>
                  <CCol md="6">
                    <CInput
                      size="sm"
                      type="text"
                      value={variableValue}
                      onChange={(event) => {
                        variables[variableKey] = event.target.value;
                        setVariables({ ...variables });
                      }}
                    />
                  </CCol>
                </CFormGroup>
              </CCol>
            </CRow>
          );
        })}
    </div>
  );
};
