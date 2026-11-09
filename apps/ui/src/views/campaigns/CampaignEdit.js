import React from 'react';
import CampaignManagerApi from '../../services/CampaignManagerApi';
import { ApolloProvider } from '@apollo/client';
import CampaignEditWithoutProvider from './CampaignEditWithoutProvider';

export default ({ match }) => {
  let client = CampaignManagerApi.getClient();
  return (
    <ApolloProvider client={client}>
      <CampaignEditWithoutProvider match={match} />
    </ApolloProvider>
  );
};
