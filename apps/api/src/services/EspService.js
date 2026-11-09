const emailValidator = require('email-validator');

const ESPS = {
  gmail: ['gmail.com', 'googlemail.com'],
  hotmail: [
    'hotmail.com',
    'hotmail.it',
    'hotmail.fr',
    'hotmail.be',
    'hotmail.de',
    'hotmail.es',
    'hotmail.com',
    'hotmail.co.uk',
    'hotmail.com.br',
    'hotmail.co.br',
    'outlook.com',
    'outlook.com.br',
    'outlook.fr',
    'outlook.be',
    'outlook.it',
    'outlook.es',
    'outlook.de',
    'msn.com',
    'live.com',
    'live.fr',
    'live.be',
    'live.it',
    'live.de'
  ],
  yahoo: ['yahoo.fr', 'yahoo.be', 'yahoo.com', 'yahoo.it', 'yahoo.de', 'yahoo.es', 'yahoo.br', 'yahoo.com.br', 'yahoo.com.be', 'yahoo.com.fr', 'yahoo.com.it', 'yahoo.com.de', 'yahoo.com.es'],
  free: [
    'free.fr',
    'aliceadsl.fr',
    'alicepro.fr',
    'aliceteam.fr',
    'freesbee.fr',
    'libertysurf.fr',
    'libertysurf.net',
    'tiscali.fr',
    'alice.it',
    'worldonline.fr',
    'tiscali.it',
    'monsieurcinema.com',
    'infonie.fr',
    'chez.com',
    'nomade.fr',
    'teamtiscali.com'
  ],

  orange: ['orange.com', 'orange.fr', 'wanadoo.fr', 'voila.fr'],
  sfr: ['neuf.fr', '9business.fr', '9online.fr', 'sfr.fr', 'club-internet.fr', 'cegetel.net', 'numericable.fr', 'noos.fr', 'club.fr', 'numericable.com'],
  bouygues: ['bbox.fr'],
  aol: ['aol.com', 'aol.de'],
  laposte: ['laposte.fr', 'laposte.net'],
  web: ['web.de'],
  gmx: ['gmx.de', 'gmx.net', 'gmx.com', 'gmx.fr'],
  freenet: ['freenet.de'],
  telenet: ['telenet.be'],
  skynet: ['skynet.be', 'proximus.be'],
  apple: ['icloud.com'],
  libero: ['libero.it'],
  virgilio: ['virgilio.it'],
  online: ['online.fr'],
  akeonet: ['akeonet.com'],
  't-online': ['t-online.de']
};
const DOMAIN_MAP = {};
for (let esp in ESPS) {
  ESPS[esp].forEach((domain) => {
    DOMAIN_MAP[domain] = esp;
  });
}

module.exports = {
  extractEsp: (email) => {
    if (!email) {
      return null;
    }

    email = email.trim().toLowerCase();
    if (!emailValidator.validate(email)) {
      return 'unknown';
    }
    let domain = email.split('@')[1];
    if (domain in DOMAIN_MAP) {
      return DOMAIN_MAP[domain];
    }
    return 'unknown';
  },

  getOppositeEsps: (espsList) => {
    let result = Object.keys({ ...ESPS });
    if (espsList) {
      result = result.filter((item) => !espsList.includes(item));
    }
    result.push('unknown');
    return result;
  },

  isFrench: (esp) => {
    return ['orange', 'sfr', 'bouygues', 'laposte', 'free'].includes(esp);
  }
};
