import React, { useContext, useState, useCallback, useEffect } from 'react';
import { CCol, CRow, CTabs, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import { useHistory } from 'react-router-dom';
import EmailingDatabaseApiContext from '../../../contexts/EmailingDatabaseApiContext';
import SettingsSection from './SettingsSection';

const sections = ['marketing_pressure', 'other'];

export default ({ match }) => {
  const section = match.params.section;
  const [active, setActive] = useState(sections.indexOf(section ? section : 'marketing_pressure'));

  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/admin/settings/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  useEffect(() => {
    if (!section) {
      changeSection('marketing_pressure');
    }
  }, [section, changeSection]);

  return (
    <CRow>
      <CCol>
        <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink>
                <i className="fas fa-sliders-h"></i>&nbsp; Marketing Pressure
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>
                <i className="fas fa-server"></i>&nbsp; Other Settings
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
            <CTabPane>
              <SettingsSection section="marketing_pressures" />
            </CTabPane>
            <CTabPane>
              <SettingsSection section="other" />
            </CTabPane>
          </CTabContent>
        </CTabs>
      </CCol>
    </CRow>
  );
};
