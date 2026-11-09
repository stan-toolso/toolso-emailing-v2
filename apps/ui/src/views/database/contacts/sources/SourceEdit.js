import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CCol, CNav, CNavItem, CNavLink, CRow, CSpinner, CTabContent, CTabPane, CTabs } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import SourceEditApi from './SourceEditApi';
import SourceEditSettings from './SourceEditSettings';
import SourceEditDashboard from './SourceEditDashboard';
import InscriptionList from '../inscriptions/InscriptionList';
import SubSources from './SubSources';

const sections = ['', 'settings', 'api', 'inscriptions', 'subSources'];

export default ({ match }) => {
  const sourceId = match.params.source_id;
  const section = match.params.section;

  const [active, setActive] = useState(sections.indexOf(section ? section : ''));
  const [source, setSource] = useState(null);

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const { loading, data, refetch } = useQuery(
    gql`
      query contactSource($id: ID!) {
        contactSource(id: $id) {
          id
          name
          utmSource
          apiEnabled
          apiKey
          apiFields
          apiScheduleIds
          apiSettings
          childConfig
          parentSource {
            id
            name
            utmSource
            apiEnabled
            apiKey
            apiFields
            apiScheduleIds
            apiSettings
            childConfig
            defaultChildSource {
              id
            }
          }
          defaultChildSource {
            id
            name
            utmSource
            apiEnabled
            apiKey
            apiFields
            apiScheduleIds
            apiSettings
            childConfig
          }
          childSources {
            id
            name
            utmSource
            apiEnabled
            apiKey
            apiFields
            apiScheduleIds
            apiSettings
            childConfig
          }
        }
      }
    `,
    {
      variables: {
        id: sourceId
      }
    }
  );

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/sources/edit/${sourceId}/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, sourceId, setActive, history]
  );

  useEffect(() => {
    if (data) {
      setSource(JSON.parse(JSON.stringify(data.contactSource)));
    }
  }, [data, setSource]);

  return (
    <CRow>
      <CCol xl={12}>
        <h3>
          {data?.contactSource?.parentSource && (
            <>
              <i
                style={{ cursor: 'pointer' }}
                className="fas fa-folder-open fa-xs"
                onClick={() => history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inscriptions/sources/edit/${data.contactSource.parentSource.id}`)}
              ></i>
              {` ${data.contactSource.parentSource.name} `}

              {' / '}
            </>
          )}
          {data && data.contactSource.name}
        </h3>

        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}
        {!loading && source && (
          <>
            <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
              <CNav variant="tabs">
                <CNavItem>
                  <CNavLink>
                    <i className="fas fa-tachometer-alt"></i>
                    &nbsp; Dashboard
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink>
                    <i className="fas fa-cogs"></i>
                    &nbsp; Settings
                  </CNavLink>
                </CNavItem>
                {!source?.parentSource?.id && (
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-tools"></i>
                      &nbsp; API
                    </CNavLink>
                  </CNavItem>
                )}
                <CNavItem>
                  <CNavLink>
                    <i className="fas fa-list"></i>
                    &nbsp; Inscriptions
                  </CNavLink>
                </CNavItem>
                {!source?.parentSource?.id && (
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-sitemap"></i>
                      &nbsp; Sub Sources
                    </CNavLink>
                  </CNavItem>
                )}
              </CNav>
              <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
                <CTabPane>
                  <SourceEditDashboard source={source} />
                </CTabPane>
                <CTabPane>
                  <SourceEditSettings source={source} refetch={refetch} />
                </CTabPane>
                {!source?.parentSource?.id && (
                  <CTabPane>
                    <SourceEditApi source={source} refetch={refetch} />
                  </CTabPane>
                )}
                <CTabPane>
                  <InscriptionList sourceId={source.id} />
                </CTabPane>
                {!source?.parentSource?.id && (
                  <CTabPane>
                    <SubSources source={source} refetch={refetch} />
                  </CTabPane>
                )}
              </CTabContent>
            </CTabs>
          </>
        )}
      </CCol>
    </CRow>
  );
};
