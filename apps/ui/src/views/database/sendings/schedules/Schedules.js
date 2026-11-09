import React, { useCallback, useContext, useState } from 'react';
import { CRow, CCol, CTabs, CNav, CNavItem, CNavLink, CTabPane, CTabContent } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import SchedulesCalendar from './SchedulesCalendar';
import SchedulesInscriptions from './SchedulesInscriptions';
import { ScheduleEdit } from './ScheduleEdit';
import SchedulesSingles from './SchedulesSingles';
import SchedulesRecurrents from './SchedulesRecurrents';
import SchedulesSettings from './SchedulesSettings';

const sections = ['', 'single_send', 'recurrent', 'inscription', 'settings'];

export default ({ match }) => {
  const section = match.params.section;
  const scheduleId = match.params.schedule_id;

  const [active, setActive] = useState(sections.indexOf(section ? section : ''));

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/sendings/schedules/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  if (scheduleId) {
    return <ScheduleEdit scheduleId={scheduleId} title={true} />;
  }

  return (
    <>
      <CRow>
        <CCol>
          <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
            <CNav variant="tabs">
              <CNavItem>
                <CNavLink>
                  <i className="far fa-calendar-alt"></i>
                  &nbsp; Calendar
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink>
                  <i className="fas fa-calendar-day"></i>
                  &nbsp; Single Send
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink>
                  <i className="fas fa-retweet"></i>
                  &nbsp; Reccurent
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink>
                  <i className="fas fa-sign-in-alt"></i>
                  &nbsp; Inscription
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink>
                  <i className="fas fa-tools"></i>
                  &nbsp; Default schedules
                </CNavLink>
              </CNavItem>
            </CNav>
            <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
              <CTabPane>
                <SchedulesCalendar />
              </CTabPane>
              <CTabPane>
                <SchedulesSingles />
              </CTabPane>
              <CTabPane>
                <SchedulesRecurrents />
              </CTabPane>
              <CTabPane>
                <SchedulesInscriptions />
              </CTabPane>
              <CTabPane>
                <SchedulesSettings />
              </CTabPane>
            </CTabContent>
          </CTabs>
        </CCol>
      </CRow>
    </>
  );
};
