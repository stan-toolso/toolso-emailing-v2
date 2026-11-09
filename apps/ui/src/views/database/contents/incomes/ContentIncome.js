import React, { useContext } from 'react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import IncomeLabel from './IncomeLabel';
import IncomeTdStyle from './IncomeTdStyle';
import IncomeFieldTd from './IncomeFieldTd';
import TotalFieldTd from './TotalFieldTd';
import { IncomeLabels } from './IncomeLabels';

export default ({ fields, dates, item, refetchIncomes, showContentName = true, prefixName }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <tr>
      {showContentName && (
        <td>
          <IncomeLabel emailingDatabaseApiContext={emailingDatabaseApiContext} item={item} fields={fields} prefixName={prefixName} />
        </td>
      )}

      <td>
        <table style={{ width: showContentName ? '150px' : '400px' }}>
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
                return <TotalFieldTd key={index} field={field} totalStats={item.totalStats} />;
              })}
            </tbody>
          </table>
        </div>
      </td>
      {dates.map((date) => {
        let dateFormated = date.format('YYYY-MM-DD');
        let dateStats = item.byDayStats.find((d) => {
          return d.day === dateFormated;
        });

        return (
          <td key={date}>
            <div style={{ width: '78px', padding: '0px' }}>
              <table style={{ margin: '0px', padding: '0px', border: '0px' }}>
                <tbody>
                  {fields.map((field, index) => {
                    return <IncomeFieldTd key={index} field={field} dateStats={dateStats} content={item} date={date} dates={dates} refetchIncomes={refetchIncomes} />;
                  })}
                </tbody>
              </table>
            </div>
          </td>
        );
      })}
    </tr>
  );
};
