import { EventType } from '../services/AccessManager/AccessManager';
import { emit } from '../services/AppEvents/AppEvents';

import React from 'react';
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle, CImg } from '@coreui/react';
import { useSelector } from 'react-redux';
import CIcon from '@coreui/icons-react';

const TheHeaderDropdown = () => {
  const user = useSelector((state) => state.user);

  const disconnect = () => {
    emit(EventType.disconnect);
  };

  const switchAccount = () => {
    emit(EventType.new_entreprise, null);
  };

  return (
    <CDropdown inNav className="c-header-nav-items mx-2" direction="down">
      <CDropdownToggle className="c-header-nav-link" caret={false}>
        <div className="c-avatar">
          <CImg src={'avatars/default.png'} className="c-avatar-img" alt="admin@bootstrapmaster.com" />
        </div>
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        {user && <CDropdownItem>{user.email}</CDropdownItem>}
        {user && user.entreprises && user.entreprises.length > 1 && (
          <CDropdownItem onClick={switchAccount}>
            <i className="fas fa-exchange-alt mfe-2" />
            Switch entreprise account
          </CDropdownItem>
        )}
        <CDropdownItem onClick={disconnect}>
          <CIcon name="cil-lock-locked" className="mfe-2" />
          Disconnect
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  );
};

export default TheHeaderDropdown;
