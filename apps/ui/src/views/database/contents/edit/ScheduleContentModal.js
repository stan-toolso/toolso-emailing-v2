import React, { useState, useContext, useEffect, useCallback } from 'react';
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CNav, CNavItem, CNavLink, CSpinner, CSwitch, CTabContent, CTabPane, CTabs } from '@coreui/react';

import { scheduleContent, unscheduleContent } from '../util';
import { getNextScheduleDate } from '../../sendings/schedules/utils';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import ScheduleEditComponent from '../../sendings/schedules/ScheduleEditComponent';
import { SCHEDULES } from '../../../../services/DatabaseQuery';
import { formatInteger } from '../../../util';
import CreateScheduleButton from '../../sendings/schedules/CreateScheduleButton';

export default ({ contentId, content, show, toggle, forceUpdate, emailingDatabaseApi }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const emailingDatabaseApiContext = emailingDatabaseApi ?? useContext(EmailingDatabaseApiContext);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let result = await emailingDatabaseApiContext.doQuery({
        query: SCHEDULES,
        variables: {
          filter: {
            availables: true
          }
        }
      });
      if (result) {
        setSchedules(JSON.parse(JSON.stringify(result.data.schedules.schedules)));
      }
      setLoading(false);
    })();
  }, [emailingDatabaseApiContext, contentId, setSchedules, setLoading]);

  const forceUpdateSchedules = useCallback(() => {
    setSchedules([...schedules]);
  }, [setSchedules, schedules]);

  return (
    <CModal show={show} color="info" size="lg" onClose={toggle}>
      <CModalHeader>Schedule your content</CModalHeader>

      <CModalBody>
        <CTabs>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink>Recurrent Schedules</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>Single Send schedules</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>Inscription schedules</CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent>
            <CTabPane>
              {loading && (
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              )}

              {!loading && (
                <>
                  <SchedulesTable schedules={schedules} content={content} type="recurrent" forceUpdate={forceUpdate} forceUpdateSchedules={forceUpdateSchedules} />
                </>
              )}
            </CTabPane>
            <CTabPane>
              {loading && (
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              )}

              {!loading && (
                <>
                  <CreateScheduleButton
                    defaultName={`Schedule for ${content.name}`}
                    defaultType="single_send"
                    onCreated={async (schedule) => {
                      schedule.edit = true;
                      await scheduleContent(emailingDatabaseApiContext, content, schedule, forceUpdate);
                      setSchedules([...schedules, schedule]);
                    }}
                  />

                  <SchedulesTable schedules={schedules} content={content} type="single_send" forceUpdate={forceUpdate} forceUpdateSchedules={forceUpdateSchedules} />
                </>
              )}
            </CTabPane>
            <CTabPane>
              {loading && (
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              )}

              {!loading && (
                <>
                  <SchedulesTable schedules={schedules} content={content} type="inscription" forceUpdate={forceUpdate} forceUpdateSchedules={forceUpdateSchedules} />
                </>
              )}
            </CTabPane>
          </CTabContent>
        </CTabs>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Close</CButton>
      </CModalFooter>
    </CModal>
  );
};

const SchedulesTable = ({ schedules, type, content, forceUpdate, forceUpdateSchedules }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  let filteredSchedules = schedules.filter((schedule) => {
    return schedule.type === type;
  });

  return (
    <table className="table table-sm">
      <thead>
        <tr>
          <th>ID</th>
          <th>name</th>
          {type !== 'inscription' && <th>Next Schedule Date</th>}
          {type !== 'inscription' && <th>Contacts</th>}
          <th>actions</th>
        </tr>
      </thead>
      {filteredSchedules.map((schedule) => {
        let nextScheduleDate = getNextScheduleDate(schedule, content);
        return (
          <tbody key={schedule.id}>
            <tr>
              <td>#{schedule.id}</td>
              <td className="font-weight-bold" style={{ width: '100%' }}>
                {schedule.name}
              </td>

              {type !== 'inscription' && (
                <td>
                  <div style={{ width: '140px' }}>{nextScheduleDate ? nextScheduleDate.format('YYYY/MM/DD HH:mm:ss') : ''}</div>
                </td>
              )}
              {type !== 'inscription' && <td>{formatInteger(schedule.contactsCount ? schedule.contactsCount : '')}</td>}

              <td>
                <div style={{ width: '140px' }}>
                  <CSwitch
                    className={'mx-1'}
                    variant={'3d'}
                    color={'primary'}
                    size={'sm'}
                    defaultChecked={
                      content.schedules.filter((item) => {
                        return item.id === schedule.id;
                      }).length > 0
                    }
                    onChange={(e) => {
                      e.target.checked ? scheduleContent(emailingDatabaseApiContext, content, schedule, forceUpdate) : unscheduleContent(emailingDatabaseApiContext, content, schedule, forceUpdate);
                    }}
                  />
                  <CButton
                    size="sm"
                    className="ml-2"
                    color="secondary"
                    style={{ verticalAlign: 'top' }}
                    onClick={() => {
                      schedule.edit = !schedule.edit;
                      forceUpdateSchedules();
                    }}
                  >
                    Edit
                  </CButton>
                </div>
              </td>
            </tr>
            {schedule.edit && (
              <tr className="bg-secondary">
                <td colSpan={type === 'inscription' ? 3 : 5}>
                  <ScheduleEditComponent schedule={schedule} forceUpdate={forceUpdate} />
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
    </table>
  );
};
