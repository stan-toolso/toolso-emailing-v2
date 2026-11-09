import { CSwitch } from '@coreui/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Col, Nav, Row, Tab } from 'react-bootstrap';
import { ApolloProvider } from '@apollo/client';
import { CSpinner } from '@coreui/react';

import { updateContent } from '../database/contents/util';
import { GET_CONTENT } from '../../services/DatabaseQuery';
import ContentInCampaign from './ContentInCampaign';
import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import CreateCampaignContentModal from './CreateCampaignContentModal';
import EmailingDatabaseApiContext from '../../contexts/EmailingDatabaseApiContext';

function getEmailingDatabase(emailingDatabases, uid) {
  return emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === uid);
}

export default ({ campaign, forceUpdate }) => {
  const [contents, setContents] = useState([]);
  const [activeKey, setActiveKey] = useState(campaign.contents[0]?.emailing_database_uid + '-' + campaign?.contents[0]?.content_id);
  const [loading, setLoading] = useState(false);
  const [activeContent, setActiveContent] = useState();
  const [activeCampaignContent, setActiveCampaignContent] = useState();
  const [wantedSection, setWantedSection] = useState('settings');

  const emailingDatabases = useSelector((state) => state.emailingDatabases);
  const [showModalCreation, setShowModalCreation] = useState(false);

  const forceUpdateContent = useCallback(() => {
    let newActiveContent = { ...activeContent };
    setActiveContent(newActiveContent);
  }, [activeContent, setActiveContent]);

  const getContentFromCampaignContent = useCallback(
    async (campaignContent) => {
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
        if (result.versions) {
          result.versions = [
            ...result.versions.map((version) => {
              let versionNew = { ...version };
              versionNew.__typename = undefined;
              return versionNew;
            })
          ];
        }

        result.emailing_database_uid = campaignContent.emailing_database_uid;
        return result;
      }
      return null;
    },
    [emailingDatabases]
  );

  const getSelectedCampaignContent = useCallback(() => {
    let uidId = activeKey.toString().split('.')[0].split('-');
    return campaign.contents.filter((campaignContent) => campaignContent.emailing_database_uid === uidId[0] && campaignContent.content_id === uidId[1])[0];
  }, [activeKey, campaign]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let futureContents = await Promise.all(campaign.contents.map((campaignContent) => getContentFromCampaignContent(campaignContent)));
      setContents(futureContents);
      setLoading(false);
    })();
  }, [setContents, campaign, getContentFromCampaignContent]);

  useEffect(() => {
    if (contents && activeCampaignContent) {
      setActiveContent(contents.find((content) => content?.id === activeCampaignContent.content_id && content.emailing_database_uid === activeCampaignContent.emailing_database_uid));
    }
  }, [setActiveContent, activeCampaignContent, contents]);

  useEffect(() => {
    let newActiveCampaignContent = getSelectedCampaignContent();
    if (newActiveCampaignContent && activeCampaignContent?.id !== newActiveCampaignContent.id) {
      setActiveCampaignContent(newActiveCampaignContent);
    }
  }, [setActiveCampaignContent, activeKey, campaign, activeCampaignContent, getSelectedCampaignContent]);

  useEffect(() => {
    let contentIndex = activeKey.toString().split('.')[1];
    let wantedSection = 'settings';
    switch (contentIndex) {
      case '0':
        if (needToShowDashboard(activeContent)) {
          wantedSection = 'dashboard';
        }
        break;
      case '2':
        wantedSection = 'templates';
        break;
      case '3':
        wantedSection = 'schedules';
        break;
      case '4':
        wantedSection = 'bats';
        break;
      default:
        break;
    }

    setWantedSection(wantedSection);
  }, [setWantedSection, activeContent, activeKey]);

  function getEmailingDatabaseOfSelectedContent() {
    return activeCampaignContent && getEmailingDatabase(emailingDatabases, activeCampaignContent.emailing_database_uid);
  }

  function needToShowDashboard(content) {
    return content && content.delivStats && content.delivStats.request ? true : false;
  }

  function getFirstActiveTab(index, content) {
    if (needToShowDashboard(content)) {
      return index + '.0';
    }
    return index + '.1';
  }

  let sellectedContent = getEmailingDatabaseOfSelectedContent();
  let emailingDatabase = sellectedContent ? new EmailingDatabaseApi(getEmailingDatabaseOfSelectedContent()) : undefined;

  async function changeContentStatus(rowContent, activationStatus) {
    if (rowContent) {
      let associatedCampaignContent = campaign.contents.find((campaignContent) => campaignContent.content_id === rowContent.id);
      let emailingDatabaseOfContent = new EmailingDatabaseApi(getEmailingDatabase(emailingDatabases, associatedCampaignContent.emailing_database_uid));
      if (emailingDatabaseOfContent) {
        await updateContent(
          emailingDatabaseOfContent,
          rowContent,
          {
            isActive: activationStatus
          },
          activationStatus ? `Content has been enabled` : `Content has been disabled`,
          forceUpdate
        );
      }
    }
  }

  return (
    <>
      <CreateCampaignContentModal
        show={showModalCreation}
        toggle={() => {
          forceUpdate();
          setShowModalCreation(false);
        }}
        campaign={campaign}
        databases={emailingDatabases}
      />
      {loading && <CSpinner />}
      {!loading && (
        <Tab.Container
          id="left-tabs-example"
          activeKey={activeKey}
          onSelect={(key) => {
            setActiveKey(key);
          }}
        >
          <Row>
            <Col sm={3}>
              <Nav variant="pills" className="flex-column" key="navMenu">
                {campaign.contents.map((campaignContent) => {
                  let index = campaignContent.emailing_database_uid + '-' + campaignContent.content_id;
                  let rowContent = null;
                  if (contents) {
                    rowContent = contents.find((content) => content.id === campaignContent.content_id);
                  }
                  return (
                    <Nav.Item key={index}>
                      {rowContent && (
                        <div className={'pt-2 pr-2 pl-2'} style={{ position: 'absolute' }}>
                          <CSwitch
                            color={'primary'}
                            variant={'3d'}
                            size="sm"
                            labelOn={'\u2713'}
                            labelOff={'\u2715'}
                            checked={rowContent?.isActive}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            onChange={async () => {
                              changeContentStatus(rowContent, !rowContent.isActive);
                            }}
                          />
                        </div>
                      )}

                      <Nav.Link eventKey={getFirstActiveTab(index, rowContent)} className={'pl-5'}>
                        {getEmailingDatabase(emailingDatabases, campaignContent.emailing_database_uid)?.name ?? campaignContent.emailing_database_uid}
                      </Nav.Link>
                      {(index === activeKey || activeKey.toString().startsWith(index + '.')) && (
                        <ul>
                          {needToShowDashboard(rowContent) && (
                            <>
                              <li key={index + '.0'}>
                                <Nav.Item key={index + '.0'}>
                                  <Nav.Link eventKey={index + '.0'} style={{ fontSize: 12, paddingBottom: '8px', paddingTop: '8px' }}>
                                    Dashboard
                                  </Nav.Link>
                                </Nav.Item>
                              </li>
                            </>
                          )}

                          <li key={index + '.1'}>
                            <Nav.Item key={index + '.1'}>
                              <Nav.Link eventKey={index + '.1'} style={{ fontSize: 12, paddingBottom: '8px', paddingTop: '8px' }}>
                                Settings
                              </Nav.Link>
                            </Nav.Item>
                          </li>
                          <li key={index + '.2'}>
                            <Nav.Item key={index + '.2'}>
                              <Nav.Link eventKey={index + '.2'} style={{ fontSize: 12, paddingBottom: '8px', paddingTop: '8px' }}>
                                Template
                              </Nav.Link>
                            </Nav.Item>
                          </li>
                          <li key={index + '.3'}>
                            <Nav.Item key={index + '.3'}>
                              <Nav.Link eventKey={index + '.3'} style={{ fontSize: 12, paddingBottom: '8px', paddingTop: '8px' }}>
                                Schedules
                              </Nav.Link>
                            </Nav.Item>
                          </li>
                          <li key={index + '.4'}>
                            <Nav.Item key={index + '.4'}>
                              <Nav.Link eventKey={index + '.4'} style={{ fontSize: 12, paddingBottom: '8px', paddingTop: '8px' }}>
                                BATs
                              </Nav.Link>
                            </Nav.Item>
                          </li>
                        </ul>
                      )}
                    </Nav.Item>
                  );
                })}

                <Nav.Item key="createDatabase">
                  <Nav.Link
                    onClick={async () => {
                      //On affiche le truc modal de selection de la database
                      //(voir plus tard pour la selection des headers & footers)
                      setShowModalCreation(true);
                    }}
                  >
                    <i className="fas fa-plus"></i> Add new Database
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </Col>
            {emailingDatabase && activeContent && (
              <Col sm={9}>
                <ApolloProvider client={emailingDatabase.getClient()}>
                  <EmailingDatabaseApiContext.Provider value={emailingDatabase}>
                    <ContentInCampaign content={activeContent} wantedSection={wantedSection} emailingDatabaseApi={emailingDatabase} forceUpdateGlobal={forceUpdate} forceUpdate={forceUpdateContent} />
                  </EmailingDatabaseApiContext.Provider>
                </ApolloProvider>
              </Col>
            )}
          </Row>
        </Tab.Container>
      )}
    </>
  );
};
