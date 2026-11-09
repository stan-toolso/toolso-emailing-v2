import { useQuery } from '@apollo/client';
import { CCard, CCardBody, CCardHeader, CInput, CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useEffect, useState } from 'react';
import { StatsInstanceFields, StatsInstanceTable } from './StatsContentTable.js';
import RangeDatePicker from '../../../common/RangeDatePicker.js';
import { AllContentTypes } from '../ContentsTypes.js';

export default ({ defaultFromDate, defaultToDate, canEditSenderName }) => {
  const [name, setName] = useState('');
  const [statsContents, setStatsContents] = useState([]);
  const [sortField, setSortField] = useState('request');
  const [order, setOrder] = useState('desc');
  const [type, setType] = useState('');

  const [fromDate, setFromDate] = useState(defaultFromDate ? defaultFromDate : null);
  const [toDate, setToDate] = useState(defaultToDate ? defaultToDate : null);

  const { loading, data, refetch } = useQuery(
    gql`
      query dimensionDelivStatsByObjectSender($fromDate: String!, $toDate: String!, $dimensionType: String) {
        dimensionDelivStats(fromDate: $fromDate, toDate: $toDate, dimensionType: $dimensionType) {
          dimensionsStats {
            dimension {
              id
              object
            }
            totalStats {
              request
              unique_open
              unique_proxy_loaded
              unique_click
              unsub
              complaint
              soft_bounce
              hard_bounce
            }
          }
        }
      }
    `,
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
        dimensionType: 'objectSender'
      },
      skip: !fromDate || !toDate,
      fetchPolicy: 'no-cache' /*nécessaire car nos id de résultats de query ne sont pas uniques*/
    }
  );

  useEffect(() => {
    if (data) {
      setStatsContents(data.dimensionDelivStats.dimensionsStats);
    }
  }, [setStatsContents, data]);

  var filteredstatsContents = FilterStatContents(statsContents, name, type);

  let fields = [StatsInstanceFields.subject, StatsInstanceFields.request, StatsInstanceFields.openers, StatsInstanceFields.unique_click, StatsInstanceFields.unsub, StatsInstanceFields.bounces];
  if (canEditSenderName) {
    fields.unshift(StatsInstanceFields.senderName);
  }

  return (
    <>
      <CCard>
        <CCardHeader>
          <span className="d-flex flex-fill justify-content-end">
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

            {!defaultFromDate && !defaultToDate && (
              <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
            )}
          </span>
        </CCardHeader>
        <CCardBody className="p-0">
          <StatsInstanceTable
            loading={loading}
            statsContents={filteredstatsContents}
            fields={fields}
            forceUpdate={refetch}
            sortField={sortField}
            setSortField={setSortField}
            sortOrder={order}
            setSortOrder={setOrder}
            showTotal={true}
          />
        </CCardBody>
      </CCard>
    </>
  );
};
function FilterStatContents(statsContents, name, type) {
  return (
    statsContents &&
    statsContents.filter((item) => {
      if (type && item.dimension && item.dimension.object && item.dimension.object.type !== type) {
        return false;
      }
      if (!name) {
        return true;
      }
      let subject = item.dimension && item.dimension.object && item.dimension.object.subject ? item.dimension.object.subject : '';
      return subject.toLowerCase().indexOf(name.toLowerCase()) >= 0;
    })
  );
}
