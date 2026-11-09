import React from 'react';

import { CCard } from '@coreui/react';
import DelivStats from './DelivStats';

export default ({ defaultFilter, defaultFromDate, defaultToDate, defaultDimension }) => {
  return (
    <CCard>
      <DelivStats defaultFilter={defaultFilter} defaultFromDate={defaultFromDate} defaultToDate={defaultToDate} defaultDimension={defaultDimension} />
    </CCard>
  );
};
