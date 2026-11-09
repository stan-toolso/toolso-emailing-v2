import { toast } from 'react-toastify';
import gql from 'graphql-tag';

export default async function updateCampaignVersion(CampaignManagerApi, campaignVersion, message, forceUpdate, enterpriseId) {
  try {
    let result = await CampaignManagerApi.doMutation({
      mutation: gql`
        mutation updateCampaignVersion($campaign_version: JSON!, $enterprise_id: Int!) {
          updateCampaignVersion(campaign_version: $campaign_version, enterprise_id: $enterprise_id) {
            id
            html
            subject
            sender_name
            name
            french_esps_subject
            preview_text
          }
        }
      `,
      variables: {
        campaign_version: campaignVersion,
        enterprise_id: parseInt(enterpriseId)
      }
    });
    if (result && result.data.updateCampaignVersion) {
      let updateCampaignVersionResult = JSON.parse(JSON.stringify(result.data.updateCampaignVersion));
      toast.success(message, {
        position: toast.POSITION.BOTTOM_RIGHT
      });

      forceUpdate();
      return updateCampaignVersionResult;
    }
  } catch (err) {
    console.log(err);
    toast.error('Failed to update campaign version', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }
}
