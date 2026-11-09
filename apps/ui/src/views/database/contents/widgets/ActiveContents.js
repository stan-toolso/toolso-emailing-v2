import React from 'react';
import { CSpinner, CWidgetDropdown, CTooltip } from '@coreui/react';

export default ({ activeContents, loading }) => {
  let total = 0;
  if (activeContents) {
    total = activeContents.length;
  }

  if (loading) {
    return (
      <div className="card text-white bg-gradient-success" style={{ textAlign: 'center', height: '95px' }}>
        <CSpinner animation="grow" color="success" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <CTooltip content="Number of active contents now">
      <CWidgetDropdown color="success" header={total.toString()} text="Active Contents" style={{ paddingBottom: '20px' }}></CWidgetDropdown>
    </CTooltip>
  );
};
