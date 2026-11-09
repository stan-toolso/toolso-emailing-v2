import React, { useContext, useEffect, useState } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CRow, CSelect, CSpinner } from '@coreui/react';

import { updateSchedule, getAllSendingConfigs, canEditSchedule } from './utils';
import moment from 'moment-timezone';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import ContactFilterEditor from '../../contacts/ContactFilterEditor';

export default ({ schedule, forceUpdate }) => {
  const [name, setName] = useState(schedule.name);
  const [protectionLevel, setProtectionLevel] = useState(schedule?.config?.protectionLevel ?? '');

  const [scheduleDate, setScheduleDate] = useState(schedule.scheduleDate ? moment(schedule.scheduleDate).tz('Europe/Paris').format('YYYY-MM-DDTHH:mm') : '');
  const [scheduleTime, setScheduleTime] = useState(schedule.scheduleDate ? moment(schedule.scheduleDate).tz('Europe/Paris').format('HH:mm') : '');

  const [sendingConfigId, setSendingConfigId] = useState(schedule.sendingConfig ? schedule.sendingConfig.id : '');

  const [filter, setFilter] = useState(schedule.config && 'filter' in schedule.config ? schedule.config.filter : {});

  const [sendingConfigs, setSendingConfigs] = useState([]);
  const [saving, setSaving] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const canEdit = canEditSchedule(schedule);

  useEffect(() => {
    (async () => {
      setSendingConfigs(await getAllSendingConfigs(emailingDatabaseApiContext));
    })();
  }, [emailingDatabaseApiContext]);

  return (
    <>
      <CRow>
        <CCol xl={12}>
          <CFormGroup>
            <CLabel htmlFor="name">Name</CLabel>
            <CInput type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>

        {schedule.type === 'single_send' && (
          <CCol xl={3}>
            <CFormGroup>
              <CLabel htmlFor="scheduleDate">Schedule date</CLabel>
              <CInput disabled={!canEdit} type="datetime-local" id="scheduleDate" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} />
            </CFormGroup>
          </CCol>
        )}
        {schedule.type === 'recurrent' && (
          <CCol xl={3}>
            <CFormGroup>
              <CLabel htmlFor="scheduleTime">Schedule time</CLabel>
              <CInput type="time" id="scheduleTime" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
            </CFormGroup>
          </CCol>
        )}
        <CCol xl={3}>
          <CFormGroup>
            <CLabel htmlFor="protectionLevel">Protection Level</CLabel>
            <CSelect
              disabled={!canEdit}
              custom
              name="protectionLevel"
              id="protectionLevel"
              value={protectionLevel}
              onChange={(event) => {
                setProtectionLevel(event.target.value);
              }}
            >
              <option value="">-- Select Protection Level --</option>

              <option key="0" value="0">
                0 (No Captcha)
              </option>
              <option key="1" value="1">
                1
              </option>
              <option key="2" value="2">
                2
              </option>
              <option key="3" value="3">
                3
              </option>
              <option key="4" value="4">
                4
              </option>
              <option key="5" value="5">
                5 (Full Captcha)
              </option>
            </CSelect>
          </CFormGroup>
        </CCol>
        <CCol xl={6}>
          <CFormGroup>
            <CLabel htmlFor="sendingConfig">Sending Config</CLabel>
            <CSelect
              disabled={!canEdit}
              custom
              name="sendingConfig"
              id="sendingConfig"
              value={sendingConfigId}
              onChange={(event) => {
                setSendingConfigId(event.target.value);
              }}
            >
              <option value="">-- Select Sending config --</option>
              {sendingConfigs.map((item, index) => {
                return (
                  <option key={index} value={item.id}>
                    {item.name}
                  </option>
                );
              })}
            </CSelect>
          </CFormGroup>
        </CCol>

        <CCol xl={12}>
          <CFormGroup>
            <CLabel>Filter</CLabel>
            <ContactFilterEditor
              filter={filter}
              setFilter={
                canEdit
                  ? (filter) => {
                      setFilter({ ...filter });
                    }
                  : () => {}
              }
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <CButton
            color="primary"
            onClick={async () => {
              setSaving(true);
              let config = JSON.parse(JSON.stringify(schedule.config ? schedule.config : {}));
              config.filter = filter;
              config.protectionLevel = protectionLevel;
              await updateSchedule(
                emailingDatabaseApiContext,
                schedule,
                {
                  name,
                  config,
                  scheduleDate:
                    schedule.type === 'single_send'
                      ? moment(scheduleDate, 'YYYY-MM-DDTHH:mm').isValid()
                        ? moment(scheduleDate, 'YYYY-MM-DDTHH:mm').toDate()
                        : null
                      : moment(scheduleTime, 'HH:mm').isValid()
                      ? moment(scheduleTime, 'HH:mm').toDate()
                      : null,
                  sendingConfigId: sendingConfigId
                },
                `Schedule has been saved`,
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
