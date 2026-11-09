const log = require('../util/log').getLogger('GAnalyticsService');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
// Identifiants Google Analytics : fichier de compte de service désigné par GOOGLE_APPLICATION_CREDENTIALS (plus de fichier commité).

const { getSettings } = require('../services/SettingsService');

const GAnalyticsService = class {
  constructor(propertyId, newsletterUtmContent) {
    this.propertyId = `${propertyId}`;
    this.newsletterUtmContent = newsletterUtmContent;
    this.analyticsDataClient = new BetaAnalyticsDataClient();
  }

  async _doRequest(reportRequest) {
    reportRequest.property = `properties/${this.propertyId}`;

    const [response] = await this.analyticsDataClient.runReport(reportRequest);

    //console.log('Report result:', response);
    //console.log(JSON.stringify(response, null, 2));
    return response;
  }

  async _getSimpleMetric(startDate, endDate, metric) {
    let report = {
      dateRanges: [
        {
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD')
        }
      ],
      metrics: [
        {
          expression: metric
        }
      ]
    };
    let resp = await this._doRequest(report);
    //console.log(JSON.stringify(resp, null, 2));
    return resp.data && resp.data.totals && resp.data.totals.length ? parseInt(resp.data.totals[0].values[0]) : 0;
  }
  async _getWithDimensions(startDate, endDate, metric, dimensions = [], dimensionFilter) {
    let gaDimensions = [];
    dimensions.forEach((dimension) => {
      gaDimensions.push({
        name: dimension
      });
    });
    let report = {
      dateRanges: [
        {
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD')
        }
      ],
      metrics: [
        {
          name: metric
        }
      ],
      dimensions: gaDimensions,

      dimensionFilter,
      pageSize: 100000
    };
    //console.log(JSON.stringify(report, null, 2));
    let resp = await this._doRequest(report);
    //console.log(JSON.stringify(resp, null, 2));
    return resp && resp.rows ? resp.rows : [];
  }

  async getAdsenseRevenuePerUtmContent(startDate, endDate) {
    return await this._getWithDimensions(
      startDate,
      endDate,
      'totalRevenue',
      ['sessionManualAdContent', 'sessionSource'],

      {
        filter: {
          stringFilter: { matchType: 'EXACT', value: this.newsletterUtmContent },
          fieldName: 'sessionSource'
        }
      }
    );
  }
};

let _mainGAService = null;
const getMainGAService = async () => {
  if (!_mainGAService) {
    const { mainGA4PropertyId, newsletterUtmContent } = await getSettings(['mainGA4PropertyId', 'newsletterUtmContent']);
    if ((mainGA4PropertyId, newsletterUtmContent)) {
      _mainGAService = new GAnalyticsService(mainGA4PropertyId, newsletterUtmContent);
    }
  }
  return _mainGAService;
};

module.exports = {
  GAnalyticsService,
  getMainGAService
};
