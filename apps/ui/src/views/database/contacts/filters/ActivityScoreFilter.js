import { CInput, CLabel } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  return (
    <>
      <CLabel className="mx-2 col-form-label pt-1">Min score</CLabel>
      <CInput
        size="sm"
        placeholder="Min Score"
        style={{ width: '100px' }}
        type="number"
        min="0"
        value={filter.minScore ? filter.minScore : ''}
        onChange={(event) => {
          filter.minScore = parseInt(event.target.value);
          setFilter(filter);
        }}
      />
      <CLabel className="ml-3 mr-2 col-form-label pt-1">Max score</CLabel>
      <CInput
        size="sm"
        placeholder="Max Score"
        style={{ width: '100px' }}
        type="number"
        min="0"
        value={filter.maxScore ? filter.maxScore : ''}
        onChange={(event) => {
          filter.maxScore = parseInt(event.target.value);
          setFilter(filter);
        }}
      />
    </>
  );
};
