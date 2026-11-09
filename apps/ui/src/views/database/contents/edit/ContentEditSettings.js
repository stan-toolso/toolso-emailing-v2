import React, { useContext, useState, useEffect } from 'react';
import { CButton, CCol, CFormGroup, CInput, CInputCheckbox, CLabel, CRow, CSelect, CSpinner } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import moment from 'moment-timezone';
import { updateContent } from '../util';
import { useSelector } from 'react-redux';
import { contentTypeLabels } from '../ContentsTypes';
import { useMultipleSettings } from '../../../common/Settings';
import PartnersSelector from '../partners/PartnersSelector';
import ContentSettingsFilters from './ContentSettingsFilters';

export default ({ content, forceUpdate, emailingDatabaseApi }) => {
  const emailingDatabaseApiContext = emailingDatabaseApi ?? useContext(EmailingDatabaseApiContext);
  let settings = useMultipleSettings(['default_content_type', 'categories']);
  let defaultType = settings?.default_content_type;
  let allCategories = settings?.categories ? settings.categories : [];

  const user = useSelector((state) => state.user);
  const [name, setName] = useState(content.name);
  const [type, setType] = useState(content.type ? content.type : defaultType);
  const [category, setCategory] = useState(content.category ?? '');
  const [partnerId, setPartnerId] = useState(content.partner ? content.partner.id : '');

  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(content.config && content.config.filters ? content.config.filters : []);
  const [maxRequests, setMaxRequests] = useState(content.config && 'maxRequests' in content.config ? content.config.maxRequests : 0);
  const [maxClicks, setMaxClicks] = useState(content.config && 'maxClicks' in content.config ? content.config.maxClicks : 0);
  const [maxRequestsAlert, setMaxRequestsAlert] = useState(content.config && 'maxRequestsAlert' in content.config ? content.config.maxRequestsAlert : false);
  const [maxRequestsAlertEmails, setMaxRequestsAlertEmails] = useState(content.config && 'maxRequestsAlertEmails' in content.config ? content.config.maxRequestsAlertEmails : user.email);

  const [maxSchedule, setMaxSchedule] = useState(content.config && 'maxSchedule' in content.config ? content.config.maxSchedule : 0);
  const [priority, setPriority] = useState(content.config && content.config.priority ? content.config.priority : 1);
  const [weight, setWeight] = useState(content.config && content.config.weight ? content.config.weight : 1);
  const [startDate, setStartDate] = useState(content.startDate ? moment(content.startDate).format('YYYY-MM-DD') : '');
  const [endDate, setEndDate] = useState(content.endDate ? moment(content.endDate).format('YYYY-MM-DD') : '');

  const [abTest, setAbTest] = useState(content.config && content.config.abTest ? content.config.abTest : {});

  useEffect(() => {
    if (!type) {
      setType(defaultType);
    }
  }, [defaultType, type, setType]);

  useEffect(() => {
    if (content) {
      setType(content.type ? content.type : defaultType);
      setName(content.name);
      setFilters(content.config && content.config.filters ? content.config.filters : []);
      setMaxRequestsAlert(content.config && 'maxRequestsAlert' in content.config ? content.config.maxRequestsAlert : false);
      setMaxRequestsAlertEmails(content.config && 'maxRequestsAlertEmails' in content.config ? content.config.maxRequestsAlertEmails : user.email);
      setMaxSchedule(content.config && 'maxSchedule' in content.config ? content.config.maxSchedule : 0);
      setPriority(content.config && content.config.priority ? content.config.priority : 1);
      setWeight(content.config && content.config.weight ? content.config.weight : 1);
      setStartDate(content.startDate ? moment(content.startDate).format('YYYY-MM-DD') : '');
      setEndDate(content.endDate ? moment(content.endDate).format('YYYY-MM-DD') : '');
      setAbTest(content.config && content.config.abTest ? content.config.abTest : {});
      setPartnerId(content.partner ? content.partner.id : '');
    }
  }, [content, defaultType, setType, setName, setFilters, setMaxRequestsAlert, setMaxRequestsAlertEmails, setMaxSchedule, setPriority, setWeight, setStartDate, setEndDate, setAbTest, user]);

  return (
    <>
      <CRow>
        <CCol xl={6}>
          <CFormGroup>
            <CLabel htmlFor="name">Name</CLabel>
            <CInput size="sm" type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>

        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="name">Partner</CLabel>
            <PartnersSelector partnerId={partnerId} setPartnerId={setPartnerId} />
          </CFormGroup>
        </CCol>

        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="name">Type</CLabel>
            <CSelect
              className="form-control mr-2"
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

        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="name">Category</CLabel>
            <CSelect
              className="form-control mr-2"
              size="sm"
              value={category ? category : ''}
              onChange={(event) => {
                setCategory(event.target.value);
              }}
            >
              <option value={''} key={''}>
                -- Select a category --
              </option>
              {allCategories &&
                allCategories.map((categ) => {
                  return (
                    <option value={categ} key={categ}>
                      {categ}
                    </option>
                  );
                })}
            </CSelect>
          </CFormGroup>
        </CCol>

        <CCol xl={4}>
          <CFormGroup>
            <CLabel htmlFor="startDate">Start date</CLabel>
            <CInput size="sm" type="date" id="startDate" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </CFormGroup>
        </CCol>
        <CCol xl={4}>
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
            <CLabel htmlFor="maxSchedule">Max schedule (0 is unlimited)</CLabel>
            <CInput size="sm" type="number" min="0" id="maxSchedule" value={maxSchedule} onChange={(event) => setMaxSchedule(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>
        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="maxRequests">Requests capping (0 is unlimited)</CLabel>
            <CInput size="sm" type="number" min="0" id="maxRequests" value={maxRequests} onChange={(event) => setMaxRequests(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>
        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="maxClicks">Clicks capping (0 is unlimited)</CLabel>
            <CInput size="sm" type="number" min="0" id="maxClicks" value={maxClicks} onChange={(event) => setMaxClicks(parseInt(event.target.value))} />
          </CFormGroup>
        </CCol>

        {(maxRequests > 0 || maxClicks > 0) && (
          <CCol xl={6}>
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
                abTest.activated = abTest.activated ? false : true;
                if (!abTest.activated) {
                  abTest.versionId = null;
                  abTest.status = null;
                }
                setAbTest({ ...abTest });
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
              await updateContent(
                emailingDatabaseApiContext,
                content,
                {
                  name,
                  partnerId: partnerId ? partnerId : null,
                  startDate: moment(startDate, 'YYYY-MM-DD').isValid() ? moment(startDate, 'YYYY-MM-DD').startOf('day').toDate() : null,
                  endDate: moment(endDate, 'YYYY-MM-DD').isValid() ? moment(endDate, 'YYYY-MM-DD').endOf('day').toDate() : null,
                  config: { ...(content.config ? content.config : {}), ...{ maxSchedule, maxRequests, maxRequestsAlert, maxRequestsAlertEmails, priority, filters, weight, abTest, maxClicks } },
                  type,
                  category
                },
                `Content settings has been saved`,
                forceUpdate
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
