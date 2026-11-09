import React, { useContext, useEffect, useState } from 'react';
import { CButton, CCol, CFormGroup, CInput, CInputCheckbox, CLabel, CRow, CCard, CSelect, CSpinner, CSwitch } from '@coreui/react';
import { gql, useMutation } from '@apollo/client';
import SchedulesSelector from '../../sendings/schedules/SchedulesSelector';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import EspSelector from '../../../common/EspSelector';

export default ({ source, refetch }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const [apiScheduleIds, setApiScheduleIds] = useState(source.apiScheduleIds);
  const [apiFields, setApiFields] = useState(source.apiFields);

  const [apiSettings, setApiSettings] = useState(source.apiSettings ?? {});

  const [updateContactSource, { loading: saving, data: dataSaved }] = useMutation(
    gql`
      mutation updateContactSource($source: JSON!) {
        updateContactSource(source: $source) {
          id
          name
          apiEnabled
          apiKey
          apiFields
          apiScheduleIds
          apiSettings
        }
      }
    `
  );

  useEffect(() => {
    if (dataSaved) {
      setApiFields(JSON.parse(JSON.stringify(dataSaved.updateContactSource.apiFields)));
      setApiScheduleIds(dataSaved.updateContactSource.apiScheduleIds);
    }
  }, [dataSaved, setApiScheduleIds, setApiFields]);

  return (
    <>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="name">Enabled</CLabel>
          </CCol>
          <CCol md="10">
            <CSwitch
              className={'mx-1 float-left mr-3 '}
              color={'primary'}
              variant={'3d'}
              labelOn={'\u2713'}
              labelOff={'\u2715'}
              checked={source.apiEnabled}
              disabled={!source.apiKey}
              onChange={async (event) => {
                await updateContactSource({
                  variables: {
                    source: {
                      id: source.id,
                      apiEnabled: event.target.checked
                    }
                  }
                });
                refetch();
              }}
            />
          </CCol>
        </CFormGroup>
      </CCol>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="name">Api Endpoint</CLabel>
          </CCol>
          <CCol md="10">
            <CLabel htmlFor="name">{emailingDatabaseApiContext.database.apiEndpoint}/source/contact/inscription</CLabel>
          </CCol>
        </CFormGroup>
      </CCol>

      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="apiKey">ApiKey</CLabel>
          </CCol>
          <CCol md="7">
            <CInput size="sm" name="apiKey" value={source.apiKey} disabled={true} />
          </CCol>
          <CCol md="3">
            <CButton
              size="sm"
              className="w-100"
              color="primary"
              onClick={async () => {
                await updateContactSource({
                  variables: {
                    source: {
                      id: source.id,
                      apiKey: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2)
                    }
                  }
                });
                refetch();
              }}
            >
              Generate new ApiKey
            </CButton>
          </CCol>
        </CFormGroup>
      </CCol>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="apiKey">Api Schedules</CLabel>
          </CCol>
          <CCol md="10">
            <SchedulesSelector scheduleIds={apiScheduleIds} setScheduleIds={setApiScheduleIds} types={['inscription']} />
          </CCol>
        </CFormGroup>
      </CCol>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="apiKey">Api Filters</CLabel>
          </CCol>
          <CCol md="10">
            <ApiFiltersEditor
              apiFilters={apiSettings?.filters ?? []}
              setApiFilters={(filters) => {
                setApiSettings({ ...apiSettings, filters });
              }}
            />
          </CCol>
        </CFormGroup>
      </CCol>
      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="apiKey">Enable duplicated contacts</CLabel>
          </CCol>
          <CCol md="10">
            <CSwitch
              className={'mx-1 float-left mr-3 '}
              color={'primary'}
              variant={'3d'}
              labelOn={'\u2713'}
              labelOff={'\u2715'}
              checked={apiSettings?.acceptDuplicates}
              onChange={async (event) => {
                setApiSettings({ ...apiSettings, acceptDuplicates: event.target.checked });
              }}
            />
          </CCol>
        </CFormGroup>
      </CCol>

      <CCol xl={12}>
        <CFormGroup row>
          <CCol md="2">
            <CLabel htmlFor="apiKey">Api Fields</CLabel>
          </CCol>
          <CCol md="10">
            <ApiFieldsEditor apiFields={apiFields} setApiFields={setApiFields} />
          </CCol>
        </CFormGroup>
      </CCol>

      <CCol xl={12}>
        <CButton
          size="sm"
          color="primary"
          onClick={async () => {
            await updateContactSource({
              variables: {
                source: {
                  id: source.id,
                  apiScheduleIds,
                  apiFields,
                  apiSettings
                }
              }
            });
          }}
        >
          {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
          Save
        </CButton>
      </CCol>
    </>
  );
};

const ApiFieldsEditor = ({ apiFields, setApiFields }) => {
  if (!apiFields) {
    apiFields = {};
  }
  apiFields = { ...DEFAULT_FIELDS, ...apiFields };
  if ('email' in apiFields) {
    apiFields.email.required = true;
    apiFields.email.enabled = true;
  }

  return (
    <div>
      {Object.keys(apiFields).map((field, index) => {
        const apiField = apiFields[field];

        return (
          <div className="mb-2" style={{ display: 'flex', flexDirection: 'row' }} key={index}>
            <ApiFieldEditor
              name={field}
              apiField={apiField}
              update={(name, value) => {
                delete apiFields[field];
                apiFields[name] = value;
                setApiFields({ ...apiFields });
              }}
            />
            {!(field in DEFAULT_FIELDS) && (
              <i
                className="pt-2 fas fa-trash d-inline-block"
                onClick={() => {
                  delete apiFields[field];
                  setApiFields({ ...apiFields });
                }}
                style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', color: '#d93737' }}
              ></i>
            )}
          </div>
        );
      })}
      <CButton
        size="sm"
        color="secondary"
        className="mt-0"
        onClick={() => {
          setApiFields({ ...apiFields, '': { uid: Math.round(Math.random() * 100000).toString() } });
        }}
      >
        Add field
      </CButton>
    </div>
  );
};
const ApiFieldEditor = ({ name, apiField, update }) => {
  return (
    <>
      <CSwitch
        className={'mx-1 float-left mr-3 '}
        color={'primary'}
        variant={'3d'}
        labelOn={'\u2713'}
        labelOff={'\u2715'}
        checked={apiField.enabled}
        disabled={name === 'email'}
        onChange={async (event) => {
          if (event.target.checked === apiField.enabled) {
            return;
          }
          apiField.enabled = event.target.checked;
          update(name, apiField);
        }}
      />

      <CInput
        size="sm"
        className="d-inline-block mr-2"
        placeholder="Field Name"
        style={{ width: '140px' }}
        disabled={name in DEFAULT_FIELDS}
        type="text"
        value={name}
        onChange={(event) => {
          update(event.target.value, apiField);
        }}
      />
      <div>
        <div>
          <CSelect
            size="sm"
            style={{ width: '150px' }}
            custom
            name="type"
            id="type"
            className="d-inline-block mr-2"
            value={apiField.type}
            onChange={(event) => {
              apiField.type = event.target.value;
              if (apiField.type === 'manual') {
                apiField.required = false;
              }
              update(name, apiField);
            }}
          >
            <option value="">Api Field</option>
            <option value="manual">Manual value</option>
          </CSelect>
          {apiField.type === 'manual' && (
            <CInput
              size="sm"
              className="d-inline-block mr-2"
              placeholder="Value"
              style={{ width: '200px' }}
              type="text"
              value={apiField.value}
              onChange={(event) => {
                apiField.value = event.target.value;
                update(name, apiField);
              }}
            />
          )}
        </div>

        {apiField.type !== 'manual' && (
          <>
            <div>
              <CFormGroup variant="checkbox" className="checkbox" inline>
                <CInputCheckbox
                  id={'required_' + name}
                  disabled={name === 'email'}
                  checked={apiField.required}
                  onChange={(event) => {
                    apiField.required = event.target.checked;
                    update(name, apiField);
                  }}
                />
                <CLabel variant="checkbox" className="form-check-label" htmlFor={'required_' + name}>
                  Required
                </CLabel>
              </CFormGroup>
            </div>
            <div>
              <ValidatorsEditor
                validators={apiField.validators}
                update={(validators) => {
                  apiField.validators = validators;
                  update(name, apiField);
                }}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};

const ValidatorsEditor = ({ validators, update }) => {
  if (!validators) {
    validators = [];
  }
  return (
    <div className={'py-0 d-block w-100'}>
      {validators.map((validator, index) => {
        return (
          <div key={index} className="mb-2">
            <ValidatorEditor
              validator={validator}
              update={(newValidator) => {
                validators.splice(index, 1, newValidator);
                update([...validators]);
              }}
            />
          </div>
        );
      })}
      <CButton
        size="sm"
        color="info"
        className=""
        onClick={() => {
          validators.push({});
          update([...validators]);
        }}
      >
        Add validator
      </CButton>
    </div>
  );
};
const ValidatorEditor = ({ validator, update }) => {
  return (
    <>
      <CSelect
        size="sm"
        style={{ width: '150px' }}
        custom
        name="type"
        id="type"
        className="d-inline-block mr-2"
        value={validator.type}
        onChange={(event) => {
          validator.type = event.target.value;
          update(validator);
        }}
      >
        <option value="">-- Select Type --</option>
        <option value="email_validation">Email validation</option>
        <option value="only_letter_validation">Only letters</option>
        <option value="gender_validation">Gender validation</option>
        <option value="date_format_validation">Date validation</option>
        <option value="zip_code_fr_validation">French zipcode validation</option>
        <option value="url_validation">URL validation</option>
        <option value="ip_validation">IP validation</option>
      </CSelect>
      {validator.type === 'date_format_validation' && (
        <CInput
          size="sm"
          className="d-inline-block mr-2"
          placeholder="Format ( YYYY-MM-DD)"
          style={{ width: '140px' }}
          type="text"
          value={validator.format}
          onChange={(event) => {
            validator.format = event.target.value;
            update(validator);
          }}
        />
      )}
    </>
  );
};

const DEFAULT_FIELDS = {
  email: {
    required: true,
    validators: [
      {
        type: 'email_validation'
      }
    ],
    uid: '1'
  },
  lastname: {
    required: true,
    validators: [
      {
        type: 'only_letter_validation'
      }
    ],
    uid: '2'
  },
  firstname: {
    required: true,
    validators: [
      {
        type: 'only_letter_validation'
      }
    ],
    uid: '3'
  },
  gender: {
    required: true,
    validators: [
      {
        type: 'gender_validation'
      }
    ],
    uid: '4'
  },
  dob: {
    required: true,
    validators: [
      {
        type: 'date_format_validation',
        format: 'YYYY-MM-DD'
      }
    ],
    uid: '5'
  },
  street: {
    required: true
  },
  zipcode: {
    required: true,
    validators: [
      {
        type: 'zip_code_fr_validation'
      }
    ],
    uid: '6'
  },

  city: {
    required: true,
    validators: [
      {
        type: 'only_letter_validation'
      }
    ],
    uid: '7'
  },

  collectUrl: {
    required: true,
    validators: [
      {
        type: 'url_validation'
      }
    ],
    uid: '8'
  },
  ip: {
    required: true,
    validators: [
      {
        type: 'ip_validation'
      }
    ],
    uid: '9'
  }
};

const ApiFiltersEditor = ({ apiFilters, setApiFilters }) => {
  if (!apiFilters) {
    apiFilters = [];
  }

  return (
    <div>
      <div className={'py-0 d-block w-100'}>
        {apiFilters.map((filter, index) => {
          return (
            <div key={index} className="mb-2">
              <FilterEditor
                filter={filter}
                setFilter={(newChild) => {
                  apiFilters.splice(index, 1, newChild);
                  setApiFilters([...apiFilters]);
                }}
              />
            </div>
          );
        })}
        <CButton
          color="info"
          className=""
          size="sm"
          onClick={() => {
            apiFilters.push({ type: 'fieldValue' });
            setApiFilters([...apiFilters]);
          }}
        >
          Add filter
        </CButton>
      </div>
    </div>
  );
};

const FilterEditor = ({ filter, setFilter }) => {
  if (!filter) {
    return null;
  }
  return (
    <CRow className="mb-2">
      <CCol xl={12}>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <CCard color="secondary" style={{ width: '100%', margin: '0', padding: '5px', display: 'flex', flexDirection: 'row' }}>
            <CSelect
              size="sm"
              style={{ width: '150px' }}
              custom
              name="type"
              id="type"
              value={filter.type}
              onChange={(event) => {
                filter.type = event.target.value;
                setFilter(filter);
              }}
            >
              <option value="">-- Select Type --</option>
              <option value="espExclude">Esp exclusion</option>
              <option value="espInclude">Esp inclusion</option>
              <option value="dailyCapping">Daily Capping</option>
              <option value="monthlyCapping">Monthly Capping</option>
            </CSelect>

            {(filter.type === 'espExclude' || filter.type === 'espInclude') && <EspsEditor filter={filter} setFilter={setFilter} />}
            {(filter.type === 'dailyCapping' || filter.type === 'monthlyCapping') && <CappingEditor filter={filter} setFilter={setFilter} />}
          </CCard>
          <i
            className="pt-3 fas fa-trash"
            onClick={() => {
              setFilter(null);
            }}
            style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block', color: '#d93737' }}
          ></i>
        </div>
      </CCol>
    </CRow>
  );
};

const EspsEditor = ({ filter, setFilter }) => {
  return (
    <div className="mx-2" style={{ width: '100%' }}>
      <EspSelector
        style={{ width: '100%' }}
        esps={filter.esps ? filter.esps : []}
        setEsps={(esps) => {
          filter.esps = esps;
          setFilter(filter);
        }}
      />
    </div>
  );
};

const CappingEditor = ({ filter, setFilter }) => {
  const onSubTypeChange = (value) => {
    let newFilter = { ...filter };
    if (value) {
      newFilter.subtype = value.target.value;
    } else {
      newFilter.subtype = undefined;
    }
    setFilter(newFilter);
  };

  const onThresoldChange = (value) => {
    let newFilter = { ...filter };
    if (value) {
      newFilter.threshold = value;
    } else {
      newFilter.threshold = undefined;
    }
    setFilter(newFilter);
  };

  return (
    <div className="mx-2" style={{ display: 'flex', flexDirection: 'row' }}>
      <CSelect size="sm" className="w-100 mx-2" custom value={filter?.subtype} onChange={onSubTypeChange}>
        <option value="">-- Select Type --</option>
        <option value="uniqueInscriptions"># Unique Inscriptions</option>
        <option value="news"># News</option>
      </CSelect>
      <CInput
        size="sm"
        placeholder="Capping Value"
        type="integer"
        className="w-100 mx-2"
        value={filter?.threshold}
        onChange={(event) => {
          onThresoldChange(event.target.value);
        }}
      />
    </div>
  );
};
