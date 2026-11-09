import React from 'react';

import { IncomeLabels } from '../database/contents/incomes/IncomeLabels';
import TotalFieldTd from '../database/contents/incomes/TotalFieldTd';
import IncomeTdStyle from '../database/contents/incomes/IncomeTdStyle';
import ContentIncome from '../database/contents/incomes/ContentIncome';
import { ApolloProvider } from '@apollo/client';
import EmailingDatabaseApiContext from '../../contexts/EmailingDatabaseApiContext';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import CampaignIncomeFieldTd from './CampaignIncomeFieldTd';

export default ({ fields, dates, item, refetchIncomes, showContentName = true }) => {
  const [expended, setExpended] = React.useState(false);
  const [showFullLabel, setShowFullLabel] = React.useState(false);
  return (
    <>
      <tbody>
        <tr>
          {showContentName && (
            <td>
              <div style={{ height: showFullLabel ? 'auto' : `${fields.length * 19}px`, overflow: 'hidden', wordBreak: 'break-all', padding: '1px 2px', minWidth: '400px' }}>
                <i
                  className={`fas fa-chevron-circle-${expended ? 'up' : 'down'} cursor-pointer pr-2`}
                  onClick={() => {
                    setExpended(!expended);
                  }}
                />
                <span
                  onClick={() => {
                    setShowFullLabel(!showFullLabel);
                  }}
                >
                  {item.name}
                </span>
              </div>
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
                        return <CampaignIncomeFieldTd key={index} field={field} dateStats={dateStats} content={item} date={date} dates={dates} refetchIncomes={refetchIncomes} />;
                      })}
                    </tbody>
                  </table>
                </div>
              </td>
            );
          })}
        </tr>
      </tbody>
      {expended && (
        <tbody className="bg-light text-dark">
          {Object.values(item.databases).map((databaseItem) => {
            const emailingDatabaseApi = new EmailingDatabaseApi(databaseItem.database);
            return (
              <ApolloProvider client={emailingDatabaseApi.getClient()} key={`${databaseItem.database.uid}-${item.name}`}>
                <EmailingDatabaseApiContext.Provider value={emailingDatabaseApi}>
                  <ContentIncome fields={fields} dates={dates} item={databaseItem} refetchIncomes={refetchIncomes} prefixName={databaseItem.database.name} />
                </EmailingDatabaseApiContext.Provider>
              </ApolloProvider>
            );
          })}
        </tbody>
      )}
    </>
  );
};
