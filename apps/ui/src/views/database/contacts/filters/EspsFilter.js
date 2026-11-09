import React from 'react';
import EspSelector from '../../../common/EspSelector';

export default ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <EspSelector
        style={{ width: '100%' }}
        esps={filter.esps ? filter.esps : []}
        setEsps={(esps) => {
          filter.esps = esps;
          setFilter(filter);
        }}
      />
    </div>
  );
};
