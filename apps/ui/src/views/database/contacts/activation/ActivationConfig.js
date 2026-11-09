import { useMutation, useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import React, { useCallback, useState } from 'react';
import { Row, Col, Form } from 'react-bootstrap';
import moment from 'moment-timezone';

import { calculateAndFormatPercent, formatInteger, formatPercent } from '../../../util';
import ActivationFieldTd from './ActivationFieldTd';
import { ActivationFields } from './ActivationFields';
import { formatFloat } from '../../../common/util';

export default ({ activationConfig }) => {
  const [newRatioInput, setNewRatioInput] = useState(activationConfig.config && activationConfig.config.newRatio ? formatFloat(activationConfig.config.newRatio * 100) : '');
  const [config, setConfig] = useState(activationConfig.config ? activationConfig.config : {});
  const [showDetails, setShowDetails] = useState(false);
  const [updateActivationConfigMutation] = useMutation(
    gql`
      mutation updateActivationConfig($input: ActivationConfigInput!) {
        updateActivationConfig(input: $input) {
          esp
          config
        }
      }
    `
  );

  const updateActivationConfig = useCallback(
    async (config) => {
      setConfig({ ...config });
      await updateActivationConfigMutation({
        variables: {
          input: { esp: activationConfig.esp, config }
        }
      });
    },
    [updateActivationConfigMutation, setConfig, config]
  );

  const { data: statsData } = useQuery(
    gql`
      query activationStats($fromDate: String!, $toDate: String!, $esp: String) {
        activationStats(fromDate: $fromDate, toDate: $toDate, esp: $esp) {
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
          newsStats
        }
      }
    `,
    {
      variables: {
        esp: activationConfig.esp,
        fromDate: moment().add(-5, 'days').format('YYYY-MM-DD'),
        toDate: moment().format('YYYY-MM-DD')
      },
      skip: !showDetails
    }
  );

  const { data: delivStatsData } = useQuery(
    gql`
      query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String, $filter: JSON) {
        dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType, filter: $filter) {
          dimensionsStats {
            dimension {
              id
              label
              type
              object
            }

            byDayStats {
              day
              stats {
                request
                unsub
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        filter: {
          esp: activationConfig.esp
        },
        dimensionType: null,
        fromDate: moment().add(-5, 'days').format('YYYY-MM-DD'),
        toDate: moment().format('YYYY-MM-DD')
      },
      skip: !showDetails
    }
  );

  let cappingStep = 5;
  if (config.wmCapping && config.wmCapping >= 1000) {
    cappingStep = 100;
  } else if (config.wmCapping && config.wmCapping >= 200) {
    cappingStep = 50;
  } else if (config.wmCapping && config.wmCapping >= 100) {
    cappingStep = 10;
  }

  return (
    <tbody>
      <tr>
        <td style={{ width: '100px' }}>
          <div style={{ width: '100px' }}>{activationConfig.esp}</div>
        </td>
        <td style={{ width: '150px' }}>
          <div className="text-center" style={{ width: '150px' }}>
            {'wmCapping' in config && (
              <i
                className="fas fa-minus-circle cursor-pointer pr-2"
                onClick={() => {
                  if (!config.wmCapping || config.wmCapping < 0.0001) {
                    delete config.wmCapping;
                  } else {
                    config.wmCapping = config.wmCapping > 10 ? config.wmCapping - cappingStep : 0;
                  }

                  updateActivationConfig({ ...config });
                }}
              ></i>
            )}
            {config.wmCappingEnabled ? formatInteger(config.wmCapping) : ''}

            <i
              className="fas fa-plus-circle cursor-pointer pl-2"
              onClick={() => {
                updateActivationConfig({ ...config, wmCapping: (config.wmCapping ?? 0) + cappingStep, wmCappingEnabled: true });
              }}
            ></i>
          </div>
        </td>
        <td style={{ width: '150px' }}>
          <div style={{ width: '150px' }}>
            {config.scheduleRatio && config.scheduleRatio != null && (
              <i
                className="fas fa-minus-circle cursor-pointer pr-2"
                onClick={() => {
                  let newRatio = config.newRatio && config.newRatio > 0.01 ? config.newRatio - 0.01 : null;
                  updateActivationConfig({ ...config, newRatio });
                  setNewRatioInput(formatFloat(newRatio * 100));
                }}
              ></i>
            )}
            {config.newRatioEnabled && 'newRatio' in config && config.newRatio !== null ? formatPercent(100 * config.newRatio) : ''}
            {(!config.newRatio || config.newRatio < 0.9999) && (
              <i
                className="fas fa-plus-circle cursor-pointer pl-2"
                onClick={() => {
                  let newRatio = Math.min(1, (config.newRatio ?? 0) + 0.01);
                  updateActivationConfig({ ...config, newRatio, newRatioEnabled: true });
                  setNewRatioInput(formatFloat(newRatio * 100));
                }}
              ></i>
            )}
          </div>
        </td>

        <td colSpan={5} style={{ width: '100%' }}>
          <i
            className={`fas fa-chevron-circle-${showDetails ? 'up' : 'down'}  cursor-pointer`}
            onClick={() => {
              setShowDetails(!showDetails);
            }}
          ></i>
        </td>
      </tr>
      {showDetails && (
        <tr>
          <td colSpan={8}>
            <Row>
              <Col sm="2">
                <Form.Check
                  type="checkbox"
                  id={`newRatioEnabled`}
                  label={`New Ratio Enabled`}
                  checked={config.newRatioEnabled}
                  onChange={() => {
                    config.newRatioEnabled = !config.newRatioEnabled;
                    updateActivationConfig(config);
                  }}
                />
              </Col>
              <Col sm="3">
                <div className="input-group input-group-sm ">
                  <div className="input-group-prepend">
                    <span className="input-group-text">New ratio</span>
                  </div>
                  <input
                    type="integer"
                    className="form-control"
                    value={newRatioInput}
                    onChange={(event) => {
                      let newValue = event.target.value.replace(/,/g, '.');
                      setNewRatioInput(newValue);
                      if (!isNaN(newValue.replace(/ /g, ''))) {
                        config.newRatio = parseFloat(newValue.replace(/ /g, '')) / 100;
                      }
                      updateActivationConfig(config);
                    }}
                  />
                </div>
              </Col>
              <Col sm="2">
                <Form.Check
                  type="checkbox"
                  id={`autoUpdateNewRatio`}
                  label={`Auto Update`}
                  checked={config.autoUpdateNewRatio}
                  onChange={() => {
                    config.autoUpdateNewRatio = !config.autoUpdateNewRatio;
                    updateActivationConfig(config);
                  }}
                />
              </Col>
              <Col sm="3">
                <div className="input-group input-group-sm ">
                  <div className="input-group-prepend">
                    <span className="input-group-text">Unsub Rate target</span>
                  </div>
                  <input
                    type="number"
                    className="form-control"
                    value={config.unsubRateTarget ? config.unsubRateTarget : 0.5}
                    onChange={(event) => {
                      config.unsubRateTarget = event.target.value;
                      if (!isNaN(config.unsubRateTarget)) {
                        config.unsubRateTarget = parseFloat(config.unsubRateTarget);
                      }
                      updateActivationConfig(config);
                    }}
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col sm="2">
                <Form.Check
                  type="checkbox"
                  id={`wmCappingEnabled`}
                  label={`WM Capping Enabled`}
                  checked={config.wmCappingEnabled}
                  onChange={() => {
                    config.wmCappingEnabled = !config.wmCappingEnabled;
                    updateActivationConfig(config);
                  }}
                />
              </Col>
              <Col sm="3">
                <div className="input-group input-group-sm ">
                  <div className="input-group-prepend">
                    <span className="input-group-text">WM Capping</span>
                  </div>
                  <input
                    type="integer"
                    className="form-control"
                    value={config.wmCapping ? config.wmCapping : ''}
                    onChange={(event) => {
                      config.wmCapping = event.target.value;
                      if (!isNaN(config.wmCapping)) {
                        config.wmCapping = parseInt(config.wmCapping);
                      }
                      updateActivationConfig(config);
                    }}
                  />
                </div>
              </Col>
              <Col sm="2">
                <Form.Check
                  type="checkbox"
                  id={`autoUpdateWmCapping`}
                  label={`Auto Update`}
                  checked={config.autoUpdateWmCapping}
                  onChange={() => {
                    config.autoUpdateWmCapping = !config.autoUpdateWmCapping;
                    updateActivationConfig(config);
                  }}
                />
              </Col>

              <Col sm="3">
                <div className="input-group input-group-sm ">
                  <div className="input-group-prepend">
                    <span className="input-group-text">Open Rate target</span>
                  </div>
                  <input
                    type="number"
                    className="form-control"
                    value={config.openRateTarget ? config.openRateTarget : 20}
                    onChange={(event) => {
                      config.openRateTarget = event.target.value;
                      if (!isNaN(config.openRateTarget)) {
                        config.openRateTarget = parseInt(config.openRateTarget);
                      }
                      updateActivationConfig(config);
                    }}
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col sm="2">
                <Form.Check
                  type="checkbox"
                  id={`scheduleCappingEnabled`}
                  label={`Schedule Capping Enabled`}
                  checked={config.scheduleCappingEnabled}
                  onChange={() => {
                    config.scheduleCappingEnabled = !config.scheduleCappingEnabled;
                    updateActivationConfig(config);
                  }}
                />
              </Col>
              <Col sm="3">
                <div className="input-group input-group-sm ">
                  <div className="input-group-prepend">
                    <span className="input-group-text">Schedule Capping</span>
                  </div>
                  <input
                    type="integer"
                    className="form-control"
                    value={config.scheduleCapping ? config.scheduleCapping : ''}
                    onChange={(event) => {
                      config.scheduleCapping = event.target.value;
                      if (!isNaN(config.scheduleCapping)) {
                        config.scheduleCapping = parseInt(config.scheduleCapping);
                      }
                      updateActivationConfig(config);
                    }}
                  />
                </div>
              </Col>
            </Row>
          </td>
        </tr>
      )}
      {showDetails && (
        <tr className="stats-table bg-secondary">
          <td>Date</td>
          <td>Requests</td>
          <td>Open rate</td>
          <td>1st attempt requests</td>
          <td>2nd attempt requests</td>
          <td>3rd attempt requests</td>
          <td>4th attempt requests</td>
          <td>Global Unsub Rate</td>
        </tr>
      )}
      {showDetails &&
        statsData &&
        statsData.activationStats.map((stats, index) => {
          let delivStats = delivStatsData?.dimensionDelivStats?.dimensionsStats[0]?.byDayStats.find((delivStats) => delivStats.day === stats.date)?.stats ?? null;
          return (
            <tr className="stats-table bg-secondary" key={index}>
              <td>{stats.date}</td>

              <ActivationFieldTd activationStats={stats} field={ActivationFields.request} statsDivStyle={statsDivStyle} />
              <ActivationFieldTd activationStats={stats} field={ActivationFields.unique_open_rate} statsDivStyle={statsDivStyle} />
              <ActivationFieldTd activationStats={stats} field={ActivationFields.request0Attempt} statsDivStyle={statsDivStyle} />
              <ActivationFieldTd activationStats={stats} field={ActivationFields.request1Attempt} statsDivStyle={statsDivStyle} />
              <ActivationFieldTd activationStats={stats} field={ActivationFields.request2Attempt} statsDivStyle={statsDivStyle} />
              <ActivationFieldTd activationStats={stats} field={ActivationFields.request3Attempt} statsDivStyle={statsDivStyle} />

              <td>
                {delivStats && (
                  <span>
                    <div style={statsDivStyle}>{calculateAndFormatPercent(delivStats.unsub, delivStats.request)}</div>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
    </tbody>
  );
};

const statsDivStyle = {
  width: '100%',
  padding: '1px 2px'
};
