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
        value={filter.activityCondition}
        onChange={(event) => {
          filter.activityCondition = event.target.value;
          setFilter(filter);
        }}
      >
        <option value="">-- Select condition --</option>
        <option value="clicker">Clicker</option>
        <option value="complainer">Complainer</option>
        <option value="opener">Opener</option>
        <option value="unsubscriber">Unsubscriber</option>
      </CSelect>
    </>
  );
};
