import React from 'react';
import { CCard, CCol, CRow, CSelect } from '@coreui/react';
import ZipcodePrefixFilterEditor from '../../contacts/filters/ZipcodePrefixFilterEditor';
import ExclusionListFilterEditor from '../../contacts/filters/ExclusionListFilterEditor';
import AgeFilter from '../../contacts/filters/AgeFilter';
import GenderFilter from '../../contacts/filters/GenderFilter';
import ActivationFilter from '../../contacts/filters/ActivationFilter';
import EspsFilter from '../../contacts/filters/EspsFilter';
import SourcesFilter from '../../contacts/filters/SourcesFilter';
import DobFilter from './DobFilter';
import InclusionListFilterEditor from '../../contacts/filters/InclusionListFilterEditor';
import FieldValueCondition from '../../contacts/filters/FieldValueCondition';

import DaysEditor from './DaysEditor';

export default ({ filter, setFilter }) => {
  if (filter && filter.type === 'days') {
    filter.type = 'daysInclude';
  }
  return (
    <CRow className="my-1">
      <CCol xl={12}>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <i
            className="pt-3 fas fa-trash"
            onClick={() => {
              setFilter(null);
            }}
            style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block', color: '#d93737' }}
          ></i>
          <CCard color="secondary" style={{ width: '100%', margin: '0', padding: '5px', display: 'flex', flexDirection: 'row' }}>
            <CSelect
              size="sm"
              style={{ width: '150px' }}
              custom
              name="type"
              id="type"
              value={filter.type}
              onChange={(event) => {
                filter.type = event.target.value;
                setFilter(filter);
              }}
            >
              <option value="">-- Select Type --</option>
              <option value="age">Age</option>
              <option value="gender">Gender</option>
              <option value="isActivated">Activated</option>
              <option value="daysInclude">Days Inclusion</option>
              <option value="daysExclude">Days Exclusion</option>
              <option value="espExclude">Esp exclusion</option>
              <option value="espInclude">Esp inclusion</option>
              <option value="sourceExclude">Source exclusion</option>
              <option value="sourceInclude">Source inclusion</option>
              <option value="zipcodePrefixes">Zipcode prefixes</option>
              <option value="exclusionList">Exclusion List</option>
              <option value="inclusionList">Inclusion List</option>
              <option value="dob">Date of Birth</option>
              <option value="fieldValue">Contact Field Value</option>
            </CSelect>
            {filter.type === 'age' && <AgeFilter filter={filter} setFilter={setFilter} />}
            {filter.type === 'gender' && <GenderFilter filter={filter} setFilter={setFilter} />}
            {filter.type === 'isActivated' && <ActivationFilter filter={filter} setFilter={setFilter} />}

            {filter.type === 'daysInclude' && <DaysEditor filter={filter} setFilter={setFilter} />}
            {filter.type === 'daysExclude' && <DaysEditor filter={filter} setFilter={setFilter} />}
            {(filter.type === 'espExclude' || filter.type === 'espInclude') && <EspsFilter filter={filter} setFilter={setFilter} />}
            {(filter.type === 'sourceExclude' || filter.type === 'sourceInclude') && <SourcesFilter filter={filter} setFilter={setFilter} />}
            {filter.type === 'zipcodePrefixes' && <ZipcodePrefixFilterEditor filter={filter} setFilter={setFilter} />}

            {filter.type === 'exclusionList' && <ExclusionListFilterEditor filter={filter} setFilter={setFilter} />}
            {filter.type === 'inclusionList' && <InclusionListFilterEditor filter={filter} setFilter={setFilter} />}
            {filter.type === 'dob' && <DobFilter filter={filter} setFilter={setFilter} />}
            {filter.type === 'fieldValue' && <FieldValueCondition filter={filter} setFilter={setFilter} />}
          </CCard>
        </div>
      </CCol>
    </CRow>
  );
};
