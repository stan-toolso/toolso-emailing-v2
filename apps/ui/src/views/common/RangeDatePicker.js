import { CLabel, CSelect } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import moment from 'moment-timezone';

export default ({ fromDate, setFromDate, toDate, setToDate, className, defaultRangeType, showRangeType = true, minDate, maxDate }) => {
  const [rangeType, setRangeType] = useState(defaultRangeType ? defaultRangeType : showRangeType ? 'last20Days' : 'custom');

  useEffect(() => {
    switch (rangeType) {
      case 'last10Days':
        setFromDate(moment().add(-10, 'days'));
        setToDate(moment());
        break;
      case 'last20Days':
        setFromDate(moment().add(-20, 'days'));
        setToDate(moment());
        break;
      case 'thisMonth':
        setFromDate(moment().startOf('month'));
        setToDate(moment());
        break;
      case 'thisWeek':
        setFromDate(moment().startOf('week').add(1, 'day'));
        setToDate(moment());
        break;
      case 'lastMonth':
        setFromDate(moment().add(-1, 'month').startOf('month'));
        setToDate(moment().add(-1, 'month').endOf('month'));
        break;
      case 'lastWeek':
        setFromDate(moment().add(-1, 'week').startOf('week').add(1, 'day'));
        setToDate(moment().add(-1, 'week').endOf('week').add(1, 'day'));
        break;
      case 'yesterday':
        setFromDate(moment().add(-1, 'day'));
        setToDate(moment().add(-1, 'day'));
        break;
      case 'today':
        setFromDate(moment());
        setToDate(moment());
        break;

      case 'thisYear':
        setFromDate(moment().startOf('year'));
        setToDate(moment());
        break;
      case 'lastYear':
        setFromDate(moment().add(-1, 'year').startOf('year'));
        setToDate(moment().add(-1, 'year').endOf('year'));
        break;

      case 'custom':
      default:
        break;
    }
  }, [rangeType, setFromDate, setToDate]);

  if (!fromDate || !toDate) {
    return null;
  }

  return (
    <div className={className}>
      {showRangeType && (
        <div className="pr-2 d-inline-block">
          <CSelect
            className=" d-inline-block"
            size="sm"
            style={{ width: '150px', float: 'right' }}
            value={rangeType}
            onChange={(event) => {
              setRangeType(event.target.value);
            }}
          >
            <option value="last10Days">Last 10 days</option>
            <option value="last20Days">Last 20 days</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="thisWeek">This week</option>
            <option value="lastWeek">Last week</option>
            <option value="thisYear">This year</option>
            <option value="lastYear">Last year</option>
            <option value="yesterday">Yesterday</option>
            <option value="today">Today</option>
            <option value="custom">Custom</option>
          </CSelect>
        </div>
      )}

      <CLabel className="px-2 pt-1">From</CLabel>
      <DatePicker
        selected={fromDate.toDate()}
        onChange={(date) => setFromDate(moment(date))}
        selectsStart
        startDate={fromDate.toDate()}
        endDate={toDate.toDate()}
        minDate={minDate ? minDate.toDate() : null}
        disabled={rangeType !== 'custom'}
        dateFormat="dd-MM-yyyy"
        className=" form-control form-control-sm"
        popperPlacement="bottom-end"
      />
      <CLabel className="px-2 pt-1">To</CLabel>
      <DatePicker
        selected={toDate.toDate()}
        onChange={(date) => setToDate(moment(date))}
        selectsEnd
        startDate={fromDate.toDate()}
        minDate={fromDate.toDate()}
        maxDate={maxDate ? maxDate.toDate() : null}
        dateFormat="dd-MM-yyyy"
        disabled={rangeType !== 'custom'}
        className=" form-control form-control-sm"
        popperPlacement="bottom-end"
      />
    </div>
  );
};
