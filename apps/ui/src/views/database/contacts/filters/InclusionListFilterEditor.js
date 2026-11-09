import React from 'react';
import InclusionListSelector from '../../contacts/inclusionLists/InclusionListSelector';

export default ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <InclusionListSelector
        style={{ width: '100%' }}
        inclusionListId={filter.inclusionListId ? filter.inclusionListId : null}
        setInclusionListId={(inclusionListId) => {
          filter.inclusionListId = inclusionListId;
          setFilter(filter);
        }}
      />
    </div>
  );
};
