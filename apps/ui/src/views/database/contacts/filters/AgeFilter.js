import { CInput, CLabel } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  return (
    <>
      <CLabel className="mx-2 col-form-label pt-1">Min age</CLabel>
      <CInput
        size="sm"
        placeholder="Min Age"
        style={{ width: '100px' }}
        type="number"
        min="0"
        value={filter.minAge ? filter.minAge : ''}
        onChange={(event) => {
          filter.minAge = parseInt(event.target.value);
          setFilter(filter);
        }}
      />
      <CLabel className="ml-3 mr-2 col-form-label pt-1">Max age</CLabel>
      <CInput
        size="sm"
        placeholder="Max Age"
        style={{ width: '100px' }}
        type="number"
        min="0"
        value={filter.maxAge ? filter.maxAge : ''}
        onChange={(event) => {
          filter.maxAge = parseInt(event.target.value);
          setFilter(filter);
        }}
      />
    </>
  );
};
