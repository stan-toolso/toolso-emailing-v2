const sequelize = require('../storage/sequelize');
const moment = require('moment-timezone');
const { mergeFieldsInObject } = require('./utils/DatabaseUtils');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

module.exports = class {
  constructor() {
    this.Suggestion = sequelize.get()?.models?.Suggestion;
  }

  findAll = async (status, unique_id, limit = 100, offset = 0) => {
    let where = {};
    if (status) {
      if (Array.isArray(status)) {
        where['status'] = { [Op.in]: status };
      } else {
        where['status'] = status;
      }
    }
    if (unique_id) {
      where['unique_id'] = unique_id;
    }
    let result = await this.Suggestion.findAll({ where, order: [['id', 'DESC']], limit, offset });
    let total = await this.Suggestion.count({ where });
    return { limit, offset, total, suggestions: result };
  };

  updateSuggestion = async (suggestion, isAdmin) => {
    if (!suggestion?.id) {
      return;
    }
    let existingSuggestion = await this.Suggestion.findByPk(suggestion?.id);

    if (existingSuggestion.status === 'draft' && suggestion.status !== 'draft' && !isAdmin) {
      return null;
    }

    if (existingSuggestion.status === 'draft' && suggestion.status === 'delete') {
      return await existingSuggestion.destroy();
    } else {
      mergeFieldsInObject(['type', 'user', 'details', 'priority', 'status', 'suggestion_date'], suggestion, existingSuggestion);
      await existingSuggestion.save();
      return existingSuggestion;
    }
  };

  createSuggestion = async (type, unique_id, details, priority, user, status) => {
    let suggestionObject = {
      type,
      user: user ?? 'Toolso',
      unique_id,
      details,
      priority,
      suggestion_date: moment().toDate(),
      status: status ?? 'todo'
    };

    let existingSuggestion = await this.Suggestion.findOne({ where: { unique_id, status: { [Op.in]: ['todo', 'draft'] } } });
    if (existingSuggestion) {
      suggestionObject.id = existingSuggestion.id;
      let result = await this.updateSuggestion(suggestionObject);
      return { ...result, updated: true };
    } else {
      return await this.Suggestion.create(suggestionObject);
    }
  };
};
