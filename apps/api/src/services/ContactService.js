const log = require('../util/log').getLogger('ContactService');
const moment = require('moment-timezone');
const emailValidator = require('email-validator');
const sequelize = require('../storage/sequelize');
const ContactStatus = require('../storage/models/ContactStatus');
const ExclusionListService = require('./ExclusionListService');
const InclusionListService = require('./InclusionListService');
const Sequelize = require('sequelize');
const { Op, QueryTypes } = Sequelize;
const { extractEsp } = require('./EspService');
const { getCachedSettings } = require('./SettingsService');
var md5 = require('md5');
var sha1 = require('sha1');
var sha256 = require('js-sha256');

module.exports = class {
  constructor() {
    this.Contact = sequelize.get()?.models?.Contact;
    this.ContactEvent = sequelize.get()?.models?.ContactEvent;
    this.ContactContent = sequelize.get()?.models?.ContactContent;
    this.ContactInscription = sequelize.get()?.models?.ContactInscription;
    this.exclusionListService = new ExclusionListService();
    this.inclusionListService = new InclusionListService();
  }

  findWithId = async (id) => {
    return await this.Contact.findByPk(id);
  };

  findWithEmail = async (email) => {
    if (!email) {
      return null;
    }
    email = email.toLowerCase().trim();
    return await this.Contact.findOne({
      where: { email }
    });
  };

  lastInscriptionAttributes = ['ip', 'collectUrl', 'inscriptionDate'];

  byDimensions = async ({ filter, dimensions, fields }) => {
    let { where, include: includeFromFilter } = await this._buildWhereFromFilter(filter);

    //deduplicate dimensions and fields
    dimensions = dimensions.filter((item, index) => {
      return item && dimensions.indexOf(item) === index;
    });
    fields = fields.filter((item, index) => {
      return item && fields.indexOf(item) === index;
    });

    const attributesMap = {
      esp: 'esp',
      stats: 'stats',
      age: 'dob',
      gender: 'gender',
      activated: 'activated',
      blacklisted: 'blacklisted',
      status: 'status',
      activityScore: 'activityScore',
      'lastInscription.collectUrl': 'lastInscription.collectUrl',
      'lastInscription.sourceId': 'lastInscription.sourceId',
      'lastInscription.inscriptionDate': 'lastInscription.inscriptionDate'
    };
    let attributes = [...dimensions, ...fields].map((key) => attributesMap[key]);
    attributes = attributes.filter((item, index) => {
      return item && attributes.indexOf(item) === index;
    });
    let includes = await this._buildIncludes(null, includeFromFilter, attributes);

    let contacts = await this.Contact.findAll({
      where,
      attributes,
      include: Object.keys(includes).length > 0 ? Object.values(includes) : null
    });

    let timezone = (await getCachedSettings(['timezone'])).timezone;
    let result = {};
    let _extractDimensionsValue = (contact, dimension) => {
      switch (dimension) {
        case 'age':
          if (!contact.dob) {
            return null;
          }
          return moment().diff(contact.dob, 'years');
        case 'lastInscription.collectUrl':
          if (!contact.lastInscription) {
            return null;
          }
          return contact.lastInscription.collectUrl;
        case 'lastInscription.sourceId':
          if (!contact.lastInscription) {
            return null;
          }
          return contact.lastInscription.sourceId;
        case 'lastInscription.inscriptionDate':
          if (!contact.lastInscription) {
            return null;
          }
          return moment.tz(contact.lastInscription.inscriptionDate, timezone).format('YYYY-MM-DD');
        case 'esp':
        default:
          return contact[dimension];
      }
    };
    let _fillFieldValue = (fieldName, fieldValue, contact, currentResult) => {
      switch (fieldName) {
        case 'activityScore':
          fieldValue.min = 'min' in fieldValue ? Math.min(fieldValue.min, contact.activityScore) : contact.activityScore;
          fieldValue.max = 'max' in fieldValue ? Math.max(fieldValue.max, contact.activityScore) : contact.activityScore;
          fieldValue.avg = 'avg' in fieldValue ? (contact.activityScore + fieldValue.avg * fieldValue.count) / (fieldValue.count + 1) : contact.activityScore;
          fieldValue.count = fieldValue.count ? fieldValue.count + 1 : 1;

          break;

        case 'stats':
          if (contact.stats) {
            for (let key in contact.stats) {
              if (!(key in fieldValue)) {
                fieldValue[key] = 0;
              }
              fieldValue[key] += contact.stats[key];
            }
          }
          break;
        case 'last_inscription_stats':
          if (contact.lastInscription && contact.lastInscription.stats) {
            for (let key in contact.lastInscription.stats) {
              if (!(key in fieldValue)) {
                fieldValue[key] = 0;
              }
              fieldValue[key] += contact.lastInscription.stats[key];
            }
          }
          break;

        case 'activated':
          if (!('count' in fieldValue)) {
            fieldValue.count = 0;
          }
          if (contact.activated) {
            fieldValue.count++;
          }
          fieldValue.activationRate = fieldValue.count / currentResult.count;
          break;
        case 'blacklisted':
          if (!('count' in fieldValue)) {
            fieldValue.count = 0;
          }
          if (contact.blacklisted) {
            fieldValue.count++;
          }
          break;
        default:
          return;
      }
    };
    for (let contact of contacts) {
      let currentResult = result;
      for (let dimension of dimensions) {
        let value = _extractDimensionsValue(contact, dimension);
        if (!(value in currentResult)) {
          currentResult[value] = {};
        }
        currentResult = currentResult[value];
      }
      currentResult.count = currentResult.count ? currentResult.count + 1 : 1;
      for (let field of fields) {
        if (!(field in currentResult)) {
          currentResult[field] = {};
        }
        _fillFieldValue(field, currentResult[field], contact, currentResult);
      }
    }
    return result;
  };

  findAll = async (offset = 0, limit = 100, filter = {}, attributes, order, include) => {
    let { where, include: includeFromFilter } = await this._buildWhereFromFilter(filter);
    if (!order) {
      order = [['id', 'DESC']];
    }

    let includes = await this._buildIncludes(include, includeFromFilter, attributes);
    let filteredAttributes = attributes && attributes.filter((value) => !this.lastInscriptionAttributes.includes(value));
    return await this.Contact.findAll({
      where,
      order,
      offset,
      limit,
      attributes: filteredAttributes,
      include: Object.keys(includes).length > 0 ? Object.values(includes) : null
    });
  };

  countAll = async (filter) => {
    let { where, include } = await this._buildWhereFromFilter(filter);
    return await this.Contact.count({
      where,
      include: Object.keys(include).length > 0 ? Object.values(include) : null
    });
  };

  _buildWhereFromFilter = async (filter, include) => {
    if (!include) {
      include = {};
    }
    let where = {};
    switch (filter.type) {
      case '':
      case null:
      case undefined:
        break;
      case 'and':
        where[Op.and] = [];
        for (let child of filter.children) {
          let childResult = await this._buildWhereFromFilter(child, include);
          where[Op.and].push(childResult.where);
        }
        break;
      case 'or':
        where[Op.or] = [];
        for (let child of filter.children) {
          let childResult = await this._buildWhereFromFilter(child, include);
          where[Op.or].push(childResult.where);
        }
        break;
      case 'age':
        if (!('dob' in where)) {
          where['dob'] = {
            [Op.and]: [{ [Op.ne]: null }]
          };
        }
        if (filter.minAge) {
          where['dob'][Op.and].push({
            [Op.lte]: moment()
              .add(-1 * filter.minAge, 'years')
              .toDate()
          });
        }
        if (filter.maxAge) {
          where['dob'][Op.and].push({
            [Op.gte]: moment()
              .add(-1 * filter.maxAge, 'years')
              .toDate()
          });
        }
        break;
      case 'activityScore':
        if (!('activityScore' in where)) {
          where['activityScore'] = {
            [Op.and]: [{ [Op.ne]: null }]
          };
        }
        if (filter.minScore) {
          where['activityScore'][Op.and].push({ [Op.gte]: filter.minScore });
        }
        if (filter.maxScore) {
          where['activityScore'][Op.and].push({ [Op.lte]: filter.maxScore });
        }
        break;
      case 'lastSourceId':
        if (!('lastSourceId' in where)) {
          where['lastSourceId'] = {
            [Op.and]: [{ [Op.ne]: null }]
          };
        }

        if (filter.value) {
          where['lastSourceId'][Op.and].push({ [Op.eq]: filter.value });
        }
        break;
      case 'status':
        if (filter.operator && filter.value) {
          if (!('status' in where)) {
            where['status'] = {
              [Op.and]: [{ [Op.ne]: null }]
            };
          }
          let statusOperator = Op.eq;
          switch (filter.operator) {
            case '!=':
              statusOperator = Op.ne;
              break;
            case '=':
            default:
              statusOperator = Op.eq;
              break;
          }
          where['status'][Op.and].push({ [statusOperator]: filter.value });
        }

        break;
      case 'gender':
        if (!('gender' in where)) {
          where['gender'] = {
            [Op.and]: [{ [Op.ne]: null }]
          };
        }
        if (filter.gender) {
          where['gender'][Op.and].push({ [Op.eq]: filter.gender });
        }
        break;
      case 'activityCondition':
        if (filter.activityCondition === 'clicker') {
          where['stats.click'] = { [Op.gt]: 0 };
        } else if (filter.activityCondition === 'opener') {
          where['stats.open'] = { [Op.gt]: 0 };
        }
        if (filter.activityCondition === 'unsubscriber') {
          where['stats.unsub'] = { [Op.gt]: 0 };
        }
        if (filter.activityCondition === 'complainer') {
          where['stats.complaint'] = { [Op.gt]: 0 };
        }
        break;
      case 'isActivated':
        if (!('activated' in where)) {
          where['activated'] = {
            [Op.and]: []
          };
        }
        if (filter.activated === true) {
          where['activated'][Op.and].push({ [Op.eq]: true });
        } else if (filter.activated === false) {
          where['activated'][Op.and].push({ [Op.eq]: false });
        }
        break;

      case 'pixelTrackingConsent':
        switch (filter.value) {
          case true:
          case 'true':
            where['pixelTrackingConsent'] = { [Op.eq]: true };
            break;
          case false:
          case 'false':
            where['pixelTrackingConsent'] = { [Op.eq]: false };
            break;
          case 'null':
            where['pixelTrackingConsent'] = { [Op.is]: null };
            break;
          default:
            break;
        }
        break;

      case 'espExclude':
        if (!('esp' in where)) {
          where['esp'] = {
            [Op.and]: []
          };
        }
        if (filter.esps) {
          where['esp'][Op.and].push({ [Op.notIn]: filter.esps });
        }
        break;
      case 'espInclude':
        if (!('esp' in where)) {
          where['esp'] = {
            [Op.and]: []
          };
        }
        if (filter.esps) {
          where['esp'][Op.and].push({ [Op.in]: filter.esps });
        }
        break;
      case 'exclusionList':
        if (filter.exclusionListId) {
          let exclusionList = await this.exclusionListService.findWithId(filter.exclusionListId);
          if (exclusionList && exclusionList.field) {
            if (!(Op.and in where)) {
              where[Op.and] = [];
            }
            where[Op.and].push(
              sequelize
                .get()
                .literal(` NOT EXISTS (SELECT "id" FROM "ExclusionListItem" WHERE "ExclusionListItem"."exclusionListId" = ${filter.exclusionListId} AND "value"="Contact"."${exclusionList.field}")`)
            );
          }
        }
        break;

      case 'inclusionList':
        if (filter.inclusionListId) {
          let inclusionList = await this.inclusionListService.findWithId(filter.inclusionListId);
          if (inclusionList && inclusionList.field) {
            if (!(Op.and in where)) {
              where[Op.and] = [];
            }
            where[Op.and].push(
              sequelize
                .get()
                .literal(` EXISTS (SELECT "id" FROM "InclusionListItem" WHERE "InclusionListItem"."inclusionListId" = ${filter.inclusionListId} AND "value"="Contact"."${inclusionList.field}")`)
            );
          }
        }
        break;

      case 'zipcodePrefixes':
        {
          let prefixes = filter.values ? filter.values.split(',') : [];
          if (filter.subType === 'exclude') {
            if (!('zipcode' in where)) {
              where['zipcode'] = {
                [Op.and]: []
              };
            }
            for (let prefix of prefixes) {
              where['zipcode'][Op.and].push({ [Op.notLike]: `${prefix}%` });
            }
          } else {
            if (!('zipcode' in where)) {
              where['zipcode'] = {
                [Op.and]: []
              };
            }
            let orObject = [];
            for (let prefix of prefixes) {
              orObject.push({ [Op.like]: `${prefix}%` });
            }
            where['zipcode'][Op.and].push({ [Op.or]: orObject });
          }
        }
        break;
      case 'sourceExclude':
        if (!('lastSourceId' in where)) {
          where['lastSourceId'] = {
            [Op.and]: []
          };
        }
        if (filter.sourceIds && filter.sourceIds.length > 0) {
          where['lastSourceId'][Op.and].push({
            [Op.or]: [{ [Op.is]: null }, { [Op.notIn]: filter.sourceIds }]
          });
        }
        break;
      case 'sourceInclude':
        if (!('lastSourceId' in where)) {
          where['lastSourceId'] = {
            [Op.and]: []
          };
        }
        if (filter.sourceIds) {
          where['lastSourceId'][Op.and].push({ [Op.in]: filter.sourceIds });
        }
        break;
      case 'inscriptionDate':
        if (!('lastInscription' in include)) {
          include['lastInscription'] = {
            model: this.ContactInscription,
            as: 'lastInscription'
          };
        }
        switch (filter.operator) {
          case 'betweenDays': {
            if (!('$lastInscription.inscriptionDate$' in where)) {
              where['$lastInscription.inscriptionDate$'] = {
                [Op.and]: []
              };
            }
            let timezone = (await getCachedSettings(['timezone'])).timezone;
            let minDate = isNaN(filter.from)
              ? null
              : moment
                  .tz(timezone)
                  .add(-1 * filter.from, 'days')
                  .startOf('day')
                  .toDate();
            if (minDate) {
              where['$lastInscription.inscriptionDate$'][Op.and].push({
                [Op.gte]: minDate
              });
            }
            let maxDate = isNaN(filter.to)
              ? null
              : moment
                  .tz(timezone)
                  .add(-1 * filter.to, 'days')
                  .endOf('day')
                  .toDate();
            if (maxDate) {
              where['$lastInscription.inscriptionDate$'][Op.and].push({
                [Op.lte]: maxDate
              });
            }
            break;
          }
          default:
            break;
        }
        break;

      case 'fieldValue': {
        let operator = null;
        let contactField = filter.field;
        if (contactField == 'customFields' && filter.customField) {
          contactField = `${contactField}.${filter.customField}`;
        }
        let value = filter.value;
        switch (filter.operator) {
          case '>=':
            operator = Op.gte;
            break;

          case '>':
            operator = Op.gt;
            break;
          case '<':
            operator = Op.lt;
            break;
          case '<=':
            operator = Op.lte;
            break;
          case 'not_in':
            operator = Op.notIn;
            break;
          case 'in':
            operator = Op.in;
            break;
          case 'IS TRUE':
            operator = Op.eq;
            value = true;
            break;
          case 'IS FALSE':
            operator = Op.eq;
            value = false;
            break;
          case 'IS NULL':
            operator = Op.eq;
            value = null;
            break;
          case 'IS NOT NULL':
            operator = Op.ne;
            value = null;
            break;
          case 'LIKE':
            operator = Op.like;
            value = `%${filter.value}%`;
            break;
          case 'ILIKE':
            operator = Op.iLike;
            value = `%${filter.value}%`;
            break;
          case 'NOT LIKE':
            operator = Op.notLike;
            value = `%${filter.value}%`;
            break;

          case 'NOT ILIKE':
            operator = Op.notILike;
            value = `%${filter.value}%`;
            break;
          case '!=':
            operator = Op.ne;
            break;

          case '=':
          default:
            operator = Op.eq;
            break;
        }
        where[contactField] = {
          [operator]: value
        };
        break;
      }
      default:
        log.warn(`Unsuported filter type ${filter.type}`);
        break;
    }

    return { where, include };
  };

  updateContact = async (fieldsToUpdate) => {
    if (!fieldsToUpdate) {
      log.error(`Can't update contact with empty contact`);
      return;
    }
    if (!fieldsToUpdate.id && !fieldsToUpdate.email) {
      log.error(`Can't update contact without id or email`);
      return;
    }
    let existingContact = null;

    if (fieldsToUpdate.id) {
      existingContact = await this.findWithId(fieldsToUpdate.id);
    } else {
      existingContact = await this.Contact.findOne({
        where: { email: fieldsToUpdate.email }
      });
    }

    if (existingContact) {
      fieldsToUpdate.email = undefined;
      fieldsToUpdate.id = undefined;
      log.debug(`Update contact ${existingContact.email}`);
      this.mergeFieldsInContact(existingContact, fieldsToUpdate);
      await existingContact.save();
      return existingContact;
    } else {
      log.error(`Contact ${fieldsToUpdate.id} not found. Cannot update it`);
    }
  };

  createOrUpdateContact = async (email, fields) => {
    fields = JSON.parse(JSON.stringify(fields));
    if (!email) {
      log.error(`Can't create or update contact with empty email`);
      return;
    }
    if (!emailValidator.validate(email)) {
      log.error(`Can't create or update contact because email ${email} is invalid`);
      return;
    }
    if (email.indexOf('{') >= 0) {
      log.error(`Can't create or update contact because email ${email} is invalid`);
      return;
    }

    email = email.toLowerCase().trim();
    log.debug(`Create or update contact ${email} with fields ${fields}`);
    let contact = await this.Contact.findOne({
      where: { email: email }
    });
    if (contact) {
      log.debug(`Contact ${email} already exists.  We update it`);
    } else {
      log.debug(`Contact ${email} doesn't exists.  We create it`);
      contact = this.Contact.build({
        email: email,
        esp: extractEsp(email),
        status: ContactStatus.new,
        lastWorkableStatusDate: new Date(),
        md5: md5(email),
        sha1: sha1(email),
        sha256: sha256(email),
        segment: Math.floor(Math.random() * 100) + 1
      });
    }
    this.mergeFieldsInContact(contact, fields);
    await contact.save();

    return contact;
  };

  _buildIncludes = async (include, includeFromFilter, attributes) => {
    var includes = include;
    if (!includes) {
      includes = {};
    }

    if (includeFromFilter) {
      for (let key in includeFromFilter) {
        includes[key] = includeFromFilter[key];
      }
    }

    if (
      !includes['lastInscription'] &&
      attributes &&
      attributes.filter((value) => {
        return value.indexOf('lastInscription') >= 0 || this.lastInscriptionAttributes.includes(value);
      }).length > 0
    ) {
      includes['lastInscription'] = {
        model: this.ContactInscription,
        as: 'lastInscription'
      };
    }
    return includes;
  };

  scanContactsToUpdate = async (limit = 50) => {
    const emails = await sequelize.get().query(
      `UPDATE "Contact"  SET "statusQueued"=TRUE,"lastStatusUpdateQueuedDate"=:now 
            WHERE "id" in (
                SELECT "id" from "Contact" WHERE 
                    ("statusQueued" IS NULL OR "statusQueued"=FALSE OR "lastStatusUpdateQueuedDate"< :maxQueuedDate) AND
                    ("nextStatusUpdateDate" IS NULL OR "nextStatusUpdateDate"<=:now)
                    LIMIT :limit
                    FOR UPDATE 
            )
            RETURNING id `,
      {
        replacements: {
          limit,
          now: moment().toDate(),
          maxQueuedDate: moment().add(-1, 'hours').toDate()
        },
        type: QueryTypes.SELECT
      }
    );
    return emails;
  };

  removeContact = async (id) => {
    log.debug(`Remove contact with id ${id}`);
    let contact = await this.Contact.findOne({
      where: { id: id }
    });
    //TODO : archive some data before
    if (contact) {
      let cachedEvents = await contact.getCachedEvents();
      if (cachedEvents) {
        log.debug(`Remove cached events of contact with id ${id}`);
        await cachedEvents.destroy();
      }

      log.debug(`Remove events of contact with id ${id}`);
      await this.ContactEvent.destroy({
        where: { contactId: id }
      });

      log.debug(`Remove contents of contact with id ${id}`);
      await this.ContactContent.destroy({
        where: { contactId: id }
      });

      log.debug(`Finaly destroy contact with id ${id}`);
      await contact.destroy();

      log.debug(`Contact with ${id} has been removed`);
    } else {
      log.debug(`Contact not found with id ${id}. Can't remove it.`);
    }
  };

  removeContactWithEmail = async (email) => {
    log.debug(`Remove contact with email ${email}`);
    var foundContact = await this.findWithEmail(email);
    if (foundContact) {
      log.debug(`contact trouvé ${foundContact.id}`);
      await this.removeContact(foundContact.id);
      log.debug(`contact supprimé ${foundContact.id}`);
      return foundContact;
    }
    return null;
  };

  mergeFieldsInContact = (contact, fields) => {
    if (!fields || Object.keys(fields).length == 0) {
      return;
    }
    if (!contact.customFields) {
      contact.customFields = {};
    }

    for (let key in fields) {
      let trimedValue = fields[key] && typeof fields[key] === 'string' ? fields[key].trim() : fields[key];
      switch (key) {
        case 'firstname':
          contact.firstname = trimedValue ? trimedValue.substring(0, 250) : trimedValue;
          delete fields[key];
          break;
        case 'lastname':
          contact.lastname = trimedValue ? trimedValue.substring(0, 250) : trimedValue;
          delete fields[key];
          break;

        case 'street':
          contact.street = trimedValue ? trimedValue.substring(0, 250) : trimedValue;
          delete fields[key];
          break;

        case 'zipcode':
          contact.zipcode = trimedValue;
          delete fields[key];
          break;

        case 'city':
          contact.city = trimedValue ? trimedValue.substring(0, 250) : trimedValue;
          delete fields[key];
          break;
        case 'gender':
          contact.gender = fields[key];
          delete fields[key];
          break;
        case 'phone':
          contact.phone = fields[key];
          delete fields[key];
          break;
        case 'dob': {
          let date = null;
          if (fields[key] instanceof Date) {
            date = fields[key];
          } else if (typeof fields[key] == 'string') {
            let formats = ['YYYY-MM-DD', 'YYYY/MM/DD', moment.ISO_8601];
            if (moment.utc(fields[key], formats).isValid()) {
              date = moment.utc(fields[key], formats).toDate();
            }
          }
          if (date) {
            contact.dob = date;
          }
          break;
        }
        default:
          contact.customFields[key] = fields[key];
          break;
      }
    }

    contact.customFields = JSON.parse(JSON.stringify(contact.customFields));
    contact.changed('customFields', true);
  };
};
