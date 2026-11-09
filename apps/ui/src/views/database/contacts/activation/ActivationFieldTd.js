import React from 'react';
import { calculateAndFormatPercent, calculatePercent, formatInteger, formatPercent, getValueColors } from '../../../common/util';
import { ActivationFields } from './ActivationFields';
import ActivationTdStyle from './ActivationTdStyle';

export default ({ field, activationStats, rowStats, statsDivStyle = { width: '78px', padding: '1px 2px' } }) => {
  let formatedValue = '';
  let colors = { backgroundColor: 'transparent', color: '#000' };
  if (activationStats) {
    switch (field) {
      case ActivationFields.request4AndMoreAttempt:
        formatedValue = formatInteger(
          (activationStats[ActivationFields.request] ?? 0) -
            (activationStats[ActivationFields.request0Attempt] ?? 0) -
            (activationStats[ActivationFields.request1Attempt] ?? 0) -
            (activationStats[ActivationFields.request2Attempt] ?? 0) -
            (activationStats[ActivationFields.request3Attempt] ?? 0)
        );
        break;
      case ActivationFields.unique_open_rate:
        if (activationStats[ActivationFields.request]) {
          let openRate = calculatePercent(activationStats[ActivationFields.unique_open] ?? 0, activationStats[ActivationFields.request]);
          colors = getValueColors(10, openRate);
          formatedValue = formatPercent(openRate);
        }
        break;

      case ActivationFields.unique_click_rate:
        if (activationStats[ActivationFields.request]) {
          formatedValue = calculateAndFormatPercent(activationStats[ActivationFields.unique_click] ?? 0, activationStats[ActivationFields.request]);
        }
        break;
      case ActivationFields.unsub_rate:
        if (activationStats[ActivationFields.unique_open]) {
          formatedValue = calculateAndFormatPercent(activationStats[ActivationFields.unsub] ?? 0, activationStats[ActivationFields.unique_open]);
        }
        break;
      case ActivationFields.complaint_rate:
        if (activationStats[ActivationFields.unique_open]) {
          formatedValue = calculateAndFormatPercent(activationStats[ActivationFields.complaint] ?? 0, activationStats[ActivationFields.unique_open]);
        }
        break;

      case ActivationFields.request:
        if (rowStats) {
          let refValue = rowStats.reduce((acc, row) => {
            return acc + (row[field] ?? 0);
          }, 0);
          colors = getValueColors(refValue / rowStats.length, activationStats[field]);
        }
        formatedValue = formatInteger(activationStats[field]);
        if (activationStats.newsStats && activationStats.newsStats.count) {
          formatedValue += ` (/${formatInteger(activationStats.newsStats.count)})`;
        }
        break;

      default:
        if (rowStats) {
          let refValue = rowStats.reduce((acc, row) => {
            return acc + (row[field] ?? 0);
          }, 0);
          colors = getValueColors(refValue / rowStats.length, activationStats[field]);
        }
        formatedValue = formatInteger(activationStats[field]);
        break;
    }
    [0, 1, 2, 3].forEach((i) => {
      if (field === ActivationFields[`request${i}Attempt`] && activationStats.newsStats && activationStats.newsStats.attempts) {
        formatedValue += ` (/${formatInteger(activationStats.newsStats.attempts[`${i}`] ?? 0)})`;
      }
    });
  }

  return (
    <td style={{ ...ActivationTdStyle }}>
      <div
        style={{
          ...statsDivStyle,
          ...colors
        }}
      >
        {formatedValue} {formatedValue === '' && <span>&nbsp;</span>}
      </div>
    </td>
  );
};
