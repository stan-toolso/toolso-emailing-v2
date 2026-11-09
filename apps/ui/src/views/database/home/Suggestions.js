import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { CBadge, CCard, CCardBody, CCardHeader, CDataTable, CSpinner, CButton } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import toPascalCase from './toPascalCase';
import { useSelector } from 'react-redux';
import EditSuggestionModal from './EditSuggestionModal';

export default (props) => {
  let wantedScheduleID = props.match?.params?.suggestion_id;
  const [suggestions, setSuggestions] = useState([]);
  const [onlyActive, setOnlyActive] = useState(props?.onlyActive);

  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const userEntreprise = useSelector((state) => state.userEntreprise);
  const isSuperAdmin = userEntreprise.role === 'superAdmin';

  const { data, loading, refetch } = useQuery(
    gql`
      query GetSuggestions($onlyActive: Boolean) {
        getSuggestions(onlyActive: $onlyActive) {
          limit
          offset
          suggestions {
            createdAt
            details
            id
            status
            priority
            unique_id
            suggestion_date
            user
            type
          }
          total
        }
      }
    `,
    { variables: { onlyActive: onlyActive ?? true } }
  );

  useEffect(() => {
    if (data?.getSuggestions?.suggestions) {
      let visibleSuggestions = isSuperAdmin
        ? data.getSuggestions.suggestions
        : data.getSuggestions.suggestions.filter((suggestion) => {
            return suggestion.status !== 'draft';
          });
      setSuggestions(visibleSuggestions);
      if (wantedScheduleID) {
        setSelectedSuggestion(data.getSuggestions.suggestions.find((s) => s.id === wantedScheduleID));
      }
    }
  }, [data, setSuggestions]);

  function getTypeLabel(type) {
    switch (type) {
      default:
        return toPascalCase(type);
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'todo':
        return 'primary';
      case 'cancelled':
      case 'ignored':
        return 'light';
      default:
        return 'success';
    }
  };

  let hasSuggestions = !loading && suggestions && suggestions.length > 0;
  let hasNoSuggestion = !loading && suggestions && suggestions.length === 0;

  return (
    <>
      {selectedSuggestion && (
        <EditSuggestionModal
          suggestion={selectedSuggestion}
          show={selectedSuggestion !== null}
          isSuperAdmin={isSuperAdmin}
          toggle={() => {
            setSelectedSuggestion(null);
          }}
        />
      )}
      <CCard>
        <CCardHeader>
          Suggestions
          {onlyActive && (
            <CButton
              size="sm"
              color="success"
              className="float-right"
              onClick={() => {
                setOnlyActive(false);
                refetch();
              }}
            >
              View All
            </CButton>
          )}
        </CCardHeader>
        <CCardBody>
          {loading && (
            <div className="" style={{ textAlign: 'center', height: '400px' }}>
              <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
            </div>
          )}
          {hasSuggestions && (
            <>
              <CDataTable
                items={loading ? null : suggestions}
                fields={[{ key: 'status' }, { key: 'type' }, { key: 'ressource' }, { key: 'user' }, { key: 'suggestion_date' }, { key: 'priority' }]}
                columnHeaderSlot={{
                  status: <div style={{}}>Status</div>,
                  type: <div style={{}}>Type</div>,
                  ressource: <div style={{}}>Ressource</div>,
                  user: <div style={{}}>User</div>,
                  suggestion_date: <div style={{}}>Date</div>,
                  priority: <div style={{}}>Priority</div>
                }}
                size="sm"
                hover
                loading={loading}
                scopedSlots={{
                  status: (suggestion) => (
                    <td>
                      <div>
                        <CBadge color={getStatusBadgeColor(suggestion.status)} style={{ display: 'inline', marginRight: '2px' }}>
                          {suggestion.status}
                        </CBadge>
                      </div>
                    </td>
                  ),
                  type: (suggestion) => (
                    <td>
                      <div>{getTypeLabel(suggestion.type)}</div>
                    </td>
                  ),
                  ressource: (suggestion) => (
                    <td>
                      <div> {toPascalCase(suggestion.unique_id.replace(suggestion.type, ''))} </div>
                    </td>
                  ),
                  user: (suggestion) => (
                    <td>
                      <div>{suggestion.user}</div>
                    </td>
                  ),
                  suggestion_date: (suggestion) => <td>{suggestion.suggestion_date ? moment(suggestion.suggestion_date).format('YYYY/MM/DD HH:mm:ss') : ''}</td>,
                  priority: (suggestion) => (
                    <td>
                      <div>{suggestion.priority}</div>
                    </td>
                  )
                }}
                onRowClick={(item) => {
                  setSelectedSuggestion(item);
                }}
              />
            </>
          )}
          {hasNoSuggestion && (
            <div>
              Nothing to report today <i className="far fa-thumbs-up"></i>
            </div>
          )}
        </CCardBody>
      </CCard>
    </>
  );
};
