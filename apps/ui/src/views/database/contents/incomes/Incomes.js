import { useQuery } from '@apollo/client';
import { CSelect, CTooltip } from '@coreui/react';
import gql from 'graphql-tag';
import moment from 'moment-timezone';
import React, { useCallback, useEffect, useState } from 'react';

import { Row, Col, Card, Spinner, Form } from 'react-bootstrap';
import RangeDatePicker from '../../../common/RangeDatePicker';
import { AllContentTypes, contentTypeKeys } from '../ContentsTypes';
import ContentIncome from './ContentIncome';
import { IncomeFieldsSelector } from './IncomeFieldsSelector';
import { IncomeLabels } from './IncomeLabels';
import { IncomeFields } from './IncomeFields';
import IncomeTdStyle from './IncomeTdStyle';
import TotalFieldTd from './TotalFieldTd';
import PartnersSelector from '../partners/PartnersSelector';
import ClipboardElement from '../../../common/ClipboardElement';

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [fields, setFields] = useState([IncomeFields.estimatedIncome, IncomeFields.unique_click, IncomeFields.manualIncome]);

  const [name, setName] = useState('');
  const [type, setType] = useState(contentTypeKeys.marketing);
  const [partnerId, setPartnerId] = useState('');

  const [contentStats, setContentStats] = useState([]);

  const { loading: loadingDelivStats, data: delivStatsData } = useQuery(
    gql`
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
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
        dimensionType: 'content',
        filter: {}
      },
      skip: !fromDate || !toDate,
      fetchPolicy: 'no-cache'
    }
  );

  const { data: contentIncomesData, refetch: refetchIncomes } = useQuery(
    gql`
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
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null
      },
      skip: !fromDate || !toDate,
      fetchPolicy: 'no-cache'
    }
  );

  useEffect(() => {
    let contentsById = {};
    if (delivStatsData && delivStatsData.dimensionDelivStats) {
      for (let dimensionStats of delivStatsData.dimensionDelivStats.dimensionsStats) {
        if (dimensionStats.dimension) {
          contentsById[dimensionStats.dimension.id] = {
            id: dimensionStats.dimension.id,
            name: dimensionStats.dimension.label,
            dimension: dimensionStats.dimension,
            partnerId: dimensionStats.dimension.object ? dimensionStats.dimension.object.partnerId : null,
            type: dimensionStats.dimension.object ? dimensionStats.dimension.object.type : null,
            incomesStats: dimensionStats.dimension.object ? dimensionStats.dimension.object.incomesStats : null,
            byDayStats: dimensionStats.byDayStats,
            totalStats: JSON.parse(JSON.stringify(dimensionStats.totalStats))
          };
        }
      }
    }

    if (contentIncomesData && contentIncomesData.contentIncomes) {
      for (let contentIncome of contentIncomesData.contentIncomes) {
        if (!contentIncome.content) {
          continue;
        }
        if (!(contentIncome.content.id in contentsById)) {
          contentsById[contentIncome.content.id] = {
            id: contentIncome.content.id,
            name: contentIncome.content.name,
            partnerId: contentIncome.content.partnerId,
            type: contentIncome.content.type,
            incomesStats: contentIncome.content.incomesStats,
            byDayStats: [],
            totalStats: {}
          };
        }
        let content = contentsById[contentIncome.content.id];

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
    for (let id in contentsById) {
      let content = contentsById[id];
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
        if (day.income) {
          content.totalStats.manualIncome += day.income.estimatedIncome;
          content.totalStats.recordedIncome += day.income.recordedIncome;
          content.totalStats.estimatedIncome += day.income.estimatedIncome;

          day.stats.estimatedIncome = day.income.estimatedIncome;
          day.stats.manualIncome = day.income.estimatedIncome;
          day.stats.recordedIncome = day.income.recordedIncome;
        } else {
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

    setContentStats(
      Object.values(contentsById).sort((a, b) => {
        return a.totalStats.request < b.totalStats.request ? 1 : -1;
      })
    );
  }, [setContentStats, delivStatsData, contentIncomesData]);

  const dates = [];
  var currentDate = moment(fromDate);
  while (currentDate <= toDate) {
    dates.unshift(moment(currentDate));
    currentDate.add(1, 'days');
  }
  const totalStats = {
    byDayStats: {}
  };
  let filteredContentStats = contentStats.filter((content) => {
    if (name && content.name.toLowerCase().indexOf(name.toLowerCase()) < 0) {
      return false;
    }
    if (type && content.type !== type) {
      return false;
    }
    return true;
  });
  filteredContentStats = filteredContentStats.filter((content) => {
    if (partnerId && content.partnerId !== partnerId) {
      return false;
    }
    return true;
  });

  for (let content of filteredContentStats) {
    ['request', 'unique_click', 'unique_open', 'manualIncome', 'estimatedIncome', 'recordedIncome'].forEach((key) => {
      if (!(key in totalStats)) {
        totalStats[key] = 0;
      }
      totalStats[key] += content.totalStats[key] ? content.totalStats[key] : 0;
    });

    for (let day of content.byDayStats) {
      if (!(day.day in totalStats.byDayStats)) {
        totalStats.byDayStats[day.day] = {};
      }
      ['request', 'unique_click', 'unique_open', 'manualIncome', 'estimatedIncome', 'recordedIncome'].forEach((key) => {
        if (!(key in totalStats.byDayStats[day.day])) {
          totalStats.byDayStats[day.day][key] = 0;
        }
        totalStats.byDayStats[day.day][key] += day.stats[key] ? day.stats[key] : 0;
      });
    }
  }
  totalStats.eCpm = totalStats.request ? (1000 * (totalStats.estimatedIncome ? totalStats.estimatedIncome : 0)) / totalStats.request : null;
  totalStats.cpc = totalStats.unique_click ? (totalStats.estimatedIncome ? totalStats.estimatedIncome : 0) / totalStats.unique_click : null;
  for (let day in totalStats.byDayStats) {
    totalStats.byDayStats[day].eCpm = totalStats.byDayStats[day].request
      ? (1000 * (totalStats.byDayStats[day].estimatedIncome ? totalStats.byDayStats[day].estimatedIncome : 0)) / totalStats.byDayStats[day].request
      : null;
    totalStats.byDayStats[day].cpc = totalStats.byDayStats[day].unique_click
      ? (totalStats.byDayStats[day].estimatedIncome ? totalStats.byDayStats[day].estimatedIncome : 0) / totalStats.byDayStats[day].unique_click
      : null;
  }

  const partnersFilter = useCallback(
    (partners) => {
      return partners.filter((partner) => {
        return contentStats.find((item) => {
          return item.partnerId == partner.id;
        });
      });
    },
    [contentStats]
  );

  return (
    <Row>
      <Col xl={12}>
        <Card>
          <Card.Header>
            <div className="d-flex ">
              <div className="pr-2">
                <CSelect
                  style={{ display: 'inline-block', width: '120px' }}
                  className="form-control pr-2"
                  size="sm"
                  onChange={(event) => {
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
              <div className="pr-2" style={{ maxWidth: '200px' }}>
                <PartnersSelector partnerId={partnerId} setPartnerId={setPartnerId} partnersFilter={partnersFilter} />
              </div>

              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            </div>

            <Row>
              <Col>
                <IncomeFieldsSelector fields={fields} setFields={setFields} />
              </Col>
              {!loadingDelivStats && filteredContentStats.length > 0 && (
                <Col style={{ maxWidth: '10px' }}>
                  <CTooltip content="copy to clipboard">
                    <span className="d-flex justify-content-end">
                      <ClipboardElement markup={copyIncomeStats(filteredContentStats, IncomeLabels, fields, dates)} onClick={() => {}}>
                        <i className="fas fa-clipboard" style={{ cursor: 'pointer', marginTop: '10px' }}></i>
                      </ClipboardElement>
                    </span>
                  </CTooltip>
                </Col>
              )}
            </Row>
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
                      <div style={{ width: '78px', padding: '1px 2px' }}>TOTAL</div>
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
                {loadingDelivStats && (
                  <tbody>
                    <tr>
                      <td colSpan={2 + dates.length}>
                        <div style={{ textAlign: 'center', padding: '0px 0px' }}>
                          <Spinner animation="grow" color="secondary" size="sm" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                )}

                {!loadingDelivStats && (
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
                        let dateStats = totalStats.byDayStats[dateFormated];

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
                )}
                {!loadingDelivStats &&
                  filteredContentStats.map((item, index) => {
                    return (
                      <tbody key={index}>
                        <ContentIncome fields={fields} dates={dates} item={item} refetchIncomes={refetchIncomes} />
                      </tbody>
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

const copyIncomeStats = (incomeStats, IncomeLabels, fields, dates) => {
  var copyText = '<table>';
  copyText += '<tr>';
  copyText += '<th key="contentId">Content Id</th>';
  copyText += '<th key="contentName">Content Name</th>';
  copyText += '<th key="field">Field</th>';
  copyText += '<th key="total">TOTAL</th>';
  dates.map((date) => {
    copyText += `<th>${date.format('DD-MM-YY')}</th>`;
  });

  copyText += '</tr>';

  for (let incomeStat of incomeStats) {
    for (let field of fields) {
      copyText += '<tr>';
      appendTableDataCellElement(incomeStat.id);
      appendTableDataCellElement(incomeStat.name);
      appendTableDataCellElement(IncomeLabels[field]);
      if (field === 'unique_click_rate') {
        appendTableDataCellElement(incomeStat.totalStats.request ? Math.round((1000000 * (incomeStat.totalStats.unique_click ?? 0)) / incomeStat.totalStats.request) / 1000000 : '');
      } else if (field === 'unique_open_rate') {
        appendTableDataCellElement(incomeStat.totalStats.request ? Math.round((1000000 * (incomeStat.totalStats.unique_open ?? 0)) / incomeStat.totalStats.request) / 1000000 : '');
      } else {
        appendTableDataCellElement(Math.round(100 * incomeStat.totalStats[field]) / 100);
      }

      dates.map((date) => {
        let dateStat = incomeStat.byDayStats.find((dayStat) => dayStat.day === date.format('YYYY-MM-DD'));
        let dateStatValue = '';
        if (dateStat?.stats) {
          if (field === 'eCpm') {
            dateStatValue = dateStat.stats.request ? (1000 * dateStat.stats.estimatedIncome) / dateStat.stats.request : '';
          } else if (field === 'cpc') {
            dateStatValue = dateStat.stats.request ? dateStat.stats.estimatedIncome / dateStat.stats.unique_click : '';
          } else if (field === 'unique_click_rate') {
            dateStatValue = dateStat.stats.request ? (1.0 * dateStat.stats.unique_click ?? 0) / dateStat.stats.request : '';
          } else if (field === 'unique_open_rate') {
            dateStatValue = dateStat.stats.request ? (1.0 * dateStat.stats.unique_open ?? 0) / dateStat.stats.request : '';
          } else {
            dateStatValue = dateStat.stats[field] ?? '';
          }
        }
        appendTableDataCellElement(dateStatValue);
      });

      copyText += '</tr>';
    }
  }
  copyText += '</table>';
  return copyText;

  function appendTableDataCellElement(valueToAppend) {
    copyText += '<td>';
    copyText += valueToAppend;
    copyText += '</td>';
  }
};
