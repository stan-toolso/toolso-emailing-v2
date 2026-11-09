import { CLink, CSpinner } from '@coreui/react';
import React, { useContext } from 'react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { formatInteger, formatPercent, calculateAndFormatPercent, calculatePercent } from '../../../common/util';
import { getEstimateOpeners } from '../../sendings/deliv/delivKpis';
import { GetFlopScore, GetTopScore } from './Score';
import { getQualityScore } from '../../sendings/deliv/delivKpis';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

export const Fields = {
  id: 'id',
  name: 'name',
  request: 'request',
  unique_open: 'unique_open',
  unique_click: 'unique_click',
  score: 'score'
};

export const rateFields = [Fields.unique_click, Fields.unique_open];

const DEFAULT_CELL_STYLE = { overflow: 'hidden', textOverflow: 'ellipsis', height: '20px' };
const OVERFLOW_CELL_STYLE = { overflowX: 'visible', overflowY: 'hidden', height: '20px' };

const LABELS = {
  [Fields.id]: 'ID',
  [Fields.name]: 'Name',
  [Fields.request]: 'Requests',
  [Fields.unique_open]: 'Opens',
  [Fields.unique_click]: 'Clicks',
  [Fields.score]: 'Score'
};

function contentFieldKeys() {
  return Reflect.ownKeys(Fields);
}

export default ({ contents, loading, maxItems, useQualityScore, showFlopsInsteadOfTops }) => {
  let sortedContents = [];
  const multiplier = showFlopsInsteadOfTops ? -1 : 1;

  if (contents && contents.length > 1) {
    sortedContents = [...contents];
    sortedContents = sortedContents
      .sort((a, b) => multiplier * getValueFromContent(Fields.score, b, useQualityScore) - multiplier * getValueFromContent(Fields.score, a, useQualityScore))
      .slice(0, maxItems);
  }

  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr>
            {contentFieldKeys().map((field, index) => {
              return <th key={index}>{LABELS[field]}</th>;
            })}
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={contentFieldKeys().length}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && (
          <tbody>
            {sortedContents.map((content) => {
              return (
                <OverlayTrigger key={content.id} delay={{ show: 250, hide: 400 }} placement="left" overlay={getTooltip(content.delivStats)}>
                  <tr key={content.id}>
                    {contentFieldKeys().map((field) => {
                      return (
                        <td key={field}>
                          <ContentTd field={field} content={content} useQualityScore={useQualityScore} showFlopsInsteadOfTops={showFlopsInsteadOfTops} />
                        </td>
                      );
                    })}
                  </tr>
                </OverlayTrigger>
              );
            })}
            {!sortedContents ||
              (sortedContents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>
                    <br />
                    No content for this period
                  </td>
                </tr>
              ))}
          </tbody>
        )}
      </table>
    </>
  );
};

const ContentTd = ({ content, field, useQualityScore, showFlopsInsteadOfTops }) => {
  const openClassName = showFlopsInsteadOfTops ? 'text-warning' : 'text-info';
  const scoreClassName = showFlopsInsteadOfTops ? 'text-danger' : 'text-success';
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  switch (field) {
    case Fields.id:
      return <span>#{getValueFromContent(field, content)}</span>;

    case Fields.name:
      return (
        <div style={{ ...DEFAULT_CELL_STYLE }}>
          <span>
            <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${content.id}`}>{getValueFromContent(field, content)}</CLink>
          </span>
        </div>
      );

    case Fields.request:
      return <span>{formatInteger(getValueFromContent(field, content))}</span>;

    case Fields.unique_open:
    case Fields.unique_click:
      return (
        <div style={{ ...OVERFLOW_CELL_STYLE, width: '50px' }}>
          <span className={openClassName}>{content.delivStats && content.delivStats.request && formatPercent(getValueFromContentsRate(field, content))}</span>
        </div>
      );

    case Fields.score:
      return <span className={scoreClassName}>{getValueFromContent(field, content, useQualityScore)}</span>;

    default:
      return null;
  }
};

function getValueFromContent(field, item, useQualityScore) {
  switch (field) {
    case Fields.id:
      return item.id;
    case Fields.isActive:
      return item.isActive.toString();
    case Fields.name:
      return item.name;
    case Fields.request:
      return item.delivStats ? item.delivStats.request : 0;
    case Fields.unique_click:
      return item.delivStats && item.delivStats.unique_click;
    case Fields.unique_open:
      return item.delivStats && item.delivStats.unique_open;
    case Fields.score:
      return useQualityScore ? getQualityScore(item.delivStats) : GetTopScore(item.delivStats) - GetFlopScore(item.delivStats);
    default:
      console.log('unknown field in TopFlop Content Table', field);
      return '';
  }
}

function getValueFromContentsRate(field, item) {
  switch (field) {
    case Fields.unique_open:
      return item.delivStats && item.delivStats.request ? Math.round(calculatePercent(getEstimateOpeners(item.delivStats), item.delivStats.request) * 10) / 10 : 0;
    case Fields.unique_click:
      return item.delivStats && item.delivStats.request ? Math.round(calculatePercent(item.delivStats.unique_click, item.delivStats.request) * 10) / 10 : 0;
    default:
      return '';
  }
}

function getTooltip(stats) {
  if (!stats) {
    return <div></div>;
  }
  return function (props) {
    let estimatedUniqueOpened = stats.request ? stats.unique_open + (stats.unique_proxy_loaded * stats.unique_open) / stats.request : 0;
    estimatedUniqueOpened = Math.round(estimatedUniqueOpened);
    return (
      <Tooltip {...props} id={Math.floor(Math.random(0) * 10000000)}>
        <div className="w-100 text-left pl-0">
          <h4 style={{ marginBottom: '0px' }}>Content Stats</h4>
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
                <td>Click</td>
                <td>
                  {stats.click ? stats.click : 0} ({calculateAndFormatPercent(stats.click, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Opened</td>
                <td>
                  {stats.open ? stats.open : 0} ({calculateAndFormatPercent(stats.open, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Proxy loaded</td>
                <td>
                  {stats.proxy_loaded ? stats.proxy_loaded : 0} ({calculateAndFormatPercent(stats.proxy_loaded, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Estimated Unique Opened</td>
                <td>
                  {estimatedUniqueOpened ? estimatedUniqueOpened : 0} ({calculateAndFormatPercent(estimatedUniqueOpened, stats.request)})
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
                <td>Unique proxy loaded</td>
                <td>
                  {stats.unique_proxy_loaded ? stats.unique_proxy_loaded : 0} ({calculateAndFormatPercent(stats.unique_proxy_loaded, stats.request)})
                </td>
              </tr>

              <tr>
                <td>Soft bounce </td>
                <td>
                  {stats.soft_bounce ? stats.soft_bounce : 0} ({calculateAndFormatPercent(stats.soft_bounce, stats.request)})
                </td>
              </tr>
              <tr>
                <td>Hard bounce </td>
                <td>
                  {stats.hard_bounce ? stats.hard_bounce : 0} ({calculateAndFormatPercent(stats.hard_bounce, stats.request)})
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
                <td>Contact Score</td>
                <td>{stats.contact_scores && stats.request ? formatInteger(Math.round(stats.contact_scores / stats.request)) : 'N/A'}</td>
              </tr>
              <tr>
                <td>Quality Score</td>
                <td>{getQualityScore(stats)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Tooltip>
    );
  };
}
