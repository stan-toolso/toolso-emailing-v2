import React, { useCallback, useContext, useState } from 'react';

import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CTabs } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import RangeDatePicker from '../../../common/RangeDatePicker';
import moment from 'moment-timezone';
import { formatInteger } from '../../../common/util';
import ContactStatsTable from './ContactStatsTable';
import ContactStatsHistoricalGraphByStatus from './ContactStatsHistoricalGraphByStatus';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import ContactStatsByDimensions from './ContactStatsByDimensions';

export const FIELDS = {
  total: 'total',
  workable: 'workable',
  new: 'new',
  unsub: 'unsub',
  complaint: 'complaint',
  hard_bounce: 'hard_bounce',
  archived: 'archived'
};

const LABELS = {
  [FIELDS.total]: 'Total',
  [FIELDS.workable]: 'Workable',
  [FIELDS.new]: 'New',
  [FIELDS.unsub]: 'Unsub',
  [FIELDS.complaint]: 'Complaint',
  [FIELDS.archived]: 'Archived',
  [FIELDS.hard_bounce]: 'Hard bounce'
};

const sections = ['', 'byDimensions'];

export default ({ match }) => {
  const section = match.params.section;
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [active, setActive] = useState(sections.indexOf(section ? section : ''));
  const history = useHistory();

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/stats/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  const { loading, data } = useQuery(
    gql`
      query contactStats($fromDate: String!, $toDate: String!) {
        contactStats(fromDate: $fromDate, toDate: $toDate) {
          id
          date
          stats
        }
      }
    `,
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null
      },
      skip: !fromDate || !toDate || section
    }
  );

  const dates = [];
  var currentDate = moment(fromDate);
  while (currentDate <= toDate) {
    dates.unshift(moment(currentDate));
    currentDate.add(1, 'days');
  }

  let statsByDates = {};
  if (data && data.contactStats) {
    for (let item of data.contactStats) {
      statsByDates[item.date] = item.stats;
    }
  }

  return (
    <>
      <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
        <CNav variant="tabs">
          <CNavItem>
            <CNavLink>
              <i className="fas fa-tachometer-alt"></i>
              &nbsp; By Status
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink>
              <i className="fas fa-table"></i>
              &nbsp; By Dimensions
            </CNavLink>
          </CNavItem>
        </CNav>
        <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
          <CTabPane>
            <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last20Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />

            <ContactStatsTable dates={dates} loading={loading} statsByDates={statsByDates} />
            <ContactStatsHistoricalGraphByStatus dates={dates} loading={loading} statsByDates={statsByDates} />
          </CTabPane>
          <CTabPane>
            <ContactStatsByDimensions />
          </CTabPane>
        </CTabContent>
      </CTabs>
    </>
  );
};

export const FieldRow = ({ field, dates, statsByDates }) => {
  return (
    <tr>
      <td>
        <div style={{ width: '200px', padding: '1px 2px' }}>{LABELS[field]}</div>
      </td>
      {dates.map((date) => {
        let { formatedValue } = extractStatsValue(statsByDates, field, date);
        return (
          <td className="text-left" key={date}>
            <div style={{ width: '66px', padding: '1px 2px' }}>{formatedValue} </div>
          </td>
        );
      })}
    </tr>
  );
};

const extractStatsValue = (statsByDates, field, date) => {
  let formatedValue = '';
  let formatedDate = date.format('YYYY-MM-DD');
  if (formatedDate in statsByDates) {
    let stats = statsByDates[formatedDate];
    switch (field) {
      case FIELDS.workable:
        formatedValue = stats.contactByStatus && 'workable' in stats.contactByStatus ? formatInteger(stats.contactByStatus.workable) : '';
        break;
      case FIELDS.new:
        formatedValue = stats.contactByStatus && 'new' in stats.contactByStatus ? formatInteger(stats.contactByStatus.new) : '';
        break;
      case FIELDS.total:
        formatedValue = 'count' in stats ? formatInteger(stats.count) : '';
        break;
      case FIELDS.complaint:
        formatedValue = stats.contactByStatus && 'complaint' in stats.contactByStatus ? formatInteger(stats.contactByStatus.complaint) : '';
        break;
      case FIELDS.unsub:
        formatedValue = stats.contactByStatus && 'unsub' in stats.contactByStatus ? formatInteger(stats.contactByStatus.unsub) : '';
        break;

      case FIELDS.hard_bounce:
        formatedValue = stats.contactByStatus && 'hard_bounce' in stats.contactByStatus ? formatInteger(stats.contactByStatus.hard_bounce) : '';
        break;

      case FIELDS.archived:
        formatedValue = stats.contactByStatus && 'archived' in stats.contactByStatus ? formatInteger(stats.contactByStatus.archived) : '';
        break;

      default:
        break;
    }
  }

  return { formatedValue };
};
