import React from 'react';
import { CSpinner, CWidgetDropdown, CTooltip } from '@coreui/react';

export default ({ loading, newActiveCount }) => {
  if (loading) {
    return (
      <div className="card text-white bg-gradient-primary" style={{ textAlign: 'center', height: '95px' }}>
        <CSpinner animation="grow" color="primary" style={{ margin: 'auto' }} />
      </div>
    );
  }
  return (
    <CTooltip content="Number of contents created last week and still active">
      <CWidgetDropdown color="primary" header={newActiveCount.toString()} text="New Active Contents" style={{ paddingBottom: '20px', whiteSpace: 'nowrap' }}></CWidgetDropdown>
    </CTooltip>
  );
};
