import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Col, Row } from 'react-bootstrap';
import { CFormGroup, CLabel, CSelect } from '@coreui/react';

import CampaignContentEditPreview from './CampaignContentEditPreview';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';

export default ({ campaign }) => {
  const [activeDatabaseUid, setActiveDatabaseUid] = useState('');
  const [selectedCampaignContent, setSelectedCampaignContent] = useState();

  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const [activeDatabase, setActiveDatabase] = useState();

  useEffect(() => {
    if (activeDatabaseUid) {
      let newSelectedContent = campaign.contents.find((campaignContent) => campaignContent.emailing_database_uid === activeDatabaseUid);
      setSelectedCampaignContent(newSelectedContent);
    } else {
      setSelectedCampaignContent(campaign.contents[0]);
    }
  }, [setSelectedCampaignContent, campaign, activeDatabaseUid]);

  useEffect(() => {
    if (activeDatabaseUid) {
      let newActiveBase = emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === activeDatabaseUid);
      setActiveDatabase(new EmailingDatabaseApi(newActiveBase));
    } else {
      let newActiveBase = emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === campaign?.contents[0]?.emailing_database_uid);
      if (newActiveBase) {
        setActiveDatabase(new EmailingDatabaseApi(newActiveBase));
      }
    }
  }, [setActiveDatabase, activeDatabaseUid, emailingDatabases, campaign]);

  return (
    <>
      <Row>
        <Col sm={12}>
          <CFormGroup>
            <CLabel>Select your Database</CLabel>
            <CSelect
              size="sm"
              value={activeDatabaseUid}
              onChange={(event) => {
                setActiveDatabaseUid(event.target.value);
              }}
            >
              {campaign.contents.map((item, index) => {
                let emailingApiConfig = emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === item.emailing_database_uid);
                return (
                  <option key={index} value={item.emailing_database_uid}>
                    {emailingApiConfig?.name}
                  </option>
                );
              })}
            </CSelect>
          </CFormGroup>
        </Col>
      </Row>
      {selectedCampaignContent && activeDatabase && (
        <>
          <Row>
            <Col sm={12}>
              <CampaignContentEditPreview campaignContent={selectedCampaignContent} emailingDatabaseApi={activeDatabase} />
            </Col>
          </Row>
        </>
      )}
    </>
  );
};
