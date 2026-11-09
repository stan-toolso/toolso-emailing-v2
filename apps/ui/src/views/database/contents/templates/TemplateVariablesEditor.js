import { CCol, CFormGroup, CInput, CRow, CLabel } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { extractTemplateVariables } from './TemplateUtil';

export default ({ variables, setVariables, contentTemplateId, used = true, templateParts, html, senderName, subject, frenchEspsSubject, previewText, campaignMode }) => {
  const [templateVariables, setTemplateVariables] = useState({});
  let unusedVariableText = campaignMode ? 'Default variables' : 'Unused Template variables';

  const { data } = useQuery(
    gql`
      query contentTemplate($id: ID!) {
        contentTemplate(id: $id) {
          id
          html
          subject
          frenchEspsSubject
          previewText
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
    if (html || (data && data.contentTemplate)) {
      let newVariables = { ...variables };
      var templateVariables = extractTemplateVariables(data && data.contentTemplate ? data.contentTemplate.html : html, newVariables, templateParts);
      templateVariables.push(...extractTemplateVariables(data && data.contentTemplate ? data.contentTemplate.senderName : senderName ?? '', newVariables, templateParts));
      templateVariables.push(...extractTemplateVariables(data && data.contentTemplate ? data.contentTemplate.subject : subject ?? '', newVariables, templateParts));
      templateVariables.push(...extractTemplateVariables(data && data.contentTemplate ? data.contentTemplate.frenchEspsSubject : frenchEspsSubject ?? '', newVariables, templateParts));
      templateVariables.push(...extractTemplateVariables(data && data.contentTemplate ? data.contentTemplate.previewText : previewText ?? '', newVariables, templateParts));

      let modified = false;
      let newTemplateVariables = {};
      if (used) {
        for (let variable of templateVariables) {
          newTemplateVariables[variable] = true;
          if (!(variable in newVariables)) {
            newVariables[variable] = '';
            modified = true;
          }
        }
      } else {
        for (let variable in newVariables) {
          if (templateVariables.indexOf(variable) < 0) {
            newTemplateVariables[variable] = true;
          }
        }
      }

      if (modified) {
        setVariables(newVariables);
      }
      setTemplateVariables(newTemplateVariables);
    }
  }, [data, setVariables, variables, setTemplateVariables, used, templateParts, html]);

  const [indexMap] = useState({});
  for (let key in variables) {
    if (!(key in indexMap)) {
      indexMap[key] = Math.round(Math.random() * 10000).toString();
    }
  }

  let variablesToMap = Object.keys(variables).filter((variable) => {
    return variable in templateVariables;
  });
  variablesToMap.sort((a, b) => {
    return a.localeCompare(b);
  });

  return (
    <>
      {!used && variablesToMap.length > 0 && <CLabel>{unusedVariableText}</CLabel>}
      <div>
        {variablesToMap.map((variableKey) => {
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
    </>
  );
};
