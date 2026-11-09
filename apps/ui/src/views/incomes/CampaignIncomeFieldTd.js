import React, { useState } from 'react';

import { IncomeFields } from '../database/contents/incomes/IncomeFields';
import { formatIncome, getValueColors } from '../common/util';
import { calculatePercent, formatInteger, formatPercent } from '../util';
import IncomeTdStyle from '../database/contents/incomes/IncomeTdStyle';
import CampaignIncomeCreateModal from './CampaignIncomeCreateModal';

export default ({ field, dateStats, content, date, dates, refetchIncomes }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  let estimatedIncome = dateStats ? dateStats.stats.estimatedIncome : null;
  let manualIncome = dateStats ? dateStats.stats.manualIncome : null;
  let recordedIncome = dateStats ? dateStats.stats.recordedIncome : null;

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
      if (dateStats && dateStats.hasOneIncome && manualIncome !== null) {
        formatedValue = formatIncome(manualIncome);
        colors = dateStats.missingIncome ? getValueColors(100, 0) : getValueColors(1, 100);
        if (dateStats.missingIncome) {
          formatedValue = `? ${formatedValue}`;
        }
      } else if (dateStats && dateStats.stats.request > 0) {
        formatedValue = '?';
        colors = getValueColors(100, 0);
      }

      break;
    case IncomeFields.recordedIncome:
      if (dateStats && dateStats.hasOneIncome && recordedIncome !== null) {
        formatedValue = formatIncome(recordedIncome);
        colors = dateStats.missingIncome ? getValueColors(100, 0) : getValueColors(1, 100);
        if (dateStats.missingIncome) {
          formatedValue = `? ${formatedValue}`;
        }
      } else if (dateStats && dateStats.stats.request > 0) {
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
          <CampaignIncomeCreateModal
            show={showIncomeModal}
            toggle={() => {
              setShowIncomeModal(false);
            }}
            campaign={content}
            date={date}
            onSave={refetchIncomes}
            minDate={dates[dates.length - 1]}
            maxDate={dates[0]}
          />
        )}
      </td>
    </tr>
  );
};
