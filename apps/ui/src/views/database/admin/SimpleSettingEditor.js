import React from 'react';
import { CButton, CInput, CProgress, CSpinner } from '@coreui/react';

export default ({ settingName, settingValue, setSetting, updateSettingsAndNotify, min, max, step, loading, showProgress }) => {
  min = min ?? 0;
  max = max ?? 1;
  step = step ?? 0.1;
  return (
    <>
      {loading && <CSpinner />}
      {!loading && (
        <>
          <div className="d-flex flex-row">
            <CInput
              type="number"
              id={settingName}
              required
              value={settingValue}
              step={step}
              min={min}
              max={max}
              onChange={(event) => {
                setSetting(event.target.value);
              }}
            ></CInput>
            <CButton
              className={'mx-2'}
              color="primary"
              onClick={async () => {
                await updateSettingsAndNotify(settingName, settingValue);
              }}
            >
              Save
            </CButton>
          </div>
          {showProgress && <CProgress value={settingValue} min={min} max={max} showValue className="mt-2" />}
        </>
      )}
    </>
  );
};
