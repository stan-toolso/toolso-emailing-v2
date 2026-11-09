import React from 'react';
import { CFormGroup, CInputCheckbox, CLabel } from '@coreui/react';

export default ({ filter, setFilter }) => {
  if (!filter.days) {
    filter.days = [];
  }
  const toggleDay = (day) => {
    let index = filter.days.indexOf(day);
    if (index >= 0) {
      filter.days.splice(index, 1);
    } else {
      filter.days.push(day);
    }
    setFilter(filter);
  };
  return (
    <div className="mx-2 pt-1">
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day1" checked={filter.days.indexOf(1) >= 0} onChange={() => toggleDay(1)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day1">
          Monday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day2" checked={filter.days.indexOf(2) >= 0} onChange={() => toggleDay(2)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day2">
          Tuesday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day3" checked={filter.days.indexOf(3) >= 0} onChange={() => toggleDay(3)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day3">
          Wednesday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day4" checked={filter.days.indexOf(4) >= 0} onChange={() => toggleDay(4)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day4">
          Thursday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day5" checked={filter.days.indexOf(5) >= 0} onChange={() => toggleDay(5)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day5">
          Friday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day6" checked={filter.days.indexOf(6) >= 0} onChange={() => toggleDay(6)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day6">
          Saturday
        </CLabel>
      </CFormGroup>
      <CFormGroup variant="checkbox" className="checkbox" inline>
        <CInputCheckbox size="sm" id="day7" checked={filter.days.indexOf(0) >= 0} onChange={() => toggleDay(0)} />
        <CLabel variant="checkbox" className="form-check-label" htmlFor="day7">
          Sunday
        </CLabel>
      </CFormGroup>
    </div>
  );
};
