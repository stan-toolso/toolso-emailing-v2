import React, { useState, useEffect, useCallback } from 'react';
import { gql } from '@apollo/client';
import { CButton, CCol, CFormGroup, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner, CSelect } from '@coreui/react';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';

import EmailingDatabaseApi from '../../services/EmailingDatabaseApi';
import CampaignManagerApi from '../../services/CampaignManagerApi';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const availableDatabases = props.databases;
  const campaign = props.campaign;

  const [databasesToCreate, setDatabasesToCreate] = useState([{ databaseUid: availableDatabases[0]?.uid }]);
  const [loadingHeaderFooter, setLoadingHeaderFooter] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingDatabase, setLoadingDatabase] = useState(false);

  const setField = useCallback(
    (databaseUid, fieldName, fieldValue) => {
      setLoadingDatabase(true);
      let newDatabasesToCreate = [...databasesToCreate];
      let databaseInstance = newDatabasesToCreate.find((instance) => instance.databaseUid === databaseUid);
      if (!databaseInstance) {
        databaseInstance = { databaseUid: databaseUid };
        newDatabasesToCreate.push(databaseInstance);
      } else {
        if (fieldName === 'databaseUid' && databaseUid !== fieldValue) {
          databaseInstance.templateParts = undefined;
        }
      }
      if (fieldName === 'settings') {
        if (fieldValue?.defaultHeader) {
          databaseInstance.headerId = fieldValue.defaultHeader;
        } else {
          databaseInstance.headerId = 'none';
        }
        if (fieldValue?.defaultFooter) {
          databaseInstance.footerId = fieldValue.defaultFooter;
        } else {
          databaseInstance.footerId = 'none';
        }
      }
      databaseInstance[fieldName] = fieldValue;
      setDatabasesToCreate(newDatabasesToCreate);
      setLoadingDatabase(false);
    },
    [setDatabasesToCreate, databasesToCreate]
  );

  const [loading, setLoading] = useState(false);
  const enterprise = useSelector((state) => state.entreprise);

  async function createCampaignContentInDatabase(dataBaseConfig, campaign, header, footer, enterpriseId, settings, partnerId) {
    setLoading(true);
    let emailingDatabaseApi = new EmailingDatabaseApi(dataBaseConfig);
    try {
      let contentToCreate = await getContentToCreate(emailingDatabaseApi, campaign, header, footer, settings, partnerId);
      let createdContent = await createContentInDatabase(emailingDatabaseApi, contentToCreate);
      return await createCampaignContent(CampaignManagerApi, campaign, createdContent, dataBaseConfig, enterpriseId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create content associated to this campaign', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    }
  }

  function replaceVariables(dataBaseConfig, text, settings, partner) {
    let databaseName = settings?.databaseName ? settings?.databaseName : dataBaseConfig.name;
    if (text) {
      let result = text.replace('{{database.name}}', databaseName);
      if (partner?.kitMapping) {
        Object.keys(partner.kitMapping).map((key) => {
          result = result.replace(key, partner.kitMapping[key]);
        });
      }
      return result;
    }
    return '';
  }

  async function getContentVersion(emailingDatabaseApi, campaignVersion, header, footer, settings, partner) {
    let result = {
      name: campaignVersion.name,
      subject: replaceVariables(emailingDatabaseApi.getDatabase(), campaignVersion.subject, settings, partner),
      senderName: replaceVariables(emailingDatabaseApi.getDatabase(), campaignVersion.sender_name, settings, partner),
      frenchEspsSubject: replaceVariables(emailingDatabaseApi.getDatabase(), campaignVersion.french_esps_subject, settings, partner),
      previewText: replaceVariables(emailingDatabaseApi.getDatabase(), campaignVersion?.preview_text, settings, partner),
      templateVariables: campaignVersion.template_variables
    };
    let html = replaceVariables(emailingDatabaseApi.getDatabase(), campaignVersion.html, settings, partner);
    result.html = await getHtml(emailingDatabaseApi, html, header, footer);
    return result;
  }

  async function getContentToCreate(emailingDatabaseApi, campaign, header, footer, settings, partnerId) {
    let partnerResult = undefined;
    if (parseInt(partnerId)) {
      await emailingDatabaseApi.doQuery({
        query: gql`
          query partner($id: ID!) {
            partner(id: $id) {
              id
              name
              contacts
              variables
              kitMapping
              validatorsEmails
              defaultMessage
            }
          }
        `,
        variables: {
          id: partnerId
        }
      });
      partnerResult = partnerResult?.data;
      partnerResult = partnerResult?.partner;
    }

    let contentVersions = await Promise.all(campaign.versions?.map((campaign_version) => getContentVersion(emailingDatabaseApi, campaign_version, header, footer, settings, partnerResult)));
    let result = {
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      config: campaign.config ?? {},
      versions: contentVersions,
      partnerId
    };
    return result;
  }

  useEffect(() => {
    (async () => {
      setLoadingHeaderFooter(true);
      let databaseUid = databasesToCreate.find((instanceToCREATE) => !instanceToCREATE.templateParts)?.databaseUid;
      if (databaseUid) {
        let dataBaseConfig = availableDatabases.find((database) => database.uid === databaseUid);
        if (dataBaseConfig) {
          let result = await new EmailingDatabaseApi(dataBaseConfig).doQuery({
            query: gql`
              query contentTemplateParts($limit: Int, $offset: Int, $filter: JSON) {
                contentTemplateParts(limit: $limit, offset: $offset, filter: $filter) {
                  contentTemplateParts {
                    id
                    name
                    uid
                    html
                  }
                }
              }
            `,
            variables: {
              limit: 1000,
              offset: 0,
              filter: {}
            }
          });
          let templatePartForUid = result?.data?.contentTemplateParts?.contentTemplateParts;
          setField(databaseUid, 'templateParts', templatePartForUid);
          let defaultCampaignSettingsforDatabase = await new EmailingDatabaseApi(dataBaseConfig).doQuery({
            query: gql`
              query getSettings($names: [String]!) {
                getSettings(names: $names)
              }
            `,
            variables: { names: ['campaignSettings'] }
          });
          defaultCampaignSettingsforDatabase = defaultCampaignSettingsforDatabase?.data?.getSettings?.campaignSettings;
          setField(databaseUid, 'settings', defaultCampaignSettingsforDatabase);
        }
      }
      setLoadingHeaderFooter(false);
    })();
  }, [setDatabasesToCreate, databasesToCreate, availableDatabases, setField]);

  useEffect(() => {
    (async () => {
      setLoadingPartners(true);
      let databaseUid = databasesToCreate.find((instanceToCREATE) => !instanceToCREATE.templateParts)?.databaseUid;
      if (databaseUid) {
        let dataBaseConfig = availableDatabases.find((database) => database.uid === databaseUid);
        if (dataBaseConfig) {
          let result = await new EmailingDatabaseApi(dataBaseConfig).doQuery({
            query: gql`
              query partners($limit: Int, $offset: Int, $filter: JSON) {
                partners(limit: $limit, offset: $offset, filter: $filter) {
                  total
                  partners {
                    id
                    name
                    validatorsEmails
                    defaultMessage
                  }
                }
              }
            `,
            variables: {
              limit: 200,
              offset: 0,
              filter: {}
            }
          });
          let partners = result?.data?.partners?.partners;
          setField(databaseUid, 'partners', partners);
        }
      }
      setLoadingPartners(false);
    })();
  }, [setDatabasesToCreate, databasesToCreate, availableDatabases, setField]);

  async function createCampaignInDatabase(theDatabaseToCreate) {
    for (const databaseToCreateIndex in theDatabaseToCreate) {
      let databaseToCreate = theDatabaseToCreate[databaseToCreateIndex];
      let databaseUid = databaseToCreate.databaseUid;
      let database = availableDatabases.find((database) => database.uid === databaseUid);

      let header = databaseToCreate.templateParts.find((templatePart) => templatePart.id == databaseToCreate.headerId);
      let footer = databaseToCreate.templateParts.find((templatePart) => templatePart.id == databaseToCreate.footerId);
      let createdCampaignContent = await createCampaignContentInDatabase(database, campaign, header, footer, enterprise.id, databaseToCreate.settings, databaseToCreate.partnerId);
      if (createdCampaignContent) {
        campaign.contents.push(createdCampaignContent);
      }
    }
    setDatabasesToCreate([]);
    toggle();
    setLoading(false);
  }

  function addDatabase() {
    let firstNonUsedDb = availableDatabases.map((db) => db.uid).filter((value) => !databasesToCreate.map((instance) => instance.databaseUid).includes(value));
    if (firstNonUsedDb && firstNonUsedDb.length > 0) {
      setField(firstNonUsedDb, 'databaseUid', firstNonUsedDb[0]);
    }
  }

  return (
    <CModal show={show} color="info" onClose={toggle} size="xl">
      <CModalHeader>{'Associate campaign to database'}</CModalHeader>
      <CModalBody>
        {databasesToCreate.map((databaseToCreate, index) => {
          return (
            <CRow key={index}>
              <CCol lg="2">
                <CFormGroup>
                  <CLabel htmlFor="name">Database</CLabel>
                  <CSelect
                    className="form-control mr-1 mt-1"
                    size="sm"
                    placeholder="database name"
                    value={databaseToCreate.databaseUid}
                    onChange={(event) => {
                      setField(databaseToCreate.databaseUid, 'databaseUid', event.target.value);
                    }}
                  >
                    {availableDatabases.map((database) => {
                      return (
                        <option value={database.uid} key={database.uid}>
                          {database.name}
                        </option>
                      );
                    })}
                  </CSelect>
                </CFormGroup>
              </CCol>
              <CCol lg="2">
                <CFormGroup>
                  <CLabel htmlFor="name">Partner</CLabel>
                  <CSelect
                    className="form-control mr-1 mt-1"
                    size="sm"
                    placeholder="Header"
                    value={databaseToCreate.partnerId}
                    onChange={(event) => {
                      setField(databaseToCreate.databaseUid, 'partnerId', parseInt(event.target.value));
                    }}
                  >
                    {(loadingPartners || loadingDatabase) && (
                      <option value="loading" key="loading">
                        <CSpinner color="secondary" />
                      </option>
                    )}
                    {!loadingPartners && !loadingDatabase && (
                      <option value="none" key="none">
                        none
                      </option>
                    )}
                    {!loadingPartners &&
                      !loadingDatabase &&
                      databaseToCreate.partners &&
                      databaseToCreate.partners.map((partner) => {
                        return (
                          <option value={partner.id} key={partner.id}>
                            {partner.name}
                          </option>
                        );
                      })}
                  </CSelect>
                </CFormGroup>
              </CCol>
              <CCol lg="4">
                <CFormGroup>
                  <CLabel htmlFor="name">Header</CLabel>
                  <CSelect
                    className="form-control mr-1 mt-1"
                    size="sm"
                    placeholder="Header"
                    value={databaseToCreate.headerId}
                    onChange={(event) => {
                      setField(databaseToCreate.databaseUid, 'headerId', event.target.value);
                    }}
                  >
                    {(loadingHeaderFooter || loadingDatabase) && (
                      <option value="loading" key="loading">
                        <CSpinner color="secondary" />
                      </option>
                    )}

                    {!loadingHeaderFooter && !loadingDatabase && (
                      <option value="none" key="none">
                        none
                      </option>
                    )}

                    {!loadingHeaderFooter &&
                      !loadingDatabase &&
                      databaseToCreate.templateParts &&
                      databaseToCreate.templateParts.map((templatePart) => {
                        return (
                          <option value={templatePart.id} key={templatePart.id}>
                            {templatePart.name}
                          </option>
                        );
                      })}
                  </CSelect>
                </CFormGroup>
              </CCol>
              <CCol lg="4">
                <CFormGroup>
                  <CLabel htmlFor="name">Footer</CLabel>
                  <CSelect
                    className="form-control mr-1 mt-1"
                    size="sm"
                    placeholder="Footer"
                    value={databaseToCreate.footerId}
                    onChange={(event) => {
                      setField(databaseToCreate.databaseUid, 'footerId', event.target.value);
                    }}
                  >
                    {(loadingHeaderFooter || loadingDatabase) && (
                      <option value="loading" key="loading">
                        <CSpinner color="secondary" />
                      </option>
                    )}

                    {!loadingHeaderFooter && !loadingDatabase && (
                      <option value="none" key="none">
                        none
                      </option>
                    )}
                    {!loadingHeaderFooter &&
                      !loadingDatabase &&
                      databaseToCreate.templateParts &&
                      databaseToCreate.templateParts.map((templatePart) => {
                        return (
                          <option value={templatePart.id} key={templatePart.id}>
                            {templatePart.name}
                          </option>
                        );
                      })}
                  </CSelect>
                </CFormGroup>
              </CCol>
            </CRow>
          );
        })}
        <CRow>
          <CCol lg="12">
            <CButton color="info" onClick={() => addDatabase()}>
              +
            </CButton>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton color="info" onClick={() => createCampaignInDatabase(databasesToCreate)}>
          {loading && <CSpinner color="secondary" />}
          Save
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

async function createCampaignContent(campaignManagerApi, campaign, createdContent, dataBaseConfig, enterpriseId) {
  let campaignContent = { campaign_id: campaign.id, content_id: createdContent.id, enterprise_id: enterpriseId, emailing_database_uid: dataBaseConfig.uid };
  let result = await campaignManagerApi.doMutation({
    mutation: gql`
      mutation createCampaignContent($campaign_content: JSON!, $enterprise_id: Int!) {
        createCampaignContent(campaign_content: $campaign_content, enterprise_id: $enterprise_id) {
          id
          enterprise_id
          campaign_id
          content_id
          emailing_database_uid
        }
      }
    `,
    variables: {
      campaign_content: campaignContent,
      enterprise_id: parseInt(enterpriseId)
    }
  });
  return result?.data?.createCampaignContent;
}

async function createContentInDatabase(emailingDatabaseApi, content) {
  let createContentMutation = {
    mutation: gql`
      mutation createContent($input: CreateContentInput!) {
        createContent(input: $input) {
          id
          name
          type
        }
      }
    `,
    variables: {
      input: content
    }
  };
  let createdContent = await emailingDatabaseApi.doMutation(createContentMutation);
  createdContent = JSON.parse(JSON.stringify(createdContent?.data?.createContent));
  return createdContent;
}

async function getHtml(emailingDatabaseApi, html, header, footer) {
  let result = html;
  if (header) {
    let queryToInsertHeader = getInsertCodeQuery(result, `{{{template_part.${header.uid}}}}`, 'top');
    let headerResult = await emailingDatabaseApi.doMutation(queryToInsertHeader);
    if (headerResult && headerResult.data) {
      result = headerResult.data.insertCodeInHtml;
    }
  }
  if (footer) {
    let queryToInsertFooter = getInsertCodeQuery(result, `{{{template_part.${footer.uid}}}}`, 'bottom');
    let footerResult = await emailingDatabaseApi.doMutation(queryToInsertFooter);
    if (footerResult && footerResult.data) {
      result = footerResult.data.insertCodeInHtml;
    }
  }
  return result;
}

function getInsertCodeQuery(html, codeToAdd, position) {
  return {
    mutation: gql`
      mutation InsertCodeInHtml($html: String!, $code: String!, $position: String!) {
        insertCodeInHtml(html: $html, code: $code, position: $position)
      }
    `,
    variables: {
      html: html,
      code: codeToAdd,
      position: position
    }
  };
}
