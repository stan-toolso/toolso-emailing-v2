import React, { useContext, useState, useEffect } from 'react';

import RangeDatePicker from '../../../common/RangeDatePicker';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { gql, useQuery } from '@apollo/client';
import { CCardBody, CCardHeader, CFormGroup, CInput, CLabel, CLink, CSelect, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import { formatInteger, calculateAndFormatPercent, getValueColors, calculatePercent } from '../../../common/util';
import { appendStats } from '../../../common/StatsUtils';
import { canActivateContent, updateContent } from '../../contents/util';
import Switch from 'react-switch';
import { getQualityScore } from './delivKpis';
import { SubdimensionSelector } from './SubdimensionSelector';
import ContentIncome from '../../contents/incomes/ContentIncome';
import { AllContentTypes } from '../../contents/ContentsTypes';

const DELIV_STATS = gql`
  query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String, $filter: JSON) {
    dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType, filter: $filter) {
      fromDate
      toDate
      dimensionType
      filter
      totalStats {
        request
      }
      dimensionsStats {
        dimension {
          id
          label
          type
          object
        }
        totalStats {
          request
        }
        byDayStats {
          day
          stats {
            request
            unique_open
            open
            unique_click
            click
            delivered
            soft_bounce
            contact_bounce
            content_bounce
            hard_bounce
            complaint
            unsub
            proxy_loaded
            unique_proxy_loaded
            contact_scores
            unique_delivered
            click_validation_asked
            click_validation_checked
            unique_click_accepted
          }
        }
      }
    }
  }
`;

export const DIMENSIONS = {
  schedule: { label: 'Schedule', value: 'schedule' },
  esp: { label: 'Esp', value: 'esp' },
  content: { label: 'Content', value: 'content' },
  sender: { label: 'Sender', value: 'sender' },
  ip: { label: 'IPAddress', value: 'ip' },
  source: { label: 'Source', value: 'source' },
  contentVersion: { label: 'Version', value: 'contentVersion' },
  objectSender: { label: 'Subject/Sender', value: 'objectSender' }
};

const FIELDS = {
  unique_estimated_open_rate: { label: 'Unique Estimated Open Rate', value: 'unique_estimated_open_rate' },
  unique_open_rate: { label: 'Unique Open Rate', value: 'unique_open_rate' },
  unique_click_rate: { label: 'Unique Click Rate', value: 'unique_click_rate' },
  unique_open: { label: '# Unique Open', value: 'unique_open' },
  open: { label: '# Open', value: 'open' },
  unique_proxy_loaded: { label: '# Unique Proxy loaded', value: 'unique_proxy_loaded' },
  proxy_loaded: { label: '# Proxy loaded', value: 'proxy_loaded' },
  unique_click: { label: '# Unique Click', value: 'unique_click' },
  click: { label: '# Click', value: 'click' },
  request: { label: '# Requests', value: 'request' },
  delivered: { label: '# Delivered', value: 'delivered' },
  soft_bounce: { label: '# Soft Bounces', value: 'soft_bounce' },
  contact_bounce: { label: '# Contact Bounces', value: 'contact_bounce' },
  content_bounce: { label: '# Content Bounces', value: 'content_bounce' },
  hard_bounce: { label: '# Hard Bounces', value: 'hard_bounce' },
  complaint: { label: '# Complaints', value: 'complaint' },
  unsub: { label: '# Unsubs', value: 'unsub' },

  soft_bounce_rate: { label: 'Soft Bounces Rate', value: 'soft_bounce_rate' },
  contact_bounce_rate: { label: 'Contact Bounces Rate', value: 'contact_bounce_rate' },
  content_bounce_rate: { label: 'Content Bounces Rate', value: 'content_bounce_rate' },
  hard_bounce_rate: { label: 'Hard Bounces Rate', value: 'hard_bounce_rate' },

  unique_proxy_loaded_rate: { label: 'Unique Proxy loaded rate', value: 'unique_proxy_loaded_rate' },
  complaint_rate: { label: 'Complaint Rate', value: 'complaint_rate' },
  unsub_rate: { label: 'Unsub Rate', value: 'unsub_rate' },
  unsub_openers: { label: 'Unsub/Openers', value: 'unsub_openers' },
  contact_scores: { label: 'Contact Score', value: 'contact_scores' },
  quality_scores: { label: 'Quality Score', value: 'quality_scores' },
  unique_delivered: { label: '# Unique Delivered', value: 'unique_delivered' },
  click_validation_asked: { label: '# Click Validation Asked', value: 'click_validation_asked' },
  click_validation_checked: { label: '# Click Validation Checked', value: 'click_validation_checked' },
  unique_click_accepted: { label: '# Unique Click Accepted', value: 'unique_click_accepted' },
  unique_click_accepted_rate: { label: 'Unique Click Accepted Rate', value: 'unique_click_accepted_rate' },
  unique_click_accepted_ratio: { label: 'Unique Clicks Accepted/Unique Clicks', value: 'unique_click_accepted_ratio' },
  click_validation_ratio: { label: 'Clicks Checked/Asked', value: 'click_validation_ratio' }
};

export default ({ defaultFilter, defaultFromDate, defaultToDate, defaultDimension, showIncome = false }) => {
  const [name, setName] = useState('');
  const [fromDate, setFromDate] = useState(defaultFromDate ? defaultFromDate : null);
  const [toDate, setToDate] = useState(defaultToDate ? defaultToDate : null);

  const [dimensionType, setDimensionType] = useState(defaultDimension ? defaultDimension : 'schedule');
  const [field, setField] = useState('unique_estimated_open_rate');
  const [contentStats, setContentStats] = useState([]);
  const [type, setType] = useState('');

  const { loading, data } = useQuery(DELIV_STATS, {
    variables: {
      fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
      toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
      dimensionType,
      filter: defaultFilter ? defaultFilter : {}
    },
    skip: !fromDate || !toDate,
    fetchPolicy: 'no-cache'
  });

  const dates = [];
  var currentDate = moment(fromDate);
  while (currentDate <= toDate) {
    dates.unshift(moment(currentDate));
    currentDate.add(1, 'days');
  }

  let dimensionsStats = data
    ? data.dimensionDelivStats.dimensionsStats.sort((a, b) => {
        let aRequest = 0;
        let bRequest = 0;
        for (let item of a.byDayStats) {
          aRequest += item.stats?.request ? item.stats.request : 0;
        }
        for (let item of b.byDayStats) {
          bRequest += item.stats?.request ? item.stats.request : 0;
        }

        a.totalRequests = aRequest;
        b.totalRequests = bRequest;
        return aRequest < bRequest ? 1 : -1;
      })
    : [];
  dimensionsStats = dimensionsStats.filter((item) => {
    let label = item.dimension && item.dimension.label ? item.dimension.label : '';
    if (name && label.toLowerCase().indexOf(name.toLowerCase()) < 0) {
      return false;
    }

    if (dimensionType === 'content' && type && item.dimension && item.dimension.object && item.dimension.object.type !== type) {
      return false;
    }
    return true;
  });

  let { backgroundColor: totalBackgroundColor, color: totalColor, formatedValue: totalFormatedValue, stats: totalStats } = extractTotalStatsValue(dimensionsStats, null, field);

  const { data: contentIncomesData, refetch: refetchIncomes } = useQuery(
    gql`
      query contentIncomes($fromDate: String!, $toDate: String!, $filter: JSON) {
        contentIncomes(fromDate: $fromDate, toDate: $toDate, filter: $filter) {
          id
          date
          estimatedIncome
          recordedIncome
          validationRate
          type
          content {
            id
            name
            type
            incomesStats
          }
        }
      }
    `,
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
        filter: {
          contentId: defaultFilter?.content
        }
      },
      skip: (!defaultFilter?.content && showIncome) || !fromDate || !toDate,
      fetchPolicy: 'no-cache'
    }
  );

  useEffect(() => {
    if (!defaultFilter?.content && showIncome) {
      return;
    }
    let contentsById = {};

    if (contentIncomesData && contentIncomesData.contentIncomes) {
      for (let contentIncome of contentIncomesData.contentIncomes) {
        if (!contentIncome.content) {
          continue;
        }
        if (!(contentIncome.content.id in contentsById)) {
          contentsById[contentIncome.content.id] = {
            id: contentIncome.content.id,
            name: contentIncome.content.name,
            type: contentIncome.content.type,
            incomesStats: contentIncome.content.incomesStats,
            byDayStats: [],
            totalStats: {}
          };
        }
        let content = contentsById[contentIncome.content.id];

        let existingDay = content.byDayStats.find((d) => {
          return d.day === contentIncome.date;
        });
        if (!existingDay) {
          existingDay = { day: contentIncome.date, stats: {} };
          content.byDayStats.push(existingDay);
        }
        existingDay.income = contentIncome;
      }
    }

    for (let id in contentsById) {
      let content = contentsById[id];
      if (!('manualIncome' in content.totalStats)) {
        content.totalStats.manualIncome = 0;
      }
      if (!('estimatedIncome' in content.totalStats)) {
        content.totalStats.estimatedIncome = 0;
      }
      for (let day of content.byDayStats) {
        if (day.income) {
          content.totalStats.manualIncome += day.income.estimatedIncome;
          content.totalStats.estimatedIncome += day.income.estimatedIncome;
          day.stats.estimatedIncome = day.income.estimatedIncome;
          day.stats.manualIncome = day.income.estimatedIncome;
        } else {
          day.stats.estimatedIncome = null;
          if (content.incomesStats && content.incomesStats.last) {
            switch (content.incomesStats.last.type) {
              case 'unique_click':
                day.stats.estimatedIncome = (content.incomesStats.last.cpc ? content.incomesStats.last.cpc : 0) * (day.stats.unique_click ? day.stats.unique_click : 0);
                break;
              default:
              case 'request':
                day.stats.estimatedIncome = (content.incomesStats.last.eCpm ? content.incomesStats.last.eCpm / 1000 : 0) * (day.stats.unique_click ? day.stats.request : 0);
                break;
            }
          }
          if (day.stats.estimatedIncome) {
            content.totalStats.estimatedIncome += day.stats.estimatedIncome;
          }
        }
      }

      content.totalStats.eCpm = null;
      if (content.totalStats.request) {
        content.totalStats.eCpm = (1000 * content.totalStats.estimatedIncome) / content.totalStats.request;
      }
      content.totalStats.cpc = null;
      if (content.totalStats.unique_click) {
        content.totalStats.cpc = content.totalStats.estimatedIncome / content.totalStats.unique_click;
      }
    }
    setContentStats(Object.values(contentsById));
  }, [setContentStats, contentIncomesData, defaultFilter, showIncome]);

  return (
    <>
      <CCardHeader>
        <div className="d-flex ">
          <CFormGroup style={{ display: 'inline-block', margin: '0px 10px 0px 0px' }}>
            <CLabel htmlFor="dimensionType">Dimension</CLabel>
            <CSelect
              type="select"
              size="sm"
              value={dimensionType}
              id="dimensionType"
              name="dimensionType"
              style={{ width: '150px', margin: '0px 5px', display: 'inline-block' }}
              onChange={(event) => setDimensionType(event.target.value)}
            >
              {Object.values(DIMENSIONS).map((dimension, index) => {
                if (defaultFilter && dimension.value in defaultFilter) {
                  return null;
                }
                return (
                  <option key={index} value={dimension.value}>
                    {dimension.label}
                  </option>
                );
              })}
            </CSelect>
            {dimensionType === 'content' && (
              <CSelect
                style={{ width: '100px', margin: '0px 5px', display: 'inline-block' }}
                className="form-control mr-2"
                size="sm"
                onChange={(event) => {
                  setType(event.target.value);
                }}
                value={type}
                id="type"
                name="type"
              >
                {Object.keys(AllContentTypes).map((key) => {
                  return (
                    <option value={key} key={key}>
                      {AllContentTypes[key]}
                    </option>
                  );
                })}
              </CSelect>
            )}
          </CFormGroup>

          <CFormGroup style={{ display: 'inline-block', margin: '0px 15px 0px 0px' }}>
            <CSelect
              type="select"
              size="sm"
              value={field}
              id="field"
              name="field"
              style={{ width: '205px', margin: '0px 5px', display: 'inline-block' }}
              onChange={(event) => setField(event.target.value)}
            >
              {Object.values(FIELDS).map((item, index) => {
                return (
                  <option key={index} value={item.value}>
                    {item.label}
                  </option>
                );
              })}
            </CSelect>
          </CFormGroup>
          {!defaultFromDate && !defaultToDate && (
            <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
          )}
        </div>
      </CCardHeader>
      <CCardBody className="p-0">
        {loading && (
          <div style={{ textAlign: 'center', padding: '10px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}
        {!loading && data && (
          <>
            <div className="table-responsive" style={{ paddingBottom: '100px' }}>
              <table className="table table-sm m-0 stats-table table-bordered " style={{ minWidth: 401 + dates.length * 68 + 'px' }}>
                <thead>
                  <tr>
                    <th>
                      <div style={{ minWidth: '400px', padding: '0px' }}>
                        <CInput
                          value={name}
                          style={{ height: '20px', padding: '0px 3px', border: 'none' }}
                          placeholder="Search"
                          onChange={(event) => {
                            setName(event.target.value);
                          }}
                          className="form-control"
                          size="sm"
                        />
                      </div>
                    </th>
                    <th className="text-left">
                      <div style={{ width: '68px', padding: '1px 2px' }}>TOTAL</div>
                    </th>
                    {dates.map((date) => {
                      return (
                        <th className="text-left" key={date}>
                          <div style={{ width: '68px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    <th>
                      <div style={{ minWidth: '400px', padding: '1px 2px' }}>TOTAL ({formatInteger(totalStats.request)})</div>
                    </th>
                    <th className="text-left" style={{ borderRightWidth: '2px', borderLeftWidth: '2px' }}>
                      <div style={{ width: '68px', padding: '1px 2px', totalBackgroundColor, totalColor }}>
                        {totalStats ? (
                          <OverlayTrigger delay={{ show: 250, hide: 400 }} placement="left" overlay={getTooltip('Deliv stats', totalStats)}>
                            <span style={{ cursor: 'pointer' }}>{totalFormatedValue}</span>
                          </OverlayTrigger>
                        ) : null}
                      </div>
                    </th>

                    {dates.map((date) => {
                      let { backgroundColor, color, formatedValue, stats } = extractTotalStatsValue(dimensionsStats, date, field);
                      return (
                        <th className="text-left" key={date}>
                          <div style={{ width: '68px', padding: '1px 2px', backgroundColor, color }}>
                            {stats ? (
                              <OverlayTrigger delay={{ show: 250, hide: 400 }} placement="left" overlay={getTooltip('Deliv stats', stats)}>
                                <span style={{ cursor: 'pointer' }}>{formatedValue}</span>
                              </OverlayTrigger>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {dimensionsStats.map((item, index) => {
                    return <DelivStatsRow key={dimensionType + '_' + index} dates={dates} dimensionStats={item} field={field} filter={defaultFilter ? defaultFilter : {}} />;
                  })}
                </tbody>
              </table>
            </div>
            {showIncome && contentStats && contentStats[0] && (
              <div className="table-responsive" style={{ paddingBottom: '100px' }}>
                <table className="table table-sm m-0 stats-table table-bordered " style={{ minWidth: 401 + dates.length * 68 + 'px' }}>
                  <thead>
                    <tr>
                      <th>
                        <div style={{ minWidth: '400px', padding: '0px' }} />
                      </th>
                      <th className="text-left">
                        <div style={{ width: '68px', padding: '1px 2px' }}>TOTAL</div>
                      </th>
                      {dates.map((date) => {
                        return (
                          <th className="text-left" key={date}>
                            <div style={{ width: '68px', padding: '1px 2px' }}> {date.format('DD-MM-YY')}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    <ContentIncome fields={['manualIncome']} dates={dates} item={contentStats[0]} refetchIncomes={refetchIncomes} showContentName={false} />
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CCardBody>
    </>
  );
};

const DelivStatsRow = ({ dates, dimensionStats, field, filter }) => {
  const [subDimensionType, setSubDimensionType] = useState('');
  const [showFullLabel, setShowFullLabel] = useState(false);

  const [, setObjectToForceRefresh] = useState(null);

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  let subFilter = { ...filter, [dimensionStats.dimension ? dimensionStats.dimension.type : null]: dimensionStats.dimension ? dimensionStats.dimension.id : null };
  const { loading, data } = useQuery(DELIV_STATS, {
    variables: {
      fromDate: dates.length >= 1 ? dates[dates.length - 1].format('YYYY-MM-DD') : null,
      toDate: dates.length >= 1 ? dates[0].format('YYYY-MM-DD') : null,
      dimensionType: subDimensionType,
      filter: subFilter
    },
    skip: !subDimensionType,
    fetchPolicy: 'no-cache'
  });
  let label = dimensionStats.dimension ? dimensionStats.dimension.label : 'Unknown';

  let subDimensionsStats = data
    ? data.dimensionDelivStats.dimensionsStats.sort((a, b) => {
        let aRequest = 0;
        let bRequest = 0;
        for (let item of a.byDayStats) {
          aRequest += item.stats.request ? item.stats.request : 0;
        }
        for (let item of b.byDayStats) {
          bRequest += item.stats.request ? item.stats.request : 0;
        }
        a.totalRequests = aRequest;
        b.totalRequests = bRequest;
        return aRequest < bRequest ? 1 : -1;
      })
    : [];

  let link = null;
  if (dimensionStats && dimensionStats.dimension && dimensionStats.dimension.type === 'content') {
    link = `/${emailingDatabaseApiContext.getUid()}/contents/list/${dimensionStats.dimension.id}`;
  }

  return (
    <>
      <tr id={dimensionStats.dimension ? dimensionStats.dimension.type + '_' + dimensionStats.dimension.id : 'null)'}>
        <td>
          <div style={{ minWidth: '400px', padding: '1px 2px' }}>
            <SubdimensionSelector filter={subFilter} subDimensionType={subDimensionType} setSubDimensionType={setSubDimensionType} />

            <div style={{ height: showFullLabel ? null : '19px', overflow: 'hidden', wordBreak: 'break-all' }}>
              {Object.keys(filter).map((elem, i) => {
                return <i key={i} className="fas fa-caret-right px-2"></i>;
              })}
              {dimensionStats && dimensionStats.dimension && dimensionStats.dimension.type === 'content' && (
                <div style={{ float: 'left', width: '40px' }}>
                  <Switch
                    onChange={(checked) => {
                      updateContent(emailingDatabaseApiContext, dimensionStats.dimension.object, { isActive: checked }, checked ? 'Content is enabled' : 'Content is disabled', () => {
                        setObjectToForceRefresh({});
                      });
                    }}
                    checked={dimensionStats.dimension.object.isActive}
                    disabled={!canActivateContent(dimensionStats.dimension.object)}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    height={18}
                    width={35}
                  />
                </div>
              )}
              <span
                onClick={() => {
                  setShowFullLabel(!showFullLabel);
                }}
              >
                {label}
              </span>
              {link && (
                <CLink to={link} target="_blank">
                  <i className="fas fa-external-link-alt" style={{ paddingLeft: '7px', fontSize: '11px' }}></i>
                </CLink>
              )}
            </div>
          </div>
        </td>
        <td className="font-weight-bold" style={{ borderRightWidth: '2px', borderLeftWidth: '2px' }}>
          <DelivCell dimensionStats={dimensionStats} date={null} field={field} />
        </td>
        {dates.map((date) => {
          return (
            <td key={date}>
              <DelivCell dimensionStats={dimensionStats} date={date} field={field} />
            </td>
          );
        })}
      </tr>
      {subDimensionType && loading ? (
        <tr>
          <td colSpan={dates.length + 1}>
            <div style={{ textAlign: 'center', padding: '0px 0px' }}>
              <CSpinner animation="grow" color="secondary" size="sm" />
            </div>
          </td>
        </tr>
      ) : null}
      {subDimensionType && !loading && data
        ? subDimensionsStats.map((subDimensionStats, index) => {
            return <DelivStatsRow key={subDimensionType + '_' + index} dates={dates} dimensionStats={subDimensionStats} field={field} filter={subFilter}></DelivStatsRow>;
          })
        : null}
    </>
  );
};

const DelivCell = ({ dimensionStats, date, field }) => {
  let { backgroundColor, color, formatedValue, stats } = extractStatsValue(dimensionStats, date, field);
  return (
    <div style={{ width: '68px', padding: '1px 2px', backgroundColor, color }}>
      {stats ? (
        <OverlayTrigger delay={{ show: 250, hide: 400 }} placement="left" overlay={getTooltip('Deliv stats', stats)}>
          <span style={{ cursor: 'pointer' }}>{formatedValue}</span>
        </OverlayTrigger>
      ) : null}
    </div>
  );
};

function getTooltip(title, stats) {
  return function (props) {
    let estimatedUniqueOpened = stats.request ? stats.unique_open + (stats.unique_proxy_loaded * stats.unique_open) / stats.request : 0;
    estimatedUniqueOpened = Math.round(estimatedUniqueOpened);

    return (
      <Tooltip {...props} id={Math.floor(Math.random(0) * 10000000)}>
        <div className="w-100 text-left pl-0">
          <h4 style={{ marginBottom: '0px' }}>{title}</h4>
          <table className="table table-sm">
            <tbody>
              <tr>
                <td>Request</td>
                <td>{stats.request ? stats.request : 0}</td>
              </tr>
              <tr>
                <td>Delivered</td>
                <td>
                  {stats.delivered ? stats.delivered : 0} ({calculateAndFormatPercent(stats.delivered, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Opened</td>
                <td>
                  {stats.open ? stats.open : 0} ({calculateAndFormatPercent(stats.open, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Click</td>
                <td>
                  {stats.click ? stats.click : 0} ({calculateAndFormatPercent(stats.click, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Unique Open</td>
                <td>
                  {stats.unique_open ? stats.unique_open : 0} ({calculateAndFormatPercent(stats.unique_open, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Unique Click</td>
                <td>
                  {stats.unique_click ? stats.unique_click : 0} ({calculateAndFormatPercent(stats.unique_click, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Estimated Unique Opened</td>
                <td>
                  {estimatedUniqueOpened ? estimatedUniqueOpened : 0} ({calculateAndFormatPercent(estimatedUniqueOpened, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Unique Delivered</td>
                <td>
                  {stats.unique_delivered ? stats.unique_delivered : 0} ({calculateAndFormatPercent(stats.unique_delivered, stats.request)})
                </td>
              </tr>

              <tr>
                <td>Unique proxy loaded</td>
                <td>
                  {stats.unique_proxy_loaded ? stats.unique_proxy_loaded : 0} ({calculateAndFormatPercent(stats.unique_proxy_loaded, stats.request)})
                </td>
              </tr>

              <tr>
                <td>Complaint</td>
                <td>
                  {stats.complaint ? stats.complaint : 0} ({calculateAndFormatPercent(stats.complaint, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Unsub</td>
                <td>
                  {stats.unsub ? stats.unsub : 0} ({calculateAndFormatPercent(stats.unsub, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Unsub/Openers</td>
                <td>{calculateAndFormatPercent(stats.unsub, stats.unique_open)}</td>
              </tr>
              <tr>
                <td>Soft bounce </td>
                <td>
                  {stats.soft_bounce ? stats.soft_bounce : 0} ({calculateAndFormatPercent(stats.soft_bounce, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Contact bounce </td>
                <td>
                  {stats.contact_bounce ? stats.contact_bounce : 0} ({calculateAndFormatPercent(stats.contact_bounce, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Content bounce </td>
                <td>
                  {stats.content_bounce ? stats.content_bounce : 0} ({calculateAndFormatPercent(stats.content_bounce, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Hard bounce </td>
                <td>
                  {stats.hard_bounce ? stats.hard_bounce : 0} ({calculateAndFormatPercent(stats.hard_bounce, stats.request)})
                </td>
              </tr>

              <tr>
                <td>Contact Score</td>
                <td>{stats.contact_scores && stats.request ? formatInteger(Math.round(stats.contact_scores / stats.request)) : 'N/A'}</td>
              </tr>
              <tr>
                <td>Quality Score</td>
                <td>{getQualityScore(stats)}</td>
              </tr>
              <tr>
                <td>Click Validation Asked</td>
                <td>
                  {stats.click_validation_asked ? stats.click_validation_asked : 0} ({calculateAndFormatPercent(stats.click_validation_asked, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Click Validation Checked</td>
                <td>
                  {stats.click_validation_checked ? stats.click_validation_checked : 0} ({calculateAndFormatPercent(stats.click_validation_checked, stats.click_validation_asked)})
                </td>
              </tr>
              <tr>
                <td>Unique Click Accepted</td>
                <td>
                  {stats.unique_click_accepted ? stats.unique_click_accepted : 0} ({calculateAndFormatPercent(stats.unique_click_accepted, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Click Accepted / Clicks</td>
                <td>{calculateAndFormatPercent(stats.unique_click_accepted, stats.unique_click)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Tooltip>
    );
  };
}

const extractTotalStatsValue = (dimensionStats, date, field) => {
  let formatedDate = date ? date.format('YYYY-MM-DD') : null;

  let stats = {};
  for (let dimensionStatsItem of dimensionStats) {
    if (dimensionStatsItem.byDayStats) {
      for (let item of dimensionStatsItem.byDayStats) {
        if (!formatedDate || item.day === formatedDate) {
          stats = appendStats(stats, item.stats);
        }
      }
    }
  }
  return getStatsValue(stats, field);
};

const extractStatsValue = (dimensionStats, date, field) => {
  let formatedDate = date ? date.format('YYYY-MM-DD') : null;
  let stats = {};
  if (dimensionStats.byDayStats) {
    for (let item of dimensionStats.byDayStats) {
      if (!formatedDate || item.day === formatedDate) {
        stats = appendStats(stats, item.stats);
      }
    }
  }
  return getStatsValue(stats, field);
};

const getStatsValue = (stats, field) => {
  let colors = { backgroundColor: '#FFF', color: '#000' };
  let formatedValue = '';
  if (stats) {
    switch (field) {
      case 'request':
      case 'delivered':
      case 'soft_bounce':
      case 'contact_bounce':
      case 'content_bounce':
      case 'hard_bounce':
      case 'unique_open':
      case 'unique_click':
      case 'unique_proxy_loaded':
      case 'click':
      case 'open':
      case 'proxy_loaded':
      case 'complaint':
      case 'unsub':
      case 'unique_delivered':
      case 'click_validation_asked':
      case 'unique_click_accepted':
        if (!stats[field] && !stats.request) {
          formatedValue = '';
        } else {
          formatedValue = formatInteger(stats[field]);
        }
        break;
      case 'click_validation_checked':
        formatedValue = stats.click_validation_asked ? formatInteger(stats[field]) : '';
        break;
      case 'contact_scores':
        if (!stats[field] || !stats.request) {
          formatedValue = '';
        } else {
          formatedValue = formatInteger(Math.round(stats.contact_scores / stats.request));
        }
        break;
      case 'quality_scores':
        if (!stats.contact_scores || !stats.request) {
          formatedValue = '';
        } else {
          formatedValue = formatInteger(Math.round(getQualityScore(stats)));
        }
        break;
      case 'unique_estimated_open_rate':
        if (!stats.request) {
          formatedValue = '';
        } else {
          let estimatedUniqueOpens = stats.unique_open + (stats.unique_proxy_loaded * stats.unique_open) / stats.request;
          formatedValue = stats.request ? calculateAndFormatPercent(estimatedUniqueOpens, stats.request) : '';
        }
        break;

      case 'unique_open_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unique_open, stats.request) : '';
        break;

      case 'unique_click_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unique_click, stats.request) : '';
        break;

      case 'unique_proxy_loaded_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unique_proxy_loaded, stats.request) : '';
        break;

      case 'unsub_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unsub, stats.request) : '';
        break;
      case 'unsub_openers':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unsub, stats.unique_open) : '';
        break;

      case 'soft_bounce_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.soft_bounce, stats.unique_open) : '';
        break;

      case 'content_bounce_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.content_bounce, stats.unique_open) : '';
        break;

      case 'contact_bounce_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.contact_bounce, stats.unique_open) : '';
        break;

      case 'hard_bounce_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.hard_bounce, stats.unique_open) : '';
        break;

      case 'complaint_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.complaint, stats.unique_open) : '';
        break;

      case 'unique_click_accepted_rate':
        formatedValue = stats.request ? calculateAndFormatPercent(stats.unique_click_accepted, stats.request) : '';
        break;

      case 'unique_click_accepted_ratio':
        formatedValue = stats.unique_click && stats.click_validation_asked ? calculateAndFormatPercent(stats.unique_click_accepted, stats.unique_click) : '';
        break;

      case 'click_validation_ratio':
        formatedValue = stats.click_validation_asked ? calculateAndFormatPercent(stats.click_validation_checked, stats.click_validation_asked) : '';
        break;

      default:
        break;
    }

    switch (field) {
      case 'unique_open_rate':
        colors = stats.request ? getValueColors(10, calculatePercent(stats.unique_open, stats.request)) : null;
        break;
      case 'unique_estimated_open_rate': {
        let estimatedUniqueOpened = stats.request ? stats.unique_open + (stats.unique_proxy_loaded * stats.unique_open) / stats.request : 0;
        colors = stats.request ? getValueColors(10, calculatePercent(estimatedUniqueOpened, stats.request)) : null;
        break;
      }
      case 'unique_click_rate':
      case 'unique_click_accepted_rate':
        colors = getValueColors(1, calculatePercent(stats.unique_click, stats.request));
        break;
      case 'unsub_rate':
        colors = getValueColors(0.5, calculatePercent(stats.unsub, stats.request), true);
        break;
      case 'unsub_openers':
        colors = getValueColors(1, calculatePercent(stats.unsub, stats.unique_open), true);
        break;
      case 'complaint_rate':
        colors = getValueColors(1, calculatePercent(stats.complaint, stats.unique_open), true);
        break;
      case 'quality_scores':
        colors = getValueColors(40, getQualityScore(stats));
        break;
      default:
        break;
    }
  }

  return { ...colors, formatedValue, stats };
};

/** 
  unique_click_accepted_ratio: { label: 'Unique Clicks Accepted/Unique Clicks', value: 'unique_click_accepted_ratio' },*/
