import React, { useContext, useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CBadge, CDataTable, CButton, CCollapse } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';

import ChildConfigEdit from './ChildConfigEdit';

const getActivatedBadge = (activated) => {
  switch (activated) {
    case true:
      return 'success';
    default:
      return 'danger';
  }
};

export default ({ contacts, loading, parentSource, refetch }) => {
  const [sources, setSources] = useState(contacts);
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  let defaultChildSource = parentSource?.defaultChildSource;

  const forceUpdate = useCallback(() => {
    setSources([...sources]);
  }, [sources, setSources]);

  useEffect(() => {
    if (contacts) {
      setSources(contacts);
    }
  }, [contacts, setSources]);

  const [updateContactSource] = useMutation(
    gql`
      mutation updateContactSource($source: JSON!) {
        updateContactSource(source: $source) {
          id
        }
      }
    `
  );

  return (
    <CDataTable
      items={loading ? null : sources}
      fields={getFields(parentSource)}
      size="sm"
      hover
      striped
      loading={loading}
      clickableRows
      onRowClick={(item) => history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/sources/edit/${item.id}`)}
      scopedSlots={{
        id: (item) => <td>{item.id}</td>,
        name: (item) => <td>{item.name}</td>,
        utmSource: (item) => <td>{item.utmSource}</td>,
        apiEnabled: (item) => (
          <td>
            <CBadge color={getActivatedBadge(item.apiEnabled)}>{item.apiEnabled ? 'Yes' : 'No'}</CBadge>
          </td>
        ),
        actions: (item) => (
          <td
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {item.id !== defaultChildSource.id && (
              <CButton
                size="sm"
                color="info"
                className="mr-5"
                onClick={async (event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  parentSource.defaultChildSourceId = item.id;
                  await updateContactSource({
                    variables: {
                      source: {
                        id: parentSource.id,
                        defaultChildSourceId: item.id
                      }
                    }
                  });
                  refetch();
                }}
              >
                Set as Default
              </CButton>
            )}
            {item.id !== defaultChildSource.id && !item.editRulesMode && (
              <CButton
                size="sm"
                color="primary"
                onClick={async (event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  item.editRulesMode = true;
                  forceUpdate();
                }}
              >
                Edit Affectation Rules
                <i className="fas fa-caret-down px-2"></i>
              </CButton>
            )}
          </td>
        ),
        isDefault: (item) => (
          <td
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <CBadge color={getActivatedBadge(item.id === defaultChildSource.id)}>{item.id === defaultChildSource.id ? 'Yes' : 'No'}</CBadge>
          </td>
        ),
        details: (item) => {
          return (
            <>
              {item && (
                <CCollapse show={item.editRulesMode}>
                  <ChildConfigEdit forceUpdate={forceUpdate} source={item} updateContactSource={updateContactSource} />
                </CCollapse>
              )}
            </>
          );
        }
      }}
    />
  );
};
function getFields(modeSubSource) {
  if (modeSubSource) {
    return ['id', { key: 'name', _classes: 'font-weight-bold' }, 'isDefault', 'actions'];
  }
  return ['id', { key: 'name', _classes: 'font-weight-bold' }, 'utmSource', 'apiEnabled'];
}
