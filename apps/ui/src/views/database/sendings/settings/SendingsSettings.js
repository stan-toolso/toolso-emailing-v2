import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CTabs } from '@coreui/react';
import { useHistory } from 'react-router-dom';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import MailRouters from './MailRouters';
import SendingConfigs from './SendingConfigs';
import Senders from './Senders';

const sections = ['configs', 'routers', 'senders'];

export default ({ match }) => {
  const section = match.params.section;

  const [active, setActive] = useState(sections.indexOf(section ? section : 'configs'));
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/sendings/settings/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  useEffect(() => {
    if (!section) {
      changeSection('configs');
    }
  }, [section, changeSection]);

  return (
    <CRow>
      <CCol xl={12}>
        <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink>
                <i className="fas fa-sliders-h"></i>&nbsp; Sending Configurations
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>
                <i className="fas fa-server"></i>&nbsp; Mail Routers
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>
                <i className="fas fa-server"></i>&nbsp; Senders
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
            <CTabPane>
              <SendingConfigs />
            </CTabPane>
            <CTabPane>
              <MailRouters />
            </CTabPane>
            <CTabPane>
              <Senders />
            </CTabPane>
          </CTabContent>
        </CTabs>
      </CCol>
    </CRow>
  );
};
