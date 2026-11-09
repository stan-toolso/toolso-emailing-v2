import { gql, useQuery } from '@apollo/client';
import { CSpinner } from '@coreui/react';
import React, { useEffect, useState, useContext } from 'react';
import Pagination from '../../../common/Pagination';
import CreateScheduleButton from './CreateScheduleButton';
import { ScheduleFields, SchedulesTable } from './SchedulesTable';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';

export default () => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const { data, loading, refetch } = useQuery(
    gql`
      query schedules($limit: Int, $offset: Int, $filter: JSON, $contentFilter: JSON) {
        schedules(limit: $limit, offset: $offset, filter: $filter) {
          total
          offset
          filter
          schedules {
            id
            isActive
            name
            type
            status
            config
            scheduleDate
            contents(filter: $contentFilter) {
              total
            }
            sendingConfig {
              id
              name
            }
          }
        }
      }
    `,
    {
      variables: {
        limit,
        offset,
        filter: {
          types: ['single_send']
        },
        contentFilter: {
          isActive: true
        }
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.schedules.total);
    }
  }, [data, setTotal]);
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0px' }}>
        <CSpinner animation="grow" color="secondary" />
      </div>
    );
  }
  const schedules = JSON.parse(JSON.stringify(data.schedules.schedules));

  return (
    <>
      <CreateScheduleButton
        defaultName="New Single Send Schedule ..."
        defaultType="single_send"
        onCreated={(schedule) => {
          refetch();
          history.push(`/${emailingDatabaseApiContext.getUid()}/sendings/schedules/single_send/${schedule.id}`);
        }}
      />

      <div className="mb-0">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
      </div>
      <SchedulesTable
        fields={[ScheduleFields.id, ScheduleFields.status, ScheduleFields.type, ScheduleFields.name, ScheduleFields.scheduleDate, ScheduleFields.sending_config, ScheduleFields.activeContentCount]}
        schedules={schedules}
        refetch={refetch}
      />
      <div className="mt-2">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </>
  );
};
