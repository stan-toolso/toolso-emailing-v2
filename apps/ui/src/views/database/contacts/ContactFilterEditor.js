import React from 'react';
import { CButton, CCol, CRow, CSelect } from '@coreui/react';

import AgeFilter from './filters/AgeFilter';
import GenderFilter from './filters/GenderFilter';
import ActivationFilter from './filters/ActivationFilter';
import EspsFilter from './filters/EspsFilter';
import ZipcodePrefixFilterEditor from './filters/ZipcodePrefixFilterEditor';
import ExclusionListFilterEditor from './filters/ExclusionListFilterEditor';
import InscriptionDateFilter from './filters/InscriptionDateFilter';
import SourcesFilter from './filters/SourcesFilter';
import StatusFilter from './filters/StatusFilter';
import ActivityScoreFilter from './filters/ActivityScoreFilter';
import FieldValueCondition from './filters/FieldValueCondition';
import ActivityConditionFilter from './filters/ActivityConditionFilter';
import PixelTrackingConsentFilter from './filters/PixelTrackingConsentFilter';

export default ({ filter, setFilter }) => {
  return (
    <CRow className="py-1">
      <CCol xl={12}>
        <Condition filter={filter} setFilter={setFilter} first={true} />
      </CCol>
    </CRow>
  );
};

const Condition = ({ filter, setFilter, first }) => {
  return (
    <div className="py-1">
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {!first && (
          <i
            className="pt-2 fas fa-trash"
            onClick={() => {
              setFilter(null);
            }}
            style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block', color: '#d93737' }}
          ></i>
        )}
        <CSelect
          className="mr-2"
          size="sm"
          value={filter.type}
          style={{ width: '200px', display: 'inline-block' }}
          onChange={(event) => {
            filter.type = event.target.value;
            setFilter({ ...filter });
          }}
        >
          <option value="">Choose a condition</option>
          <option value="or">OR</option>
          <option value="and">AND</option>
          <option value="fieldValue">Field Value</option>
          <option value="isActivated">Activation</option>
          <option value="age">Age</option>
          <option value="status">Status</option>
          <option value="gender">Gender</option>
          <option value="activityScore">Activity Score </option>
          <option value="zipcodePrefixes">Zipcode prefixes</option>
          <option value="exclusionList">Exclusion List</option>
          <option value="espExclude">Esp exclusion</option>
          <option value="espInclude">Esp inclusion</option>
          <option value="sourceExclude">Source exclusion</option>
          <option value="sourceInclude">Source inclusion</option>
          <option value="inscriptionDate">Inscription Date</option>
          <option value="activityCondition">Activity Condition</option>
          <option value="pixelTrackingConsent">Pixel Tracking Consent</option>
        </CSelect>

        {filter.type === 'fieldValue' && <FieldValueCondition filter={filter} setFilter={setFilter} />}
        {filter.type === 'isActivated' && <ActivationFilter filter={filter} setFilter={setFilter} />}

        {filter.type === 'age' && <AgeFilter filter={filter} setFilter={setFilter} />}
        {filter.type === 'activityScore' && <ActivityScoreFilter filter={filter} setFilter={setFilter} />}

        {filter.type === 'status' && <StatusFilter filter={filter} setFilter={setFilter} />}

        {filter.type === 'gender' && <GenderFilter filter={filter} setFilter={setFilter} />}
        {(filter.type === 'espExclude' || filter.type === 'espInclude') && <EspsFilter filter={filter} setFilter={setFilter} />}
        {filter.type === 'zipcodePrefixes' && <ZipcodePrefixFilterEditor filter={filter} setFilter={setFilter} />}
        {filter.type === 'exclusionList' && <ExclusionListFilterEditor filter={filter} setFilter={setFilter} />}
        {filter.type === 'inscriptionDate' && <InscriptionDateFilter filter={filter} setFilter={setFilter} />}
        {filter.type === 'activityCondition' && <ActivityConditionFilter filter={filter} setFilter={setFilter} />}
        {filter.type === 'pixelTrackingConsent' && <PixelTrackingConsentFilter filter={filter} setFilter={setFilter} />}
        {(filter.type === 'sourceExclude' || filter.type === 'sourceInclude') && <SourcesFilter filter={filter} setFilter={setFilter} />}
      </div>
      {(filter.type === 'or' || filter.type === 'and') && <ChildCondition filter={filter} setFilter={setFilter} />}
    </div>
  );
};

const ChildCondition = ({ filter, setFilter }) => {
  if (!filter.children) {
    filter.children = [{}];
  }
  return (
    <div className="pl-3 py-1">
      {filter.children.map((child, index) => {
        return (
          <Condition
            key={index}
            filter={child}
            setFilter={(value) => {
              if (value) {
                filter.children = [...filter.children.slice(0, index), value, ...filter.children.slice(index + 1)];
              } else {
                filter.children = [...filter.children.slice(0, index), ...filter.children.slice(index + 1)];
              }
              setFilter({ ...filter });
            }}
          />
        );
      })}
      <CButton
        size="sm"
        color="success"
        onClick={() => {
          filter.children.push({ type: '' });
          setFilter({ ...filter });
        }}
      >
        Add condition
      </CButton>
    </div>
  );
};
