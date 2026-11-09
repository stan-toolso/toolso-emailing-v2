import { CButton, CCard, CCol, CFormGroup, CInput, CInputCheckbox, CLabel, CRow, CSpinner } from '@coreui/react';
import React from 'react';
import SenderSelector from '../SenderSelector';
import { formatInteger } from '../../../common/util';
import { updateSenderWeights } from './SendingConfigs';

export const SenderConfigEditor = ({ espConfig, senderConfig, setSenderConfig, loadingCounts, counts, managedEsps, emailingDatabaseApiContext }) => {
  if (!senderConfig.minScoreByEsp) {
    senderConfig.minScoreByEsp = {};
  }
  if (!senderConfig.autoUpdates) {
    senderConfig.autoUpdates = {};
  }
  for (let esp in senderConfig.minScoreByEsp) {
    if (esp === 'default') {
      if (!espConfig.default) {
        delete senderConfig.minScoreByEsp[esp];
      }
    } else {
      if (espConfig.esps.indexOf(esp) < 0) {
        delete senderConfig.minScoreByEsp[esp];
      }
    }
  }

  return (
    <CCard className="bg-light text-dark p-2">
      <CRow>
        <CCol sm="8">
          <CFormGroup>
            <CLabel htmlFor="senderName">Sender Email</CLabel>
            <SenderSelector
              senderId={senderConfig.senderId}
              setSender={(sender) => {
                senderConfig.senderId = sender ? sender.id : null;
                setSenderConfig({ ...senderConfig });
              }}
              emailingDatabaseApiContext={emailingDatabaseApiContext}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="2">
          <CFormGroup>
            <CLabel htmlFor="weight">Weight</CLabel>
            <CInput
              size="sm"
              style={{ width: '100px' }}
              type="number"
              id="weight"
              placeholder="Weight"
              min={0}
              max={0}
              value={senderConfig.weight !== null ? senderConfig.weight : ''}
              onChange={(event) => {
                let newValue = parseInt(event.target.value);
                if (!isNaN(newValue)) {
                  senderConfig.weight = newValue;
                  updateSenderWeights(espConfig.senders, senderConfig);
                } else {
                  senderConfig.weight = event.target.value;
                }
                setSenderConfig({ ...senderConfig });
              }}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="2">
          <CButton
            className="mt-2"
            color="danger"
            size="sm"
            onClick={() => {
              setSenderConfig(null);
            }}
          >
            Remove this sender configuration
          </CButton>
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          <CFormGroup variant="checkbox" className="checkbox">
            <CInputCheckbox
              size="sm"
              id="activatedContact"
              checked={senderConfig.activatedContact ? senderConfig.activatedContact : false}
              onChange={() => {
                senderConfig.activatedContact = senderConfig.activatedContact ? false : true;
                setSenderConfig({ ...senderConfig });
              }}
            />
            <CLabel htmlFor="activatedContact">Only activated contacts</CLabel>
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="12">
          <CLabel>Min score by esps</CLabel>
          <table className="table table-sm" style={{ maxWidth: '400px' }}>
            <thead>
              <tr>
                <th>Esp</th>
                <th>Score</th>
                <th>Auto</th>
                <th>Target OR</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {[...(espConfig.default ? ['default'] : []), ...(espConfig.esps ? espConfig.esps : [])].map((esp) => {
                var minScore = esp in senderConfig.minScoreByEsp ? senderConfig.minScoreByEsp[esp] : '';
                if (!(esp in senderConfig.autoUpdates)) {
                  senderConfig.autoUpdates[esp] = {
                    enabled: false,
                    minOpenRate: 19
                  };
                }
                var autoUpdate = senderConfig.autoUpdates[esp];
                let defaultVolume = 0;
                if (counts) {
                  for (let esp in counts.esps) {
                    if (!managedEsps.includes(esp)) {
                      defaultVolume += counts.esps[esp];
                    }
                  }
                }
                return (
                  <tr key={esp}>
                    <td>{esp}</td>
                    <td>
                      <CInput
                        type="number"
                        step="1"
                        value={minScore}
                        min={0}
                        max={101}
                        onChange={(event) => {
                          let value = parseFloat(event.target.value.replace(/,/g, '.').replace(/ /g, ''));
                          if (!isNaN(value)) {
                            senderConfig.minScoreByEsp[esp] = value;
                          } else {
                            senderConfig.minScoreByEsp[esp] = event.target.value;
                          }
                          setSenderConfig({ ...senderConfig });
                        }}
                      />
                    </td>
                    <td>
                      <CFormGroup variant="checkbox" className="checkbox ml-4 pt-2">
                        <CInputCheckbox
                          size="sm"
                          id="activatedContact"
                          checked={autoUpdate.enabled}
                          onChange={() => {
                            autoUpdate.enabled = !autoUpdate.enabled;
                            setSenderConfig({ ...senderConfig });
                          }}
                        />
                      </CFormGroup>
                    </td>
                    <td>
                      <CInput
                        type="number"
                        disabled={!autoUpdate.enabled}
                        step="1"
                        value={autoUpdate.minOpenRate}
                        min={0}
                        max={101}
                        onChange={(event) => {
                          let value = parseFloat(event.target.value.replace(/,/g, '.').replace(/ /g, ''));
                          if (!isNaN(value)) {
                            autoUpdate.minOpenRate = value;
                          } else {
                            autoUpdate.minOpenRate = event.target.value;
                          }
                          setSenderConfig({ ...senderConfig });
                        }}
                      />
                    </td>
                    <td>
                      {loadingCounts && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
                      {!loadingCounts && counts && esp !== 'default' && <span>{counts && counts.esps && counts.esps[esp] ? formatInteger(counts.esps[esp]) : 0}</span>}
                      {!loadingCounts && counts && esp === 'default' && <span>{formatInteger(defaultVolume)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CCol>
      </CRow>
    </CCard>
  );
};
