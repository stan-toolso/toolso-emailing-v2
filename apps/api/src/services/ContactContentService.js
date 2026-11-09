const log = require('../util/log').getLogger('ContactContentService');

const sequelize = require('../storage/sequelize');
const { Op, QueryTypes } = require('sequelize');
const { getCachedSettings, getSettings } = require('./SettingsService');
const moment = require('moment-timezone');

module.exports = class {
  constructor() {
    this.sequelizeObject = sequelize.get();
    this.ContactContent = this.sequelizeObject?.models?.ContactContent;
  }

  /**
   * Clean old events to keep the database light
   */
  clean = async () => {
    log.debug(`Cleaning contact content`);
    let { contact_content_max_history_days, contact_content_max_lines_to_destroy } = await getSettings(['contact_content_max_history_days', 'contact_content_max_lines_to_destroy']);

    if (!contact_content_max_history_days) {
      log.debug(`No contact_content_max_history_days defined, we can skip this job.`);
      return;
    }

    const minIdResult = await this.sequelizeObject.query(`select min(id) as minid from "ContactContent"`, {
      type: QueryTypes.SELECT
    });

    if (minIdResult?.length && minIdResult?.length && minIdResult[0].minid) {
      let minId = minIdResult[0].minid;
      const rawResult = await this.sequelizeObject.query(`select id,"createdAt" from "ContactContent" where id >= ${minId + contact_content_max_lines_to_destroy} order by id LIMIT 1`, {
        type: QueryTypes.SELECT
      });

      if (rawResult && rawResult.length && rawResult[0]) {
        let maxId = rawResult[0].id;
        let date = rawResult[0].createdAt;
        log.debug(`Found oldest contact content with id ${maxId} and date ${date}`);

        let daysBetweenCandidateDateAndNow = moment().diff(moment(date), 'days');

        if (contact_content_max_history_days < daysBetweenCandidateDateAndNow) {
          let destroyResult = await this.ContactContent.destroy({
            where: {
              id: {
                [Op.lt]: maxId,
                [Op.gte]: minId
              }
            }
          });
          log.debug(`Contact content cleaned. Result : ${destroyResult}`);
          return destroyResult;
        }
      }
    }
  };
};
