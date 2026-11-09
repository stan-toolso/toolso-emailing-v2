import { CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  return (
    <>
      <CSelect
        size="sm"
        style={{ width: '150px' }}
        className="mx-2"
        custom
        name="gender"
        id="gender"
        value={filter.gender}
        onChange={(event) => {
          filter.gender = event.target.value;
          setFilter(filter);
        }}
      >
        <option value="">-- Select gender --</option>
        <option value="m">Male</option>
        <option value="f">Female</option>
      </CSelect>
    </>
  );
};
