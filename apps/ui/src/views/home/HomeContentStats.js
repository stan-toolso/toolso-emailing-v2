import { CRow, CCol, CNav, CNavItem, CNavLink, CTabs, CTabContent, CTabPane } from '@coreui/react';
import React, { useEffect, useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import HomeContentStatsByContent from './HomeContentStatsByContent';
import HomeContentStatsByObject from './HomeContentStatsByObject';

const sections = ['byContent', 'byObject'];

export default ({ match }) => {
  const section = match.params.section;

  const [active, setActive] = useState(sections.indexOf(section ? section : 'byContent'));
  const history = useHistory();

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/contentStats/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [setActive, history]
  );

  useEffect(() => {
    if (!section) {
      changeSection('byContent');
    }
  }, [section, changeSection]);

  return (
    <CRow>
      <CCol xl={12}>
        <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink>
                <i className="fas fa-envelope-open-text"></i>&nbsp; By Content
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink>
                <i className="fas fa-at"></i>&nbsp; By Subject / Sender
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
            <CTabPane>
              <HomeContentStatsByContent />
            </CTabPane>
            <CTabPane>
              <HomeContentStatsByObject />
            </CTabPane>
          </CTabContent>
        </CTabs>
      </CCol>
    </CRow>
  );
};
