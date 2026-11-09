import React, { useState } from 'react';
import { formatIncome, formatInteger, getValueColors } from '../../../common/util';
import { calculatePercent, formatPercent } from '../../../util';
import IncomeCreateModal from './IncomeCreateModal';
import { IncomeFields } from './IncomeFields';
import IncomeTdStyle from './IncomeTdStyle';

export default ({ field, dateStats, content, date, dates, refetchIncomes }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  let income = dateStats && dateStats.income ? dateStats.income : null;
  let lastIncome = content.byDayStats.filter((d) => {
    return d.income;
  }).length
    ? content.byDayStats.find((d) => {
        return d.income;
      }).income
    : null;

  let estimatedIncome = dateStats ? dateStats.stats.estimatedIncome : null;

  let eCpm = null;
  if (dateStats && dateStats.stats.request && estimatedIncome !== null) {
    eCpm = (1000 * estimatedIncome) / dateStats.stats.request;
  }
  let cpc = null;
  if (dateStats && dateStats.stats.request && estimatedIncome !== null && dateStats.stats.unique_click) {
    cpc = estimatedIncome / dateStats.stats.unique_click;
  }

  let formatedValue = '';
  let colors = { backgroundColor: '#FFF', color: '#000' };
  switch (field) {
    case 'request':
      if (dateStats && dateStats.stats.request) {
        formatedValue = formatInteger(dateStats.stats.request);
        colors = getValueColors(content.totalStats.request / dates.length, dateStats.stats.request);
      }
      break;
    case 'unique_open':
      if (dateStats && dateStats.stats.request) {
        formatedValue = formatInteger(dateStats ? dateStats.stats.unique_open : 0);
        colors = getValueColors(content.totalStats.unique_open / dates.length, dateStats ? dateStats.stats.unique_open : 0);
      }
      break;
    case 'unique_click':
      if (dateStats && dateStats.stats.unique_click) {
        formatedValue = formatInteger(dateStats ? dateStats.stats.unique_click : 0);
        colors = getValueColors(content.totalStats.unique_click / dates.length, dateStats ? dateStats.stats.unique_click : 0);
      }
      break;
    case 'unique_click_rate':
      if (dateStats && dateStats.stats.request) {
        let value = calculatePercent(dateStats.stats.unique_click ?? 0, dateStats.stats.request);
        formatedValue = formatPercent(value);
        colors = getValueColors(1, value);
      }
      break;
    case 'unique_open_rate':
      if (dateStats && dateStats.stats.request) {
        let value = calculatePercent(dateStats.stats.unique_open ?? 0, dateStats.stats.request);
        formatedValue = formatPercent(value);
        colors = getValueColors(10, value);
      }
      break;
    case 'manualIncome':
      if (income) {
        formatedValue = formatIncome(income.estimatedIncome);
        colors = getValueColors(content.totalStats.manualIncome / dates.length, income && income.estimatedIncome ? income.estimatedIncome : 0);
      } else if (dateStats && dateStats.stats.request) {
        formatedValue = '?';
        colors = getValueColors(100, 0);
      }

      break;
    case IncomeFields.recordedIncome:
      if (income) {
        formatedValue = formatIncome(income.recordedIncome);
        colors = getValueColors(content.totalStats.recordedIncome / dates.length, income && income.recordedIncome ? income.recordedIncome : 0);
      } else if (dateStats && dateStats.stats.request) {
        formatedValue = '?';
        colors = getValueColors(100, 0);
      }

      break;
    case 'estimatedIncome':
      if (estimatedIncome !== null) {
        formatedValue = formatIncome(estimatedIncome);
        colors = getValueColors(content.totalStats.estimatedIncome / dates.length, estimatedIncome);
      }

      break;

    case 'eCpm':
      if (eCpm !== null) {
        formatedValue = formatIncome(eCpm);
        colors = getValueColors(content.totalStats.eCpm, eCpm);
      }
      break;
    case 'cpc':
      if (cpc !== null) {
        formatedValue = formatIncome(cpc);
        colors = getValueColors(content.totalStats.cpc, cpc);
      }
      break;
    default:
      break;
  }

  return (
    <tr>
      <td style={IncomeTdStyle}>
        <div
          style={{
            ...colors,
            width: '78px',
            padding: '1px 2px',
            cursor: field === IncomeFields.manualIncome || field == IncomeFields.recordedIncome ? 'pointer' : 'default'
          }}
          onClick={
            field === IncomeFields.manualIncome || field == IncomeFields.recordedIncome
              ? () => {
                  setShowIncomeModal(true);
                  return false;
                }
              : () => {}
          }
        >
          {formatedValue}
          {formatedValue === '' && <span>&nbsp;</span>}
        </div>
        {(field === IncomeFields.manualIncome || field == IncomeFields.recordedIncome) && showIncomeModal && (
          <IncomeCreateModal
            show={showIncomeModal}
            toggle={() => {
              setShowIncomeModal(false);
            }}
            content={content}
            stats={dateStats && dateStats.stats ? dateStats.stats : null}
            date={date}
            income={income}
            existingIncome={lastIncome}
            onSave={refetchIncomes}
          />
        )}
      </td>
    </tr>
  );
};
