import React, { useState, useEffect, useContext } from 'react';
import ActivationWidget from '../widgets/ActivationWidget';
import WorkableContactWidget from '../widgets/WorkableContactWidget';
import TodayInscriptionsWidget from '../widgets/TodayInscriptionsWidget';

import moment from 'moment-timezone';
import { CRow, CCol } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';
import { LAST_CONTACT_STATS, CONTACT_STATS, LAST_INSCRIPTION_STATS } from '../../../services/DatabaseQuery';
import TodayClicksWidget from '../contents/widgets/TodayClicksWidget';
import Suggestions from './Suggestions';

export default () => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [lastContactStats, setLastContactStats] = useState(null);
  const [lastInscriptionStats, setLastInscriptionStats] = useState(null);
  const [contactStatsHistory, setContactStatsHistory] = useState(null);

  const [loadingContactStats, setLoadingContactStats] = useState(true);
  const [loadingInscriptionStats, setLoadingInscriptionStats] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingContactStats(true);
      let result = await emailingDatabaseApiContext.doQuery({
        query: LAST_CONTACT_STATS
      });
      if (result) {
        setLastContactStats(result.data.lastContactStats);
      }
      result = await emailingDatabaseApiContext.doQuery({
        query: CONTACT_STATS,
        variables: {
          fromDate: moment().add(-7, 'days').format('YYYY-MM-DD'),
          toDate: moment().format('YYYY-MM-DD')
        }
      });
      if (result) {
        setContactStatsHistory(result.data.contactStats);
      }
      setLoadingContactStats(false);
    })();
  }, [emailingDatabaseApiContext, setLoadingContactStats]);

  useEffect(() => {
    (async () => {
      setLoadingInscriptionStats(true);

      let result = await emailingDatabaseApiContext.doQuery({
        query: LAST_INSCRIPTION_STATS,
        variables: {
          fromInscriptionDate: moment().add(-7, 'days').format('YYYY-MM-DD'),
          toInscriptionDate: moment().format('YYYY-MM-DD')
        }
      });
      if (result) {
        setLastInscriptionStats(result.data.lastInscriptionStats);
      }
      setLoadingInscriptionStats(false);
    })();
  }, [emailingDatabaseApiContext, setLoadingContactStats]);

  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <TodayInscriptionsWidget loading={loadingInscriptionStats} lastInscriptionStats={lastInscriptionStats} />
        </CCol>
        <CCol sm="6" lg="3">
          <WorkableContactWidget loading={loadingContactStats} lastContactStats={lastContactStats} contactStatsHistory={contactStatsHistory} />
        </CCol>
        <CCol sm="6" lg="3">
          <TodayClicksWidget />
        </CCol>
        <CCol sm="6" lg="3">
          <ActivationWidget loading={loadingInscriptionStats} lastInscriptionStats={lastInscriptionStats} />
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="12" lg="12">
          <Suggestions onlyActive />
        </CCol>
      </CRow>
    </>
  );
};
