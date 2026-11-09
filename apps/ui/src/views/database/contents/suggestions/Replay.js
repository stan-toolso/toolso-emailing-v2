import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import moment from 'moment-timezone';
import gql from 'graphql-tag';
import { CCard, CCardBody, CCardHeader, CInput, CSelect } from '@coreui/react';
import { ReplayContentTable } from './ReplayContentTable';
import CreateContentModal from '../list/CreateContentModal';
import { AllContentTypes } from '../ContentsTypes';

export default () => {
  const [replaySuggestContents, setReplaySuggestContents] = useState([]);
  const [showModalCreation, setShowModalCreation] = useState(false);
  const [contentToClone, setContentToClone] = useState(null);
  const [name, setName] = useState('');
  const [maxSuggestionsCount, setMaxSuggestionsCount] = useState(20);
  const [type, setType] = useState('');

  const fromDate = moment().subtract(3, 'month');
  const toDate = moment().subtract(5, 'day');
  const showCountList = [10, 20, 50, 100, 200, 500];

  const { loading, data, refetch } = useQuery(
    gql`
      query ContentReplaySuggestion($filter: JSON, $limit: Int) {
        contents(filter: $filter, limit: $limit) {
          contents {
            id
            isActive
            name
            createdAt
            endDate
            type
            delivStats {
              request
              unique_click
              unique_open
              unique_proxy_loaded
            }
          }
        }
      }
    `,
    {
      variables: {
        filter: {
          createdFromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
          CreatedToDate: toDate ? toDate.format('YYYY-MM-DD') : null
        },
        limit: 3000
      }
    }
  );

  useEffect(() => {
    if (data) {
      setReplaySuggestContents(data.contents.contents);
    }
  }, [setReplaySuggestContents, data]);

  var filteredReplaySuggestContents = FilterReplaySuggestContents(replaySuggestContents, name, type);

  return (
    <>
      <CreateContentModal
        replay="true"
        show={showModalCreation}
        contentToClone={contentToClone}
        toggle={() => {
          refetch();
          setShowModalCreation(false);
        }}
      />
      <CCard>
        <CCardHeader>
          <span className="d-flex justify-content-end">
            <CInput
              value={name}
              style={{ padding: '0px 3px', marginRight: '10px' }}
              placeholder="Search"
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="form-control"
              size="sm"
            />

            <CSelect
              style={{ display: 'inline-block', width: '120px' }}
              className="form-control mr-2"
              size="sm"
              onChange={(event) => {
                setType(event.target.value);
              }}
              value={type}
            >
              {Object.keys(AllContentTypes).map((key) => {
                return (
                  <option value={key} key={key}>
                    {AllContentTypes[key]}
                  </option>
                );
              })}
            </CSelect>

            <span>Show</span>
            <CSelect
              size="sm"
              style={{ width: '80px' }}
              className="d-inline-block ml-2"
              value={maxSuggestionsCount}
              onChange={(event) => {
                setMaxSuggestionsCount(parseInt(event.target.value));
              }}
            >
              {showCountList.map((item, index) => {
                return (
                  <option value={item} key={index}>
                    {item}
                  </option>
                );
              })}
            </CSelect>
          </span>
        </CCardHeader>

        <CCardBody className="p-0">
          <ReplayContentTable
            loading={loading}
            replaySuggestContents={filteredReplaySuggestContents}
            forceUpdate={refetch}
            maxSuggestionsCount={maxSuggestionsCount}
            cloneContent={(content) => {
              setContentToClone(content);
              setShowModalCreation(true);
            }}
          />
        </CCardBody>
      </CCard>
    </>
  );
};

function FilterReplaySuggestContents(replaySuggestContents, name, type) {
  return (
    replaySuggestContents &&
    replaySuggestContents.filter((item) => {
      if (type && item.type !== type) {
        return false;
      }
      if (!name) {
        return true;
      }
      let label = item.name ? item.name : '';
      return label.toLowerCase().indexOf(name.toLowerCase()) >= 0;
    })
  );
}
