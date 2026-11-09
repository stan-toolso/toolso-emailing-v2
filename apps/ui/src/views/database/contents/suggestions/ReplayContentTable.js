import { CLink, CSpinner } from '@coreui/react';
import React, { useContext } from 'react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import Switch from 'react-switch';
import { toast } from 'react-toastify';
import { UPDATE_CONTENT } from '../../../../services/DatabaseQuery';
import moment from 'moment-timezone';
import { calculatePercent, formatPercent, formatInteger } from '../../../util';
import { getEstimateOpeners } from '../../sendings/deliv/delivKpis';

export const ReplayFields = {
  id: 'id',
  name: 'name',
  isActive: 'isActive',
  createdAt: 'createdAt',
  endDate: 'endDate',
  request: 'request',
  unique_open: 'unique_open',
  unique_click: 'unique_click',
  score: 'score'
};

export const rateFields = [ReplayFields.unique_click, ReplayFields.unique_open];

const LABELS = {
  [ReplayFields.id]: 'ID',
  [ReplayFields.isActive]: 'Active',
  [ReplayFields.name]: 'Name',
  [ReplayFields.request]: 'Requests',
  [ReplayFields.unique_click]: 'Clicks',
  [ReplayFields.unique_open]: 'Opens',
  [ReplayFields.score]: 'Score',
  [ReplayFields.endDate]: 'End Date',
  [ReplayFields.createdAt]: 'Creation Date'
};

function replayFieldKeys() {
  return Reflect.ownKeys(ReplayFields).filter((item) => item !== ReplayFields.score);
}

export const ReplayContentTable = ({ replaySuggestContents, loading, forceUpdate, maxSuggestionsCount, cloneContent }) => {
  let sortedReplaySuggestionsContents = [...replaySuggestContents];
  if (sortedReplaySuggestionsContents.length > 1) {
    sortedReplaySuggestionsContents = sortedReplaySuggestionsContents
      .sort((a, b) => getValueFromReplaySuggestionContent(ReplayFields.score, b) - getValueFromReplaySuggestionContent(ReplayFields.score, a))
      .slice(0, maxSuggestionsCount);
  }

  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr>
            {replayFieldKeys().map((field, index) => {
              return <th key={index}>{LABELS[field]}</th>;
            })}
            <th key="replay">Replay</th>
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={replayFieldKeys().length}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && (
          <tbody>
            {sortedReplaySuggestionsContents.map((replaySuggestContent) => {
              return (
                <tr key={replaySuggestContent.id}>
                  {replayFieldKeys().map((field) => {
                    return (
                      <td key={field}>
                        <ReplaySuggestContentTd field={field} replaySuggestionContent={replaySuggestContent} forceUpdate={forceUpdate} />
                      </td>
                    );
                  })}
                  <td
                    onClick={(event) => {
                      event.stopPropagation();
                      event.nativeEvent.stopPropagation();
                    }}
                  >
                    {
                      <i
                        className="pl-2 pr-1 fas  fa-clone"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          cloneContent(replaySuggestContent);
                        }}
                      ></i>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </>
  );
};

const ReplaySuggestContentTd = ({ replaySuggestionContent, field, forceUpdate }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  switch (field) {
    case ReplayFields.id:
      return <span>#{getValueFromReplaySuggestionContent(field, replaySuggestionContent)}</span>;
    case ReplayFields.isActive:
      return (
        <span>
          <Switch
            onChange={(checked) => {
              updateReplayContent(emailingDatabaseApiContext, { isActive: checked, id: replaySuggestionContent.id }, checked ? 'Content is enabled' : 'Content is disabled', forceUpdate);
            }}
            checked={replaySuggestionContent.isActive}
            disabled={!replaySuggestionContent}
            uncheckedIcon={false}
            checkedIcon={false}
            height={18}
            width={35}
          />
        </span>
      );

    case ReplayFields.name:
      return (
        <span>
          <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${replaySuggestionContent.id}`}>{getValueFromReplaySuggestionContent(field, replaySuggestionContent)}</CLink>
        </span>
      );

    case ReplayFields.request:
      return <span>{formatInteger(getValueFromReplaySuggestionContent(field, replaySuggestionContent))}</span>;

    case ReplayFields.unique_open:
      return (
        <span className="text-info">
          {replaySuggestionContent.delivStats && replaySuggestionContent.delivStats.request && formatPercent(getValueFromReplaySuggestionContentRate(field, replaySuggestionContent))}
          <small className="text-muted">{' (' + formatInteger(getValueFromReplaySuggestionContent(field, replaySuggestionContent)) + ')'}</small>
        </span>
      );

    case ReplayFields.unique_click:
      return (
        <span className="text-success">
          {replaySuggestionContent.delivStats && replaySuggestionContent.delivStats.request && formatPercent(getValueFromReplaySuggestionContentRate(field, replaySuggestionContent))}
          <small className="text-muted">{' (' + formatInteger(getValueFromReplaySuggestionContent(field, replaySuggestionContent)) + ')'}</small>
        </span>
      );

    case ReplayFields.score:
      return <span className="text-warning">{formatInteger(getValueFromReplaySuggestionContent(field, replaySuggestionContent))}</span>;

    case ReplayFields.endDate:
    case ReplayFields.createdAt:
      return <span>{getValueFromReplaySuggestionContent(field, replaySuggestionContent) ? moment(getValueFromReplaySuggestionContent(field, replaySuggestionContent)).format('YYYY/MM/DD') : ''}</span>;

    default:
      return null;
  }
};

function getValueFromReplaySuggestionContent(field, item) {
  switch (field) {
    case ReplayFields.id:
      return item.id;
    case ReplayFields.isActive:
      return item.isActive.toString();
    case ReplayFields.name:
      return item.name;
    case ReplayFields.createdAt:
      return item.createdAt;
    case ReplayFields.endDate:
      return item.endDate;
    case ReplayFields.request:
      return item.delivStats && item.delivStats.request;
    case ReplayFields.unique_click:
      return item.delivStats && item.delivStats.unique_click;
    case ReplayFields.unique_open:
      return item.delivStats && item.delivStats.unique_open;
    case ReplayFields.score:
      return item.delivStats && item.delivStats.request * (item.delivStats.unique_click + item.delivStats.unique_open / 100);
    default:
      console.log('unknown field in replay Content Table', field);
      return '';
  }
}

const updateReplayContent = async (emailingDatabaseApiContext, jsonObject, message, forceUpdate) => {
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

function getValueFromReplaySuggestionContentRate(field, item) {
  switch (field) {
    case ReplayFields.unique_open:
      return item.delivStats && item.delivStats.request ? calculatePercent(getEstimateOpeners(item.delivStats), item.delivStats.request) : 0;
    case ReplayFields.unique_click:
      return item.delivStats && item.delivStats.request ? calculatePercent(item.delivStats.unique_click, item.delivStats.request) : 0;
    default:
      return '';
  }
}
