import { CInput, CLabel, CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  if (!filter.operator) {
    filter.operator = 'betweenDays';
  }
  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.operator}
        style={{ width: '150px', display: 'inline-block' }}
        onChange={(event) => {
          filter.operator = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="betweenDays">Between Days</option>
      </CSelect>
      {filter.operator === 'betweenDays'}
      {
        <>
          <CLabel className="mx-2 col-form-label pt-1">From</CLabel>
          <CInput
            size="sm"
            placeholder="Days"
            style={{ width: '100px' }}
            type="number"
            min="0"
            value={!isNaN(filter.from) ? filter.from : ''}
            onChange={(event) => {
              let value = parseInt(event.target.value);
              filter.from = isNaN(value) ? null : value;
              setFilter({ ...filter });
            }}
          />
          <CLabel className="ml-3 mr-2 col-form-label pt-1">To</CLabel>
          <CInput
            size="sm"
            placeholder="Days"
            style={{ width: '100px' }}
            type="number"
            min="0"
            value={!isNaN(filter.to) ? filter.to : ''}
            onChange={(event) => {
              let value = parseInt(event.target.value);
              filter.to = isNaN(value) ? null : value;
              setFilter({ ...filter });
            }}
          />
        </>
      }
    </>
  );
};
