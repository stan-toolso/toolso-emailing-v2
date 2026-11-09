import React, { useEffect, useState } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner, CSelect, CFormGroup, CButton, CLabel, CInput, CInputCheckbox } from '@coreui/react';
import ReactTagInput from '@pathofdev/react-tag-input';

import { toast } from 'react-toastify';
import { gql, useMutation, useQuery } from '@apollo/client';
import Switch from 'react-switch';
import '@pathofdev/react-tag-input/build/index.css';

export default ({ match }) => {
  const ruleId = match.params.rule_id;

  const [name, setName] = useState('');
  const [filter, setFilter] = useState({});
  const [actions, setActions] = useState([]);

  const { loading, data, refetch } = useQuery(
    gql`
      query contactMessageRule($id: ID!) {
        contactMessageRule(id: $id) {
          id
          name
          enabled
          actions
          filter
        }
      }
    `,
    {
      variables: {
        id: ruleId
      }
    }
  );
  useEffect(() => {
    if (data) {
      setName(data.contactMessageRule.name);
      setFilter(JSON.parse(JSON.stringify(data.contactMessageRule.filter)));
      setActions(JSON.parse(JSON.stringify(data.contactMessageRule.actions)));
    }
  }, [data, setName]);
  const rule = data ? JSON.parse(JSON.stringify(data.contactMessageRule)) : null;

  const [updateContactMessageRule, { loading: loadingUpdate }] = useMutation(gql`
    mutation updateContactMessageRule($contactMessageRule: JSON!) {
      updateContactMessageRule(contactMessageRule: $contactMessageRule) {
        id
        name
        enabled
        actions
        filter
      }
    }
  `);

  return (
    <CRow className="inscription-detail">
      <CCol xl={12}>
        <CCard>
          <CCardHeader>
            {rule && (
              <Switch
                className={'mx-1 float-left mr-3 '}
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
            )}
            Rule: #{ruleId}
          </CCardHeader>
          <CCardBody>
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                <CSpinner animation="grow" color="secondary" />
              </div>
            )}
            {!loading && rule && (
              <>
                <CRow>
                  <CCol xl={12}>
                    <CFormGroup>
                      <CLabel htmlFor="name">Name</CLabel>
                      <CInput size="sm" type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
                    </CFormGroup>
                  </CCol>

                  <CCol xl={12}>
                    <CLabel htmlFor="name">Condition</CLabel>
                    <Condition filter={filter} setFilter={setFilter} first={true} />
                  </CCol>

                  <CCol xl={12}>
                    <CLabel htmlFor="name">Actions</CLabel>
                    <ActionsEditor actions={actions} setActions={setActions} />
                  </CCol>
                </CRow>

                <CRow>
                  <CCol xl={12}>
                    <CButton
                      color="primary"
                      onClick={async () => {
                        await updateContactMessageRule({
                          variables: {
                            contactMessageRule: {
                              id: rule.id,
                              name,
                              filter,
                              actions
                            }
                          }
                        });
                        refetch();
                      }}
                    >
                      {loadingUpdate && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
                      Save
                    </CButton>
                  </CCol>
                </CRow>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

const Condition = ({ filter, setFilter, first }) => {
  return (
    <div className="py-1">
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {!first && (
          <i
            className="pt-2 fas fa-trash"
            onClick={() => {
              setFilter(null);
            }}
            style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block', color: '#d93737' }}
          ></i>
        )}
        <CSelect
          className="mr-2"
          size="sm"
          value={filter.type}
          style={{ width: '200px', display: 'inline-block' }}
          onChange={(event) => {
            filter.type = event.target.value;
            setFilter({ ...filter });
          }}
        >
          <option value="">Choose a condition</option>
          <option value="or">OR</option>
          <option value="and">AND</option>
          <option value="keywords">Keywords</option>
          <option value="field">Field</option>
        </CSelect>
        {filter.type === 'keywords' && <KeywordsEditor filter={filter} setFilter={setFilter} />}
        {filter.type === 'field' && <FieldsEditor filter={filter} setFilter={setFilter} />}
      </div>

      {(filter.type === 'or' || filter.type === 'and') && <ChildCondition filter={filter} setFilter={setFilter} />}
    </div>
  );
};

const ChildCondition = ({ filter, setFilter }) => {
  if (!filter.children) {
    filter.children = [{}];
  }
  return (
    <div className="pl-3 py-1">
      {filter.children.map((child, index) => {
        return (
          <Condition
            key={index}
            filter={child}
            setFilter={(value) => {
              if (value) {
                filter.children = [...filter.children.slice(0, index), value, ...filter.children.slice(index + 1)];
              } else {
                filter.children = [...filter.children.slice(0, index), ...filter.children.slice(index + 1)];
              }
              setFilter({ ...filter });
            }}
          />
        );
      })}
      <CButton
        size="sm"
        color="success"
        onClick={() => {
          filter.children.push({ type: '' });
          setFilter({ ...filter });
        }}
      >
        Add condition
      </CButton>
    </div>
  );
};

const KeywordsEditor = ({ filter, setFilter }) => {
  if (!filter.fields) {
    filter.fields = {
      message: true,
      title: false
    };
  }
  if (!filter.keywords) {
    filter.keywords = [];
  }
  const toggleField = (field) => {
    filter.fields[field] = !filter.fields[field];
    setFilter({ ...filter });
  };
  return (
    <div className="w-100">
      <div>
        <CLabel inline>Fields : </CLabel>
        <CFormGroup variant="checkbox" className="checkbox" inline>
          <CInputCheckbox id="message" checked={filter.fields.message} onChange={() => toggleField('message')} />
          <CLabel variant="checkbox" className="form-check-label" htmlFor="day1">
            Message
          </CLabel>
        </CFormGroup>
        <CFormGroup variant="checkbox" className="checkbox" inline>
          <CInputCheckbox id="title" checked={filter.fields.title} onChange={() => toggleField('title')} />
          <CLabel variant="checkbox" className="form-check-label" htmlFor="day2">
            Title
          </CLabel>
        </CFormGroup>
      </div>

      <div>
        <ReactTagInput
          tags={filter.keywords}
          placeholder="Add keywords"
          onChange={(values) => {
            filter.keywords = values;
            setFilter({ ...filter });
          }}
          className="w-100"
        />
      </div>
    </div>
  );
};

const FieldsEditor = ({ filter, setFilter }) => {
  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.fieldName}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          filter.fieldName = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="">Choose a field</option>
        <option value="message">Message</option>
        <option value="title">Title</option>
        <option value="to">To</option>
        <option value="from">From</option>
      </CSelect>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.operator}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          filter.operator = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="">Choose an operator</option>
        <option value="=">=</option>
        <option value="!=">!=</option>
        <option value="contains">Contains</option>
        <option value="iContains">Contains (case insensitive)</option>
        <option value="notContains">Not Contains</option>
        <option value="iNotContains">Not Contains (case insensitive)</option>
      </CSelect>
      <CInput
        size="sm"
        type="text"
        placeholder="Value"
        value={filter.value}
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter({ ...filter });
        }}
      />
    </>
  );
};

const ActionsEditor = ({ actions, setActions }) => {
  if (!actions || !Array.isArray(actions)) {
    actions = [];
  }
  return (
    <div className="pl-3 py-1">
      {actions.map((action, index) => {
        return (
          <ActionEditor
            key={index}
            action={action}
            setAction={(value) => {
              if (value) {
                actions = [...actions.slice(0, index), value, ...actions.slice(index + 1)];
              } else {
                actions = [...actions.slice(0, index), ...actions.slice(index + 1)];
              }
              setActions([...actions]);
            }}
          />
        );
      })}
      <CButton
        size="sm"
        color="success"
        onClick={() => {
          actions.push({ type: '' });
          setActions([...actions]);
        }}
      >
        Add action
      </CButton>
    </div>
  );
};

const ActionEditor = ({ action, setAction }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }} className="py-1">
      <i
        className="pt-2 fas fa-trash"
        onClick={() => {
          setAction(null);
        }}
        style={{ cursor: 'pointer', width: '30px', paddingLeft: '10px', paddingTop: '10px', display: 'block', color: '#d93737' }}
      ></i>

      <CSelect
        className="mr-2"
        size="sm"
        value={action.type}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          action.type = event.target.value;
          setAction({ ...action });
        }}
      >
        <option value="">Choose action</option>
        <option value="markAsDone">Mark as done</option>
        <option value="blacklist">Blacklist</option>
        <option value="unsubscribe">Unsubscribe</option>
      </CSelect>
    </div>
  );
};
