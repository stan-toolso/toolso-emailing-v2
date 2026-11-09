import { CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.operator}
        style={{ width: '100px', display: 'inline-block' }}
        onChange={(event) => {
          filter.operator = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="">-- Operator --</option>
        <option value="=">=</option>
        <option value="!=">!=</option>
      </CSelect>
      <CSelect
        size="sm"
        style={{ width: '150px' }}
        className="mx-2"
        custom
        name="status"
        id="status"
        value={filter.value}
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter(filter);
        }}
      >
        <option value="">-- Select status --</option>
        <option value="workable">Workable</option>
        <option value="new">New</option>
        <option value="archived">Archived</option>
        <option value="unsub">Unsub</option>
        <option value="complaint">Complaint</option>
        <option value="hard_bounce">Hard Bounce</option>
      </CSelect>
    </>
  );
};
