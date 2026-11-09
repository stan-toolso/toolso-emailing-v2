import { CCol, CRow, CSelect, CFormGroup, CLabel } from '@coreui/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React from 'react';
import moment from 'moment-timezone';

export default ({ filter, setFilter }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <>
      <div style={{ width: '100%', height: '30px' }}>
        <CRow>
          <CCol xl={3}>
            <CSelect
              className="mx-2 w-100"
              custom
              name="utm"
              id="utm"
              value={filter.subType}
              size="sm"
              onChange={(event) => {
                filter.subType = event.target.value;
                if (filter.subType === 'birthday') {
                  filter.from = undefined;
                  filter.to = undefined;
                }
                setFilter({ ...filter });
              }}
            >
              <option value="period">Period</option>
              <option value="birthday">Birthday</option>
            </CSelect>
          </CCol>
          {filter.subType !== 'birthday' && (
            <>
              <CCol xl={9} className="d-flex flex-row">
                <CFormGroup>
                  <CLabel>From</CLabel>
                  <DatePicker
                    className="mx-2 form-control form-control-sm"
                    selected={filter.from && filter.from.length === 5 ? new Date(new Date().getFullYear(), parseInt(filter.from.substr(0, 2)) - 1, parseInt(filter.from.substr(3, 2))) : undefined}
                    onChange={(date) => {
                      filter.subType = 'period';
                      filter.from = moment(date).format('MM-DD');
                      setFilter({ ...filter });
                    }}
                    forceShowMonthNavigation
                    showIcon
                    minDate={new Date(new Date().getFullYear(), 0, 1)}
                    maxDate={new Date(new Date().getFullYear(), 11, 31)}
                    dateFormat="dd MMMM"
                    renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                      <div
                        style={{
                          margin: 10,
                          display: 'flex',
                          justifyContent: 'center'
                        }}
                      >
                        <table>
                          <tr>
                            <td>
                              <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>
                                {'<'}
                              </button>
                            </td>
                            <td className="mx-4">{months[date.getMonth()]}</td>
                            <td>
                              {' '}
                              <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>
                                {'>'}
                              </button>
                            </td>
                          </tr>
                        </table>
                      </div>
                    )}
                  />
                </CFormGroup>
                <CFormGroup>
                  <CLabel className="ml-3 mr-2">To</CLabel>
                  <DatePicker
                    className="form-control form-control-sm"
                    selected={filter.to && filter.to.length === 5 ? new Date(new Date().getFullYear(), parseInt(filter.to.substr(0, 2)) - 1, parseInt(filter.to.substr(3, 2))) : undefined}
                    onChange={(date) => {
                      filter.to = moment(date).format('MM-DD');
                      filter.subType = 'period';
                      setFilter({ ...filter });
                    }}
                    minDate={
                      filter.from && filter.from.length === 5
                        ? new Date(new Date().getFullYear(), parseInt(filter.from.substr(0, 2)) - 1, parseInt(filter.from.substr(3, 2)))
                        : new Date(new Date().getFullYear(), 0, 1)
                    }
                    maxDate={new Date(new Date().getFullYear(), 11, 31)}
                    dateFormat="dd MMMM"
                    renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                      <div
                        style={{
                          margin: 10,
                          display: 'flex',
                          justifyContent: 'center'
                        }}
                      >
                        <table>
                          <tr>
                            <td>
                              <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>
                                {'<'}
                              </button>
                            </td>
                            <td className="mx-4">{months[date.getMonth()]}</td>
                            <td>
                              {' '}
                              <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>
                                {'>'}
                              </button>
                            </td>
                          </tr>
                        </table>
                      </div>
                    )}
                  />
                </CFormGroup>
              </CCol>
            </>
          )}
        </CRow>
      </div>
    </>
  );
};
