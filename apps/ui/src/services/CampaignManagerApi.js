import EmailingDatabaseApi from './EmailingDatabaseApi';
class CampaignManagerApi {
  constructor() {
    let compaignManagerApiConfig = { uid: 'campaign-manager', name: 'Campaign Manager', enabled: true, apiEndpoint: 'https://campaign-manager.toolso.io' };
    return new EmailingDatabaseApi(compaignManagerApiConfig);
  }
}
export default new CampaignManagerApi();
