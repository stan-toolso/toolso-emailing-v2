import React from 'react';
import { formatIncome, formatInteger, getValueColors } from '../../../common/util';
import { calculatePercent, formatPercent } from '../../../util';
import IncomeTdStyle from './IncomeTdStyle';

export default ({ field, totalStats, refStats, dates }) => {
  let formatedValue = '';

  let colors = { backgroundColor: '#FFF', color: '#000' };
  if (totalStats) {
    switch (field) {
      case 'request':
        formatedValue = formatInteger(totalStats.request);
        if (refStats) {
          colors = getValueColors(refStats.request / dates.length, totalStats.request);
        }
        break;
      case 'unique_open':
        formatedValue = formatInteger(totalStats.unique_open);
        if (refStats) {
          colors = getValueColors(refStats.unique_open / dates.length, totalStats.unique_open);
        }
        break;
      case 'unique_click':
        formatedValue = formatInteger(totalStats.unique_click);
        if (refStats) {
          colors = getValueColors(refStats.unique_click / dates.length, totalStats.unique_click);
        }
        break;

      case 'unique_click_rate':
        {
          let value = calculatePercent(totalStats.unique_click ?? 0, totalStats.request);
          formatedValue = formatPercent(value);
          colors = getValueColors(1, value);
        }

        break;
      case 'unique_open_rate':
        {
          let value = calculatePercent(totalStats.unique_open ?? 0, totalStats.request);
          formatedValue = formatPercent(value);
          colors = getValueColors(10, value);
        }
        break;

      case 'manualIncome':
        formatedValue = formatIncome(totalStats.manualIncome);
        if (refStats) {
          colors = getValueColors(refStats.manualIncome / dates.length, totalStats.manualIncome);
        }
        break;
      case 'estimatedIncome':
        formatedValue = formatIncome(totalStats.estimatedIncome);
        if (refStats) {
          colors = getValueColors(refStats.estimatedIncome / dates.length, totalStats.estimatedIncome);
        }
        break;
      case 'recordedIncome':
        formatedValue = formatIncome(totalStats.recordedIncome);
        if (refStats) {
          colors = getValueColors(refStats.recordedIncome / dates.length, totalStats.recordedIncome);
        }
        break;
      case 'eCpm':
        formatedValue = formatIncome(totalStats.eCpm);
        if (refStats) {
          colors = getValueColors(refStats.eCpm, totalStats.eCpm);
        }
        break;
      case 'cpc':
        formatedValue = formatIncome(totalStats.cpc);
        if (refStats) {
          colors = getValueColors(refStats.cpc, totalStats.cpc);
        }

        break;
      default:
        break;
    }
  }

  return (
    <tr>
      <td style={{ ...IncomeTdStyle, fontWeight: 'bold' }}>
        <div style={{ ...colors, width: '90px', padding: '1px 2px' }}>
          {formatedValue}
          {formatedValue === '' && <span>&nbsp;</span>}
        </div>
      </td>
    </tr>
  );
};
