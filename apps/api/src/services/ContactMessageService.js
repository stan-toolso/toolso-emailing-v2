const ContactMessageStatus = require('../storage/models/ContactMessageStatus');
const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const log = require('../util/log').getLogger('ContactMessageService');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');

const ContactService = require('./ContactService');
const ContactMessageRuleService = require('./ContactMessageRuleService');
const ContentSender = require('./ContentSender');
const { getCachedSettings } = require('./SettingsService');
const moment = require('moment-timezone');
const { htmlToText } = require('html-to-text');

module.exports = class {
  constructor() {
    this.contactService = new ContactService();
    this.contactMessageRuleService = new ContactMessageRuleService();
    this.contentSender = new ContentSender();
    this.ContactMessage = sequelize.get().models.ContactMessage;
    this.Contact = sequelize.get().models.Contact;
  }

  createContactMessage = async (message) => {
    log.debug(`Create contact message  from ${message.from}`);

    let contact = message.from ? await this.contactService.findWithEmail(message.from) : null;

    if (message.to) {
      message.to = message.to.substring(0, 250);
    }
    if (message.from) {
      message.from = message.from.substring(0, 250);
    }
    if (message.title) {
      message.title = message.title.substring(0, 250);
    }

    message.extract = message.message ? htmlToText(message.message).substring(0, 250) : '';

    let contactMessage = await this.ContactMessage.create({
      ...message,
      status: message.status ? message.status : ContactMessageStatus.pending,
      contactId: contact ? contact.id : null,
      date: message.date ? message.date : new Date()
    });

    // await contactMessage.save();

    await this.contactMessageRuleService.executeRulesOnMessage(contactMessage);

    return contactMessage;
  };

  updateMessage = async (message) => {
    let storedMessage = await this.ContactMessage.findByPk(message.id);
    if (storedMessage) {
      mergeFieldsInObject(['status', 'contactId'], message, storedMessage);
      await storedMessage.save();
    }
    return storedMessage;
  };

  findWithId = async (id) => {
    return await this.ContactMessage.findByPk(id);
  };

  findAll = async (offset = 0, limit = 100, filter = {}, order) => {
    let { where, include } = await this._buildWhereFromFilter(filter);

    if (!order) {
      order = [['id', 'DESC']];
    }

    return await this.ContactMessage.findAll({
      where: Object.keys(where).length > 0 ? where : null,
      order,
      offset: offset,
      limit: limit,
      include: Object.keys(include).length > 0 ? Object.values(include) : null
    });
  };
  countAll = async (filter) => {
    let { where, include } = await this._buildWhereFromFilter(filter);

    return await this.ContactMessage.count({
      where: Object.keys(where).length > 0 ? where : null,
      include: Object.keys(include).length > 0 ? Object.values(include) : null
    });
  };

  _buildWhereFromFilter = async (filter, include) => {
    let where = {};
    if (!include) {
      include = {};
    }
    if (filter) {
      if ('email' in filter && filter.email) {
        if (!('contact' in include)) {
          include['contact'] = {
            model: this.Contact,
            as: 'contact'
          };
        }

        where['$contact.email$'] = {
          [Op.iLike]: `%${filter['email']}%`
        };
      }
      if ('sendFromToolso' in filter) {
        if (filter['sendFromToolso']) {
          where['sendFromToolso'] = filter['sendFromToolso'];
        } else {
          where['sendFromToolso'] = {
            [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: false }]
          };
        }
      }

      if ('from' in filter && filter.from) {
        where['from'] = {
          [Op.iLike]: `%${filter['from']}%`
        };
      }

      if ('to' in filter && filter.from) {
        where['to'] = {
          [Op.iLike]: `%${filter['to']}%`
        };
      }

      if ('status' in filter && filter.status) {
        where['status'] = filter.status;
      }

      if ('fromDate' in filter) {
        where['date'] = {
          [Op.gte]: moment.tz(filter.fromDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone).toDate()
        };
      }
      if ('toDate' in filter) {
        where['date'] = {
          ...(where['date'] ? where['date'] : {}),
          [Op.lte]: moment
            .tz(filter.toDate, 'YYYY-MM-DD', (await getCachedSettings(['timezone'])).timezone)
            .endOf('day')
            .toDate()
        };
      }
    }

    return { where, include };
  };

  sendMessage = async (emails, subject, senderName, html, templateVariables, sendingConfigId, author) => {
    let results = {};

    for (let email of emails) {
      let result = await this.contentSender.sendContactMessage(email, subject, senderName, html, templateVariables, sendingConfigId);

      if (result && result.messageId) {
        let contactMessage = await this.ContactMessage.create({
          message: result.html,
          extract: htmlToText(result.html).substring(0, 250),
          title: result.subject,
          from: result.senderEmail,
          to: email,
          status: ContactMessageStatus.done,
          contactId: result.contactId,
          author,
          sendFromToolso: true,
          date: new Date()
        });

        await contactMessage.save();
        result.contactMessage = contactMessage;
      }

      results[email] = result;
    }

    return results;
  };
};
