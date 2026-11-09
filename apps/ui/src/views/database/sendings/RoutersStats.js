import { useQuery } from '@apollo/client';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useEffect, useState } from 'react';
import { RoutersStatsTable } from './RoutersStatsTable';
import RangeDatePicker from '../../common/RangeDatePicker';

export default () => {
  const [stats, setStats] = useState([]);

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const { loading, data } = useQuery(
    gql`
      query RoutersStats($fromDate: String, $toDate: String) {
        delivRouterStats(fromDate: $fromDate, toDate: $toDate)
      }
    `,
    {
      variables: {
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null
      }
    }
  );

  useEffect(() => {
    if (data) {
      setStats(data.delivRouterStats.delivRoutersStats);
    }
  }, [setStats, data]);

  return (
    <>
      <CCard>
        <CCardHeader>
          <div className="d-flex ">
            <div>Routers Stats</div>
            <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="thisMonth" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
          </div>
        </CCardHeader>
        <CCardBody className="p-0">
          <RoutersStatsTable loading={loading} stats={stats} />
        </CCardBody>
      </CCard>
    </>
  );
};
