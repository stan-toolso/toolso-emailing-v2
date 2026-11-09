import { CButton, CCard, CCardBody, CCardFooter, CCardHeader, CCol, CFormGroup, CInput, CLabel, CRow, CSpinner } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { confirmAlert } from 'react-confirm-alert';
import { toast } from 'react-toastify';
import { formatInteger } from '../../../common/util';
import moment from 'moment-timezone';
import { EspConfigEditor } from './EspConfigEditor';
import { onEspConfigUpdated } from './SendingConfigs';

export const SendingConfigEditor = ({ sendingConfig, setSendingConfig, emailingDatabaseApiContext }) => {
  const [name, setName] = useState(sendingConfig.name);
  const [updated, setUpdated] = useState(true);
  const [config, setConfig] = useState(sendingConfig.config ? sendingConfig.config : {});

  useEffect(() => {
    if (sendingConfig?.config) {
      setConfig(sendingConfig.config);
    }
  }, [sendingConfig, setConfig]);

  if (!config.espConfigs) {
    config.espConfigs = [];
  }

  const {
    data: counts,
    loading: loadingCounts,
    refetch: refetchCounts
  } = useQuery(
    gql`
      query CountContactsInSendingConfig($config: JSON!) {
        countContactsInSendingConfig(config: $config)
      }
    `,
    {
      variables: {
        config: config
      }
    }
  );

  const [updateSendingConfig, { loading: updating, data: dataUpdated }] = useMutation(gql`
    mutation UpdateSendingConfig($sendingConfig: JSON!) {
      updateSendingConfig(sendingConfig: $sendingConfig) {
        id
        name
        config
        history
      }
    }
  `);
  useEffect(() => {
    if (dataUpdated && !updated) {
      setSendingConfig({
        ...dataUpdated.updateSendingConfig,
        edit: true
      });
      setUpdated(true);
    }
  }, [dataUpdated, updated, setSendingConfig]);

  const [deleteSendingConfig] = useMutation(gql`
    mutation DeleteSendingConfig($sendingConfigId: ID!) {
      deleteSendingConfig(sendingConfigId: $sendingConfigId)
    }
  `);

  let managedEsps = [];
  for (let espConfig of config.espConfigs) {
    if (espConfig.esps) {
      managedEsps = [...managedEsps, ...espConfig.esps];
    }
  }
  return (
    <div className="p-2">
      <CRow>
        <CCol sm="5">
          <CFormGroup>
            <CLabel htmlFor="name">Name</CLabel>
            <CInput size="sm" type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>
        <CCol sm="2">
          <CFormGroup>
            <CLabel htmlFor="name">Estimated Volume</CLabel>
            {loadingCounts && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            {!loadingCounts && counts && counts.countContactsInSendingConfig && <CInput size="sm" type="text" disabled={true} value={formatInteger(counts.countContactsInSendingConfig.total)} />}
          </CFormGroup>
        </CCol>
        <CCol sm="5">
          <CLabel className="w-100">Last update :{sendingConfig.history ? moment(sendingConfig.history[sendingConfig.history.length - 1].date).format('YYYY-MM-DD HH:mm:ss') : '-'}</CLabel>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="12">
          <CFormGroup>
            <CLabel>Esp configurations</CLabel>

            <div className=" mb-2">
              <CButton
                size="sm"
                onClick={() => {
                  config.espConfigs.push({});
                  setConfig({ ...config });
                }}
                color="secondary"
              >
                Add Esp configuration
              </CButton>
            </div>

            {config.espConfigs.map((espConfig, index) => {
              return (
                <EspConfigEditor
                  key={emailingDatabaseApiContext.getUid() + index}
                  espConfig={espConfig}
                  setEspConfig={(newEspConfig) => {
                    if (newEspConfig === null) {
                      config.espConfigs.splice(index, 1);
                    } else {
                      config.espConfigs[index] = newEspConfig;
                    }
                    onEspConfigUpdated(config.espConfigs, newEspConfig);
                    setConfig({ ...config });
                    refetchCounts();
                  }}
                  loadingCounts={loadingCounts}
                  managedEsps={managedEsps}
                  counts={counts ? counts.countContactsInSendingConfig : null}
                  emailingDatabaseApiContext={emailingDatabaseApiContext}
                />
              );
            })}
          </CFormGroup>
        </CCol>
      </CRow>

      <CRow className="mt-2">
        <CCol xl={12}>
          <CButton
            color="primary"
            className="mr-3"
            size="sm"
            onClick={async () => {
              setUpdated(false);
              let response = await updateSendingConfig({
                variables: {
                  sendingConfig: {
                    id: sendingConfig.id,
                    name,
                    config
                  }
                }
              });
              if (response && response.data) {
                toast.success(`Sending config ${sendingConfig.name} has been saved`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              } else {
                toast.error(`Failed to save sending config ${sendingConfig.name}.`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }
            }}
          >
            {updating && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
            Save
          </CButton>

          <CButton
            color="danger"
            size="sm"
            onClick={() => {
              confirmAlert({
                customUI: ({ onClose }) => {
                  return (
                    <CCard className="card-accent-danger">
                      <CCardHeader>Are you sure?</CCardHeader>
                      <CCardBody>
                        <p>You want to delete this sending config? </p>
                      </CCardBody>
                      <CCardFooter>
                        <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                          No
                        </CButton>
                        <CButton
                          color="danger"
                          className="px-5"
                          onClick={async () => {
                            let response = await deleteSendingConfig({ variables: { sendingConfigId: sendingConfig.id } });
                            if (response && response.data && response.data.deleteSendingConfig === 'ok') {
                              setSendingConfig(null);
                              toast.success(`Sending config ${sendingConfig.name} has been deleted`, {
                                position: toast.POSITION.BOTTOM_RIGHT
                              });
                            } else {
                              toast.error(`Failed to delete sending config ${sendingConfig.name}.`, {
                                position: toast.POSITION.BOTTOM_RIGHT
                              });
                            }
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
          >
            Delete
          </CButton>
        </CCol>
      </CRow>
    </div>
  );
};
