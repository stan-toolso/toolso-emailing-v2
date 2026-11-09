import { CButton, CCard, CCardBody, CCardHeader, CCol, CLabel, CRow } from '@coreui/react';
import React from 'react';
import EspSelector from '../../../common/EspSelector';
import { SenderConfigEditor } from './SenderConfigEditor';

export const EspConfigEditor = ({ espConfig, setEspConfig, loadingCounts, counts, managedEsps, emailingDatabaseApiContext }) => {
  if (!espConfig.senders) {
    espConfig.senders = [];
  }

  return (
    <CCard accentColor="secondary">
      <CCardHeader>
        <CRow>
          <CCol sm="11">
            <EspSelector
              defaultOption={true}
              esps={[...(espConfig.default ? ['default'] : []), ...(espConfig.esps ? espConfig.esps : [])]}
              setEsps={(esps) => {
                espConfig.esps = esps.filter((esp) => {
                  return esp !== 'default';
                });
                espConfig.default = esps.indexOf('default') >= 0;
                setEspConfig({ ...espConfig });
              }}
            />
          </CCol>
          <CCol sm="1">
            <i
              className="fa fa-lg  fa-trash  text-danger ml-4"
              style={{ cursor: 'pointer', float: 'right', marginTop: '11px' }}
              onClick={() => {
                setEspConfig(null);
              }}
            ></i>
          </CCol>
        </CRow>
      </CCardHeader>
      <CCardBody>
        <CLabel>Sender configurations</CLabel>
        <div className=" mb-2">
          <CButton
            size="sm"
            onClick={() => {
              espConfig.senders.push({});
              setEspConfig({ ...espConfig });
            }}
            color="secondary"
          >
            Add Sender configuration
          </CButton>
        </div>

        {espConfig.senders.map((senderConfig, index) => {
          return (
            <SenderConfigEditor
              key={emailingDatabaseApiContext.getUid() + index}
              espConfig={espConfig}
              senderConfig={senderConfig}
              setSenderConfig={(newSenderConfig) => {
                if (newSenderConfig === null) {
                  espConfig.senders.splice(index, 1);
                } else {
                  espConfig.senders[index] = newSenderConfig;
                }
                setEspConfig({ ...espConfig });
              }}
              loadingCounts={loadingCounts}
              counts={counts}
              managedEsps={managedEsps}
              emailingDatabaseApiContext={emailingDatabaseApiContext}
            />
          );
        })}
      </CCardBody>
    </CCard>
  );
};
