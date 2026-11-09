import React, { useState, useEffect } from 'react';
import { CCard, CCardHeader, CCardBody, CRow, CCol, CLabel } from '@coreui/react';
import ComplaintReductionPolicyParamsEditor from './ComplaintReductionPolicyParamsEditor.js';

import SimpleSettingEditor from './SimpleSettingEditor.js';
import { gql, useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EspSelector from '../../common/EspSelector.js';

export default ({ section }) => {
  const [complaintReductionPolicyStrats, setComplaintReductionPolicyStrats] = useState([]);
  const [maxPressureReductionRatio, setMaxPressureReductionRatio] = useState();
  const [complaintReductionPolicyLevel, setComplaintReductionPolicyLevel] = useState();
  const [wantedEsps, setWantedEsps] = useState(['default', 'gmail', 'orange', 'hotmail']);
  function toastSuccess(message) {
    toast.success(message, {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }

  const { data, loading, refetch } = useQuery(
    gql`
      query getSettings($names: [String]!) {
        getSettings(names: $names)
      }
    `,
    {
      variables: {
        names: ['marketingPressureStrategies', 'maxPressureReductionRatio', 'complaintReductionPolicyLevel']
      }
    }
  );

  const [updateSettings] = useMutation(
    gql`
      mutation updateSettings($settings: JSON!) {
        updateSettings(settings: $settings)
      }
    `
  );

  async function updateSettingsAndNotify(paramName, paramValue) {
    let variables = { settings: {} };
    let paramNameSplit = paramName.split('.');
    variables.settings.complaintReductionPolicyLevel = { ...complaintReductionPolicyLevel };
    if (paramNameSplit.length == 2) {
      if (!variables.settings[paramNameSplit[0]]) {
        variables.settings[paramNameSplit[0]] = {};
      } else {
        variables.settings[paramNameSplit[0]] = { ...data.getSettings[paramNameSplit[0]] };
      }
      variables.settings[paramNameSplit[0]][paramNameSplit[1]] = parseFloat(paramValue);
      if (isNaN(variables.settings[paramNameSplit[0]][paramNameSplit[1]])) {
        variables.settings[paramNameSplit[0]][paramNameSplit[1]] = undefined;
      }
    } else {
      variables.settings[paramName] = parseFloat(paramValue);
    }
    await updateSettings({ variables });
    toastSuccess(`${paramName} updated`);
  }

  function setReductionPolicyLevel(esp) {
    return (value) => {
      let newComplaintReductionPolicyLevel = { ...complaintReductionPolicyLevel };
      newComplaintReductionPolicyLevel[esp] = parseInt(value) ?? undefined;
      setComplaintReductionPolicyLevel(newComplaintReductionPolicyLevel);
    };
  }

  useEffect(() => {
    if (data && data.getSettings && data.getSettings.marketingPressureStrategies) {
      setComplaintReductionPolicyStrats(JSON.parse(JSON.stringify(data.getSettings.marketingPressureStrategies)));
    }
    if (data && data.getSettings && data.getSettings.maxPressureReductionRatio) {
      setMaxPressureReductionRatio(data.getSettings.maxPressureReductionRatio);
    }
    if (data && data.getSettings && data.getSettings.complaintReductionPolicyLevel) {
      setComplaintReductionPolicyLevel(JSON.parse(JSON.stringify(data.getSettings.complaintReductionPolicyLevel)));
      let newWantedEsps = [];
      for (let esp in data.getSettings.complaintReductionPolicyLevel) {
        newWantedEsps.push(esp);
      }
      newWantedEsps = newWantedEsps.sort((a, b) => a.localeCompare(b));
      setWantedEsps(newWantedEsps);
    }
  }, [data, setComplaintReductionPolicyStrats, setMaxPressureReductionRatio, setComplaintReductionPolicyLevel]);

  if (section == 'marketing_pressures') {
    return (
      <>
        <CRow>
          <CCard>
            <CCardHeader>Complaint Reduction Policy Level</CCardHeader>
            <CCardBody>
              <EspSelector style={{ width: '100%' }} esps={wantedEsps} setEsps={setWantedEsps} defaultOption={true} />
              <CRow>
                {wantedEsps.map((esp) => {
                  return (
                    <CCol key={esp}>
                      <CLabel>{esp}</CLabel>
                      <SimpleSettingEditor
                        settingValue={complaintReductionPolicyLevel ? complaintReductionPolicyLevel[esp] : null}
                        settingName={`complaintReductionPolicyLevel.${esp}`}
                        setSetting={setReductionPolicyLevel(esp)}
                        updateSettingsAndNotify={updateSettingsAndNotify}
                        loading={loading}
                        min={0}
                        max={5}
                        step={1}
                        showProgress={true}
                      />
                    </CCol>
                  );
                })}
              </CRow>
            </CCardBody>
          </CCard>
          <CCard>
            <CCardHeader>Max Pressure Reduction Ratio</CCardHeader>
            <CCardBody>
              <CCol>
                <SimpleSettingEditor
                  settingValue={maxPressureReductionRatio}
                  settingName={'maxPressureReductionRatio'}
                  setSetting={setMaxPressureReductionRatio}
                  updateSettingsAndNotify={updateSettingsAndNotify}
                  loading={loading}
                />
              </CCol>
            </CCardBody>
          </CCard>
        </CRow>
        <CRow>
          <CCard>
            <CCardHeader>Complaint Reduction Policies</CCardHeader>
            <CCardBody>
              <CCol>
                <ComplaintReductionPolicyParamsEditor strats={complaintReductionPolicyStrats} loading={loading} refetch={refetch} updateSettings={updateSettings} toastSuccess={toastSuccess} />
              </CCol>
            </CCardBody>
          </CCard>
        </CRow>
      </>
    );
  } else {
    return <CCard>Not Implemented</CCard>;
  }
};
