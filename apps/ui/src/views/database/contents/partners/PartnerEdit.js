import React, { useState, useCallback, useContext } from 'react';
import { CTabs, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';

import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Bats from '../bats/Bats';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import PartnerEditGeneral from './PartnerEditGeneral';
import PartnerEditContacts from './PartnerEditContacts';
import PartnerEditVariables from './PartnerEditVariables';
import PartnerEditMappingKitVariables from './PartnerEditMappingKitVariables';

const sections = ['', 'contacts', 'variables', 'kit-mapping', 'bats'];

const PARTNER = gql`
  query partner($id: ID!) {
    partner(id: $id) {
      id
      name

      contacts
      variables
      kitMapping

      validatorsEmails
      defaultMessage
    }
  }
`;

export default ({ match }) => {
  const partnerId = match.params.partner_id;
  const section = match.params.section;

  const [active, setActive] = useState(sections.indexOf(section ? section : ''));
  const history = useHistory();

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const changeSection = useCallback(
    (newSection) => {
      history.push(`/${emailingDatabaseApiContext.getUid()}/contents/partners/${partnerId}/${newSection}`);
      setActive(sections.indexOf(newSection ? newSection : ''));
    },
    [emailingDatabaseApiContext, partnerId, setActive, history]
  );

  const { loading, data, refetch } = useQuery(PARTNER, {
    variables: {
      id: partnerId
    }
  });

  if (loading) {
    return (
      <div className="pt-3 text-center">
        <div className="sk-spinner sk-spinner-pulse"></div>
      </div>
    );
  }
  const partner = data.partner ? data.partner : null;
  return (
    <>
      <h3>
        #{partnerId} : {partner ? partner.name : ''}
      </h3>

      <CTabs activeTab={active} onActiveTabChange={(idx) => changeSection(sections[idx])}>
        <CNav variant="tabs">
          <CNavItem>
            <CNavLink>
              <i className="fas fa-edit"></i>
              &nbsp; General
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink>
              <i className="fas fa-users"></i>
              &nbsp; Contacts
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink>
              <i className="fas fa-cogs"></i>
              &nbsp; Variables
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink>
              <i className="fas fa-exchange-alt"></i>
              &nbsp; Kit mapping
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink>
              <i className="fas fa-calendar-check"></i>
              &nbsp; Bats
            </CNavLink>
          </CNavItem>
        </CNav>
        <CTabContent className="p-3 border-right border-left border-bottom" style={{ minHeight: '300px', background: '#FFF' }}>
          <CTabPane>{partner && <PartnerEditGeneral partner={partner} forceUpdate={refetch} />}</CTabPane>
          <CTabPane>{partner && <PartnerEditContacts partner={partner} />}</CTabPane>
          <CTabPane>{partner && <PartnerEditVariables partner={partner} refetch={refetch} />}</CTabPane>
          <CTabPane>{partner && <PartnerEditMappingKitVariables partner={partner} refetch={refetch} />}</CTabPane>

          <CTabPane>
            <Bats partnerId={partnerId} />
          </CTabPane>
        </CTabContent>
      </CTabs>
    </>
  );
};
