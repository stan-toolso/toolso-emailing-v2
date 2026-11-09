import { CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import React from 'react';
import { useQuery } from '@apollo/client';

const TEMPLATES = gql`
  query contentTemplates($limit: Int, $offset: Int, $filter: JSON) {
    contentTemplates(limit: $limit, offset: $offset, filter: $filter) {
      total
      contentTemplates {
        id
        name
        subject
        senderName
        frenchEspsSubject
        html
      }
    }
  }
`;

export default ({ contentTemplateId, setContentTemplateId, setContentTemplate, nullLabel = '-- Select the template --' }) => {
  const { loading, data } = useQuery(TEMPLATES, {
    variables: {
      limit: 10000,
      offset: 0,
      filter: {}
    }
  });

  if (loading) {
    return (
      <div className="pt-3 text-center">
        <div className="sk-spinner sk-spinner-pulse"></div>
      </div>
    );
  }

  return (
    <CSelect
      size="sm"
      id="templateSelector"
      value={contentTemplateId ? contentTemplateId : ''}
      onChange={(event) => {
        setContentTemplateId(event.target.value ? parseInt(event.target.value) : null);
        if (setContentTemplate) {
          setContentTemplate(
            data.contentTemplates.contentTemplates.filter((c) => {
              return c.id === event.target.value;
            })[0]
          );
        }
      }}
    >
      <option value={''}>{nullLabel}</option>
      {data &&
        data.contentTemplates.contentTemplates.map((contentTemplate) => {
          return (
            <option key={contentTemplate.id} value={contentTemplate.id}>
              {contentTemplate.name}
            </option>
          );
        })}
    </CSelect>
  );
};
