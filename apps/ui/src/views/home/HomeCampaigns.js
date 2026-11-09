import HomeCampaigns from '../campaigns/HomeCampaignsWithoutProvider';
import React from 'react';
import { ApolloProvider } from '@apollo/client';
import CampaignManagerApi from '../../services/CampaignManagerApi';

export default () => {
  let client = CampaignManagerApi.getClient();
  return (
    <>
      <ApolloProvider client={client}>
        <HomeCampaigns />
      </ApolloProvider>
    </>
  );
};
