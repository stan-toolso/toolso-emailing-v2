'use strict';

module.exports = {
  filterBlacklist: async (email) => {
    const BlacklistedContactService = require('../BlacklistedContactService');
    let blacklistedContact = await new BlacklistedContactService().findWithFields(email);
    if (blacklistedContact) {
      return false;
    }
    return true;
  }
};
