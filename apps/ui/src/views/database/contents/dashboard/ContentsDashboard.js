import React, { useCallback, useContext, useState, useEffect } from 'react';
import { CRow, CCol, CTabContent, CTabPane, CNav, CNavItem, CNavLink, CTabs } from '@coreui/react';
import { useQuery } from '@apollo/client';
import moment from 'moment-timezone';
import gql from 'graphql-tag';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import DashboardTab from './DashboardTab';

const sections = ['', 'newsletter', 'marketing'];
const sectionsLabels = ['Overview', 'Newsletter', 'Marketing'];

var usefullSectionsIds = [0];

export default ({ match }) => {
  const section = match.params.section;
  const [active, setActive] = useState(sections.indexOf(section ? section : ''));
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();
  const [weeklyContents, setWeeklyContents] = useState([]);
  const [globalContents, setGlobalContents] = useState([]);
  const [delivContents, setDelivContents] = useState([]);
  const [scheduleContents, setScheduleContents] = useState([]);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  const fromDate = moment().subtract(7, 'day');
  const toDate = moment();

  const { loading: loadingWeeklyContents, data: dataWeeklyContents } = useQuery(
    gql`
      query weeklyContents($filter: JSON, $limit: Int) {
        contents(filter: $filter, limit: $limit) {
          contents {
            id
            isActive
            name
            createdAt
            endDate
            isActive
            type
            delivStats {
              request
              delivered
              soft_bounce
              hard_bounce
              click
              open
              unique_click
              unique_open
              unique_proxy_loaded
              proxy_loaded
              complaint
              unsub
              contact_scores
            }
          }
        }
      }
    `,
    {
      variables: {
        filter: {
          createdFromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
          CreatedToDate: toDate ? toDate.format('YYYY-MM-DD') : null
        },
        limit: 3000
      }
    }
  );

  const { loading: loadingGlobalContents, data: dataGlobalContents } = useQuery(
    gql`
      query globalContents($filter: JSON, $limit: Int) {
        contents(filter: $filter, limit: $limit) {
          contents {
            type
          }
        }
      }
    `,
    {
      variables: {
        limit: 3000,
        filter: {
          isActive: true
        }
      }
    }
  );

  const { loading: loadingDelivContents, data: dataDelivContents } = useQuery(
    gql`
      query delivContents($fromDate: String!, $toDate: String!, $dimensionType: String) {
        dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType) {
          dimensionsStats {
            totalStats {
              unique_click
              request
            }
            dimension {
              object
            }
          }
        }
      }
    `,
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
        dimensionType: 'content'
      }
    }
  );

  const { loading: loadingScheduleContents, data: dataScheduleContents } = useQuery(
    gql`
      query schedules($limit: Int, $offset: Int, $filter: JSON) {
        schedules(limit: $limit, offset: $offset, filter: $filter) {
          schedules {
            report
          }
        }
      }
    `,
    {
      variables: {
        filter: {
          fromDate: moment().add(-7, 'days').format('YYYY-MM-DD'),
          toDate: moment().format('YYYY-MM-DD'),
          types: ['recurrent_instance', 'single_send'],
          forCalendar: true
        },
        offset: 0,
        limit: 100
      }
    }
  );

  const maxWantedItems = 10;

  useEffect(() => {
    if (dataWeeklyContents) {
      var requestArrays = dataWeeklyContents.contents.contents && dataWeeklyContents.contents.contents.filter((content) => content.delivStats).map((content) => content.delivStats.request);
      requestArrays = requestArrays && requestArrays.sort((a, b) => a - b);
      var contentsWithMoreThanThousandRequests = dataWeeklyContents.contents.contents.filter((content) => content.delivStats && content.delivStats.request && content.delivStats.request > 1000);
      if (contentsWithMoreThanThousandRequests.length >= maxWantedItems) {
        setWeeklyContents(contentsWithMoreThanThousandRequests);
      } else {
        if (requestArrays.length >= 10) {
          var firstDecile = requestArrays[Math.floor(requestArrays.length * 0.1) - 1];
          var filtereredContents = dataWeeklyContents.contents.contents.filter((content) => content.delivStats && content.delivStats.request && content.delivStats.request > firstDecile);
          setWeeklyContents(filtereredContents);
        } else {
          setWeeklyContents(dataWeeklyContents.contents.contents);
        }
      }
    }
  }, [setWeeklyContents, dataWeeklyContents]);

  if (dataGlobalContents) {
    var newUsefullSections = dataGlobalContents.contents.contents && [
      ...new Set(dataGlobalContents.contents.contents.filter((content) => content.type && content.type !== 'welcome_mail').map((content) => content.type))
    ];
    if (newUsefullSections.length >= 2) {
      newUsefullSections = ['', ...newUsefullSections];
    } else {
      newUsefullSections = [''];
    }

    usefullSectionsIds = newUsefullSections.map((section) => sections.indexOf(section));
  }

  useEffect(() => {
    if (dataGlobalContents) {
      setGlobalContents(dataGlobalContents.contents.contents);
    }
  }, [setGlobalContents, dataGlobalContents]);

  useEffect(() => {
    if (dataDelivContents) {
      setDelivContents(dataDelivContents.dimensionDelivStats.dimensionsStats);
    }
  }, [setDelivContents, dataDelivContents]);

  useEffect(() => {
    if (dataScheduleContents && dataScheduleContents.schedules) {
      setScheduleContents(dataScheduleContents.schedules.schedules);
    }
  }, [setScheduleContents, dataScheduleContents]);

  function FilterByType(contents, type) {
    if (!type || type === '') {
      return contents;
    }
    return contents.filter((content) => content.type === type);
  }

  function FilterDelivByType(delivs, type) {
    if (!type || type === '') {
      return delivs;
    }
    return delivs.filter((deliv) => deliv.dimension && deliv.dimension.object.type === type);
  }

  return (
    <>
      <CRow>
        <CCol>
          <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
            <CNav variant="tabs">
              {usefullSectionsIds.map((sectionId) => {
                return (
                  <CNavItem key={sectionId}>
                    <CNavLink>{sectionsLabels[sectionId]}</CNavLink>
                  </CNavItem>
                );
              })}
            </CNav>
            <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
              {usefullSectionsIds.map((sectionId) => {
                return (
                  <CTabPane key={sectionId}>
                    <DashboardTab
                      weeklyContents={FilterByType(weeklyContents, sections[sectionId])}
                      loadingWeeklyContents={loadingWeeklyContents}
                      activeContents={FilterByType(globalContents, sections[sectionId])}
                      loadingGlobalContents={loadingGlobalContents}
                      delivContents={FilterDelivByType(delivContents, sections[sectionId])}
                      loadingDelivContents={loadingDelivContents}
                      scheduleContents={scheduleContents}
                      loadingScheduleContents={loadingScheduleContents}
                      wantedType={sections[sectionId]}
                      maxWantedItems={maxWantedItems}
                    />
                  </CTabPane>
                );
              })}
            </CTabContent>
          </CTabs>
        </CCol>
      </CRow>
    </>
  );
};
