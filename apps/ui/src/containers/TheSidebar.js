import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { CCreateElement, CSidebar, CSidebarNav, CSidebarNavDivider, CSidebarNavTitle, CSidebarMinimizer, CSidebarNavDropdown, CSidebarNavItem, CImg } from '@coreui/react';

// sidebar nav config
import navigation from './_nav';

const TheSidebar = () => {
  const dispatch = useDispatch();
  const show = useSelector((state) => state.sidebarShow);
  const userEntreprise = useSelector((state) => state.userEntreprise);
  const currentEmailingDatabase = useSelector((state) => state.currentEmailingDatabase);
  const enterprise = useSelector((state) => state.entreprise);

  return (
    <CSidebar show={show} onShowChange={(val) => dispatch({ type: 'set', sidebarShow: val })}>
      <div className="c-sidebar-nav-item " style={{ height: '56px' }}>
        <a href="/" className="c-sidebar-nav-link d-flex  flex-row  p-0" style={{ height: '56px' }}>
          <div className="mr-1  text-center " style={{ flex: '0 0 50px', paddingTop: '5px' }}>
            <CImg src={'img/toolso_logo_white_300.png'} className="" style={{ width: '36px', height: '36px' }} />
          </div>

          <h2 className="flex-grow-1 pt-2 text-white">Toolso Emailing</h2>
        </a>
      </div>

      <CSidebarNav>
        <CCreateElement
          items={navigation(useLocation(), currentEmailingDatabase, userEntreprise, enterprise)}
          components={{
            CSidebarNavDivider,
            CSidebarNavDropdown,
            CSidebarNavItem,
            CSidebarNavTitle
          }}
        />
      </CSidebarNav>
      <CSidebarMinimizer className="c-d-md-down-none" />
    </CSidebar>
  );
};

export default React.memo(TheSidebar);
