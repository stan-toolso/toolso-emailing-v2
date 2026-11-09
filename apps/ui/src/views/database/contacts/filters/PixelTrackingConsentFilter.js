import { CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  if (!('value' in filter)) {
    filter.value = 'false';
  }
  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.value}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="true">Accepted (true)</option>
        <option value="false">Refused (false)</option>
        <option value="null">Unknown (null)</option>
      </CSelect>
    </>
  );
};
