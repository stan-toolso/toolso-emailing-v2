import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import moment from 'moment-timezone';
import React, { useEffect, useState } from 'react';

import { Row, Col, Card, Spinner } from 'react-bootstrap';
import RangeDatePicker from '../../../common/RangeDatePicker';
import { ActivationFields } from './ActivationFields';
import { ActivationFieldsSelector } from './ActivationFieldsSelector';
import ActivationFieldTd from './ActivationFieldTd';
import { ActivationLabels } from './ActivationLabels';
import ActivationTdStyle from './ActivationTdStyle';

export default () => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [fields, setFields] = useState([ActivationFields.request, ActivationFields.unique_open_rate]);

  const [activationStatsByEsp, setActivationStatsByEsp] = useState([]);
  const [totalStats, setTotalStats] = useState({});

  const { loading, data } = useQuery(
    gql`
      query activationStats($fromDate: String!, $toDate: String!) {
        activationStats(fromDate: $fromDate, toDate: $toDate) {
          id
          date
          esp
          request
          request0Attempt
          request1Attempt
          request2Attempt
          request3Attempt
          unique_open
          unique_click
          unique_proxy_loaded
          unsub
          complaint
          hard_bounce
          soft_bounce
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
    let activationStatsByEsp = {};
    let totalStats = {
      byDate: {}
    };
    const fieldsToSum = [
      ActivationFields.request,
      ActivationFields.request0Attempt,
      ActivationFields.request1Attempt,
      ActivationFields.request2Attempt,
      ActivationFields.request3Attempt,
      ActivationFields.unique_open,
      ActivationFields.unique_click,
      ActivationFields.unique_proxy_loaded,
      ActivationFields.unsub,
      ActivationFields.complaint,
      ActivationFields.hard_bounce,
      ActivationFields.soft_bounce
    ];

    if (data) {
      for (let item of data.activationStats) {
        if (!(item.esp in activationStatsByEsp)) {
          activationStatsByEsp[item.esp] = {
            esp: item.esp,
            total: {},
            byDate: {}
          };
        }
        if (!(item.date in activationStatsByEsp[item.esp].byDate)) {
          activationStatsByEsp[item.esp].byDate[item.date] = item;
        }
        if (!(item.date in totalStats.byDate)) {
          totalStats.byDate[item.date] = {
            date: item.date
          };
        }
        for (let field of fieldsToSum) {
          if (!(field in activationStatsByEsp[item.esp].total)) {
            activationStatsByEsp[item.esp].total[field] = 0;
          }
          activationStatsByEsp[item.esp].total[field] += item[field];

          if (!(field in totalStats)) {
            totalStats[field] = 0;
          }
          if (!(field in totalStats.byDate[item.date])) {
            totalStats.byDate[item.date][field] = 0;
          }

          totalStats[field] += item[field];
          totalStats.byDate[item.date][field] += item[field];
        }
      }
    }
    setTotalStats(totalStats);
    activationStatsByEsp = Object.values(activationStatsByEsp).sort((a, b) => {
      return a.total.request < b.total.request ? 1 : -1;
    });
    setActivationStatsByEsp(activationStatsByEsp);
  }, [data, setActivationStatsByEsp, setTotalStats]);

  const dates = [];
  var currentDate = moment(fromDate);
  while (currentDate <= toDate) {
    dates.unshift(moment(currentDate));
    currentDate.add(1, 'days');
  }
  return (
    <Row>
      <Col xl={12}>
        <Card>
          <Card.Header>
            <div className="d-flex ">
              <h5 className="card-title">Activation Stats</h5>
              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            </div>

            <ActivationFieldsSelector fields={fields} setFields={setFields} />
          </Card.Header>
          <Card.Body>
            <div className="table-responsive" style={{ paddingBottom: '200px' }}>
              <table className="table table-sm m-0 stats-table table-bordered " style={{ minWidth: 401 + dates.length * 68 + 'px' }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>
                      <div style={{ width: '180px', padding: '0px' }}></div>
                    </th>
                    <th className="text-left">
                      <div style={{ width: '78px', padding: '1px 2px' }}>TOTAL</div>
                    </th>
                    {dates.map((date, index) => {
                      return (
                        <th className="text-left" key={index}>
                          <div style={{ width: '78px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                {loading && (
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

                {!loading && (
                  <tbody style={{ fontWeight: 'bold' }}>
                    <tr>
                      <td>TOTAL</td>
                      <td>
                        <table style={{ width: '180px' }}>
                          <tbody>
                            {fields.map((field, index) => {
                              return (
                                <tr key={index}>
                                  <td style={{ ...ActivationTdStyle }}>
                                    {' '}
                                    <div style={{ padding: '1px 2px' }}>{ActivationLabels[field]}</div>
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
                                return (
                                  <tr key={index}>
                                    <ActivationFieldTd field={field} activationStats={totalStats} />
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                      {dates.map((date) => {
                        let dateFormated = date.format('YYYY-MM-DD');

                        return (
                          <td key={date}>
                            <div style={{ width: '78px', padding: '0px' }}>
                              <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                                <tbody>
                                  {fields.map((field, index) => {
                                    let stats = totalStats.byDate[dateFormated];
                                    return (
                                      <tr key={index}>
                                        <ActivationFieldTd field={field} activationStats={stats} rowStats={Object.values(totalStats.byDate)} />
                                      </tr>
                                    );
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
                {!loading &&
                  activationStatsByEsp.map((item, index) => {
                    return (
                      <tbody key={index}>
                        <tr>
                          <td>
                            <div style={{ width: '150px', padding: '1px 2px' }}>{item.esp}</div>
                          </td>
                          <td>
                            <table style={{ width: '180px' }}>
                              <tbody>
                                {fields.map((field, index) => {
                                  return (
                                    <tr key={index}>
                                      <td style={{ ...ActivationTdStyle }}>
                                        {' '}
                                        <div style={{ padding: '1px 2px' }}>{ActivationLabels[field]}</div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                          <td>
                            <div style={{ width: '78px', padding: '0px', fontWeight: 'bold' }}>
                              <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                                <tbody>
                                  {fields.map((field, index) => {
                                    return (
                                      <tr key={index}>
                                        <ActivationFieldTd field={field} activationStats={item.total} />
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                          {dates.map((date) => {
                            let dateFormated = date.format('YYYY-MM-DD');
                            let dateStats = dateFormated in item.byDate ? item.byDate[dateFormated] : null;

                            return (
                              <td key={dateFormated}>
                                <div style={{ width: '78px', padding: '0px' }}>
                                  <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                                    <tbody>
                                      {fields.map((field, index) => {
                                        return (
                                          <tr key={index}>
                                            <ActivationFieldTd field={field} activationStats={dateStats} rowStats={Object.values(item.byDate)} />
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
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
