import { CInput, CSelect } from '@coreui/react';
import React from 'react';

export default ({ filter, setFilter }) => {
  let operators = OPERATORS[''];
  switch (filter.field) {
    case 'email':
    case 'lastname':
    case 'firstname':
    case 'zipcode':
    case 'street':
    case 'city':
      operators = OPERATORS['string'];
      break;

    case 'segment':
      operators = OPERATORS['number'];
      break;

    case 'customFields':
      operators = OPERATORS[filter.fieldType ? filter.fieldType : ''];
      break;
    default:
      operators = OPERATORS[''];
      break;
  }

  return (
    <>
      <CSelect
        className="mx-2"
        size="sm"
        value={filter.field}
        style={{ width: '200px', display: 'inline-block' }}
        onChange={(event) => {
          filter.field = event.target.value;
          setFilter({ ...filter });
        }}
      >
        <option value="">Choose field</option>
        <option value="email">Email</option>
        <option value="firstname">Firstname</option>
        <option value="lastname">Lastname</option>
        <option value="zipcode">Zipcode</option>
        <option value="street">Street</option>
        <option value="city">City</option>
        <option value="segment">Segment</option>
        <option value="customFields">Custom Field</option>
        <option value="md5">MD5</option>
        <option value="sha1">SHA1</option>
        <option value="sha256">SHA256</option>
      </CSelect>
      {filter.field === 'customFields' && (
        <>
          <CInput
            className="mr-2"
            size="sm"
            style={{ width: '100px', display: 'inline-block' }}
            value={filter.customField}
            placeholder="Field Name"
            onChange={(event) => {
              filter.customField = event.target.value;
              setFilter({ ...filter });
            }}
          />
          <CSelect
            className="mr-2"
            size="sm"
            value={filter.fieldType}
            style={{ width: '100px', display: 'inline-block' }}
            onChange={(event) => {
              filter.fieldType = event.target.value;
              setFilter({ ...filter });
            }}
          >
            <option value={''}>Field Type</option>
            <option value={'string'}>String</option>
            <option value={'boolean'}>Boolean</option>
            <option value={'number'}>Number</option>
          </CSelect>
        </>
      )}

      <CSelect
        className="mr-2"
        size="sm"
        value={filter.operator}
        style={{ width: '100px', display: 'inline-block' }}
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
        style={{ width: '150px', display: 'inline-block' }}
        value={filter.value}
        placeholder="Value"
        onChange={(event) => {
          filter.value = event.target.value;
          setFilter({ ...filter });
        }}
      />
    </>
  );
};

var OPERATORS = {
  boolean: {
    'IS TRUE': 'True',
    'IS FALSE': 'False',
    'IS NULL': 'Is Null',
    'IS NOT NULL': 'Is Not Null'
  },
  string: {
    '=': 'Equals',
    LIKE: 'Contains',
    '!=': 'Not Equals',
    'NOT LIKE': 'Not Contains',
    'IS NULL': 'Is Null',
    'IS NOT NULL': 'Is Not Null',
    '>=': '>=',
    '>': '>',
    '<': '<',
    '<=': '<='
  },
  number: {
    '=': '=',
    '>=': '>=',
    '>': '>',
    '<': '<',
    '<=': '<=',
    'IS NULL': 'Is Null',
    'IS NOT NULL': 'Is Not Null'
  },
  '': {
    '=': '='
  }
};
