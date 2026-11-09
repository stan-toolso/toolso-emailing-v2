import React from 'react';
import Select from 'react-select';
import { EspOptions } from './EspOptions';

export default ({ esps, setEsps, defaultOption = false }) => {
  const options = [...(defaultOption ? [{ value: 'default', label: 'Default' }] : []), ...EspOptions];

  const onChange = (values) => {
    let esps = [];
    if (values) {
      for (let value of values) {
        esps.push(value.value);
      }
    }
    setEsps(esps);
  };
  return (
    <Select
      value={options.filter((option) => {
        return esps && esps.indexOf(option.value) >= 0;
      })}
      onChange={onChange}
      isMulti={true}
      options={options}
    />
  );
};
