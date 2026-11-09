import React, { useState, useEffect, useCallback } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSelect, CSpinner } from '@coreui/react';
import { gql } from '@apollo/client';
import moment from 'moment-timezone';
import RangeDatePicker from '../common/RangeDatePicker';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import { toast } from 'react-toastify';

export default ({ show, toggle, campaign, date, onSave, minDate, maxDate }) => {
  const [validationRate, setValidationRate] = useState(100);
  const [recordedIncome, setRecordedIncome] = useState('');

  const [forceAllocation, setForceAllocation] = useState(0);

  const [type, setType] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(date ?? moment().add(-1, 'days'));
  const [toDate, setToDate] = useState(date ?? moment().add(-1, 'days'));

  const [databases, setDatabases] = useState(campaign && campaign.databases ? Object.values(campaign.databases) : []);

  useEffect(() => {
    let recordedIncome = '';
    let estimatedIncome = 0;
    let type = '';
    if (campaign) {
      campaign.totalStatsOnPeriod = {};
      for (let database of Object.values(campaign.databases)) {
        delete database.recordedIncomeInput;
        delete database.validationRateInput;
        database.recordedIncome = '';
        database.estimatedIncome = 0;
        database.totalStatsOnPeriod = {};
        let defaultValidationRate = 100;
        for (let byDayStat of database.byDayStats) {
          if (byDayStat.day >= fromDate.format('YYYY-MM-DD') && byDayStat.day <= toDate.format('YYYY-MM-DD')) {
            ['request', 'unique_click', 'unique_open'].forEach((key) => {
              campaign.totalStatsOnPeriod[key] = (campaign.totalStatsOnPeriod[key] ?? 0) + (byDayStat.stats[key] ?? 0);
              database.totalStatsOnPeriod[key] = (database.totalStatsOnPeriod[key] ?? 0) + (byDayStat.stats[key] ?? 0);
            });

            if (byDayStat.income) {
              recordedIncome = (recordedIncome !== '' ? recordedIncome : 0) + (byDayStat.income.recordedIncome ?? 0);
              estimatedIncome += (byDayStat.income.recordedIncome * byDayStat.income.validationRate) / 100;
              type = byDayStat.income.type;
              database.allocationType = type;
              database.recordedIncome = (database.recordedIncome !== '' ? database.recordedIncome : 0) + (byDayStat.income.recordedIncome ?? 0);
              database.estimatedIncome += (byDayStat.income.recordedIncome * byDayStat.income.validationRate) / 100;
            }
          } else {
            if (!type && byDayStat.income && byDayStat.income.type) {
              type = getDefaultType(campaign.totalStats, byDayStat.income.type);
              if (!database.allocationType) {
                database.allocationType = type;
              }
            }
          }
          defaultValidationRate = byDayStat.income?.validationRate ?? defaultValidationRate;
        }
        if (database.recordedIncome) {
          database.validationRate = (database.estimatedIncome * 100) / database.recordedIncome;
        } else {
          database.validationRate = defaultValidationRate;
        }
      }
    }
    if (!type) {
      type = getDefaultType(campaign.totalStats);
    }
    if (recordedIncome) {
      setValidationRate((estimatedIncome * 100) / recordedIncome);
    }
    setRecordedIncome(recordedIncome);

    setType(type);
  }, [date, fromDate, toDate, setFromDate, setToDate, setValidationRate, setType, setRecordedIncome, campaign]);

  const onDatabaseChanged = useCallback(() => {
    let recordedIncome = 0;
    let estimatedIncome = 0;
    if (campaign) {
      for (let database of Object.values(campaign.databases)) {
        if (database.recordedIncome) {
          recordedIncome += database.recordedIncome;
          estimatedIncome += (database.recordedIncome * database.validationRate) / 100;
        }
      }
    }
    if (recordedIncome) {
      setValidationRate((estimatedIncome * 100) / recordedIncome);
    }
    setRecordedIncome(recordedIncome);
    setType(type);
    setDatabases(Object.values(campaign.databases));
  }, [campaign, setValidationRate, setRecordedIncome, setDatabases]);

  const onTotalChanged = useCallback(() => {
    let totalOfType = campaign.totalStatsOnPeriod[type];

    let newRecordedIncome = customParseFloat(recordedIncome);
    let newValidationRate = customParseFloat(validationRate);
    if (!(isNaN(newRecordedIncome) || isNaN(newValidationRate))) {
      for (let database of Object.values(campaign.databases)) {
        delete database.recordedIncomeInput;
        delete database.validationRateInput;
        database.recordedIncome = totalOfType ? (newRecordedIncome * database.totalStatsOnPeriod[type] ?? 0) / totalOfType : newRecordedIncome / Object.values(campaign.databases).length;
        database.validationRate = newValidationRate;
        database.allocationType = type;
      }
    }
    setDatabases(Object.values(campaign.databases));
  }, [campaign, validationRate, recordedIncome, type, setDatabases]);

  useEffect(() => {
    if (forceAllocation > 0) {
      onTotalChanged();
    }
    setForceAllocation(0);
  }, [forceAllocation, onTotalChanged, setForceAllocation]);

  const save = useCallback(() => {
    setSaving(true);
    Promise.all(
      Object.values(campaign.databases).map((database) => {
        return new Promise((resolve, reject) => {
          if (database.recordedIncome === '' || isNaN(database.recordedIncome)) {
            resolve();
            return;
          }

          new EmailingDatabaseApi(database.database)
            .doMutation({
              mutation: gql`
                mutation CreateContentIncome($contentId: ID!, $fromDate: String!, $toDate: String!, $type: String!, $recordedIncome: Float!, $validationRate: Float!) {
                  createContentIncomes(contentId: $contentId, fromDate: $fromDate, toDate: $toDate, type: $type, recordedIncome: $recordedIncome, validationRate: $validationRate) {
                    id
                  }
                }
              `,
              variables: {
                contentId: database.id,
                fromDate: fromDate.format('YYYY-MM-DD'),
                toDate: toDate.format('YYYY-MM-DD'),
                type: database.allocationType,
                validationRate: database.validationRate,
                recordedIncome: database.recordedIncome
              }
            })
            .then(() => {
              toast.success(`Income has been save for ${database.database.name}`, {
                position: toast.POSITION.BOTTOM_RIGHT
              });
              resolve();
            })
            .catch(reject);
        });
      })
    ).then(() => {
      setSaving(false);
      if (onSave) {
        onSave();
      }
      toggle();
    });
  }, [campaign, fromDate, toDate]);
  return (
    <CModal show={show} color="info" onClose={toggle} size="lg">
      <CModalHeader>New income for {campaign.name}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl="12">
            <RangeDatePicker
              className="d-flex flex-fill "
              defaultRangeType="custom"
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              showRangeType={false}
              minDate={minDate}
              maxDate={maxDate}
            />
            <hr />
          </CCol>
        </CRow>
        <CRow>
          <CCol xl="3">
            <CLabel></CLabel>
            <div className="font-weight-bold pt-2"> Total income</div>
          </CCol>
          <CCol xl="3">
            <CFormGroup>
              <CLabel htmlFor="name">Recorded income</CLabel>
              <CInput
                size="sm"
                type="text"
                placeholder="Revenue"
                value={recordedIncome ?? ''}
                onChange={(event) => {
                  setRecordedIncome(event.target.value);
                  setForceAllocation(forceAllocation + 1);
                }}
              />
            </CFormGroup>
          </CCol>

          <CCol xl="3">
            <CFormGroup>
              <CLabel htmlFor="name">Validation rate</CLabel>
              <CInput
                size="sm"
                type="text"
                placeholder="Validation Rate"
                value={validationRate ? (typeof validationRate === 'number' ? validationRate.toFixed(2) : validationRate) : ''}
                onChange={(event) => {
                  setValidationRate(event.target.value);

                  setForceAllocation(forceAllocation + 1);
                }}
              />
            </CFormGroup>
          </CCol>
          <CCol xl="3">
            <CFormGroup>
              <CLabel htmlFor="name">Allocation Type</CLabel>
              <CSelect
                size="sm"
                type="text"
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setForceAllocation(forceAllocation + 1);
                }}
              >
                <option value="">-- Allocation Type --</option>
                <option value="request">Requests</option>
                {(!campaign.totalStats || campaign.totalStats.unique_open) && <option value="unique_open">Unique opens</option>}
                {(!campaign.totalStats || campaign.totalStats.unique_click) && <option value="unique_click">Unique clicks</option>}
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>

        {databases.map((database) => {
          if (!('recordedIncomeInput' in database) || database.recordedIncomeInput === undefined) {
            database.recordedIncomeInput = database.recordedIncome !== null && database.recordedIncome !== undefined ? database.recordedIncome : '';
          }
          if (!('validationRateInput' in database) || database.validationRateInput === undefined) {
            database.validationRateInput = database.validationRate !== null && database.validationRate !== undefined ? database.validationRate : '';
          }

          return (
            <CRow key={database.database.uid}>
              <CCol xl="3">{database.database.name}</CCol>
              <CCol xl="3">
                <CFormGroup>
                  <CInput
                    size="sm"
                    type="text"
                    placeholder="Revenue"
                    value={database.recordedIncomeInput}
                    onChange={(event) => {
                      database.recordedIncomeInput = event.target.value;
                      database.recordedIncome = customParseFloat(database.recordedIncomeInput);
                      onDatabaseChanged();
                    }}
                  />
                </CFormGroup>
              </CCol>

              <CCol xl="3">
                <CFormGroup>
                  <CInput
                    size="sm"
                    type="text"
                    placeholder="Validation Rate"
                    value={database.validationRateInput}
                    onChange={(event) => {
                      database.validationRateInput = event.target.value;
                      database.validationRate = customParseFloat(database.validationRateInput);
                      onDatabaseChanged();
                    }}
                  />
                </CFormGroup>
              </CCol>
              <CCol xl="3">
                <CFormGroup>
                  <CSelect
                    size="sm"
                    type="text"
                    value={database.allocationType}
                    onChange={(event) => {
                      database.allocationType = event.target.value;
                      onDatabaseChanged();
                    }}
                  >
                    <option value="">-- Allocation Type --</option>
                    <option value="request">Requests</option>
                    {(!campaign.totalStats || campaign.totalStats.unique_open) && <option value="unique_open">Unique opens</option>}
                    {(!campaign.totalStats || campaign.totalStats.unique_click) && <option value="unique_click">Unique clicks</option>}
                  </CSelect>
                </CFormGroup>
              </CCol>
            </CRow>
          );
        })}
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton color="info" size="sm" disabled={!fromDate || !toDate || saving} onClick={save}>
          {saving && <CSpinner color="secondary" />}
          Insert
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

const customParseFloat = (a) => {
  if (a === undefined || a === null) {
    return null;
  }
  if (typeof a === 'number') {
    return a;
  }
  return parseFloat(a.replace(/,/g, '.').replace(/ /g, ''));
};

const getDefaultType = (stats, defaultType) => {
  if (defaultType && stats && defaultType in stats) {
    return defaultType;
  }
  if (defaultType && !stats) {
    return defaultType;
  }
  if (stats) {
    if (stats.unique_click) {
      return 'unique_click';
    }
    if (stats.unique_open) {
      return 'unique_open';
    }
    if (stats.request) {
      return 'request';
    }
  }
  return '';
};
