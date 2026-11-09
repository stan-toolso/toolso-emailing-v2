import { CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import React from 'react';
import { useQuery } from '@apollo/client';

const TEMPLATES = gql`
  query partners($limit: Int, $offset: Int, $filter: JSON) {
    partners(limit: $limit, offset: $offset, filter: $filter) {
      total
      partners {
        id
        name
        validatorsEmails
        defaultMessage
        contacts
      }
    }
  }
`;

export default ({ partnerId, setPartnerId, setPartner, nullLabel = '-- Select the partner --', partnersFilter }) => {
  const { loading, data } = useQuery(TEMPLATES, {
    variables: {
      limit: 10000,
      offset: 0,
      filter: {}
    }
  });

  if (loading) {
    return (
      <div className="pt-3 text-center">
        <div className="sk-spinner sk-spinner-pulse"></div>
      </div>
    );
  }
  let partnersToShow = data && data.partners && data.partners.partners ? data.partners.partners : [];
  if (partnersFilter) {
    partnersToShow = partnersFilter(partnersToShow);
  }

  return (
    <CSelect
      size="sm"
      id="partnerSelector"
      value={partnerId ? partnerId : ''}
      onChange={(event) => {
        if (setPartnerId) {
          setPartnerId(event.target.value ? parseInt(event.target.value) : null);
        }
        if (setPartner) {
          setPartner(
            data.partners.partners.filter((c) => {
              return c.id === event.target.value;
            })[0]
          );
        }
      }}
    >
      <option value={''}>{nullLabel}</option>
      {partnersToShow.map((partner) => {
        return (
          <option key={partner.id} value={partner.id}>
            {partner.name}
          </option>
        );
      })}
    </CSelect>
  );
};
