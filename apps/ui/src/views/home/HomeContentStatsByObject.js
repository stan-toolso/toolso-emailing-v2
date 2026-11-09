import { CCard, CCardBody, CCardHeader, CInput, CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useEffect, useState } from 'react';
import { StatsInstanceFields, StatsInstanceTable } from '../database/contents/stats/StatsContentTable';
import RangeDatePicker from '../common/RangeDatePicker';
import { AllContentTypes } from '../database/contents/ContentsTypes';
import { useSelector } from 'react-redux';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';

var isLoading = true;

export default ({ defaultFromDate, defaultToDate }) => {
  const [name, setName] = useState('');
  const [statsContents, setStatsContents] = useState([]);
  const [sortField, setSortField] = useState('request');
  const [order, setOrder] = useState('desc');
  const [type, setType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [fromDate, setFromDate] = useState(defaultFromDate ? defaultFromDate : null);
  const [toDate, setToDate] = useState(defaultToDate ? defaultToDate : null);

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  let fields = [
    StatsInstanceFields.database,
    StatsInstanceFields.senderName,
    StatsInstanceFields.subject,
    StatsInstanceFields.request,
    StatsInstanceFields.openers,
    StatsInstanceFields.unique_click,
    StatsInstanceFields.unsub,
    StatsInstanceFields.bounces
  ];

  useEffect(() => {
    if (fromDate && toDate && emailingDatabases) {
      var newStats = [];
      emailingDatabases.forEach(async (database) => {
        let result = await new EmailingDatabaseApi(database).doQuery({
          query: gql`
            query dimensionDelivStats($fromDate: String!, $toDate: String!, $dimensionType: String) {
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
          variables: {
            fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
            toDate: toDate ? toDate.format('YYYY-MM-DD') : null,
            dimensionType: 'objectSender'
          },
          skip: !fromDate || !toDate
        });
        if (result) {
          var statsToAdd = result.data.dimensionDelivStats.dimensionsStats.map((stat) => ({ ...stat, database: database }));
          newStats = [...newStats, ...statsToAdd];
          setStatsContents(newStats);
        }
      });
    }
    isLoading = false;
  }, [fromDate, toDate, emailingDatabases]);

  var filteredstatsContents = FilterStatContents(statsContents, name, type);
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
              style={{ display: 'inline-block', width: '110px' }}
              className="form-control mr-2"
              size="sm"
              onChange={(event) => {
                setStatusFilter(event.target.value);
              }}
              value={statusFilter}
            >
              <option value="">All Status</option>
              <option value="activ">Activ</option>
              <option value="inactiv">Inactiv</option>
            </CSelect>
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
              <div style={{ minWidth: '374px' }}>
                <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last10Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
              </div>
            )}
          </span>
        </CCardHeader>
        <CCardBody className="p-0">
          <StatsInstanceTable
            loading={isLoading}
            statsContents={filteredstatsContents}
            fields={fields}
            sortField={sortField}
            setSortField={setSortField}
            sortOrder={order}
            setSortOrder={setOrder}
            showTotal={true}
            statusFilter={statusFilter}
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
      let senderName = item.dimension && item.dimension.object && item.dimension.object.senderName ? item.dimension.object.senderName : '';
      let subject = item.dimension && item.dimension.object && item.dimension.object.subject ? item.dimension.object.subject : '';
      return senderName.toLowerCase().indexOf(name.toLowerCase()) >= 0 || subject.toLowerCase().indexOf(name.toLowerCase()) >= 0;
    })
  );
}
