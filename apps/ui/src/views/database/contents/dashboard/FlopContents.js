import TopFlopContentsTable from './TopFlopContentsTable';
import React from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';

export default ({ weeklyContents, loading, maxWantedItems }) => {
  return (
    <>
      <CCard>
        <CCardHeader style={{ backgroundColor: 'rgba(0,0,21,.03)' }}>
          <strong>Flop Contents of the week</strong>
        </CCardHeader>
        <CCardBody className="p-0">
          <TopFlopContentsTable loading={loading} contents={weeklyContents} maxItems={maxWantedItems} useQualityScore={true} showFlopsInsteadOfTops={true} />
        </CCardBody>
      </CCard>
    </>
  );
};
