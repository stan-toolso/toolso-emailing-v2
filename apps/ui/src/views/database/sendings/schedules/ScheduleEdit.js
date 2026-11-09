import { gql, useQuery } from '@apollo/client';
import { CNav, CNavItem, CNavLink, CSpinner, CSwitch, CTabContent, CTabPane, CTabs } from '@coreui/react';
import React, { useContext, useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import DelivStats from '../deliv/DelivStats';
import ScheduleDetailSummary from './ScheduleDetailSummary';
import ScheduleEditComponent from './ScheduleEditComponent';
import ScheduleEditStrategiesComponent from './ScheduleEditStrategiesComponent';
import { canActivateSchedule, updateSchedule } from './utils';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useSelector } from 'react-redux';

export const ScheduleEditCard = ({ scheduleId }) => {
  return (
    <Card>
      <ScheduleEdit scheduleId={scheduleId} />
    </Card>
  );
};

const sections = ['', 'settings'];

export const ScheduleEdit = ({ scheduleId, date, onScheduleChanged, defaultSection, title }) => {
  const [active, setActive] = useState(sections.indexOf(defaultSection ? defaultSection : ''));
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { loading, data, refetch } = useQuery(
    gql`
      query schedule($id: ID!, $fromDate: String, $toDate: String, $dimensionType: String, $filter: JSON, $contentFilter: JSON) {
        schedule(id: $id) {
          id
          parentId
          isActive
          name
          type
          status
          scheduleDate
          rate
          contactsCount
          config
          report
          sendingConfig {
            id
            name
          }
          contents(filter: $contentFilter) {
            total
          }
          dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType, filter: $filter) {
            dimensionsStats {
              totalStats {
                request
                open
                unique_open
                click
                unique_click
                complaint
                unsub
                soft_bounce
                hard_bounce
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: scheduleId,
        dimensionType: 'schedule',
        contentFilter: {
          isActive: true
        }
      },
      skip: scheduleId === null
    }
  );

  useEffect(() => {
    if (onScheduleChanged && data) {
      onScheduleChanged(JSON.parse(JSON.stringify(data.schedule)));
    }
  }, [onScheduleChanged, data]);

  const schedule = data && data.schedule ? JSON.parse(JSON.stringify(data.schedule)) : null;

  if (schedule && schedule.status === 'sent') {
    sections.push('deliv');
  }
  const userEntreprise = useSelector((state) => state.userEntreprise);
  const isSuperAdmin = userEntreprise.role === 'superAdmin';
  if (isSuperAdmin) {
    sections.push('strategies');
  }

  return (
    <>
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0px' }}>
          <CSpinner animation="grow" color="secondary" />
        </div>
      )}
      {!loading && schedule && (
        <>
          {title && (
            <>
              <CSwitch
                className={'mx-1 float-left mr-3 '}
                variant={'3d'}
                color={'primary'}
                size={'sm'}
                checked={schedule.isActive}
                disabled={!canActivateSchedule(schedule)}
                onChange={(e) => {
                  updateSchedule(
                    emailingDatabaseApiContext,
                    schedule,
                    {
                      isActive: e.target.checked
                    },
                    e.target.checked ? `Schedule ${schedule.name} has been activated` : `Schedule ${schedule.name} has been disabled`,
                    refetch
                  );
                }}
              />
              <h3>
                #{scheduleId} : {schedule.name}
              </h3>
            </>
          )}

          <CTabs activeTab={active} onActiveTabChange={setActive}>
            <CNav variant="tabs">
              <CNavItem id="Summary">
                <CNavLink>
                  <i className="fas fa-tachometer-alt"></i>
                  &nbsp; Summary
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink id="Settings">
                  <i className="fas fa-cogs"></i>
                  &nbsp; Settings
                </CNavLink>
              </CNavItem>
              {schedule.status === 'sent' && (
                <CNavItem>
                  <CNavLink id="Deliverability">
                    <i className="fas fa-chart-line"></i>&nbsp; Deliverability
                  </CNavLink>
                </CNavItem>
              )}
              {isSuperAdmin && (
                <CNavItem>
                  <CNavLink id="Strategies">
                    <i className="fa-solid fa-chess-rook"></i>
                    &nbsp; Strategies
                  </CNavLink>
                </CNavItem>
              )}
            </CNav>
            <CTabContent className=" border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
              <CTabPane className="p-3" id="ScheduleDetailSummary">
                <ScheduleDetailSummary schedule={schedule} date={date} />
              </CTabPane>
              <CTabPane className="p-3" style={{ overflowX: 'scroll' }} id="ScheduleEditComponent">
                <ScheduleEditComponent schedule={schedule} forceUpdate={refetch} />
              </CTabPane>
              {schedule.status === 'sent' && (
                <CTabPane id="DelivStats">
                  <DelivStats defaultFilter={{ schedule: schedule.parentId ? schedule.parentId : schedule.id }} defaultFromDate={date} defaultToDate={date} defaultDimension={'content'} />
                </CTabPane>
              )}
              {isSuperAdmin && (
                <CTabPane className="p-3" id="ScheduleEditStrategiesComponent">
                  <ScheduleEditStrategiesComponent schedule={schedule} forceUpdate={refetch} />
                </CTabPane>
              )}
            </CTabContent>
          </CTabs>
        </>
      )}
    </>
  );
};
