import React, { useCallback, useEffect, useState } from 'react';
import { CCol, CRow, CWidgetDropdown } from '@coreui/react';
import { useSelector } from 'react-redux';

import { calculateAndFormatPercent, formatInteger } from '../common/util';
import { GET_CONTENT } from '../../services/DatabaseQuery';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import { StatsInstanceTable } from '../database/contents/stats/StatsContentTable';

export const StatsInstanceFields = {
  id: 'id',
  name: 'name',
  request: 'request',
  openers: 'openers',
  unique_click: 'unique_click',
  unsub: 'unsub',
  bounces: 'bounces',
  database: 'database'
};

function getEmailingDatabase(emailingDatabases, uid) {
  return emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === uid);
}

function getStatContents(contents) {
  let result = [...contents];
  result.map((aContent) => {
    aContent.totalStats = aContent.delivStats;
    aContent.dimension = {};
    aContent.dimension.id = aContent.id;
    aContent.dimension.object = {};
    aContent.dimension.object.name = aContent.name;
    return aContent;
  });
  return result;
}

export default ({ campaign }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState([]);

  const emailingDatabases = useSelector((state) => state.emailingDatabases);
  if (!campaign) {
    return null;
  }

  const getContentFromCampaignContent = useCallback(async (campaignContent) =>{
    let dataBaseConfig = getEmailingDatabase(emailingDatabases, campaignContent.emailing_database_uid);

    if (dataBaseConfig) {
      let result = await new EmailingDatabaseApi(dataBaseConfig).doQuery({
        query: GET_CONTENT,
        variables: {
          id: campaignContent.content_id
        }
      });
      result = { ...result.data.content };
      if (result.bats) {
        result.bats = result.bats.map((bat) => {
          return { ...bat };
        });
      }
      result.versions = [
        ...result.versions.map((version) => {
          let versionNew = { ...version };
          versionNew.__typename = undefined;
          return versionNew;
        })
      ];
      result.database = {};
      result.database.name = dataBaseConfig.name;
      return result;
    }
    return null;
  }, [emailingDatabases]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let futureContents = await Promise.all(campaign.contents.map((campaignContent) => getContentFromCampaignContent(campaignContent)));
      setContents(futureContents);
      setLoading(false);
    })();
  }, [setContents, campaign, getContentFromCampaignContent]);

  return (
    <>
      <CRow>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-primary" header={campaign.deliv_stats.request ? formatInteger(campaign?.deliv_stats?.request) : '0'} text="Total requests"></CWidgetDropdown>
        </CCol>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-info" header={calculateAndFormatPercent(campaign.deliv_stats.unique_open, campaign.deliv_stats.request)} text="Unique open rate"></CWidgetDropdown>
        </CCol>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-warning" header={calculateAndFormatPercent(campaign.deliv_stats.unique_click, campaign.deliv_stats.request)} text="Unique click rate"></CWidgetDropdown>
        </CCol>
        <CCol sm="6" lg="3">
          <CWidgetDropdown color="gradient-danger" header={calculateAndFormatPercent(campaign.deliv_stats.complaint, campaign.deliv_stats.delivered)} text="Complaint rate"></CWidgetDropdown>
        </CCol>
      </CRow>
      <CRow>
        <StatsInstanceTable
          fields={[
            StatsInstanceFields.database,
            StatsInstanceFields.id,
            StatsInstanceFields.name,
            StatsInstanceFields.request,
            StatsInstanceFields.openers,
            StatsInstanceFields.unique_click,
            StatsInstanceFields.unsub,
            StatsInstanceFields.bounces
          ]}
          statsContents={getStatContents(contents)}
          loading={loading}
          showTotal={true}
        ></StatsInstanceTable>
      </CRow>
    </>
  );
};
