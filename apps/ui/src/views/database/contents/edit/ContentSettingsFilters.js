import React from 'react';
import { CButton } from '@coreui/react';
import FilterEditor from './FilterEditor';

export default ({ filters, setFilters }) => {
  return (
    <div>
      <CButton
        size="sm"
        color="success"
        className="mb-3"
        onClick={() => {
          setFilters([...filters, { id: filters.length + 1 }]);
        }}
      >
        Add filter
      </CButton>
      {filters.map((filter) => {
        return (
          <FilterEditor
            key={filter.id}
            filter={filter}
            setFilter={(value) => {
              let index = filters.indexOf(filter);
              if (value) {
                setFilters([...filters.slice(0, index), value, ...filters.slice(index + 1)]);
              } else {
                setFilters([...filters.slice(0, index), ...filters.slice(index + 1)]);
              }
            }}
          />
        );
      })}
    </div>
  );
};
