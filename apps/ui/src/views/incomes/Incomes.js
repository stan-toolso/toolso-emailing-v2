import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Spinner, Form } from 'react-bootstrap';
import moment from 'moment-timezone';

import { AllContentTypes, contentTypeKeys } from '../database/contents/ContentsTypes';
import { IncomeFields } from '../database/contents/incomes/IncomeFields';
import { CSelect } from '@coreui/react';
import { useSelector } from 'react-redux';
import { DatabaseSelector } from '../database/DatabaseSelector';
import { IncomeFieldsSelector } from '../database/contents/incomes/IncomeFieldsSelector';
import RangeDatePicker from '../common/RangeDatePicker';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import gql from 'graphql-tag';
import { IncomeLabels } from '../database/contents/incomes/IncomeLabels';
import TotalFieldTd from '../database/contents/incomes/TotalFieldTd';
import IncomeTdStyle from '../database/contents/incomes/IncomeTdStyle';
import CampaignIncome from './CampaignIncome';

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const emailingDatabases = useSelector((state) => state.emailingDatabases);
  const entreprise = useSelector((state) => state.entreprise);

  const [databases, setDatabases] = useState(
    localStorage.getItem(`campaignIncomesDatabases-${entreprise.id}`)
      ? JSON.parse(localStorage.getItem(`campaignIncomesDatabases-${entreprise.id}`))
      : emailingDatabases.map((database) => database.uid)
  );
  const [fields, setFields] = useState(
    localStorage.getItem(`campaignIncomesFields-${entreprise.id}`)
      ? JSON.parse(localStorage.getItem(`campaignIncomesFields-${entreprise.id}`))
      : [IncomeFields.estimatedIncome, IncomeFields.unique_click, IncomeFields.manualIncome]
  );

  const [name, setName] = useState('');
  const [type, setType] = useState(localStorage.getItem(`campaignIncomesType-${entreprise.id}`) ? localStorage.getItem(`campaignIncomesType-${entreprise.id}`) : contentTypeKeys.marketing);
  const [partnerName, setPartnerName] = useState(
    localStorage.getItem(`campaignIncomesPartner-${entreprise.id}`) && localStorage.getItem(`campaignIncomesPartner-${entreprise.id}`) != null
      ? localStorage.getItem(`campaignIncomesPartner-${entreprise.id}`)
      : ''
  );
  const [partnerNames, setPartnerNames] = useState([]);

  const [contentStats, setContentStats] = useState([]);
  const [statsByDatabase, setStatsByDatabase] = useState({});
  const [totalStats, setTotalStats] = useState({});
  const [totalStatsByDay, setTotalStatsByDay] = useState({});

  useEffect(async () => {
    let statsByDatabase = {};
    if (!fromDate || !toDate) {
      return;
    }
    for (let databaseUid of databases) {
      let database = emailingDatabases.find((database) => database.uid === databaseUid);
      if (!(databaseUid in statsByDatabase)) {
        statsByDatabase[databaseUid] = {
          database
        };
      }
      let delivStatsLoaded = statsByDatabase[databaseUid].delivStats || statsByDatabase[databaseUid].delivStatsLoading;
      if (!delivStatsLoaded) {
        statsByDatabase[databaseUid].delivStatsLoading = true;
        setStatsByDatabase({ ...statsByDatabase });
        fetchDelivStats(database, fromDate, toDate).then((delivStats) => {
          statsByDatabase[databaseUid].delivStats = delivStats;
          statsByDatabase[databaseUid].delivStatsLoading = false;
          setStatsByDatabase({ ...statsByDatabase });
        });
      }
      let incomesLoaded = statsByDatabase[databaseUid].incomes || statsByDatabase[databaseUid].incomesLoading;
      if (!incomesLoaded) {
        statsByDatabase[databaseUid].incomesLoading = true;
        setStatsByDatabase({ ...statsByDatabase });
        fetchIncomes(database, fromDate, toDate).then((incomes) => {
          statsByDatabase[databaseUid].incomes = incomes;
          statsByDatabase[databaseUid].incomesLoading = false;
          setStatsByDatabase({ ...statsByDatabase });
        });
      }
    }
  }, [databases, setStatsByDatabase, fromDate, toDate]);

  useEffect(() => {
    let { contentStats, partnerNames, totalStats, totalStatsByDay } = buildStats({ statsByDatabase, contentStats, fromDate, toDate, type, partnerNameFilter: partnerName, nameFilter: name });
    setPartnerNames(partnerNames);
    setContentStats(contentStats);
    setTotalStats(totalStats);
    setTotalStatsByDay(totalStatsByDay);
  }, [setContentStats, setPartnerNames, setTotalStats, setTotalStatsByDay, statsByDatabase, fromDate, toDate, type, partnerName, name, type]);

  const dates = [];
  var currentDate = moment(fromDate);
  while (currentDate <= toDate) {
    dates.unshift(moment(currentDate));
    currentDate.add(1, 'days');
  }
  const loading = Object.values(statsByDatabase).some((stats) => stats.delivStatsLoading || stats.incomesLoading);
  return (
    <Row>
      <Col xl={12}>
        <Card>
          <Card.Header>
            <h4>Incomes</h4>
          </Card.Header>
          <Card.Header>
            <div className="d-flex ">
              <div className="pr-2">
                <CSelect
                  style={{ display: 'inline-block', width: '120px' }}
                  className="form-control pr-2"
                  size="sm"
                  onChange={(event) => {
                    localStorage.setItem(`campaignIncomesType-${entreprise.id}`, event.target.value);
                    setType(event.target.value);
                  }}
                  value={type}
                >
                  {Object.keys(AllContentTypes).map((key) => {
                    return (
                      <option value={key} key={key}>
                        {AllContentTypes[key]}
                      </option>
                    );
                  })}
                </CSelect>
              </div>
              <div>
                <CSelect
                  size="sm"
                  id="partnerSelector"
                  value={partnerName}
                  onChange={(event) => {
                    localStorage.setItem(`campaignIncomesPartner-${entreprise.id}`, event.target.value ? event.target.value : '');
                    setPartnerName(event.target.value ? event.target.value : null);
                  }}
                >
                  <option value={''}>-- Select the partner --</option>
                  {partnerNames.map((partnerName) => {
                    return (
                      <option key={partnerName} value={partnerName}>
                        {partnerName}
                      </option>
                    );
                  })}
                </CSelect>
              </div>
              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            </div>
            <div className="mt-2">
              <DatabaseSelector
                databases={databases}
                setDatabases={(values) => {
                  localStorage.setItem(`campaignIncomesDatabases-${entreprise.id}`, JSON.stringify(values));
                  setDatabases(values);
                }}
              />
            </div>
            <div className="mt-2">
              <IncomeFieldsSelector
                fields={fields}
                setFields={(values) => {
                  localStorage.setItem(`campaignIncomesFields-${entreprise.id}`, JSON.stringify(values));
                  setFields(values);
                }}
              />
            </div>
          </Card.Header>
          <Card.Body>
            <div className="table-responsive" style={{ paddingBottom: '200px' }}>
              <table className="table table-sm m-0 stats-table table-bordered " style={{ minWidth: 401 + dates.length * 68 + 'px' }}>
                <thead>
                  <tr>
                    <th>
                      <div style={{ minWidth: '300px', padding: '0px' }}>
                        <Form.Control
                          value={name}
                          style={{ height: '20px', padding: '0px 3px', border: 'none' }}
                          placeholder="Search"
                          onChange={(event) => {
                            setName(event.target.value);
                          }}
                          className="form-control"
                          size="sm"
                        />
                      </div>
                    </th>
                    <th>
                      <div style={{ width: '150px', padding: '0px' }}></div>
                    </th>
                    <th className="text-left">
                      <div style={{ width: '90px', padding: '1px 2px' }}>TOTAL</div>
                    </th>
                    {dates.map((date) => {
                      return (
                        <th className="text-left" key={date}>
                          <div style={{ width: '78px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                {loading && (
                  <tbody>
                    <tr>
                      <td colSpan={3 + dates.length}>
                        <div style={{ textAlign: 'center', padding: '0px 0px' }}>
                          <Spinner animation="grow" color="secondary" size="sm" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                )}
                <tbody style={{ fontWeight: 'bold' }}>
                  <tr>
                    <td>TOTAL</td>
                    <td>
                      <table style={{ width: '150px' }}>
                        <tbody>
                          {fields.map((field, index) => {
                            return (
                              <tr key={index}>
                                <td style={IncomeTdStyle}>
                                  {' '}
                                  <div style={{ padding: '1px 2px' }}>{IncomeLabels[field]}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                    <td>
                      <div style={{ width: '78px', padding: '0px' }}>
                        <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                          <tbody>
                            {fields.map((field, index) => {
                              return <TotalFieldTd key={index} field={field} totalStats={totalStats} />;
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                    {dates.map((date) => {
                      let dateFormated = date.format('YYYY-MM-DD');
                      let dateStats = totalStatsByDay[dateFormated];

                      return (
                        <td key={date}>
                          <div style={{ width: '78px', padding: '0px' }}>
                            <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                              <tbody>
                                {fields.map((field, index) => {
                                  return <TotalFieldTd key={index} field={field} totalStats={dateStats} refStats={totalStats} dates={dates} />;
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>

                {contentStats.map((item, index) => {
                  return (
                    <CampaignIncome
                      key={index}
                      fields={fields}
                      dates={dates}
                      item={item}
                      refetchIncomes={() => {
                        setDatabases([...databases]);
                      }}
                    />
                  );
                })}
              </table>
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

const buildStats = ({ statsByDatabase, type, partnerNameFilter, nameFilter }) => {
  let contentStats = {};
  let partnerNames = {};
  let totalStats = {};
  let totalStatsByDay = {};
  for (let databaseUid in statsByDatabase) {
    let databaseStats = statsByDatabase[databaseUid];

    if (databaseStats.delivStats && databaseStats.delivStats.dimensionsStats) {
      for (let dimensionStats of databaseStats.delivStats.dimensionsStats) {
        let name = dimensionStats.dimension?.object?.name ?? null;
        let contentType = dimensionStats.dimension?.object?.type ?? null;
        if (!name || contentType !== type) {
          continue;
        }
        if (nameFilter && name.toLowerCase().indexOf(nameFilter.toLowerCase()) === -1) {
          continue;
        }
        let partnerName = dimensionStats.dimension?.object?.partnerName ?? '';
        if (partnerName) {
          if (!(partnerName.toLowerCase() in partnerNames)) {
            partnerNames[partnerName.toLowerCase()] = partnerName;
          }
        }

        if (partnerNameFilter && partnerNameFilter !== 'null') {
          if (partnerNameFilter.toLowerCase() !== partnerName.toLowerCase()) {
            continue;
          }
        }
        if (!(name in contentStats)) {
          contentStats[name] = { name, databases: {}, byDayStats: [], totalStats: {} };
        }

        contentStats[name].databases[databaseUid] = {
          database: databaseStats.database,
          id: dimensionStats.dimension.id,
          name,
          dimension: dimensionStats.dimension,
          partnerId: dimensionStats.dimension.object ? dimensionStats.dimension.object.partnerId : null,
          type: dimensionStats.dimension.object ? dimensionStats.dimension.object.type : null,
          incomesStats: dimensionStats.dimension.object ? dimensionStats.dimension.object.incomesStats : null,
          byDayStats: dimensionStats.byDayStats,
          totalStats: JSON.parse(JSON.stringify(dimensionStats.totalStats))
        };
      }
    }

    if (databaseStats.incomes) {
      for (let contentIncome of databaseStats.incomes) {
        if (!contentIncome.content) {
          continue;
        }
        let name = contentIncome.content.name;
        let partnerName = '';
        if (contentIncome.content.partner) {
          partnerName = contentIncome.content.partner.name;
          name = `[${partnerName}] ${name}`;
          if (!(partnerName.toLowerCase() in partnerNames)) {
            partnerNames[partnerName.toLowerCase()] = partnerName;
          }
        }

        if (contentIncome.content.type !== type) {
          continue;
        }
        if (nameFilter && name.toLowerCase().indexOf(nameFilter.toLowerCase()) === -1) {
          continue;
        }
        if (partnerNameFilter) {
          if (partnerNameFilter.toLowerCase() !== partnerName.toLowerCase()) {
            continue;
          }
        }
        if (!(name in contentStats)) {
          contentStats[name] = { name, databases: {}, byDayStats: [], totalStats: {} };
        }

        if (!(databaseUid in contentStats[name].databases)) {
          contentStats[name].databases[databaseUid] = {
            database: databaseStats.database,
            id: contentIncome.content.id,
            name: contentIncome.content.name,
            partnerId: contentIncome.content.partnerId,
            type: contentIncome.content.type,
            incomesStats: contentIncome.content.incomesStats,
            byDayStats: [],
            totalStats: {}
          };
        }

        let content = contentStats[name].databases[databaseUid];

        let existingDay = content.byDayStats.find((d) => {
          return d.day === contentIncome.date;
        });
        if (!existingDay) {
          existingDay = { day: contentIncome.date, stats: {} };
          content.byDayStats.push(existingDay);
        }
        existingDay.income = contentIncome;
      }
    }
  }

  contentStats = Object.values(contentStats);
  consolidateStats(contentStats, totalStats, totalStatsByDay);
  contentStats = contentStats.sort((a, b) => {
    return a.totalStats.request > b.totalStats.request ? -1 : 1;
  });
  partnerNames = Object.values(partnerNames).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
  return { contentStats, partnerNames, totalStats, totalStatsByDay };
};

const consolidateStats = (contentStats, totalStats, totalStatsByDay) => {
  for (let item of contentStats) {
    item.totalStats = {};
    item.byDayStats = {};
    for (let databaseUid in item.databases) {
      let content = item.databases[databaseUid];
      if (!('manualIncome' in content.totalStats)) {
        content.totalStats.manualIncome = 0;
      }
      if (!('estimatedIncome' in content.totalStats)) {
        content.totalStats.estimatedIncome = 0;
      }
      if (!('recordedIncome' in content.totalStats)) {
        content.totalStats.recordedIncome = 0;
      }
      for (let day of content.byDayStats) {
        if (!(day.day in item.byDayStats)) {
          item.byDayStats[day.day] = { day: day.day, stats: {}, missingIncome: false, hasOneIncome: false };
        }
        if (!(day.day in totalStatsByDay)) {
          totalStatsByDay[day.day] = {};
        }
        let itemDay = item.byDayStats[day.day];
        if (day.income) {
          itemDay.hasOneIncome = true;
          content.totalStats.manualIncome += day.income.estimatedIncome;
          content.totalStats.recordedIncome += day.income.recordedIncome;
          content.totalStats.estimatedIncome += day.income.estimatedIncome;

          day.stats.estimatedIncome = day.income.estimatedIncome;
          day.stats.manualIncome = day.income.estimatedIncome;
          day.stats.recordedIncome = day.income.recordedIncome;
        } else {
          itemDay.missingIncome = true;
          day.stats.estimatedIncome = null;
          day.stats.recordedIncome = 0;
          if (content.incomesStats && content.incomesStats.last) {
            switch (content.incomesStats.last.type) {
              case 'unique_click':
                day.stats.estimatedIncome = (content.incomesStats.last.cpc ? content.incomesStats.last.cpc : 0) * (day.stats.unique_click ? day.stats.unique_click : 0);
                break;
              default:
              case 'request':
                day.stats.estimatedIncome = (content.incomesStats.last.eCpm ? content.incomesStats.last.eCpm / 1000 : 0) * (day.stats.unique_click ? day.stats.request : 0);
                break;
            }
          }
          if (day.stats.estimatedIncome) {
            content.totalStats.estimatedIncome += day.stats.estimatedIncome;
          }
        }

        let itemDayStats = itemDay.stats;
        ['request', 'unique_click', 'unique_open', 'manualIncome', 'estimatedIncome', 'recordedIncome'].forEach((key) => {
          itemDayStats[key] = (itemDayStats[key] ?? 0) + (day.stats[key] ?? 0);
          item.totalStats[key] = (item.totalStats[key] ?? 0) + (day.stats[key] ?? 0);
          totalStats[key] = (totalStats[key] ?? 0) + (day.stats[key] ?? 0);
          totalStatsByDay[day.day][key] = (totalStatsByDay[day.day][key] ?? 0) + (day.stats[key] ?? 0);
        });
      }

      content.totalStats.eCpm = null;
      if (content.totalStats.request) {
        content.totalStats.eCpm = (1000 * content.totalStats.estimatedIncome) / content.totalStats.request;
      }
      content.totalStats.cpc = null;
      if (content.totalStats.unique_click) {
        content.totalStats.cpc = content.totalStats.estimatedIncome / content.totalStats.unique_click;
      }
    }
    item.totalStats.eCpm = null;
    if (item.totalStats.request) {
      item.totalStats.eCpm = (1000 * item.totalStats.estimatedIncome) / item.totalStats.request;
    }
    item.totalStats.cpc = null;
    if (item.totalStats.unique_click) {
      item.totalStats.cpc = item.totalStats.estimatedIncome / item.totalStats.unique_click;
    }

    item.byDayStats = Object.values(item.byDayStats);
  }
  for (let dayItem of Object.values(totalStatsByDay)) {
    dayItem.eCpm = null;
    if (dayItem.request) {
      dayItem.eCpm = (1000 * dayItem.estimatedIncome) / dayItem.request;
    }
    dayItem.cpc = null;
    if (dayItem.unique_click) {
      dayItem.cpc = dayItem.estimatedIncome / dayItem.unique_click;
    }
  }
  totalStats.eCpm = null;
  if (totalStats.request) {
    totalStats.eCpm = (1000 * totalStats.estimatedIncome) / totalStats.request;
  }
  totalStats.cpc = null;
  if (totalStats.unique_click) {
    totalStats.cpc = totalStats.estimatedIncome / totalStats.unique_click;
  }
};

const fetchDelivStats = async (database, fromDate, toDate) => {
  let result = await new EmailingDatabaseApi(database).doQuery({
    query: gql`
      query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String, $filter: JSON) {
        dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType, filter: $filter) {
          fromDate
          toDate
          dimensionsStats {
            dimension {
              id
              label
              type
              object
            }
            totalStats {
              request
              unique_open
              unique_click
            }
            byDayStats {
              day
              stats {
                request
                unique_open
                unique_click
              }
            }
          }
        }
      }
    `,
    variables: {
      fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
      toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
      dimensionType: 'content',
      filter: {}
    }
  });

  if (result && result.data) {
    return JSON.parse(JSON.stringify(result.data.dimensionDelivStats));
  }
  return null;
};

const fetchIncomes = async (database, fromDate, toDate) => {
  let result = await new EmailingDatabaseApi(database).doQuery({
    query: gql`
      query contentIncomes($fromDate: String!, $toDate: String!) {
        contentIncomes(fromDate: $fromDate, toDate: $toDate) {
          id
          date
          estimatedIncome
          recordedIncome
          validationRate
          type
          content {
            id
            name
            type
            incomesStats
            partner {
              id
              name
            }
          }
        }
      }
    `,
    variables: {
      fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
      toDate: toDate ? toDate.format('YYYY-MM-DD') : null
    }
  });

  if (result && result.data) {
    return JSON.parse(JSON.stringify(result.data.contentIncomes));
  }
  return null;
};
