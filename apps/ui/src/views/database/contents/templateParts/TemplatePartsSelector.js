import { CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import React from 'react';
import { useQuery } from '@apollo/client';

const TEMPLATE_PARTS = gql`
  query contentTemplateParts($limit: Int, $offset: Int, $filter: JSON) {
    contentTemplateParts(limit: $limit, offset: $offset, filter: $filter) {
      total
      contentTemplateParts {
        id
        name
        uid
        html
      }
    }
  }
`;

export default ({ contentTemplatePartId, setContentTemplatePartId, setContentTemplatePart, nullLabel = '-- Select the template part --' }) => {
  const { loading, data } = useQuery(TEMPLATE_PARTS, {
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
      value={contentTemplatePartId ? contentTemplatePartId : ''}
      onChange={(event) => {
        setContentTemplatePartId(event.target.value ? parseInt(event.target.value) : null);
        if (setContentTemplatePart) {
          setContentTemplatePart(
            data.contentTemplateParts.contentTemplateParts.filter((c) => {
              return c.id === event.target.value;
            })[0]
          );
        }
      }}
    >
      <option value={''}>{nullLabel}</option>
      {data &&
        data.contentTemplateParts.contentTemplateParts.map((contentTemplatePart) => {
          return (
            <option key={contentTemplatePart.id} value={contentTemplatePart.id}>
              {contentTemplatePart.name}
            </option>
          );
        })}
    </CSelect>
  );
};
