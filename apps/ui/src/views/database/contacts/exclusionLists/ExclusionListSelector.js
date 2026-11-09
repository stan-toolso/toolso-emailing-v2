import { gql, useQuery } from '@apollo/client';
import React from 'react';
import Select from 'react-select';
import { formatInteger } from '../../../common/util';

export default ({ exclusionListId, setExclusionListId }) => {
  const { data } = useQuery(gql`
    query exclusionLists {
      exclusionLists(offset: 0, limit: 1000) {
        total
        exclusionLists {
          id
          name
          field
          stats
        }
      }
    }
  `);

  const onChange = (value) => {
    setExclusionListId(value && value.value ? parseInt(value.value) : null);
  };
  const options = data
    ? data.exclusionLists.exclusionLists.map((item) => {
        return { label: `${item.name} - ${item.stats ? formatInteger(item.stats.count) : 0} contacts`, value: parseInt(item.id) };
      })
    : [];
  return (
    <Select
      value={options.filter((option) => {
        return exclusionListId && exclusionListId === option.value;
      })}
      onChange={onChange}
      isMulti={false}
      options={options}
    />
  );
};
