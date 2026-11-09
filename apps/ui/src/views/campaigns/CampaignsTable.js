import { CLink, CSpinner } from '@coreui/react';
import React from 'react';
import { useSelector } from 'react-redux';

import { calculatePercent, formatPercent, formatInteger } from '../util';
import { getEstimateOpeners } from '../database/sendings/deliv/delivKpis';

export const CampaignsFields = {
  isActive: 'isActive',
  id: 'id',
  name: 'name',
  request: 'request',
  openers: 'openers',
  unique_click: 'unique_click',
  unsub: 'unsub',
  bounces: 'bounces',
  databases: 'databases'
};

export const rateFields = [CampaignsFields.openers, CampaignsFields.unique_click, CampaignsFields.unsub, CampaignsFields.bounces];

const LABELS = {
  [CampaignsFields.isActive]: 'Active',
  [CampaignsFields.id]: 'ID',
  [CampaignsFields.name]: 'Name',
  [CampaignsFields.request]: 'Requests',
  [CampaignsFields.openers]: 'Opens',
  [CampaignsFields.unique_click]: 'Clicks',
  [CampaignsFields.unsub]: 'Unsubs',
  [CampaignsFields.bounces]: 'Bounces',
  [CampaignsFields.databases]: 'Databases'
};

export const CampaignsTable = ({ fields, campaigns, loading, forceUpdate, sortField, setSortField, sortOrder, setSortOrder, statusFilter }) => {
  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  if (!fields) {
    fields = Object.values(CampaignsFields);
  }

  const handleSorting = (sortField, sortOrder) => {
    let multiplicator = sortOrder === 'desc' ? -1 : 1;
    if (rateFields.includes(sortField)) {
      sortedCampaigns.sort((a, b) => multiplicator * (getRateValueFromCampaign(sortField, a) - getRateValueFromCampaign(sortField, b)));
    } else if (sortField === CampaignsFields.name) {
      sortedCampaigns.sort(
        (a, b) => multiplicator * getValueFromCampaign(sortField, a, emailingDatabases).toLowerCase().localeCompare(getValueFromCampaign(sortField, b, emailingDatabases).toLowerCase())
      );
    } else {
      sortedCampaigns.sort((a, b) => multiplicator * (getValueFromCampaign(sortField, a, emailingDatabases) - getValueFromCampaign(sortField, b, emailingDatabases)));
    }
  };

  const handleFiltering = (statusFilter) => {
    if (statusFilter === 'activ') {
      sortedCampaigns = sortedCampaigns.filter((campaign) => campaign.isActive);
    }
    if (statusFilter === 'inactiv') {
      sortedCampaigns = sortedCampaigns.filter((campaign) => !campaign.isActive);
    }
  };

  const handleSortingChange = (clickedColumn) => {
    const newSortOrder = clickedColumn === sortField && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(clickedColumn);
    setSortOrder(newSortOrder);
  };

  var sortedCampaigns = campaigns ? [...campaigns] : [];
  if (!loading && campaigns && campaigns.length > 1) {
    handleFiltering(statusFilter);
    handleSorting(sortField, sortOrder);
  }

  const getKey = (campaign) => {
    return campaign.id;
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
            {sortedCampaigns.map((campaign) => {
              return (
                <tr key={getKey(campaign)}>
                  {fields.map((field) => {
                    return (
                      <td key={field}>
                        <CampaignsTd field={field} campaign={campaign} forceUpdate={forceUpdate} emailingDatabases={emailingDatabases} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </>
  );
};

const CampaignsTd = ({ campaign, field, emailingDatabases }) => {
  switch (field) {
    case CampaignsFields.id:
      return <span>#{getValueFromCampaign(field, campaign)}</span>;
    case CampaignsFields.databases:
      return <span>{getValueFromCampaign(field, campaign, emailingDatabases)}</span>;
    case CampaignsFields.name:
      return (
        <span>
          <CLink to={`/campaigns/list/${campaign.id}`}>{getValueFromCampaign(field, campaign)}</CLink>
        </span>
      );
    case CampaignsFields.request:
      return <span>{formatInteger(getValueFromCampaign(field, campaign))}</span>;

    case CampaignsFields.openers:
      return (
        <span className="text-info">
          {campaign.deliv_stats?.request ? formatPercent(getRateValueFromCampaign(field, campaign)) : '0'}
          {campaign?.deliv_stats?.request ? <small className="text-muted">{' (' + formatInteger(getValueFromCampaign(field, campaign)) + ')'}</small> : <></>}
        </span>
      );

    case CampaignsFields.unique_click:
      return (
        <span className="text-success">
          {campaign?.deliv_stats?.request ? formatPercent(getRateValueFromCampaign(field, campaign)) : '0'}
          <small className="text-muted">{campaign?.deliv_stats?.request ? ' (' + formatInteger(getValueFromCampaign(field, campaign)) + ')' : <></>}</small>
        </span>
      );
    case CampaignsFields.unsub:
      return (
        <span className="text-warning">
          {campaign?.deliv_stats?.request ? formatPercent(getRateValueFromCampaign(field, campaign)) : '0'}
          <small className="text-muted">{campaign?.deliv_stats?.request && getValueFromCampaign(field, campaign) ? ' (' + formatInteger(getValueFromCampaign(field, campaign) + ')') : <></>}</small>
        </span>
      );
    case CampaignsFields.bounces:
      return (
        <span className="text-danger">
          {campaign?.deliv_stats?.request ? formatPercent(getRateValueFromCampaign(field, campaign)) : '0'}
          <small className="text-muted">{campaign.deliv_stats && campaign.deliv_stats.request ? ' (' + formatInteger(getValueFromCampaign(field, campaign)) + ')' : <></>}</small>
        </span>
      );

    default:
      return null;
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

function getValueFromCampaign(field, item, emailingDatabases) {
  switch (field) {
    case CampaignsFields.id:
      return item.id;
    case CampaignsFields.isActive:
      return item.isActive;
    case CampaignsFields.name:
      return item.name;
    case CampaignsFields.request:
      return item.deliv_stats ? item.deliv_stats.request : 0;
    case CampaignsFields.openers:
      return item.deliv_stats ? getEstimateOpeners(item.deliv_stats) : 0;
    case CampaignsFields.unique_click:
      return item.deliv_stats ? item.deliv_stats.unique_click : 0;
    case CampaignsFields.unsub:
      return item.deliv_stats ? item.deliv_stats.unsub : 0;
    case CampaignsFields.bounces:
      return item.deliv_stats ? item.deliv_stats.soft_bounce + item.deliv_stats.hard_bounce : 0;
    case CampaignsFields.databases:
      return item.contents && emailingDatabases
        ? item.contents.map((content) => emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === content.emailing_database_uid).name).join(', ')
        : '';
    default:
      return '';
  }
}

function getRateValueFromCampaign(field, item) {
  switch (field) {
    case CampaignsFields.openers:
      return item.deliv_stats && item.deliv_stats.request ? calculatePercent(getEstimateOpeners(item.deliv_stats), item.deliv_stats.request) : 0;
    case CampaignsFields.unique_click:
      return item.deliv_stats && item.deliv_stats.request ? calculatePercent(item.deliv_stats.unique_click, item.deliv_stats.request) : 0;
    case CampaignsFields.unsub:
      return item.deliv_stats && item.deliv_stats.request ? calculatePercent(item.deliv_stats.unsub, item.deliv_stats.request) : 0;
    case CampaignsFields.bounces:
      return item.deliv_stats && item.deliv_stats.request ? calculatePercent(item.deliv_stats.soft_bounce + item.deliv_stats.hard_bounce, item.deliv_stats.request) : 0;
    default:
      return '';
  }
}
