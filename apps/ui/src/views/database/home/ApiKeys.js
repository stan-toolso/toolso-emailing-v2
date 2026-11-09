import React, { useState, useEffect } from 'react';
import { CCard, CCardHeader, CCardBody, CButton, CDataTable, CCardFooter, CSpinner } from '@coreui/react';
import moment from 'moment-timezone';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { gql, useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';

import CreateApiKeyModal from './CreateApiKeyModal';

export default () => {
  const [showModalCreation, setShowModalCreation] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingDelete, setLoadingDelete] = useState(false);

  const { data, loading, refetch } = useQuery(gql`
    query ApiKeys {
      apiKeys {
        id
        name
        apiKey
        createdAt
      }
    }
  `);
  const [deleteApiKeyMutation] = useMutation(
    gql`
      mutation Mutation($deleteApiKeyId: ID!) {
        deleteApiKey(id: $deleteApiKeyId)
      }
    `
  );

  const deleteApiKey = async (apiKey) => {
    setLoadingDelete(true);
    let result = await deleteApiKeyMutation({ variables: { deleteApiKeyId: parseInt(apiKey.id) } });
    if (result && result.data && result.data.deleteApiKey === 'ok') {
      let nextApiKeys = apiKeys.filter((anApiKey) => anApiKey.id !== apiKey.id);
      setApiKeys(nextApiKeys);
      toast.success('Api key has been deleted', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    } else {
      toast.error('Api Key cannot be deleted', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    }
    setLoadingDelete(false);
  };

  useEffect(() => {
    if (data) {
      setApiKeys(data.apiKeys);
    }
  }, [data, setApiKeys]);

  return (
    <>
      <CreateApiKeyModal
        show={showModalCreation}
        toggle={() => {
          refetch();
          setShowModalCreation(false);
        }}
      />

      <CCard>
        <CCardHeader>
          Api Keys
          <CButton
            size="sm"
            color="primary"
            className="float-right"
            onClick={() => {
              setShowModalCreation(true);
            }}
          >
            Create new Api Key
          </CButton>
        </CCardHeader>
        <CCardBody>
          {(loading || loadingDelete) && <CSpinner />}
          {!loading && !loadingDelete && (
            <CDataTable
              items={loading ? null : apiKeys}
              fields={[{ key: 'id' }, { key: 'name', _classes: 'font-weight-bold' }, { key: 'apiKey' }, { key: 'createdAt' }, { key: 'actions' }]}
              columnHeaderSlot={{
                id: <div style={{ width: '50px' }}>#ID</div>,
                name: <div style={{ minWidth: '300px' }}>Name</div>,
                apiKey: <div style={{ minWidth: '300px' }}>Api Key</div>,
                createdAt: <div style={{ width: '100px' }}>Creation Date</div>,
                actions: <div></div>
              }}
              size="sm"
              hover
              striped
              loading={loading}
              scopedSlots={{
                name: (apiKey) => (
                  <td style={{ minWidth: '300px' }}>
                    <div>{apiKey.name}</div>
                  </td>
                ),
                createdAt: (content) => <td style={{ width: '100px', textAlign: 'center' }}>{content.createdAt ? moment(content.createdAt).format('YYYY/MM/DD') : ''}</td>,
                actions: (apiKey) => (
                  <td
                    style={{ width: '40px' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.nativeEvent.stopPropagation();
                    }}
                  >
                    {
                      <i
                        className="pl-2 pr-1 fas  fa-trash"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          confirmAlert({
                            customUI: ({ onClose }) => {
                              return (
                                <CCard className="card-accent-danger">
                                  <CCardHeader>Are you sure?</CCardHeader>
                                  <CCardBody>
                                    <p>Do you really want to delete this api Key?</p>
                                  </CCardBody>
                                  <CCardFooter>
                                    <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                                      No
                                    </CButton>
                                    <CButton
                                      color="danger"
                                      className="px-5"
                                      onClick={() => {
                                        deleteApiKey(apiKey);
                                        onClose();
                                      }}
                                    >
                                      Yes, Delete it!
                                    </CButton>
                                  </CCardFooter>
                                </CCard>
                              );
                            }
                          });
                        }}
                      ></i>
                    }
                  </td>
                )
              }}
            />
          )}
        </CCardBody>
      </CCard>
    </>
  );
};
