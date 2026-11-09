import { CCard, CCardBody, CCardHeader, CLink, CSpinner } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import RangeDatePicker from '../common/RangeDatePicker';
import { calculateAndFormatPercent } from '../common/util';
import { formatInteger } from '../util';

let statsByDatabase = {};

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [stats, setStats] = useState([]);
  const [totalStats, setTotalStats] = useState({
    request: 0,
    unique_click: 0,
    unique_open: 0,
    unsub: 0
  });

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const refreshStats = useCallback(() => {
    let stats = Object.values(statsByDatabase);
    setStats(stats);
    let totalStats = {
      request: 0,
      unique_click: 0,
      unique_open: 0,
      unsub: 0
    };
    for (let item of stats) {
      if (item.delivStatsLoaded) {
        if (item.delivStats && item.delivStats.request) {
          totalStats.request += item.delivStats.request;
          totalStats.unique_open += item.delivStats.unique_open;
          totalStats.unique_click += item.delivStats.unique_click;
          totalStats.unsub += item.delivStats.unsub;
        }
      }
    }
    setTotalStats(totalStats);
  }, [setStats, setTotalStats]);

  useEffect(() => {
    if (fromDate && toDate && emailingDatabases) {
      statsByDatabase = {};

      for (let database of emailingDatabases) {
        statsByDatabase[database.uid] = {
          database,
          delivStatsLoaded: false,
          delivStats: null
        };
      }

      refreshStats();

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String) {
              dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType) {
                totalStats {
                  request
                  unique_open
                  unique_click
                  unsub
                }
              }
            }
          `,
          variables: {
            fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
            toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
            dimensionType: null
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].delivStatsLoaded = true;
        }
        if (result && result.data && statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].delivStats = result.data.dimensionDelivStats.totalStats;
        }
        refreshStats();
      });
    }
  }, [fromDate, toDate, emailingDatabases, refreshStats]);

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex ">
          <div>Stats</div>
          <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="today" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
        </div>
      </CCardHeader>
      <CCardBody className="p-0">
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Database</th>
                <th>Volume</th>
                <th>Opens</th>
                <th>Clicks</th>
                <th>Unsubs</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((item) => {
                return (
                  <tr key={item.database.id}>
                    <td className="text-primary">
                      <CLink to={`/${item.database.uid}/`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.database.name}
                      </CLink>
                    </td>

                    {!item.delivStatsLoaded && (
                      <td>
                        <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />
                      </td>
                    )}
                    {item.delivStatsLoaded && (
                      <>
                        <td>
                          {' '}
                          <span>{item.delivStats.request ? formatInteger(item.delivStats.request) : '0'}</span>
                        </td>
                        <td>
                          {item.delivStats.request && (
                            <span className="text-info">
                              {formatInteger(item.delivStats.unique_open)} <small className="text-muted">({calculateAndFormatPercent(item.delivStats.unique_open, item.delivStats.request)})</small>
                            </span>
                          )}
                        </td>
                        <td>
                          {item.delivStats.request && (
                            <span className="text-success">
                              {formatInteger(item.delivStats.unique_click)} <small className="text-muted">({calculateAndFormatPercent(item.delivStats.unique_click, item.delivStats.request)})</small>
                            </span>
                          )}
                        </td>
                        <td>
                          {item.delivStats.request && (
                            <span className="text-warning">
                              {formatInteger(item.delivStats.unsub)} <small className="text-muted">({calculateAndFormatPercent(item.delivStats.unsub, item.delivStats.request)})</small>
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>

            <tbody>
              <tr className="font-weight-bold">
                <td>TOTAL</td>
                <td>{formatInteger(totalStats.request)}</td>
                <td>
                  {totalStats.request && (
                    <span className="text-info">
                      {formatInteger(totalStats.unique_open)} <small className="text-muted">({calculateAndFormatPercent(totalStats.unique_open, totalStats.request)})</small>
                    </span>
                  )}
                </td>
                <td>
                  {totalStats.request && (
                    <span className="text-success">
                      {formatInteger(totalStats.unique_click)} <small className="text-muted">({calculateAndFormatPercent(totalStats.unique_click, totalStats.request)})</small>
                    </span>
                  )}
                </td>
                <td>
                  {totalStats.request && (
                    <span className="text-warning">
                      {formatInteger(totalStats.unsub)} <small className="text-muted">({calculateAndFormatPercent(totalStats.unsub, totalStats.request)})</small>
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CCardBody>
    </CCard>
  );
};
