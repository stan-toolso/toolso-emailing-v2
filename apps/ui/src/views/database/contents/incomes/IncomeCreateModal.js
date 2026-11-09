import React, { useState, useEffect } from 'react';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSelect, CSpinner } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';
import moment from 'moment-timezone';
import RangeDatePicker from '../../../common/RangeDatePicker';

export default ({ show, toggle, content, income, date, stats, existingIncome, onSave }) => {
  const [validationRate, setValidationRate] = useState(existingIncome && existingIncome.validationRate ? existingIncome.validationRate : 100);
  const [recordedIncome, setRecordedIncome] = useState(0);
  const [type, setType] = useState(existingIncome && existingIncome.type ? existingIncome.type : '');
  const [fromDate, setFromDate] = useState(income ? moment(income.date) : moment().add(-1, 'days'));
  const [toDate, setToDate] = useState(income ? moment(income.date) : moment().add(-1, 'days'));

  useEffect(() => {
    if (income) {
      setValidationRate(income.validationRate);
      setRecordedIncome(income.recordedIncome);
      setType(income.type);
    } else if (existingIncome) {
      setValidationRate(existingIncome.validationRate);
      setRecordedIncome(0);
      setType(getDefaultType(stats, existingIncome.type));
    } else {
      setValidationRate(100);
      setRecordedIncome(0);
      setType(getDefaultType(stats));
    }
    if (date) {
      setFromDate(date);
      setToDate(date);
    }
  }, [income, date, existingIncome, setFromDate, setToDate, setValidationRate, setType, setRecordedIncome, stats]);

  const [createContentIncomes, { loading, data }] = useMutation(gql`
    mutation CreateContentIncome($contentId: ID!, $fromDate: String!, $toDate: String!, $type: String!, $recordedIncome: Float!, $validationRate: Float!) {
      createContentIncomes(contentId: $contentId, fromDate: $fromDate, toDate: $toDate, type: $type, recordedIncome: $recordedIncome, validationRate: $validationRate) {
        id
      }
    }
  `);

  useEffect(() => {
    if (data) {
      toggle();
    }
  }, [data, toggle]);
  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>New income for {content.name}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol xl="12">
            <RangeDatePicker className="d-flex flex-fill " defaultRangeType="custom" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} showRangeType={false} />
            <hr />
          </CCol>
        </CRow>
        <CRow>
          <CCol xl="6">
            <CFormGroup>
              <CLabel htmlFor="name">Allocation Type</CLabel>
              <CSelect
                size="sm"
                type="text"
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                }}
              >
                <option value="">-- Allocation Type --</option>
                <option value="request">Requests</option>
                {(!stats || stats.unique_open) && <option value="unique_open">Unique opens</option>}
                {(!stats || stats.unique_click) && <option value="unique_click">Unique clicks</option>}
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>
        <CRow>
          <CCol xl="6">
            <CFormGroup>
              <CLabel htmlFor="name">Recorded income</CLabel>
              <CInput
                size="sm"
                type="text"
                placeholder="Revenue"
                value={recordedIncome}
                onChange={(event) => {
                  setRecordedIncome(customParseFloat(event.target.value));
                }}
              />
            </CFormGroup>
          </CCol>

          <CCol xl="6">
            <CFormGroup>
              <CLabel htmlFor="name">Validation rate</CLabel>
              <CInput
                size="sm"
                type="text"
                placeholder="Revenue"
                value={validationRate}
                onChange={(event) => {
                  setValidationRate(customParseFloat(event.target.value));
                }}
              />
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton
          color="info"
          size="sm"
          disabled={!type || !fromDate || !toDate}
          onClick={async () => {
            await createContentIncomes({
              variables: {
                contentId: content.id,
                fromDate: fromDate.format('YYYY-MM-DD'),
                toDate: toDate.format('YYYY-MM-DD'),
                type,
                validationRate: parseFloat(validationRate),
                recordedIncome: parseFloat(recordedIncome)
              }
            });
            if (onSave) {
              onSave();
            }
            toggle();
          }}
        >
          {loading && <CSpinner color="secondary" />}
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
  return a.replace(/,/g, '.').replace(/ /g, '');
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
