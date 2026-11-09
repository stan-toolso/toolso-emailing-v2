import React from 'react';
import SourcesSelector from '../sources/SourcesSelector';

export default ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <SourcesSelector
        style={{ width: '100%' }}
        sourceIds={filter.sourceIds ? filter.sourceIds : []}
        setSourceIds={(sourceIds) => {
          filter.sourceIds = sourceIds;
          setFilter({ ...filter });
        }}
      />
    </div>
  );
};
