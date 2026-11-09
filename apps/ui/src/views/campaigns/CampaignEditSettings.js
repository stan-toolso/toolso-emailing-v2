import React, { useState, useEffect } from 'react';
import { CButton, CCard, CCol, CFormGroup, CInput, CInputCheckbox, CLabel, CRow, CSelect, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import ZipcodePrefixFilterEditor from '../database/contacts/filters/ZipcodePrefixFilterEditor';
import ExclusionListFilterEditor from '../database/contacts/filters/ExclusionListFilterEditor';
import AgeFilter from '../database/contacts/filters/AgeFilter';
import GenderFilter from '../database/contacts/filters/GenderFilter';
import ActivationFilter from '../database/contacts/filters/ActivationFilter';
import EspsFilter from '../database/contacts/filters/EspsFilter';
import SourcesFilter from '../database/contacts/filters/SourcesFilter';
import InclusionListFilterEditor from '../database/contacts/filters/InclusionListFilterEditor';
import { useSelector } from 'react-redux';
import { contentTypeLabels } from '../database/contents/ContentsTypes';
import CampaignManagerApi from '../../services/CampaignManagerApi';
import updateCampaign from './updateCampaign';

export default ({ campaign, forceUpdate, enterpriseId }) => {
  const [defaultType] = 'newsletter';

  const user = useSelector((state) => state.user);
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState(campaign.type ? campaign.type : defaultType);

  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(campaign.config && campaign.config.filters ? campaign.config.filters : []);
  const [maxRequests, setMaxRequests] = useState(campaign.config && 'maxRequests' in campaign.config ? campaign.config.maxRequests : 0);
  const [maxRequestsAlert, setMaxRequestsAlert] = useState(campaign.config && 'maxRequestsAlert' in campaign.config ? campaign.config.maxRequestsAlert : false);
  const [maxRequestsAlertEmails, setMaxRequestsAlertEmails] = useState(campaign.config && 'maxRequestsAlertEmails' in campaign.config ? campaign.config.maxRequestsAlertEmails : user.email);

  const [maxSchedule, setMaxSchedule] = useState(campaign.config && 'maxSchedule' in campaign.config ? campaign.config.maxSchedule : 0);
  const [priority, setPriority] = useState(campaign.config && campaign.config.priority ? campaign.config.priority : 1);
  const [weight, setWeight] = useState(campaign.config && campaign.config.weight ? campaign.config.weight : 1);
  const [startDate, setStartDate] = useState(campaign.start_date ? moment(campaign.start_date).format('YYYY-MM-DD') : '');
  const [endDate, setEndDate] = useState(campaign.end_date ? moment(campaign.end_date).format('YYYY-MM-DD') : '');

  const [abTest, setAbTest] = useState(campaign.config && campaign.config.abTest ? campaign.config.abTest : {});

  useEffect(() => {
    if (!type) {
      setType(defaultType);
    }
  }, [defaultType, type, setType]);

  return (
    <>
      <CRow>
        <CCol xl={9}>
          <CFormGroup>
            <CLabel htmlFor="name">Name</CLabel>
            <CInput size="sm" type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>

        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="name">Type</CLabel>
            <CSelect
              className="form-control mr-2 mt-1"
              size="sm"
              value={type ? type : ''}
              onChange={(event) => {
                setType(event.target.value);
              }}
            >
              {Object.keys(contentTypeLabels).map((key) => {
                return (
                  <option value={key} key={key}>
                    {contentTypeLabels[key]}
                  </option>
                );
              })}
            </CSelect>
          </CFormGroup>
        </CCol>

        <CCol xl={6}>
          <CFormGroup>
            <CLabel htmlFor="startDate">Start date</CLabel>
            <CInput size="sm" type="date" id="startDate" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </CFormGroup>
        </CCol>
        <CCol xl={6}>
          <CFormGroup>
            <CLabel htmlFor="endDate">End date</CLabel>
            <CInput size="sm" type="date" id="endDate" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </CFormGroup>
        </CCol>
        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="priority">Priority</CLabel>
            <CInput size="sm" type="number" min="0" id="priority" value={priority} onChange={(event) => setPriority(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>
        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="weight">Weight</CLabel>
            <CInput size="sm" type="number" min="0" max="100" id="weight" value={weight} onChange={(event) => setWeight(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>
        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="maxSchedule">Max schedule per database (0 is unlimited)</CLabel>
            <CInput size="sm" type="number" min="0" id="maxSchedule" value={maxSchedule} onChange={(event) => setMaxSchedule(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>
        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="maxRequests">Requests capping per database (0 is unlimited)</CLabel>
            <CInput size="sm" type="number" min="0" id="maxRequests" value={maxRequests} onChange={(event) => setMaxRequests(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>

        {maxRequests > 0 && (
          <CCol xl={8}>
            <CFormGroup variant="checkbox" className="checkbox">
              <CInputCheckbox
                size="sm"
                id="maxRequestsAlert"
                checked={maxRequestsAlert}
                onChange={() => {
                  setMaxRequestsAlert(!maxRequestsAlert);
                }}
              />
              <CLabel htmlFor="maxRequestsAlert">Alert when capping is reached </CLabel>
            </CFormGroup>
            {maxRequestsAlert && (
              <CFormGroup>
                <CInput size="sm" id="maxRequestsAlertEmails" placeholder="Emails (..,..)" value={maxRequestsAlertEmails} onChange={(event) => setMaxRequestsAlertEmails(event.target.value)} />
              </CFormGroup>
            )}
          </CCol>
        )}

        <CCol xl={12}>
          <CFormGroup>
            <CLabel>Filters</CLabel>
            <ContentSettingsFilters filters={filters} setFilters={setFilters}></ContentSettingsFilters>
          </CFormGroup>
        </CCol>

        <CCol xl={12} className="pb-2">
          <CFormGroup variant="checkbox" className="checkbox">
            <CInputCheckbox
              size="sm"
              id="abTestActivated"
              checked={abTest.activated ? abTest.activated : false}
              onChange={() => {
                let newAbTest = { ...abTest };
                newAbTest.activated = newAbTest.activated ? false : true;
                if (!newAbTest.activated) {
                  newAbTest.versionId = null;
                  newAbTest.status = null;
                }
                setAbTest(newAbTest);
              }}
            />
            <CLabel htmlFor="activatedContact">Activate AB Test</CLabel>
          </CFormGroup>
          {abTest.activated && (
            <CRow>
              <CCol xl={4}>
                <CFormGroup>
                  <CLabel htmlFor="volume">Test volume</CLabel>
                  <CInput
                    size="sm"
                    type="number"
                    min="1"
                    id="volume"
                    value={abTest.volume ? abTest.volume : 5000}
                    onChange={(event) => {
                      abTest.volume = parseInt(event.target.value);
                      setAbTest({ ...abTest });
                    }}
                    disabled={abTest.status === 'completed'}
                  />
                </CFormGroup>
              </CCol>
              <CCol xl={4}>
                <CFormGroup>
                  <CLabel htmlFor="period">Test period (in hours)</CLabel>
                  <CInput
                    size="sm"
                    type="number"
                    min="1"
                    id="period"
                    value={abTest.period ? abTest.period : 1}
                    onChange={(event) => {
                      abTest.period = parseInt(event.target.value);
                      setAbTest({ ...abTest });
                    }}
                    disabled={abTest.status === 'completed'}
                  />
                </CFormGroup>
              </CCol>
              <CCol xl={4}>
                <CFormGroup>
                  <CLabel htmlFor="goal">Goal</CLabel>
                  <CSelect
                    size="sm"
                    custom
                    name="goal"
                    id="goal"
                    value={abTest.goal}
                    onChange={(event) => {
                      abTest.goal = event.target.value;
                      setAbTest({ ...abTest });
                    }}
                    disabled={abTest.status === 'completed'}
                  >
                    <option value="open">Open rate</option>
                    <option value="click">Click rate</option>
                  </CSelect>
                </CFormGroup>
              </CCol>
              {abTest.status === 'completed' && abTest.versionId && (
                <CCol xl={4}>
                  <CFormGroup>
                    <CLabel>Selected version</CLabel>
                    <input className="form-control form-control-sm" value={`${abTest.versionId} - ${abTest.versionLabel}`} disabled={true} />
                  </CFormGroup>
                </CCol>
              )}
            </CRow>
          )}
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CButton
            color="primary"
            onClick={async () => {
              setSaving(true);
              await updateCampaign(
                CampaignManagerApi,
                campaign,
                {
                  name,
                  start_date: moment(startDate, 'YYYY-MM-DD').isValid() ? moment(startDate, 'YYYY-MM-DD').startOf('day').toDate() : null,
                  end_date: moment(endDate, 'YYYY-MM-DD').isValid() ? moment(endDate, 'YYYY-MM-DD').endOf('day').toDate() : null,
                  config: { ...(campaign.config ? campaign.config : {}), ...{ maxSchedule, maxRequests, maxRequestsAlert, maxRequestsAlertEmails, priority, filters, weight, abTest } },
                  type
                },
                forceUpdate,
                enterpriseId
              );
              setSaving(false);
            }}
          >
            {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Save
          </CButton>
        </CCol>
      </CRow>
    </>
  );
};

const ContentSettingsFilters = ({ filters, setFilters }) => {
  return (
    <div>
      <CButton
        size="sm"
        color="success"
        className="mb-3"
        onClick={() => {
          setFilters([...filters, { id: filters.length + 1 }]);
        }}
      >
        Add filter
      </CButton>
      {filters.map((filter) => {
        return (
          <FilterEditor
            key={filter.id}
            filter={filter}
            setFilter={(value) => {
              let index = filters.indexOf(filter);
              if (value) {
                setFilters([...filters.slice(0, index), value, ...filters.slice(index + 1)]);
              } else {
                setFilters([...filters.slice(0, index), ...filters.slice(index + 1)]);
              }
            }}
          />
        );
      })}
    </div>
  );
};
const FilterEditor = ({ filter, setFilter }) => {
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
          </CCard>
        </div>
      </CCol>
    </CRow>
  );
};

const DaysEditor = ({ filter, setFilter }) => {
  if (!filter.days) {
    filter.days = [];
  }
  const toggleDay = (day) => {
    let index = filter.days.indexOf(day);
    if (index >= 0) {
      filter.days.splice(index, 1);
    } else {
      filter.days.push(day);
    }
    setFilter(filter);
  };

  return (
    <div className="mx-2 pt-1">
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day1" checked={filter.days.indexOf(1) >= 0} onChange={() => toggleDay(1)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day1">
          Monday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day2" checked={filter.days.indexOf(2) >= 0} onChange={() => toggleDay(2)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day2">
          Tuesday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day3" checked={filter.days.indexOf(3) >= 0} onChange={() => toggleDay(3)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day3">
          Wednesday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day4" checked={filter.days.indexOf(4) >= 0} onChange={() => toggleDay(4)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day4">
          Thursday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day5" checked={filter.days.indexOf(5) >= 0} onChange={() => toggleDay(5)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day5">
          Friday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day6" checked={filter.days.indexOf(6) >= 0} onChange={() => toggleDay(6)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day6">
          Saturday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day7" checked={filter.days.indexOf(7) >= 0} onChange={() => toggleDay(7)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day7">
          Sunday
        </CLabel>
      </CFormGroup>
    </div>
  );
};
