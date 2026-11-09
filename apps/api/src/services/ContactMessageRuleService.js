const ContactMessageStatus = require('../storage/models/ContactMessageStatus');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const log = require('../util/log').getLogger('ContactMessageRuleService');
const ContactService = require('./ContactService');
const InscriptionService = require('./InscriptionService');
const BlacklistedContactService = require('./BlacklistedContactService');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

module.exports = class {
  constructor() {
    this.ContactMessageRule = sequelize.get().models.ContactMessageRule;

    this.contactService = new ContactService();
    this.inscriptionService = new InscriptionService();
    this.blacklistedContactService = new BlacklistedContactService();
  }

  createContactMessageRule = async (name) => {
    log.debug(`Create contact message  rule`);

    let rule = await this.ContactMessageRule.create({
      name: name ? name : 'New contact message rule',
      enabled: false,
      filter: {},
      actions: []
    });
    await rule.save();
    return rule;
  };

  update = async (rule) => {
    let storedRule = await this.ContactMessageRule.findByPk(rule.id);
    if (storedRule) {
      mergeFieldsInObject(['enabled', 'filter', 'actions', 'name'], rule, storedRule);
      await storedRule.save();
    }
    return storedRule;
  };

  delete = async (id) => {
    let item = await this.ContactMessageRule.findByPk(id);
    if (item) {
      await item.destroy();
    }
  };

  findWithId = async (id) => {
    return await this.ContactMessageRule.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filter = {}, order) => {
    let { where } = await this._buildWhereFromFilter(filter);
    if (!order) {
      order = [['id', 'DESC']];
    }
    return await this.ContactMessageRule.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order,
      offset: offset,
      limit: limit
    });
  };
  countAll = async (filter) => {
    let { where } = await this._buildWhereFromFilter(filter);

    return await this.ContactMessageRule.count({
      where: Object.keys(where).length > 0 ? where : null
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if (filter) {
      if ('name' in filter && filter.name) {
        where['name'] = {
          [Op.iLike]: `%${filter['name']}%`
        };
      }

      if ('enabled' in filter && filter.enabled) {
        where['enabled'] = filter.enabled;
      }
    }

    return { where };
  };

  executeRulesOnMessage = async (contactMessage) => {
    log.debug(`Execute rules on message ${contactMessage.id}`);
    let rules = await this.ContactMessageRule.findAll({
      where: {
        enabled: true
      }
    });
    for (let rule of rules) {
      if (await this._isMessageMatchFilter(rule.filter, contactMessage)) {
        await this._executeActions(rule, contactMessage);
      }
    }
  };

  _isMessageMatchFilter = async (filter, contactMessage) => {
    switch (filter.type) {
      case 'and':
        if (filter.children) {
          let matched = true;
          for (let child of filter.children) {
            matched = await this._isMessageMatchFilter(child, contactMessage);
            if (!matched) {
              break;
            }
          }
          return matched;
        }
        return true;
      case 'or':
        if (filter.children) {
          let matched = false;
          for (let child of filter.children) {
            matched = await this._isMessageMatchFilter(child, contactMessage);
            if (matched) {
              break;
            }
          }
          return matched;
        }
        return false;

      case 'keywords':
        let matched = false;

        let keywords = filter.keywords ? filter.keywords : [];
        for (let keyword of keywords) {
          keyword = keyword.toLowerCase().trim();
          if (filter.fields && 'title' in filter.fields && filter.fields.title) {
            if (contactMessage.title && contactMessage.title.toLowerCase().indexOf(keyword) >= 0) {
              matched = true;
              break;
            }
          }

          if (filter.fields && 'message' in filter.fields && filter.fields.message) {
            if (contactMessage.message && contactMessage.message.toLowerCase().substring(0, 200).indexOf(keyword) >= 0) {
              matched = true;
              break;
            }
          }
        }
        return matched;

      case 'field':
        let fieldMatched = false;
        let fieldValue = null;
        switch (filter.fieldName) {
          case 'title':
            fieldValue = contactMessage.title;
            break;
          case 'message':
            fieldValue = contactMessage.message;
            break;
          case 'from':
            fieldValue = contactMessage.from;
            break;
          case 'to':
            fieldValue = contactMessage.to;
            break;
          default:
            fieldValue = null;
            break;
        }
        switch (filter.operator) {
          case '=':
            fieldMatched = fieldValue == filter.value;
            break;
          case '!=':
            fieldMatched = fieldValue != filter.value;
            break;
          case 'contains':
            fieldMatched = fieldValue && fieldValue.indexOf(filter.value) >= 0;
            break;
          case 'iContains':
            fieldMatched = fieldValue && fieldValue.toLowerCase().indexOf(filter.value.toLowerCase()) >= 0;
            break;
          case 'notContains':
            fieldMatched = !fieldValue || fieldValue.indexOf(filter.value) < 0;
            break;
          case 'iNotContains':
            fieldMatched = !fieldValue || fieldValue.toLowerCase().indexOf(filter.value.toLowerCase()) < 0;
            break;

          default:
            break;
        }
        return fieldMatched;
      default:
        return true;
    }
  };

  _executeActions = async (rule, contactMessage) => {
    log.debug(`Execute actions of rule ${rule.id} on message ${contactMessage.id}`);
    if (!rule.actions) {
      return;
    }
    let contact;
    for (let action of rule.actions) {
      switch (action.type) {
        case 'markAsDone':
          contactMessage.status = ContactMessageStatus.done;
          await contactMessage.save();
          break;
        case 'blacklist':
          log.debug(`Unsub contact ${contactMessage.from}`);
          contact = await this.contactService.findWithEmail(contactMessage.from);
          if (contact) {
            await this.blacklistedContactService.blacklistContactWithId(contact.id, `Toolso contact message rule ${rule.name}`, null);
          }
          break;
        case 'unsubscribe':
          log.debug(`Unsub contact ${contactMessage.from}`);
          contact = await this.contactService.findWithEmail(contactMessage.from);
          if (contact) {
            contact = await this.inscriptionService.unsubscribeContact(contact.email, `Toolso contact message rule ${rule.name}`, '');
          }
          break;

        default:
          break;
      }
    }
  };
};
