import { gql, useMutation } from '@apollo/client';
import { CSwitch } from '@coreui/react';
import React, { useState } from 'react';

import { Col, Nav, Row, Tab } from 'react-bootstrap';
import CampaignEditTemplate from './CampaignEditTemplate';
import CampaignManagerApi from '../../services/CampaignManagerApi';
import updateCampaignVersion from './updateCampaignVersion';

export default ({ campaign, forceUpdate, setCampaign, defaultTemplateVariables, enterpriseId }) => {
  const [activeKey, setActiveKey] = useState(0);

  const [createCampaignVersion] = useMutation(gql`
    mutation createCampaignVersion($campaign_id: Int!, $enterprise_id: Int!) {
      createCampaignVersion(campaign_id: $campaign_id, enterprise_id: $enterprise_id) {
        id
        name
      }
    }
  `);
  const [deleteCampaignVersion] = useMutation(gql`
    mutation deleteCampaignVersion($id: Int!, $enterprise_id: Int!) {
      deleteCampaignVersion(id: $id, enterprise_id: $enterprise_id)
    }
  `);

  const [cloneCampaignVersion] = useMutation(gql`
    mutation cloneCampaignVersion($id: Int!, $enterprise_id: Int!) {
      cloneCampaignVersion(id: $id, enterprise_id: $enterprise_id) {
        id
        name
        html
        subject
        sender_name
        disabled
        template_variables
      }
    }
  `);

  return (
    <>
      <Tab.Container
        id="left-tabs-example"
        activeKey={activeKey}
        onSelect={(key) => {
          setActiveKey(key);
        }}
      >
        <Row>
          <Col sm={8}>
            <Tab.Content>
              {campaign.versions.map((version, index) => {
                return (
                  <Tab.Pane eventKey={index} key={index}>
                    <CampaignEditTemplate
                      key={index}
                      campaign={campaign}
                      campaignVersion={version}
                      forceUpdate={forceUpdate}
                      setCampaign={setCampaign}
                      defaultTemplateVariables={defaultTemplateVariables}
                      enterpriseId={enterpriseId}
                    />
                  </Tab.Pane>
                );
              })}
            </Tab.Content>
          </Col>
          <Col sm={4} className="border-left">
            <Nav variant="pills" className="flex-column">
              {campaign.versions.map((version, index) => {
                return (
                  <Nav.Item key={index}>
                    <div className={'pt-2 pr-2 pl-2'} style={{ position: 'absolute' }}>
                      <CSwitch
                        color={'primary'}
                        variant={'3d'}
                        size="sm"
                        labelOn={'\u2713'}
                        labelOff={'\u2715'}
                        checked={version.disabled ? false : true}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                        onChange={async (event) => {
                          let newCampaign = { ...campaign };
                          newCampaign.versions = [...newCampaign.versions];
                          let newVersion = { ...version };
                          newVersion.disabled = !event.target.checked;
                          newVersion.__typename = undefined;

                          newCampaign.versions[index] = newVersion;
                          await updateCampaignVersion(CampaignManagerApi, newVersion, newVersion.disabled ? 'Version has been disabled' : 'Version has been enabled', forceUpdate, enterpriseId);
                          setCampaign(newCampaign);
                        }}
                      />
                    </div>
                    <Nav.Link eventKey={index} className={'pl-5'}>
                      <div className="float-right">
                        <i
                          className="far fa-clone pl-2"
                          onClick={async (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            let result = await cloneCampaignVersion({ variables: { id: parseInt(version.id), enterprise_id: parseInt(enterpriseId) } });
                            if (result && result.data && result.data.cloneCampaignVersion) {
                              campaign.versions = [...campaign.versions, result.data.cloneCampaignVersion];
                              forceUpdate();
                              setActiveKey(campaign.versions.length - 1);
                            }
                          }}
                        />
                        {campaign.versions.length >= 2 && (
                          <i
                            className="fas fa-trash pl-2"
                            onClick={async (event) => {
                              event.stopPropagation();
                              event.preventDefault();

                              let result = await deleteCampaignVersion({ variables: { id: parseInt(version.id), enterprise_id: parseInt(enterpriseId) } });
                              if (result && result.data && result.data.deleteCampaignVersion) {
                                campaign.versions = campaign.versions.filter((aVersion) => aVersion.id !== version.id);
                                forceUpdate();
                                setActiveKey(Math.min(activeKey, campaign.versions.length - 1));
                              }
                            }}
                          />
                        )}
                      </div>
                      #{version.id} - {version.name}
                    </Nav.Link>
                  </Nav.Item>
                );
              })}

              <Nav.Item>
                <Nav.Link
                  onClick={async () => {
                    let result = await createCampaignVersion({ variables: { campaign_id: parseInt(campaign.id), enterprise_id: parseInt(enterpriseId) } });
                    if (result && result.data && result.data.createCampaignVersion) {
                      campaign.versions = [...campaign.versions, result.data.createCampaignVersion];
                      forceUpdate();
                      setActiveKey(campaign.versions.length - 1);
                    }
                  }}
                >
                  <i className="fas fa-plus"></i> Add new version
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>
      </Tab.Container>
    </>
  );
};
