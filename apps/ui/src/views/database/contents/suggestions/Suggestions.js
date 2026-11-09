import React, { useCallback, useContext, useState } from 'react';
import { CRow, CCol, CTabs, CNav, CNavItem, CNavLink, CTabPane, CTabContent } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import Replay from './Replay';

const sections = ['', 'replay'];

export default ({ match }) => {
  const section = match.params.section;
  const [active, setActive] = useState(sections.indexOf(section ? section : ''));
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/suggestions/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, setActive, history]
  );

  return (
    <>
      <CRow>
        <CCol>
          <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
            <CNav variant="tabs">
              <CNavItem>
                <CNavLink>
                  <i className="fas fa-redo"></i>
                  &nbsp; Replay
                </CNavLink>
              </CNavItem>
            </CNav>
            <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
              <CTabPane>
                <Replay />
              </CTabPane>
            </CTabContent>
          </CTabs>
        </CCol>
      </CRow>
    </>
  );
};
