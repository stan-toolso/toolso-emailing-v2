'use strict';

const DANGEROUS_ESPS = require('./DangerousEsps');

module.exports = {
  filterEsp: (email) => {
    email = email.toLowerCase().trim();
    var esp = email.split('@')[1];

    if (esp in DANGEROUS_ESPS) {
      return false;
    }
    return true;
  }
};
