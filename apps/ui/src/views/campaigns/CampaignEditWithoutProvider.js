import React, { useState, useEffect, useCallback } from 'react';
import { CCol, CNav, CNavItem, CNavLink, CRow, CSpinner, CTabContent, CTabPane, CTabs } from '@coreui/react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import CampaignEditDashboard from './CampaignEditDashboard';
import CampaignEditSettings from './CampaignEditSettings';
import CampaignEditTemplates from './CampaignEditTemplates';
import CampaignEditDatabases from './CampaignEditDatabases';
import CampaignEditPreviews from './CampaignEditPreviews';
import CampaignEditBats from './CampaignEditBats';
import { useSelector } from 'react-redux';

const sectionsByDefault = ['template', 'settings', 'databases', 'preview', 'bats'];

export default ({ match }) => {
  const [sections, setSections] = useState(sectionsByDefault);
  const campaignId = match.params.campaign_id;
  const section = match.params.section;
  const [campaign, setCampaign] = useState(null);
  const [active, setActive] = useState(section ? sections.indexOf(section) : 0);
  const [defaultTemplateVariables, setDefaultTemplateVariables] = useState([]);
  const enterprise = useSelector((state) => state.entreprise);

  useEffect(() => {
    if (hasAtLeastOneRequest(campaign)) {
      let futureSections = [''].concat(sectionsByDefault);
      setSections(futureSections);
    } else {
      setSections(sectionsByDefault);
    }
  }, [setSections, campaign]);

  const changeSection = useCallback(
    (newSectionIndex) => {
      let newSection = sections[newSectionIndex];
      let newActive = sections.indexOf(newSection ? newSection : '');
      setActive(newActive);
    },
    [setActive, sections]
  );

  const { loading, data, refetch } = useQuery(
    gql`
      query GetCampaign($campaign_id: Int, $enterprise_id: Int!) {
        getCampaign(id: $campaign_id, enterprise_id: $enterprise_id) {
          id
          name
          is_active
          start_date
          end_date
          config
          type
          deliv_stats
          versions {
            id
            subject
            french_esps_subject
            sender_name
            html
            preview_text
            deliv_stats
            name
            disabled
            template_variables
          }
          contents {
            id
            enterprise_id
            emailing_database_uid
            content_id
          }
        }
      }
    `,
    {
      fetchPolicy: 'network-only',
      variables: {
        campaign_id: parseInt(campaignId),
        enterprise_id: parseInt(enterprise.id)
      }
    }
  );

  useEffect(() => {
    if (data && data.getCampaign) {
      let newCampaign = JSON.parse(JSON.stringify(data.getCampaign));
      setCampaign(newCampaign);
    }
  }, [setCampaign, data]);

  const forceUpdate = useCallback(() => {
    setCampaign(JSON.parse(JSON.stringify(campaign)));
  }, [campaign, setCampaign]);

  function hasAtLeastOneVersion(campaign) {
    let result = campaign?.versions && campaign.versions.length >= 1 && campaign.versions.some((version) => version.html || version.contentTemplate);
    return result ? true : false;
  }

  function hasAtLeastOneRequest(campaign) {
    return campaign?.deliv_stats?.request ? true : false;
  }

  const { loading: loadingSetting, data: dataSettings } = useQuery(
    gql`
      query GetSetting($enterpriseId: Int!, $name: String!) {
        getSetting(enterprise_id: $enterpriseId, name: $name) {
          value
        }
      }
    `,
    {
      variables: {
        enterpriseId: parseInt(enterprise.id),
        name: 'defaultTemplateVariables'
      }
    }
  );

  useEffect(() => {
    if (dataSettings?.getSetting?.value) {
      setDefaultTemplateVariables(JSON.parse(dataSettings?.getSetting?.value));
    }
  }, [setDefaultTemplateVariables, dataSettings]);

  return (
    <>
      <CRow className="content-detail">
        <CCol xl={12}>
          <h3>
            #{campaignId} {campaign ? ': ' + campaign.name : ''}
          </h3>

          {(loading || loadingSetting) && (
            <div style={{ textAlign: 'center', padding: '30px 0px' }}>
              <CSpinner animation="grow" color="secondary" />
            </div>
          )}
          {!loading && !loadingSetting && campaign && (
            <>
              <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(idx)}>
                <CNav variant="tabs">
                  {hasAtLeastOneRequest(campaign) && (
                    <CNavItem>
                      <CNavLink>
                        <i className="fas fa-tachometer-alt"></i>
                        &nbsp; Dashboard
                      </CNavLink>
                    </CNavItem>
                  )}
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-edit"></i>
                      &nbsp; Template
                    </CNavLink>
                  </CNavItem>

                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-cogs"></i>
                      &nbsp; Settings
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-server"></i>
                      &nbsp; Databases
                    </CNavLink>
                  </CNavItem>

                  {hasAtLeastOneVersion(campaign) && (
                    <CNavItem>
                      <CNavLink>
                        <i className="fas fa-eye"></i>
                        &nbsp; Preview
                      </CNavLink>
                    </CNavItem>
                  )}
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-calendar-check"></i>
                      &nbsp; BATs
                    </CNavLink>
                  </CNavItem>
                  {/* <CNavItem>
                    <CNavLink>
                      <i className="fas fa-calendar"></i>
                      &nbsp; Schedules
                    </CNavLink>
                  </CNavItem>
                   */}
                </CNav>
                <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
                  {hasAtLeastOneRequest(campaign) && (
                    <CTabPane>
                      <CampaignEditDashboard campaign={campaign} forceUpdate={forceUpdate} />
                    </CTabPane>
                  )}

                  <CTabPane>
                    <CampaignEditTemplates campaign={campaign} setCampaign={setCampaign} forceUpdate={forceUpdate} defaultTemplateVariables={defaultTemplateVariables} enterpriseId={enterprise?.id} />
                  </CTabPane>
                  <CTabPane>
                    <CampaignEditSettings campaign={campaign} forceUpdate={forceUpdate} enterpriseId={enterprise?.id} />
                  </CTabPane>
                  <CTabPane>
                    <CampaignEditDatabases campaign={campaign} forceUpdate={forceUpdate} refetch={refetch} />
                  </CTabPane>
                  {campaign && (
                    <>
                      <CTabPane>
                        <CampaignEditPreviews campaign={campaign} />
                      </CTabPane>
                    </>
                  )}
                  <CTabPane>
                    <CampaignEditBats campaign={campaign} forceUpdate={forceUpdate} />
                  </CTabPane>
                  {/* <CTabPane>
                    <ContentEditSchedules campaign={campaign} forceUpdate={forceUpdate} />
                  </CTabPane>
                  <CTabPane>
                    <div>bats</div>
                    {/*<ContentEditBats campaign={campaign} forceUpdate={forceUpdate} />
                  </CTabPane> */}
                </CTabContent>
              </CTabs>
            </>
          )}
        </CCol>
      </CRow>
    </>
  );
};
