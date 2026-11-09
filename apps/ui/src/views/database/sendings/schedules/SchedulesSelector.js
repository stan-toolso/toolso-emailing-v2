import { gql, useQuery } from '@apollo/client';
import React, { useEffect, useState } from 'react';
import Select from 'react-select';

export default ({ scheduleIds, setScheduleIds, types }) => {
  const [options, setOptions] = useState([]);

  const { data } = useQuery(
    gql`
      query schedules($filter: JSON) {
        schedules(filter: $filter) {
          schedules {
            id
            name
          }
        }
      }
    `,
    {
      variables: {
        filter: {
          types
        }
      }
    }
  );

  useEffect(() => {
    if (data) {
      let options = [];
      for (let schedule of data.schedules.schedules) {
        options.push({ value: parseInt(schedule.id), label: schedule.name });
      }
      setOptions(options);
    }
  }, [data, setOptions]);
  const onChange = (values) => {
    let result = [];
    if (values) {
      for (let value of values) {
        result.push(value.value);
      }
    }
    setScheduleIds(result);
  };
  return (
    <Select
      value={options.filter((option) => {
        return scheduleIds && scheduleIds.indexOf(option.value) >= 0;
      })}
      onChange={onChange}
      isMulti={true}
      options={options}
    />
  );
};
