const log = require('../../util/log').getLogger('UsageService');
const config = require('../../util/config');
const knex = require('knex');
const moment = require('moment-timezone');
const UsageType = require('./UsageType');

const ALL_FIELDS = ['id', 'date', 'type', 'subtype', 'resource_uid', 'entreprise_id', 'service', 'cost', 'value', 'unit_cost'];

module.exports = class {
  constructor() {}
  async _knex() {
    if (!this.knex) {
      const usageDatabaseUrl = config.usageDatabaseUrl();
      if (!usageDatabaseUrl) {
        throw new Error('USAGE_DATABASE_URL is not configured');
      }
      log.info(`Init Usage postgres connection`);

      this.knex = knex({
        client: 'pg',
        connection: usageDatabaseUrl,
        searchPath: ['knex', 'public'],
        pool: { min: 0, max: 2 }
      });
    }
    return this.knex;
  }
  async initConnection() {
    await this._knex();
  }

  async createOrUpdateUsage(date, type, subtype, value, projection = false) {
    log.debug(`[${process.env.RESOURCE_UID}] CreateOrUpdateUsage toolso-emailing,${date},${type},${value}`);
    let where = {
      date: moment(date).format('YYYY-MM-DD'),
      type,
      subtype,
      service: 'toolso-emailing',
      resource_uid: process.env.RESOURCE_UID
    };
    let resource = await this.getResource(process.env.RESOURCE_UID);
    let unit_cost = await this.getPricing(type, subtype, resource);
    if (type == UsageType.engine_active_database && value == 1) {
      let daysInMonth = moment(date).daysInMonth();
      //unit_cost = unit_cost / daysInMonth;
      value = value / daysInMonth;
    }

    const cost = value * unit_cost;
    let existingUsage = await (await this._knex())('usages').where(where).first();
    if (existingUsage) {
      await (
        await this._knex()
      )('usages')
        .where('id', existingUsage.id)
        .update({ value, cost, unit_cost, projection, entreprise_id: resource ? resource.entreprise_id : null });
      return existingUsage;
    } else {
      const usage = {
        date: moment(date).format('YYYY-MM-DD'),
        service: 'toolso-emailing',
        type,
        subtype,
        resource_uid: process.env.RESOURCE_UID,
        entreprise_id: resource ? resource.entreprise_id : null,
        value,
        cost,
        unit_cost,
        projection
      };

      return await (await this._knex())('usages').insert(usage, ALL_FIELDS);
    }
  }

  async getResource(uid) {
    return await (await this._knex())('resources').where('uid', uid).first();
  }
  async getPricing(type, subtype, resource) {
    let specificPricing = await (
      await this._knex()
    )('pricings')
      .where({
        service: 'toolso-emailing',
        type,
        subtype,
        resource_uid: process.env.RESOURCE_UID
      })
      .first();
    if (!specificPricing) {
      specificPricing = await (
        await this._knex()
      )('pricings')
        .where({
          service: 'toolso-emailing',
          type,
          subtype,
          resource_uid: null,
          entreprise_id: resource?.entreprise_id
        })
        .first();
    }
    if (specificPricing) {
      return specificPricing.unit_cost;
    }
    switch (type) {
      case UsageType.engine_email_sent:
        return 0.0004;
      case UsageType.router_email_sent:
        return 0.0001;
      case UsageType.engine_active_database:
        return 0;
    }

    return 0;
  }

  async updateProjections() {
    let _knex = await this._knex();
    //on supprime d'abord toutes les anciennes projections
    await _knex('usages').where('projection', true).andWhere('resource_uid', process.env.RESOURCE_UID).andWhere('date', '<=', moment().add(-1, 'days')).del();

    let lastWeekUsages = await _knex
      .select('type', 'subtype', _knex.raw('SUM(value)'))
      .from('usages')
      .where('service', 'toolso-emailing')
      .andWhere('resource_uid', process.env.RESOURCE_UID)
      .andWhere('projection', false)
      .andWhere('date', '>=', moment().add(-7, 'days'))
      .andWhere('date', '<=', moment().add(-1, 'days'))
      .groupBy(['type', 'subtype']);

    for (let usage of lastWeekUsages) {
      let dayProjection = usage.sum ? parseFloat(usage.sum) / 7 : 0;

      let currentDate = moment();
      let endDate = moment().add(31, 'days');
      let dates = [];
      while (currentDate <= endDate) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate = currentDate.add(1, 'days');
      }
      await Promise.all(
        dates.map((date) => {
          return this.createOrUpdateUsage(date, usage.type, usage.subtype, dayProjection, true);
        })
      );
    }
  }
};
