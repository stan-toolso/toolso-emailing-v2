import React from 'react';
import { CSpinner } from '@coreui/react';
import { FIELDS, FieldRow } from './ContactStats';

export default ({ dates, loading, statsByDates }) => {
  return (
    <div className="table-responsive">
      <table className="table table-sm m-0 stats-table table-bordered ">
        <thead>
          <tr>
            <th>
              <div style={{ width: '200px', padding: '1px 2px' }}></div>
            </th>
            {dates.map((date) => {
              return (
                <th className="text-left" key={date}>
                  <div style={{ width: '66px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={dates.length + 1}>
                <div style={{ textAlign: 'center', padding: '20px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && (
          <tbody>
            {Object.values(FIELDS).map((field) => {
              return <FieldRow field={field} key={field} dates={dates} statsByDates={statsByDates} />;
            })}
          </tbody>
        )}
      </table>
    </div>
  );
};
