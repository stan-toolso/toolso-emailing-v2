import { gql, useQuery } from '@apollo/client';
import React from 'react';
import Select from 'react-select';
import { formatInteger } from '../../../common/util';

export default ({ inclusionListId, setInclusionListId }) => {
  const { data } = useQuery(gql`
    query inclusionLists {
      inclusionLists(offset: 0, limit: 1000) {
        total
        inclusionLists {
          id
          name
          field
          stats
        }
      }
    }
  `);

  const onChange = (value) => {
    setInclusionListId(value && value.value ? parseInt(value.value) : null);
  };
  const options = data
    ? data.inclusionLists.inclusionLists.map((item) => {
        return { label: `${item.name} - ${item.stats ? formatInteger(item.stats.count) : 0} contacts`, value: parseInt(item.id) };
      })
    : [];
  return (
    <Select
      value={options.filter((option) => {
        return inclusionListId && inclusionListId === option.value;
      })}
      onChange={onChange}
      isMulti={false}
      options={options}
    />
  );
};
