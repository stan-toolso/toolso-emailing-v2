import React from 'react';
import { CCol, CInput, CRow, CSelect } from '@coreui/react';

export default ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <CRow>
        <CCol xl={3}>
          <CSelect
            className="mx-2 w-100"
            custom
            name="utm"
            id="utm"
            value={filter.subType}
            onChange={(event) => {
              filter.subType = event.target.value;
              setFilter({ ...filter });
            }}
          >
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </CSelect>
        </CCol>
        <CCol xl={9}>
          <CInput
            placeholder="Prefixes"
            className="w-100"
            type="text"
            value={filter.values ? filter.values : ''}
            onChange={(event) => {
              filter.values = event.target.value;
              setFilter({ ...filter });
            }}
          />
          <small>Separate all zipcode prefixes with a comma. Ex : 33,34,35</small>
        </CCol>
      </CRow>
    </div>
  );
};
