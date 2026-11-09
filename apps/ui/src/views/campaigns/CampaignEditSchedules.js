import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Col, Row } from 'react-bootstrap';
import { CFormGroup, CLabel, CSelect } from '@coreui/react';

export default ({ campaign }) => {
  const [activeDatabaseUid, setActiveDatabaseUid] = useState('');
  const [selectedCampaignContent, setSelectedCampaignContent] = useState();
  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  useEffect(() => {
    if (activeDatabaseUid) {
      let newSelectedContent = campaign.contents.find((campaignContent) => (campaignContent.emailing_database_uid = activeDatabaseUid));
      setSelectedCampaignContent(newSelectedContent);
    } else {
      setSelectedCampaignContent(campaign.contents[0]);
    }
  }, [setSelectedCampaignContent, setActiveDatabaseUid, activeDatabaseUid]);

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
                    {emailingApiConfig.name}
                  </option>
                );
              })}
            </CSelect>
          </CFormGroup>
        </Col>
      </Row>
      {selectedCampaignContent && (
        <>
          <Row>
            <Col sm={12}>
              <div>schedules</div>
            </Col>
          </Row>
        </>
      )}
    </>
  );
};
