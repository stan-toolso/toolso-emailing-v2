'use strict';

const DANGEROUS_EMAIL_PATTERNS = require('./DangerousEmailPatterns');

module.exports = {
  filterEmailPatterns: (email) => {
    email = email.toLowerCase().trim();
    for (let patternObject of DANGEROUS_EMAIL_PATTERNS) {
      if (email.match(patternObject.pattern)) {
        return false;
      }
    }
    return true;
  }
};
