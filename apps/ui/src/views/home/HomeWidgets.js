import { CCol, CRow, CSpinner, CWidgetDropdown } from '@coreui/react';
import gql from 'graphql-tag';
import moment from 'moment-timezone';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import ChartLineSimple from '../charts/ChartLineSimple';
import { formatInteger } from '../util';

let statsByDatabase = {};

export default () => {
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingDeliv, setLoadingDeliv] = useState(true);

  const [todayWorkables, setTodayWorkables] = useState(null);
  const [workablesDataPoints, setWorkablesDataPoints] = useState([]);

  const [todayRequests, setTodayRequests] = useState(null);
  const [requestsDataPoints, setRequestsDataPoints] = useState([]);

  const [todayClicks, setTodayClicks] = useState(null);
  const [clicksDataPoints, setClicksDataPoints] = useState([]);

  const [todayUnsubs, setTodayUnsubs] = useState(null);
  const [unsubsDataPoints, setUnsubsDataPoints] = useState([]);

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const refreshStats = useCallback(() => {
    let tmpLoadingContacts = false;
    let tmpTodayWorkables = 0;
    let tmpWorkablesDataPoints = [];

    let tmpLoadingDeliv = false;
    let tmpTodayRequests = 0;
    let tmpRequestsDataPoints = [];

    let tmpTodayClicks = 0;
    let tmpClicksDataPoints = [];

    let tmpTodayUnsubs = 0;
    let tmpUnsubsDataPoints = [];

    for (let id in statsByDatabase) {
      let item = statsByDatabase[id];

      if (item.loadingContacts) {
        tmpLoadingContacts = true;
      } else {
        if (item.contactStats && item.contactStats.workable) {
          tmpTodayWorkables += item.contactStats.workable;
        }
        if (item.historyContactStats) {
          let i = 0;
          for (let stats of item.historyContactStats) {
            let value = 'workable' in stats ? stats['workable'] : 0;

            if (tmpWorkablesDataPoints.length <= i) {
              tmpWorkablesDataPoints[i] = 0;
            }

            tmpWorkablesDataPoints[i] = tmpWorkablesDataPoints[i] + value;
            i++;
          }
        }
      }

      if (item.loadingDeliv) {
        tmpLoadingDeliv = true;
      } else {
        if (item.todayDelivStats && item.todayDelivStats.request) {
          tmpTodayRequests += item.todayDelivStats.request;
        }
        if (item.todayDelivStats && item.todayDelivStats.unique_click) {
          tmpTodayClicks += item.todayDelivStats.unique_click;
        }

        if (item.todayDelivStats && item.todayDelivStats.unsub) {
          tmpTodayUnsubs += item.todayDelivStats.unsub;
        }
        if (item.historyDelivStats) {
          let i = 0;
          for (let stats of item.historyDelivStats) {
            let requests = 'request' in stats ? stats['request'] : 0;
            let clicks = 'unique_click' in stats ? stats['unique_click'] : 0;
            let unsubs = 'unsub' in stats ? stats['unsub'] : 0;

            if (tmpRequestsDataPoints.length <= i) {
              tmpRequestsDataPoints[i] = 0;
              tmpClicksDataPoints[i] = 0;
              tmpUnsubsDataPoints[i] = 0;
            }
            tmpRequestsDataPoints[i] = tmpRequestsDataPoints[i] + requests;
            tmpClicksDataPoints[i] = tmpClicksDataPoints[i] + clicks;
            tmpUnsubsDataPoints[i] = tmpUnsubsDataPoints[i] + unsubs;

            i++;
          }
        }
      }
    }

    setLoadingContacts(tmpLoadingContacts);
    setTodayWorkables(tmpTodayWorkables);
    setWorkablesDataPoints(tmpWorkablesDataPoints.reverse());

    setLoadingDeliv(tmpLoadingDeliv);
    setTodayRequests(tmpTodayRequests);
    setRequestsDataPoints(tmpRequestsDataPoints);
    setTodayClicks(tmpTodayClicks);
    setClicksDataPoints(tmpClicksDataPoints);
    setTodayUnsubs(tmpTodayUnsubs);
    setUnsubsDataPoints(tmpUnsubsDataPoints);
  }, [
    setTodayWorkables,
    setWorkablesDataPoints,
    setLoadingContacts,
    setTodayRequests,
    setRequestsDataPoints,
    setLoadingDeliv,
    setClicksDataPoints,
    setTodayClicks,
    setTodayUnsubs,
    setUnsubsDataPoints
  ]);

  useEffect(() => {
    if (emailingDatabases) {
      statsByDatabase = {};

      for (let database of emailingDatabases) {
        statsByDatabase[database.uid] = {
          database,
          loadingContacts: true,
          loadingDeliv: true
        };
      }

      refreshStats();

      const dates = [];
      for (let i = 0; i < 10; i++) {
        dates.push(
          moment()
            .add(i - 9, 'days')
            .format('YYYY-MM-DD')
        );
      }

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query contactStats($fromDate: String!, $toDate: String!) {
              contactStats(fromDate: $fromDate, toDate: $toDate) {
                id
                date
                stats
              }
            }
          `,
          variables: {
            fromDate: moment().add(-10, 'days').format('YYYY-MM-DD'),
            toDate: moment().format('YYYY-MM-DD')
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].loadingContacts = false;
          if (result?.data?.contactStats && result.data.contactStats.length > 0) {
            statsByDatabase[database.uid].contactStats = result.data.contactStats[0].stats.contactByStatus;
            statsByDatabase[database.uid].historyContactStats = result.data.contactStats.map((item) => {
              return item.stats.contactByStatus;
            });
          }
        }
        refreshStats();
      });

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String) {
              dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType) {
                dimensionsStats {
                  byDayStats {
                    day
                    stats {
                      request
                      unique_open
                      unique_click
                      unsub
                    }
                  }
                }
              }
            }
          `,
          variables: {
            fromDate: moment().add(-10, 'days').format('YYYY-MM-DD'),
            toDate: moment().format('YYYY-MM-DD'),
            dimensionType: null
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].loadingDeliv = false;
          if (result && result.data && result.data.dimensionDelivStats.dimensionsStats.length > 0) {
            let todayStats = result.data.dimensionDelivStats.dimensionsStats[0].byDayStats.filter((item) => {
              return item.day === moment().format('YYYY-MM-DD');
            });
            if (todayStats && todayStats.length > 0) {
              statsByDatabase[database.uid].todayDelivStats = todayStats[0].stats;
            }

            statsByDatabase[database.uid].historyDelivStats = dates.map((date) => {
              let dayStats = result.data.dimensionDelivStats.dimensionsStats[0].byDayStats.filter((item) => {
                return item.day === date;
              });
              if (dayStats && dayStats.length > 0) {
                return dayStats[0].stats;
              } else {
                return {};
              }
            });
          }
        }

        refreshStats();
      });
    }
  }, [emailingDatabases, refreshStats]);

  return (
    <CRow>
      <CCol sm="3">
        {loadingContacts && (
          <div className="card text-white bg-gradient-primary" style={{ textAlign: 'center', height: '160px' }}>
            <CSpinner animation="grow" color="primary" style={{ margin: 'auto' }} />
          </div>
        )}
        {!loadingContacts && (
          <CWidgetDropdown
            color="gradient-primary"
            header={formatInteger(todayWorkables).toString()}
            text="Workable contacts"
            footerSlot={
              <ChartLineSimple
                className="mt-3"
                style={{ height: '70px' }}
                dataPoints={workablesDataPoints}
                backgroundColor="rgba(255,255,255,.2)"
                pointHoverBackgroundColor="primary"
                options={{ elements: { line: { borderWidth: 2.5 } } }}
                label="Workables"
                labels="workables"
              />
            }
          ></CWidgetDropdown>
        )}
      </CCol>

      <CCol sm="3">
        {loadingDeliv && (
          <div className="card text-white bg-gradient-info" style={{ textAlign: 'center', height: '160px' }}>
            <CSpinner animation="grow" color="info" style={{ margin: 'auto' }} />
          </div>
        )}
        {!loadingDeliv && (
          <CWidgetDropdown
            color="gradient-info"
            header={formatInteger(todayRequests).toString()}
            text="Requests"
            footerSlot={
              <ChartLineSimple
                className="mt-3"
                style={{ height: '70px' }}
                dataPoints={requestsDataPoints}
                backgroundColor="rgba(255,255,255,.2)"
                pointHoverBackgroundColor="info"
                options={{ elements: { line: { borderWidth: 2.5 } } }}
                label="Requests"
                labels="requests"
              />
            }
          ></CWidgetDropdown>
        )}
      </CCol>

      <CCol sm="3">
        {loadingDeliv && (
          <div className="card text-white bg-gradient-success" style={{ textAlign: 'center', height: '160px' }}>
            <CSpinner animation="grow" color="success" style={{ margin: 'auto' }} />
          </div>
        )}
        {!loadingDeliv && (
          <CWidgetDropdown
            color="gradient-success"
            header={formatInteger(todayClicks).toString()}
            text="Clicks"
            footerSlot={
              <ChartLineSimple
                className="mt-3"
                style={{ height: '70px' }}
                dataPoints={clicksDataPoints}
                backgroundColor="rgba(255,255,255,.2)"
                pointHoverBackgroundColor="success"
                options={{ elements: { line: { borderWidth: 2.5 } } }}
                label="Clicks"
                labels="clicks"
              />
            }
          ></CWidgetDropdown>
        )}
      </CCol>
      <CCol sm="3">
        {loadingDeliv && (
          <div className="card text-white bg-gradient-warning" style={{ textAlign: 'center', height: '160px' }}>
            <CSpinner animation="grow" color="warning" style={{ margin: 'auto' }} />
          </div>
        )}
        {!loadingDeliv && (
          <CWidgetDropdown
            color="gradient-warning"
            header={formatInteger(todayUnsubs).toString()}
            text="Unsubscribes"
            footerSlot={
              <ChartLineSimple
                className="mt-3"
                style={{ height: '70px' }}
                dataPoints={unsubsDataPoints}
                backgroundColor="rgba(255,255,255,.2)"
                pointHoverBackgroundColor="warning"
                options={{ elements: { line: { borderWidth: 2.5 } } }}
                label="Unsubscribes"
                labels="Unsubscribes"
              />
            }
          ></CWidgetDropdown>
        )}
      </CCol>
    </CRow>
  );
};
