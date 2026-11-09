import { CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  if (!('activated' in filter)) {
    filter.activated = true;
  }
  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.activated}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          filter.activated = event.target.value === 'true';
          setFilter({ ...filter });
        }}
      >
        <option value={true}>Is Activated</option>
        <option value={false}>Is NotActivated</option>
      </CSelect>
    </>
  );
};
