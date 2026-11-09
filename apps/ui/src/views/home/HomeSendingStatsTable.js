import { CCard, CCardBody, CCardHeader, CLink, CSpinner } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import RangeDatePicker from '../common/RangeDatePicker';
import { formatInteger } from '../util';

let statsByDatabase = {};

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [stats, setStats] = useState([]);
  const [routers, setRouters] = useState([]);
  const [totalStats, setTotalStats] = useState({
    request: 0
  });

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const refreshStats = useCallback(() => {
    let stats = Object.values(statsByDatabase);
    let routers = {};
    let senders = {};

    let totalStats = {
      request: 0
    };

    for (let id in statsByDatabase) {
      let item = statsByDatabase[id];
      item.dimensions = {};

      if (item.sendersLoaded) {
        if (item.senders) {
          for (let sender of item.senders) {
            if (sender.mailRouter) {
              let mailRouterUid = sender.mailRouter.type ? sender.mailRouter.type : 'unknown';
              senders[sender.id] = mailRouterUid;
              routers[mailRouterUid] = mailRouterUid;
            }
          }
        }
      }
      if (item.delivStatsLoaded) {
        if (item.delivStats && item.delivStats.totalStats.request) {
          totalStats.request += item.delivStats.totalStats.request;
          for (let dimItem of item.delivStats.dimensionsStats) {
            let senderId = dimItem.dimension && dimItem.dimension.id ? parseInt(dimItem.dimension.id) : 'unknown';
            if (senders[senderId]) {
              let dimensionUid = senders[senderId];
              if (!(dimensionUid in item.dimensions)) {
                item.dimensions[dimensionUid] = {
                  request: 0
                };
              }
              item.dimensions[dimensionUid].request += dimItem.totalStats.request;
            }
          }
        }
      }
    }

    setStats(stats);
    setRouters(Object.values(routers));
    setTotalStats(totalStats);
  }, [setStats, setTotalStats, setRouters]);

  useEffect(() => {
    if (fromDate && toDate && emailingDatabases) {
      statsByDatabase = {};

      for (let database of emailingDatabases) {
        statsByDatabase[database.uid] = {
          database,
          delivStatsLoaded: false,
          delivStats: null,
          senders: null,
          sendersLoaded: false,
          dimensions: {}
        };
      }

      refreshStats();

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query senders {
              senders {
                id
                name
                email
                mailRouter {
                  id
                  name
                  type
                }
              }
            }
          `
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].sendersLoaded = true;
          if (result && result.data) {
            statsByDatabase[database.uid].senders = result.data.senders;
          }
        }

        refreshStats();
      });

      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String) {
              dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType) {
                totalStats {
                  request
                }
                dimensionsStats {
                  dimension {
                    id
                    label
                    type
                  }
                  totalStats {
                    request
                  }
                }
              }
            }
          `,
          variables: {
            fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
            toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
            dimensionType: 'sender'
          }
        });
        if (statsByDatabase[database.uid]) {
          statsByDatabase[database.uid].delivStatsLoaded = true;
          if (result && result.data) {
            statsByDatabase[database.uid].delivStats = result.data.dimensionDelivStats;
          }
        }
        refreshStats();
      });
    }
  }, [fromDate, toDate, emailingDatabases, refreshStats]);

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex ">
          <div>Sending Stats</div>
          <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="today" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
        </div>
      </CCardHeader>
      <CCardBody className="p-0">
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Database</th>
                {routers.map((router, index) => {
                  return <th key={index}>{router}</th>;
                })}
                <th>Total</th>
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

                    {routers.map((router, index) => {
                      if (!item.delivStatsLoaded || !item.sendersLoaded) {
                        return (
                          <td key={index}>
                            <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />
                          </td>
                        );
                      }

                      let requests = item.dimensions[router] ? item.dimensions[router].request : 0;
                      return (
                        <td key={index}>
                          <span>{formatInteger(requests)}</span>
                        </td>
                      );
                    })}
                    <td>
                      {!item.delivStatsLoaded && <CSpinner animation="grow" size="sm" color="secondary" style={{ margin: 'auto' }} />}
                      {item.delivStatsLoaded && <span>{formatInteger(item.delivStats.totalStats.request)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tbody>
              <tr className="font-weight-bold">
                <td>TOTAL</td>
                {routers.map((router, index) => {
                  let requests = 0;
                  for (let item of stats) {
                    requests = requests + (item.dimensions && item.dimensions[router] ? item.dimensions[router].request : 0);
                  }
                  return (
                    <td key={index}>
                      <span>{formatInteger(requests)}</span>
                    </td>
                  );
                })}
                <td>{formatInteger(totalStats.request)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CCardBody>
    </CCard>
  );
};
