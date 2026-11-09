import { CLink, CSpinner, CTooltip } from '@coreui/react';
import React, { useContext } from 'react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { calculatePercent, formatPercent, formatInteger } from '../../../util';
import { getEstimateOpeners } from '../../sendings/deliv/delivKpis';
import Switch from 'react-switch';
import { UPDATE_CONTENT } from '../../../../services/DatabaseQuery';
import { toast } from 'react-toastify';
import ClipboardElement from '../../../common/ClipboardElement';
import moment from 'moment-timezone';

export const StatsInstanceFields = {
  isActive: 'isActive',
  id: 'id',
  name: 'name',
  request: 'request',
  openers: 'openers',
  unique_click: 'unique_click',
  unsub: 'unsub',
  bounces: 'bounces',
  database: 'database',
  subject: 'subject',
  senderName: 'senderName',
  startDate: 'startDate'
};

export const rateFields = [StatsInstanceFields.openers, StatsInstanceFields.unique_click, StatsInstanceFields.unsub, StatsInstanceFields.bounces];

const LABELS = {
  [StatsInstanceFields.isActive]: 'Active',
  [StatsInstanceFields.id]: 'ID',
  [StatsInstanceFields.name]: 'Name',
  [StatsInstanceFields.request]: 'Requests',
  [StatsInstanceFields.openers]: 'Opens',
  [StatsInstanceFields.unique_click]: 'Clicks',
  [StatsInstanceFields.unsub]: 'Unsubs',
  [StatsInstanceFields.bounces]: 'Bounces',
  [StatsInstanceFields.database]: 'Database',
  [StatsInstanceFields.subject]: 'Subject',
  [StatsInstanceFields.senderName]: 'SenderName',
  [StatsInstanceFields.startDate]: 'Start Date'
};

export const StatsInstanceTable = ({ fields, statsContents, loading, forceUpdate, sortField, setSortField, sortOrder, setSortOrder, showTotal, statusFilter }) => {
  const handleSorting = (sortField, sortOrder) => {
    let multiplicator = sortOrder === 'desc' ? -1 : 1;
    if (rateFields.includes(sortField)) {
      sortedStatContents.sort((a, b) => multiplicator * (getValueFromStatContentRate(sortField, a) - getValueFromStatContentRate(sortField, b)));
    } else if (sortField === StatsInstanceFields.name || sortField === StatsInstanceFields.database) {
      sortedStatContents.sort((a, b) => multiplicator * getValueFromStatContent(sortField, a).toLowerCase().localeCompare(getValueFromStatContent(sortField, b).toLowerCase()));
    } else {
      sortedStatContents.sort((a, b) => multiplicator * (getValueFromStatContent(sortField, a) - getValueFromStatContent(sortField, b)));
    }
  };

  const handleFiltering = (statusFilter) => {
    if (statusFilter === 'activ') {
      sortedStatContents = sortedStatContents.filter((content) => content.dimension.object.isActive);
    }
    if (statusFilter === 'inactiv') {
      sortedStatContents = sortedStatContents.filter((content) => !content.dimension.object.isActive);
    }
  };

  const handleSortingChange = (clickedColumn) => {
    const newSortOrder = clickedColumn === sortField && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(clickedColumn);
    setSortOrder(newSortOrder);
  };

  var sortedStatContents = [...statsContents].filter((statContentObj) => statContentObj.dimension);
  if (!loading && statsContents.length > 0) {
    handleFiltering(statusFilter);
    handleSorting(sortField, sortOrder);
  }

  const getKey = (statContent) => {
    return statContent.database ? statContent.dimension.id + statContent.database.uid : statContent.dimension.id;
  };

  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr>
            {fields.map((field, index) => {
              return (
                <th key={index} onClick={() => handleSortingChange(field)} style={{ cursor: 'pointer' }}>
                  {LABELS[field]}
                  {PrintArrow(field, sortField, sortOrder)}
                </th>
              );
            })}
            <th>
              {sortedStatContents && sortedStatContents.length > 0 && (
                <CTooltip content="copy to clipboard">
                  <span className="d-inline-block">
                    <ClipboardElement markup={copyStatsContents(sortedStatContents, fields)} className="pr-2" onClick={() => {}}>
                      <i className="fas fa-clipboard" style={{ cursor: 'pointer' }}></i>
                    </ClipboardElement>
                  </span>
                </CTooltip>
              )}
            </th>
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={fields.length}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && (
          <tbody>
            {sortedStatContents.map((statContent) => {
              return (
                <tr key={getKey(statContent)}>
                  {fields.map((field) => {
                    return (
                      <td key={field}>
                        <StatContentTd field={field} statContent={statContent} forceUpdate={forceUpdate} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        )}
        {!loading && showTotal && sortedStatContents && (
          <tbody>
            <tr className="font-weight-bold" key="total">
              <td colSpan={fields.length - 5}>TOTAL</td>
              {fields
                .filter(
                  (field) =>
                    field !== StatsInstanceFields.database &&
                    field !== StatsInstanceFields.name &&
                    field !== StatsInstanceFields.id &&
                    field !== StatsInstanceFields.isActive &&
                    field !== StatsInstanceFields.senderName &&
                    field !== StatsInstanceFields.subject &&
                    field !== StatsInstanceFields.startDate
                )
                .map((field) => {
                  if (rateFields.includes(field)) {
                    return (
                      <td key={field}>
                        {formatPercent(calculatePercent(GetTotal(field, sortedStatContents), GetTotal(StatsInstanceFields.request, sortedStatContents)))}
                        <small className="text-muted">{' (' + formatInteger(GetTotal(field, sortedStatContents)) + ')'}</small>
                      </td>
                    );
                  } else {
                    return <td key={field}>{formatInteger(GetTotal(field, sortedStatContents))}</td>;
                  }
                })}
            </tr>
          </tbody>
        )}
      </table>
    </>
  );
};

const GetTotal = (field, sortedStatContents) => {
  return sortedStatContents.map((stat) => getValueFromStatContent(field, stat)).reduce((a, b) => a + b, 0);
};

const StatContentTd = ({ statContent, field, forceUpdate }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  switch (field) {
    case StatsInstanceFields.isActive:
      return (
        <span>
          <Switch
            onChange={(checked) => {
              updateStatContent(emailingDatabaseApiContext, { isActive: checked, id: statContent.dimension.id }, checked ? 'Content is enabled' : 'Content is disabled', forceUpdate);
            }}
            checked={statContent.dimension.object.isActive}
            disabled={!canActivateContent(statContent)}
            uncheckedIcon={false}
            checkedIcon={false}
            height={18}
            width={35}
          />
        </span>
      );
    case StatsInstanceFields.id:
      return <span>#{getValueFromStatContent(field, statContent)}</span>;
    case StatsInstanceFields.startDate:
      return <span>{moment(getValueFromStatContent(field, statContent))?.format('YYYY/MM/DD') ?? ''}</span>;
    case StatsInstanceFields.name:
      return (
        <span>
          <CLink to={`/${emailingDatabaseApiContext ? emailingDatabaseApiContext.getUid() : statContent.database.uid}/contents/list/${statContent.dimension.id}`}>
            {getValueFromStatContent(field, statContent)}
          </CLink>
        </span>
      );
    case StatsInstanceFields.subject:
    case StatsInstanceFields.senderName:
      return (
        <span>
          <CLink to={`/${emailingDatabaseApiContext ? emailingDatabaseApiContext.getUid() : statContent.database.uid}/contents/list/${statContent.dimension.object.contentId}`}>
            {getValueFromStatContent(field, statContent)}
          </CLink>
        </span>
      );
    case StatsInstanceFields.database:
      return <span>{getValueFromStatContent(field, statContent)}</span>;
    case StatsInstanceFields.request:
      return <span>{formatInteger(getValueFromStatContent(field, statContent))}</span>;

    case StatsInstanceFields.openers:
      return (
        <span className="text-info">
          {statContent.totalStats && statContent.totalStats.request && formatPercent(getValueFromStatContentRate(field, statContent))}
          {statContent.totalStats && statContent.totalStats.request && <small className="text-muted">{' (' + formatInteger(getValueFromStatContent(field, statContent)) + ')'}</small>}
        </span>
      );

    case StatsInstanceFields.unique_click:
      return (
        <span className="text-success">
          {statContent.totalStats && statContent.totalStats.request && formatPercent(getValueFromStatContentRate(field, statContent))}
          <small className="text-muted">{statContent.totalStats && statContent.totalStats.request && ' (' + formatInteger(getValueFromStatContent(field, statContent)) + ')'}</small>
        </span>
      );
    case StatsInstanceFields.unsub:
      return (
        <span className="text-warning">
          {statContent.totalStats && statContent.totalStats.request && formatPercent(getValueFromStatContentRate(field, statContent))}
          {statContent.totalStats && statContent.totalStats.request && <small className="text-muted">{' (' + formatInteger(getValueFromStatContent(field, statContent)) + ')'}</small>}
        </span>
      );
    case StatsInstanceFields.bounces:
      return (
        <span className="text-danger">
          {statContent.totalStats && statContent.totalStats.request && formatPercent(getValueFromStatContentRate(field, statContent))}
          {statContent.totalStats && statContent.totalStats.request && (
            <small className="text-muted">{statContent.totalStats && statContent.totalStats.request && ' (' + formatInteger(getValueFromStatContent(field, statContent)) + ')'}</small>
          )}
        </span>
      );

    default:
      return null;
  }
};

const canActivateContent = (statContent) => {
  return statContent != null && statContent.dimension != null && statContent.dimension.object != null;
};

const updateStatContent = async (emailingDatabaseApiContext, jsonObject, message, forceUpdate) => {
  try {
    let result = await emailingDatabaseApiContext.doQuery({
      query: UPDATE_CONTENT,
      variables: {
        content: jsonObject
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.updateContent) {
      toast.success(message, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
    }
  } catch (err) {
    console.error(err);
    toast.error('Failed to update content', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
};

function PrintArrow(columnName, sortField, sortOrder) {
  if (columnName === sortField) {
    if (sortOrder === 'desc') {
      return <i className="fas fa-sort-down ml-1"></i>;
    } else {
      return <i className="fas fa-sort-up ml-1"></i>;
    }
  }
}

function getValueFromStatContent(field, item) {
  switch (field) {
    case StatsInstanceFields.id:
      return item.dimension && item.dimension.id;
    case StatsInstanceFields.isActive:
      return item.dimension && item.dimension.object.isActive;
    case StatsInstanceFields.name:
      return item.dimension && item.dimension.object.name;
    case StatsInstanceFields.startDate:
      return item.dimension && item.dimension.object.startDate;
    case StatsInstanceFields.subject:
      return item.dimension && item.dimension.object.subject;
    case StatsInstanceFields.senderName:
      return item.dimension && item.dimension.object.senderName;
    case StatsInstanceFields.database:
      return item.database.name;
    case StatsInstanceFields.request:
      return item.totalStats ? item.totalStats.request : 0;
    case StatsInstanceFields.openers:
      return item.totalStats ? getEstimateOpeners(item.totalStats) : 0;
    case StatsInstanceFields.unique_click:
      return item.totalStats ? item.totalStats.unique_click : 0;
    case StatsInstanceFields.unsub:
      return item.totalStats ? item.totalStats.unsub : 0;
    case StatsInstanceFields.bounces:
      return item.totalStats ? item.totalStats.soft_bounce + item.totalStats.hard_bounce : 0;
    default:
      return '';
  }
}

function getValueFromStatContentRate(field, item) {
  switch (field) {
    case StatsInstanceFields.openers:
      return item.totalStats && item.totalStats.request ? calculatePercent(getEstimateOpeners(item.totalStats), item.totalStats.request) : 0;
    case StatsInstanceFields.unique_click:
      return item.totalStats && item.totalStats.request ? calculatePercent(item.totalStats.unique_click, item.totalStats.request) : 0;
    case StatsInstanceFields.unsub:
      return item.totalStats && item.totalStats.request ? calculatePercent(item.totalStats.unsub, item.totalStats.request) : 0;
    case StatsInstanceFields.bounces:
      return item.totalStats && item.totalStats.request ? calculatePercent(item.totalStats.soft_bounce + item.totalStats.hard_bounce, item.totalStats.request) : 0;
    default:
      return '';
  }
}

const copyStatsContents = (siteStats, fieldsToExtract) => {
  var copyText = '<table>';
  copyText += '<tr>';
  for (let field of fieldsToExtract) {
    appendTableDataCellElement(LABELS[field]);

    if (rateFields.includes(field)) {
      appendTableDataCellElement(LABELS[field].slice(0, -1) + ' Rate (%)');
    }
  }
  copyText += '</tr>';
  for (let statContent of siteStats) {
    copyText += '<tr>';
    for (let field of fieldsToExtract) {
      appendTableDataCellElement(getValueFromStatContent(field, statContent));
      if (rateFields.includes(field)) {
        appendTableDataCellElement(getValueFromStatContentRate(field, statContent));
      }
    }
    copyText += '</tr>';
  }
  copyText += '</table>';
  return copyText;

  function appendTableDataCellElement(valueToAppend) {
    copyText += '<td>';
    copyText += valueToAppend;
    copyText += '</td>';
  }
};
