import React from 'react';
import { CButton, CCol, CInput, CRow, CSelect } from '@coreui/react';

export default ({ filter, setFilter }) => {
  return (
    <CRow className="py-1">
      <CCol xl={12}>
        <Condition filter={filter} setFilter={setFilter} first={true} />
      </CCol>
    </CRow>
  );
};

const isFieldValueCondition = (type) => {
  let result = type === 'collectUrl' || type === 'ip' || type === 'sourceName';
  return result;
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
          value={filter?.type}
          style={{ width: '200px', display: 'inline-block' }}
          onChange={(event) => {
            filter.type = event.target.value;
            setFilter({ ...filter });
          }}
        >
          <option value="">Choose a condition</option>
          <option value="or">OR</option>
          <option value="and">AND</option>
          <option value="collectUrl">Collect Url</option>
          <option value="esp">Esp</option>
          <option value="sourceName">Source Name</option>
          <option value="ip">Ip</option>
        </CSelect>

        {isFieldValueCondition(filter?.type) && <FieldValueCondition filter={filter} setFilter={setFilter} />}
        {filter?.type==='esp' && <EspCondition filter={filter} setFilter={setFilter} />}
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
        onClick={(event) => {
          event.stopPropagation();
          filter.children.push({ type: '' });
          setFilter({ ...filter });
        }}
      >
        Add condition
      </CButton>
    </div>
  );
};

const FieldValueCondition = ({ filter, setFilter }) => {
  let operators = {
    is: 'Equals',
    startsWith: 'StartsWith',
    regExp: 'regExp'
  };

  return (
    <>
      <CSelect
        className="mr-2"
        size="sm"
        value={filter.operator}
        style={{ width: '150px', display: 'inline-block' }}
        onChange={(event) => {
          filter.operator = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="">-- Operator --</option>
        {Object.keys(operators).map((operator, index) => {
          return (
            <option key={index} value={operator}>
              {operators[operator]}
            </option>
          );
        })}
      </CSelect>
      <CInput
        className="mr-2"
        size="sm"
        style={{ width: '250px', display: 'inline-block' }}
        value={filter?.value ?? ''}
        placeholder="Value"
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter({ ...filter });
        }}
      />
    </>
  );
};

const EspCondition = ({ filter, setFilter }) => {
  return (
    <>
      <CInput
        className="mr-2"
        size="sm"
        style={{ width: '250px', display: 'inline-block' }}
        value={filter?.value ?? ''}
        placeholder="Value"
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter({ ...filter });
        }}
      />
    </>
  );
};
