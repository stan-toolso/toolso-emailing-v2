import React, { useState, useEffect, useContext, useCallback } from 'react';
import { CCol, CNav, CNavItem, CNavLink, CRow, CSpinner, CSwitch, CTabContent, CTabPane, CTabs, CBadge, CTooltip } from '@coreui/react';
import { useSelector } from 'react-redux';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { GET_CONTENT } from '../../../../services/DatabaseQuery';
import ContentEditDashboard from './ContentEditDashboard';
import ContentEditTemplates from './ContentEditTemplates';
import ContentEditPreview from './ContentEditPreview';
import ContentEditSettings from './ContentEditSettings';
import ContentEditSchedules from './ContentEditSchedules';
import ContentEditBats from './ContentEditBats';
import ContentHistory from './ContentHistory';
import { canActivateContent, updateContent } from '../util';
import { useHistory } from 'react-router-dom';
import CreateContentModal from '../list/CreateContentModal';
import SuspendContentModal from '../list/SuspendContentModal';

const sections = ['', 'template', 'preview', 'settings', 'schedules', 'bats', 'history'];

export default ({ match }) => {
  const contentId = match.params.content_id;
  const section = match.params.section;

  const [active, setActive] = useState(sections.indexOf(section ? section : ''));

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const history = useHistory();
  const [showModalCreation, setShowModalCreation] = useState(false);
  const [showModalSuspend, setShowModalSuspend] = useState(false);

  const userEntreprise = useSelector((state) => state.userEntreprise);
  const isSuperAdmin = userEntreprise.role === 'superAdmin';

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/list/${contentId}/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, contentId, setActive, history]
  );

  useEffect(() => {
    if (!content) {
      return;
    }
    if (!section && !content.delivStats) {
      changeSection('template');
    }
  }, [history, content, section, changeSection]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let result = await emailingDatabaseApiContext.doQuery({
        query: GET_CONTENT,
        variables: {
          id: contentId
        }
      });
      if (result) {
        setContent(JSON.parse(JSON.stringify(result.data.content)));
      }
      setLoading(false);
    })();
  }, [emailingDatabaseApiContext, contentId, setContent, setLoading]);

  const forceUpdate = useCallback(() => {
    setContent({ ...content });
  }, [content, setContent]);

  const defaultVersion = content ? (content.defaultVersion ? content.defaultVersion : content.versions.length > 0 ? content.versions[0] : null) : null;
  function hasAtLeastOneContent(content) {
    return content && content.versions && content.versions.length >= 1 && content.versions.some((version) => version.html || version.contentTemplate);
  }

  const cloneContent = () => {
    setShowModalCreation(true);
  };

  return (
    <>
      {content && (
        <>
          <CreateContentModal
            replay="true"
            show={showModalCreation}
            contentToClone={content}
            toggle={() => {
              setShowModalCreation(false);
            }}
          />
          <SuspendContentModal
            show={showModalSuspend ? true : false}
            contentToSuspend={content}
            enterprise
            toggle={() => {
              forceUpdate();
              setShowModalSuspend(false);
            }}
          />
        </>
      )}
      <CRow className="content-detail">
        <CCol xl={12}>
          {content && (
            <CSwitch
              className={'mx-1 float-left mr-2'}
              color={'primary'}
              variant={'3d'}
              labelOn={'\u2713'}
              labelOff={'\u2715'}
              checked={content.isActive}
              disabled={!canActivateContent(content)}
              onChange={async (event) => {
                if (event.target.checked === content.isActive) {
                  return;
                }
                await updateContent(
                  emailingDatabaseApiContext,
                  content,
                  {
                    isActive: event.target.checked
                  },
                  event.target.checked ? `Content has been enabled` : `Content has been disabled`,
                  forceUpdate
                );
              }}
            />
          )}
          {content?.suspended && (
            <CTooltip content={`suspended by Toolso (${content.suspensionReason})`}>
              <CBadge color="danger" style={{ verticalAlign: 'top', marginTop: '7px', marginRight: '2px' }}>
                suspended
              </CBadge>
            </CTooltip>
          )}

          <h3 style={{ display: 'inline' }}>
            #{contentId} : {content && `${content.partner ? `[${content.partner.name}] ` : ''}${content.name}`}
            {content && (
              <i
                className="pl-2 pr-1 far  fa-clone"
                style={{ cursor: 'pointer', fontSize: '15px' }}
                onClick={() => {
                  cloneContent(content);
                }}
              />
            )}
            {content && isSuperAdmin && !content.suspended && (
              <i
                className="pl-2 pr-1 far  fa-hand-paper"
                style={{ cursor: 'pointer', fontSize: '15px' }}
                onClick={() => {
                  setShowModalSuspend(content);
                }}
              />
            )}
          </h3>

          {loading && (
            <div style={{ textAlign: 'center', padding: '30px 0px' }}>
              <CSpinner animation="grow" color="secondary" />
            </div>
          )}
          {!loading && content && (
            <>
              <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
                <CNav variant="tabs">
                  <CNavItem>
                    <CNavLink style={{ display: content.delivStats ? null : 'none' }}>
                      <i className="fas fa-tachometer-alt"></i>
                      &nbsp; Dashboard
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-edit"></i>
                      &nbsp; Template
                    </CNavLink>
                  </CNavItem>
                  {content && hasAtLeastOneContent(content) && (
                    <CNavItem>
                      <CNavLink>
                        <i className="fas fa-eye"></i>
                        &nbsp; Preview
                      </CNavLink>
                    </CNavItem>
                  )}
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-cogs"></i>
                      &nbsp; Settings
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-calendar"></i>
                      &nbsp; Schedules
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink>
                      <i className="fas fa-calendar-check"></i>
                      &nbsp; BATs
                    </CNavLink>
                  </CNavItem>
                  {content?.history?.length ? (
                    <CNavItem>
                      <CNavLink>
                        <i className="fas fa-history"></i>
                        &nbsp; History
                      </CNavLink>
                    </CNavItem>
                  ) : (
                    <></>
                  )}
                </CNav>
                <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
                  <CTabPane>
                    <ContentEditDashboard content={content} forceUpdate={forceUpdate} />
                  </CTabPane>
                  <CTabPane>
                    <ContentEditTemplates content={content} forceUpdate={forceUpdate} />
                  </CTabPane>
                  {content && hasAtLeastOneContent(content) && (
                    <CTabPane>
                      <ContentEditPreview content={content} contentVersion={defaultVersion} forceUpdate={forceUpdate} />
                    </CTabPane>
                  )}

                  <CTabPane>
                    <ContentEditSettings content={content} forceUpdate={forceUpdate} />
                  </CTabPane>
                  <CTabPane>
                    <ContentEditSchedules content={content} forceUpdate={forceUpdate} />
                  </CTabPane>
                  <CTabPane>
                    <ContentEditBats content={content} forceUpdate={forceUpdate} />
                  </CTabPane>
                  <CTabPane>
                    <ContentHistory content={content} />
                  </CTabPane>
                </CTabContent>
              </CTabs>
            </>
          )}
        </CCol>
      </CRow>
    </>
  );
};
