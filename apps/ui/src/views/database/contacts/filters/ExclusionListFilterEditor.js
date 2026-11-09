import React from 'react';
import ExclusionListSelector from '../../contacts/exclusionLists/ExclusionListSelector';

export default ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <ExclusionListSelector
        style={{ width: '100%' }}
        exclusionListId={filter.exclusionListId ? filter.exclusionListId : null}
        setExclusionListId={(exclusionListId) => {
          filter.exclusionListId = exclusionListId;
          setFilter(filter);
        }}
      />
    </div>
  );
};
