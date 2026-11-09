import { CCard, CCardBody, CCardHeader, CLink, CSpinner } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import RangeDatePicker from '../common/RangeDatePicker';
import { calculateAndFormatPercent } from '../common/util';
import { formatInteger } from '../util';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

let statsByDatabase = {};

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [stats, setStats] = useState([]);
  const [totalStats, setTotalStats] = useState({
    request: 0,
    uniqueInscriptions: 0,
    uniqueActives: 0
  });

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const refreshStats = useCallback(() => {
    let stats = Object.values(statsByDatabase);
    setStats(stats);
    let totalStats = {
      request: 0,
      uniqueInscriptions: 0,
      uniqueActives: 0
    };
    for (let item of stats) {
      if (item.delivStatsLoaded) {
        if (item.delivStats && item.delivStats.request) {
          totalStats.request += item.delivStats.request;
        }
      }
      if (item.inscriptionStatsLoaded) {
        if (item.inscriptionStats && item.inscriptionStats.uniqueCount) {
          totalStats.uniqueInscriptions += item.inscriptionStats.uniqueCount;
        }
        if (item.inscriptionStats && item.inscriptionStats.uniqueActives) {
          totalStats.uniqueActives += item.inscriptionStats.uniqueActives;
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
          toContactStatsLoaded: false,
          fromContactStatsLoaded: false,
          delivStatsLoaded: false,
          delivStats: null,
          fromContactStats: null,
          toContactStats: null,

          inscriptionStatsLoaded: false,
          inscriptionStats: null
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
          if (result && result.data) {
            statsByDatabase[database.uid].delivStats = result.data.dimensionDelivStats.totalStats;
          }
        }

        refreshStats();
      });

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query lastInscriptionStats($fromInscriptionDate: String!, $toInscriptionDate: String!) {
              lastInscriptionStats(fromInscriptionDate: $fromInscriptionDate, toInscriptionDate: $toInscriptionDate) {
                id
                date
                inscriptionDate
                stats
              }
            }
          `,
          variables: {
            fromInscriptionDate: fromDate.format('YYYY-MM-DD'),
            toInscriptionDate: toDate.format('YYYY-MM-DD')
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].inscriptionStatsLoaded = true;
          if (result && result.data) {
            let sums = {
              count: 0,
              uniqueCount: 0,
              uniqueActives: 0
            };
            for (let item of result.data.lastInscriptionStats) {
              sums.count += item.stats.count;
              sums.uniqueCount += item.stats.uniqueCount;
              sums.uniqueActives += item.stats.uniqueActives;
            }
            statsByDatabase[database.uid].inscriptionStats = sums;
          }
        }

        refreshStats();
      });

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
            fromDate: toDate.format('YYYY-MM-DD'),
            toDate: toDate.format('YYYY-MM-DD')
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].toContactStatsLoaded = true;
          if (result?.data?.contactStats && result.data.contactStats.length > 0) {
            statsByDatabase[database.uid].toContactStats = { ...result.data.contactStats[0].stats.contactByStatus };
            statsByDatabase[database.uid].toContactStats.not_exploited = result.data.contactStats[0].stats.not_exploited ?? 0;
            statsByDatabase[database.uid].toContactStats.notExploitedByEsps = result.data.contactStats[0].stats.notExploitedByEsps ?? {};
          }
        }

        refreshStats();
      });

      if (toDate.diff(fromDate, 'days') >= 1) {
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
              fromDate: fromDate.format('YYYY-MM-DD'),
              toDate: fromDate.format('YYYY-MM-DD')
            }
          });
          if (statsByDatabase[database.uid]) {
            statsByDatabase[database.uid].fromContactStatsLoaded = true;
            if (result?.data?.contactStats && result.data.contactStats.length > 0) {
              statsByDatabase[database.uid].fromContactStats = { ...result.data.contactStats[0].stats.contactByStatus };
              statsByDatabase[database.uid].fromContactStats.not_exploited = result.data.contactStats[0].stats.not_exploited ?? 0;
              statsByDatabase[database.uid].fromContactStats.notExploitedByEsps = result.data.contactStats[0].stats.notExploitedByEsps ?? {};
            }
          }
          refreshStats();
        });
      }
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
                <th>Workables</th>
                <th>Unique inscriptions</th>
                <th>Activation</th>
                <th>Not exploited</th>
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
                    <td>
                      {!item.delivStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.delivStatsLoaded && <span>{formatInteger(item.delivStats.request)}</span>}
                    </td>
                    <td>
                      {!item.toContactStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.toContactStatsLoaded && (
                        <>
                          {toDate.diff(fromDate, 'days') >= 1 && (
                            <>
                              {!item.fromContactStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                              {item.fromContactStatsLoaded && (
                                <span className="text-info">{item.fromContactStats && item.fromContactStats.workable ? formatInteger(item.fromContactStats.workable) : 0}</span>
                              )}

                              <span>
                                <i className="px-1 fas fa-caret-right"></i>
                              </span>
                            </>
                          )}

                          <span className="text-info">{item.toContactStats && item.toContactStats.workable ? formatInteger(item.toContactStats.workable) : 0}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {!item.inscriptionStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.inscriptionStatsLoaded && <span className="text-success">{formatInteger(item.inscriptionStats.uniqueCount)}</span>}
                    </td>
                    <td>
                      {!item.inscriptionStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.inscriptionStatsLoaded && <span className="text-warning">{calculateAndFormatPercent(item.inscriptionStats.uniqueActives, item.inscriptionStats.uniqueCount)}</span>}
                    </td>
                    <td>
                      {!item.toContactStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.toContactStatsLoaded && (
                        <>
                          {toDate.diff(fromDate, 'days') >= 1 && (
                            <>
                              {!item.fromContactStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                              {item.fromContactStatsLoaded && (
                                <span className="text-info">
                                  {item.fromContactStats && item.fromContactStats.workable ? formatInteger(item.fromContactStats.not_exploited) : 0}
                                  &nbsp;&nbsp;
                                  <NotExploitedTooltip notExploitedByEsps={item?.toContactStats?.fromContactStats ?? {}} />
                                </span>
                              )}

                              <span>
                                <i className="px-1 fas fa-caret-right"></i>
                              </span>
                            </>
                          )}

                          <span className="text-info">
                            {item.toContactStats && item.toContactStats.workable ? formatInteger(item.toContactStats.not_exploited) : 0}
                            &nbsp;&nbsp;
                            <NotExploitedTooltip notExploitedByEsps={item?.toContactStats?.notExploitedByEsps ?? {}} />
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tbody>
              <tr className="font-weight-bold">
                <td>TOTAL</td>
                <td>{formatInteger(totalStats.request)}</td>
                <td></td>
                <td className="text-success">{formatInteger(totalStats.uniqueInscriptions)}</td>
                <td className="text-warning">{calculateAndFormatPercent(totalStats.uniqueActives, totalStats.uniqueInscriptions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CCardBody>
    </CCard>
  );
};

const NotExploitedTooltip = ({ notExploitedByEsps }) => {
  if (Object.keys(notExploitedByEsps).length === 0) {
    return null;
  }
  return (
    <OverlayTrigger
      delay={{ show: 250, hide: 400 }}
      placement="left"
      overlay={(props) => {
        return (
          <Tooltip {...props} id={Math.floor(Math.random(0) * 10000000)}>
            <table>
              <tbody>
                {Object.keys(notExploitedByEsps).map((esp) => {
                  return (
                    <tr key={esp}>
                      <td className="text-left">{esp}</td>
                      <td className="text-right">{formatInteger(notExploitedByEsps[esp])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tooltip>
        );
      }}
    >
      <i className="fas fa-info-circle text-muted "></i>
    </OverlayTrigger>
  );
};
