import { CButton, CCol, CRow, CSpinner } from '@coreui/react';
import React, { useEffect, useState, useContext } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { SendingConfigEditor } from './SendingConfigEditor';

export default () => {
  const [sendingConfigs, setSendingConfigs] = useState([]);
  const [created, setCreated] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { loading, data } = useQuery(gql`
    query SendingConfigs {
      sendingConfigs {
        id
        name
        config
        history
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setSendingConfigs(JSON.parse(JSON.stringify(data.sendingConfigs)));
    }
  }, [data, setSendingConfigs]);

  const [createSendingConfig, { loading: creating, data: newSendingConfig }] = useMutation(gql`
    mutation CreateSendingConfig {
      createSendingConfig {
        id
        name
        config
      }
    }
  `);

  useEffect(() => {
    if (newSendingConfig && !created) {
      let sendingConfig = JSON.parse(JSON.stringify(newSendingConfig.createSendingConfig));
      sendingConfig.edit = true;
      setCreated(true);
      setSendingConfigs([...sendingConfigs, sendingConfig]);
    }
  }, [newSendingConfig, created, setCreated, sendingConfigs, setSendingConfigs]);

  //
  return (
    <CRow>
      <CCol>
        <div className="d-flex justify-content-end mb-2">
          <CButton
            color="primary"
            size="sm"
            disabled={creating}
            onClick={() => {
              setCreated(false);
              createSendingConfig();
            }}
          >
            {creating && <CSpinner color="secondary" />}
            Create a new sending configuration
          </CButton>
        </div>
        {loading && (
          <div style={{ textAlign: 'center', padding: '10px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}
        {!loading && sendingConfigs.length === 0 && <div className="text-center text-muted p-5 ">You don&apos;t have any sending configuration.</div>}
        {!loading && sendingConfigs.length > 0 && (
          <table className="table table-bordered  table-sm table-responsive-sm ">
            <thead>
              <tr>
                <th>ID</th>
                <th style={{ width: '100%' }}>Name</th>
                <th></th>
              </tr>
            </thead>
            {sendingConfigs.map((sendingConfig, index) => {
              return (
                <tbody key={emailingDatabaseApiContext.getUid() + index}>
                  <tr
                    onClick={() => {
                      sendingConfig.edit = !sendingConfig.edit;
                      setSendingConfigs([...sendingConfigs]);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ width: '60px' }}> {sendingConfig.id}</div>
                    </td>
                    <td>
                      <div className="w-100">{sendingConfig.name}</div>
                    </td>
                    <td>
                      <div className="px-2" style={{ width: '35px' }}>
                        <i className={`fas fa-chevron-${sendingConfig.edit ? 'up' : 'down'}`}></i>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ display: sendingConfig.edit ? null : 'none' }}>
                    <td colSpan={4} className="bg-light text-dark">
                      <SendingConfigEditor
                        key={emailingDatabaseApiContext.getUid() + index}
                        sendingConfig={sendingConfig}
                        emailingDatabaseApiContext={emailingDatabaseApiContext}
                        setSendingConfig={(newSendingConfig) => {
                          if (newSendingConfig === null) {
                            sendingConfigs.splice(sendingConfigs.indexOf(sendingConfig), 1);
                          } else {
                            sendingConfigs[sendingConfigs.indexOf(sendingConfig)] = newSendingConfig;
                          }
                          setSendingConfigs([...sendingConfigs]);
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        )}
      </CCol>
    </CRow>
  );
};

export const onEspConfigUpdated = (espConfigs, espConfig) => {
  var hasDefault = false;
  espConfigs.forEach((item) => {
    if (item !== espConfig) {
      item.esps = item.esps.filter((espItem) => {
        return !espConfig || espConfig.esps.indexOf(espItem) < 0;
      });
      if (espConfig && espConfig.default) {
        item.default = false;
        hasDefault = true;
      } else {
        hasDefault = hasDefault || item.default;
      }
    }
  });
  if (!hasDefault && espConfigs.length > 0) {
    espConfigs[0].default = true;
  }
};

export const updateSenderWeights = (senders, sender) => {
  let availableWeight = 100 - (isNaN(sender.weight) ? 0 : sender.weight);
  let lastSender = 0;
  senders.forEach((item) => {
    if (item === sender) {
      return;
    }
    lastSender = item;
    availableWeight -= item.weight && !isNaN(item.weight) ? item.weight : 0;
    if (availableWeight < 0) {
      item.weight += availableWeight;
      availableWeight = 0;
    }
  });
  if (availableWeight >= 0) {
    if (lastSender) {
      lastSender.weight = (lastSender.weight && !isNaN(lastSender.weight) ? lastSender.weight : 0) + availableWeight;
    } else {
      sender.weight += availableWeight;
    }
  }
};
