import { toast } from 'react-toastify';
import gql from 'graphql-tag';

export default async function updateCampaign(CampaignManagerApi, campaign, fieldsToUpdate, forceUpdate, enterpriseId) {
  const UPDATE_CAMPAIGN_QUERY = gql`
    mutation UpdateCampaign($campaign: JSON!, $enterprise_id: Int!) {
      updateCampaign(campaign: $campaign, enterprise_id: $enterprise_id) {
        id
        name
        is_active
        start_date
        end_date
        config
        type
        deliv_stats
        versions {
          id
          subject
          sender_name
          html
          deliv_stats
          preview_text
          french_esps_subject
        }
        contents {
          enterprise_id
          emailing_database_uid
          content_id
        }
      }
    }
  `;
  try {
    fieldsToUpdate.id = campaign.id;
    let result = await CampaignManagerApi.doMutation({
      mutation: UPDATE_CAMPAIGN_QUERY,
      variables: {
        campaign: fieldsToUpdate,
        enterprise_id: parseInt(enterpriseId)
      },
      fetchPolicy: 'network-only'
    });
    if (result && result.data.updateCampaign) {
      for (let key in result.data.updateCampaign) {
        if (key in campaign) {
          campaign[key] = JSON.parse(JSON.stringify(result.data.updateCampaign[key]));
        }
      }
      toast.success('campaign Updated', {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
    }
  } catch (err) {
    console.error(err);
    toast.error('Failed to update campaign', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
}
