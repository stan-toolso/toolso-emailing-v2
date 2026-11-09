import { useQuery } from '@apollo/client';
import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react';
import gql from 'graphql-tag';
import moment from 'moment-timezone';
import React, { useEffect, useState } from 'react';
import Pagination from '../../../common/Pagination';
import { ScheduleInstanceFields, ScheduleInstancesTable } from './ScheduleInstancesTable ';

export default () => {
  const [scheduleInstances, setScheduleInstances] = useState([]);

  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const { loading, data } = useQuery(
    gql`
      query schedules($limit: Int, $offset: Int, $filter: JSON) {
        schedules(limit: $limit, offset: $offset, filter: $filter) {
          schedules {
            id
            isActive
            name
            type
            status
            scheduleDate
            rate
            report
            dimensionDelivStats(dimensionType: null) {
              totalStats {
                request
                unique_open
                unique_proxy_loaded
                unique_click
                unsub
                complaint
                soft_bounce
                hard_bounce
                contact_bounce
                content_bounce
              }
            }
          }
          total
          offset
        }
      }
    `,
    {
      variables: {
        filter: {
          toDate: moment().format('YYYY-MM-DD'),
          types: ['recurrent_instance', 'single_send']
        },
        offset: offset,
        limit: 10
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.schedules.total);
      setScheduleInstances(data.schedules.schedules);
    }
  }, [setTotal, setScheduleInstances, data]);

  return (
    <>
      <CCard>
        <CCardHeader>Last schedules</CCardHeader>
        <CCardBody className="p-0">
          <ScheduleInstancesTable
            loading={loading}
            schedules={scheduleInstances}
            fields={[
              ScheduleInstanceFields.id,
              ScheduleInstanceFields.scheduleDate,
              ScheduleInstanceFields.name,
              ScheduleInstanceFields.request,
              ScheduleInstanceFields.openers,
              ScheduleInstanceFields.unique_click,
              ScheduleInstanceFields.unsub,
              ScheduleInstanceFields.bounces
            ]}
          />
          <CRow className="m-0">
            <CCol sm="6"></CCol>
            <CCol sm="6">
              <Pagination offset={offset} limit={10} total={total} setOffset={setOffset} />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    </>
  );
};
