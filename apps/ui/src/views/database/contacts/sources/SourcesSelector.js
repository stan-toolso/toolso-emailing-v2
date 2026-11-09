import { gql, useQuery } from '@apollo/client';
import React from 'react';
import Select from 'react-select';

export default ({ sourceIds, setSourceIds }) => {
  const { data } = useQuery(gql`
    query contactSources {
      contactSources(offset: 0, limit: 1000) {
        total
        sources {
          id
          name
        }
      }
    }
  `);

  const onChange = (values) => {
    let sourceIds = [];
    if (values) {
      for (let value of values) {
        sourceIds.push(value.value);
      }
    }
    setSourceIds(sourceIds);
  };
  const options = data
    ? data.contactSources.sources.map((item) => {
        return { label: `${item.name}`, value: parseInt(item.id) };
      })
    : [];
  return (
    <Select
      value={options.filter((option) => {
        return sourceIds && sourceIds.indexOf(option.value) >= 0;
      })}
      onChange={onChange}
      isMulti={true}
      options={options}
    />
  );
};
