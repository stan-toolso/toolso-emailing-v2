import React, { useContext } from 'react';

import EmailingDatabaseApiContext from '../../../../../contexts/EmailingDatabaseApiContext';
import { CBadge, CLink, CSpinner } from '@coreui/react';
import Switch from 'react-switch';
import { gql, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';

const DEFAULT_CELL_STYLE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };
export default ({ rules, loading }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const [updateContactMessageRule] = useMutation(gql`
    mutation updateContactMessageRule($contactMessageRule: JSON!) {
      updateContactMessageRule(contactMessageRule: $contactMessageRule) {
        id
        enabled
      }
    }
  `);

  return (
    <div className="table-responsive">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>
              <div style={{ width: '50px' }}></div>
            </th>
            <th>
              <div style={{ width: '50px' }}>ID</div>
            </th>
            <th>
              <div style={{ width: '200px' }}>Name</div>
            </th>
            <th>
              <div style={{ width: '100%' }}>Actions</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && rules.length === 0 && (
            <tr>
              <td colSpan={4}>
                <div className="text-center w-100">... No rules ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            rules.map((rule, index) => {
              return (
                <tr key={index}>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '50px' }}>
                      <Switch
                        onChange={async (checked) => {
                          let updatedRule = await updateContactMessageRule({
                            variables: {
                              contactMessageRule: {
                                id: rule.id,
                                enabled: checked
                              }
                            }
                          });
                          rule.enabled = updatedRule && updatedRule.data ? updatedRule.data.updateContactMessageRule.enabled : null;
                          if (checked === rule.enabled) {
                            toast.success(`Rule ${rule.id} has been ${checked ? 'enabled' : 'disabled'}`, {
                              position: toast.POSITION.BOTTOM_RIGHT
                            });
                          } else {
                            toast.error(`Failed to  ${checked ? 'enable' : 'disable'} rule ${rule.id}`, {
                              position: toast.POSITION.BOTTOM_RIGHT
                            });
                          }
                        }}
                        checked={rule.enabled ? true : false}
                        uncheckedIcon={false}
                        checkedIcon={false}
                        height={18}
                        width={35}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '50px' }}>
                      <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/messages/rules/list/${rule.id}`}>#{rule.id}</CLink>
                    </div>
                  </td>

                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>{rule.name ? rule.name : ''}</div>
                  </td>

                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '100%', maxWidth: '600px' }}>
                      {rule.actions &&
                        rule.actions.map((action, index) => {
                          return (
                            <CBadge key={index} className="mr-1 p-1" color={getActionBadgeColor(action)}>
                              {getActionLabel(action)}
                            </CBadge>
                          );
                        })}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

const getActionLabel = (action) => {
  switch (action.type) {
    case 'blacklist':
      return 'Blacklist';
    case 'unsubscribe':
      return 'Unsubscribe';
    case 'markAsDone':
      return 'Mark As Done';
    default:
      return '';
  }
};
const getActionBadgeColor = (action) => {
  switch (action.type) {
    case 'blacklist':
      return 'danger';
    case 'unsubscribe':
      return 'warning';
    case 'markAsDone':
      return 'success';
    default:
      return 'secondary';
  }
};
