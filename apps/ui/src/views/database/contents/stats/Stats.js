import React, { useEffect, useState, useCallback, useContext } from 'react';
import { CRow, CCol, CNav, CNavItem, CNavLink, CTabs, CTabContent, CTabPane } from '@coreui/react';
import { useHistory } from 'react-router-dom';

import StatsByContent from './StatsByContent';
import StatsByObject from './StatsByObject';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useSettings } from '../../../common/Settings';

const sections = ['byContent', 'byObject'];

export default ({ defaultFromDate, defaultToDate, match }) => {
  const section = match.params.section;
  const [canEditSenderName] = useSettings('canEditSenderName');
  const [active, setActive] = useState(sections.indexOf(section ? section : 'byContent'));
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/stats/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [setActive, history, emailingDatabaseApiContext]
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
                <i className="fas fa-at"></i>&nbsp; By Subject{canEditSenderName && ' / Sender'}
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
            <CTabPane>
              <StatsByContent defaultFromDate={defaultFromDate} defaultToDate={defaultToDate} />
            </CTabPane>
            <CTabPane>
              <StatsByObject defaultFromDate={defaultFromDate} defaultToDate={defaultToDate} canEditSenderName={canEditSenderName} />
            </CTabPane>
          </CTabContent>
        </CTabs>
      </CCol>
    </CRow>
  );
};
