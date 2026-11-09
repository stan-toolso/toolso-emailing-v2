import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { CHeader, CToggler, CHeaderBrand, CHeaderNav, CHeaderNavItem, CHeaderNavLink } from '@coreui/react';
import TheEmailingBreadcrumb from './TheEmailingBreadcrumb';
import EmailingDatabaseSwitcher from './EmailingDatabaseSwitcher';

import { TheHeaderDropdown } from './index';
import { canViewContacts } from '../services/PermissionService';

const TheHeader = () => {
  const dispatch = useDispatch();
  const sidebarShow = useSelector((state) => state.sidebarShow);
  const currentEmailingDatabase = useSelector((state) => state.currentEmailingDatabase);
  const permission = useSelector((state) => state.permission);

  const toggleSidebar = () => {
    const val = [true, 'responsive'].includes(sidebarShow) ? false : 'responsive';
    dispatch({ type: 'set', sidebarShow: val });
  };

  const toggleSidebarMobile = () => {
    const val = [false, 'responsive'].includes(sidebarShow) ? true : 'responsive';
    dispatch({ type: 'set', sidebarShow: val });
  };

  return (
    <CHeader withSubheader>
      <CToggler inHeader className="ml-md-3 d-lg-none" onClick={toggleSidebarMobile} />
      <CToggler inHeader className="ml-3 d-md-down-none" onClick={toggleSidebar} />

      <CHeaderBrand className="mx-auto d-lg-none">
        <EmailingDatabaseSwitcher />
      </CHeaderBrand>
      <CHeaderBrand className="d-none d-lg-block pt-2">
        <EmailingDatabaseSwitcher />
      </CHeaderBrand>

      <CHeaderNav className="d-md-down-none mr-auto">
        {currentEmailingDatabase && (
          <>
            <CHeaderNavItem className="px-3">
              <CHeaderNavLink to={`/${currentEmailingDatabase.uid}/`} exact={true}>
                Home
              </CHeaderNavLink>
            </CHeaderNavItem>

            {canViewContacts(permission) && (
              <CHeaderNavItem className="px-3">
                <CHeaderNavLink to={`/${currentEmailingDatabase.uid}/contacts/`}>Contacts</CHeaderNavLink>
              </CHeaderNavItem>
            )}

            <CHeaderNavItem className="px-3">
              <CHeaderNavLink to={`/${currentEmailingDatabase.uid}/contents/`}>Contents</CHeaderNavLink>
            </CHeaderNavItem>
            <CHeaderNavItem className="px-3">
              <CHeaderNavLink to={`/${currentEmailingDatabase.uid}/sendings/`}>Sendings</CHeaderNavLink>
            </CHeaderNavItem>

            {permission?.role === 'superAdmin' && (
              <CHeaderNavItem className="px-3">
                <CHeaderNavLink to={`/${currentEmailingDatabase.uid}/admin/`}>Admin</CHeaderNavLink>
              </CHeaderNavItem>
            )}
          </>
        )}
      </CHeaderNav>

      <CHeaderNav className="px-3">
        <TheHeaderDropdown />
      </CHeaderNav>

      {currentEmailingDatabase && <TheEmailingBreadcrumb />}
    </CHeader>
  );
};

export default TheHeader;
