const log = require('../../../util/log').getLogger('Bat/validate');

const { getJwtSecret } = require('../../../services/JwtSecretService');
var CryptoJS = require('crypto-js');
const BatStatus = require('../../../storage/models/BatStatus');

let _batService = null;
let _contentService = null;
module.exports = async (req, res) => {
  if (!_batService) {
    const BatService = require('../../../services/BatService');
    const ContentService = require('../../../services/ContentService');
    _batService = new BatService();
    _contentService = new ContentService();
  }
  let validatorToken = decodeURIComponent(req.query.t);
  if (!validatorToken) {
    return res.status(404).render('404');
  }
  let jwtSecret = await getJwtSecret();
  validatorToken = CryptoJS.AES.decrypt(validatorToken, jwtSecret).toString(CryptoJS.enc.Utf8);
  let validator = validatorToken.substring(validatorToken.indexOf('#') + 1);

  let bat = await _batService.findWithUid(req.params.uid);

  if (!bat || !bat.validatorsEmails || !validator || bat.validatorsEmails.toLowerCase().indexOf(validator) < 0) {
    return res.status(404).render('404');
  }

  log.debug(`Validate BAT [${req.params.uid}], version ${req.params.versionId}, validator ${validator}`);

  let content = await bat.getContent();
  let versions = await content.getVersions();
  versions = versions.filter((version) => {
    return _contentService.isVersionAvailable(version);
  });

  let version = null;
  for (let item of versions) {
    if (item.id == req.params.versionId) {
      version = item;
    }
  }
  if (!version) {
    return res.status(404).render('404');
  }

  let validation = bat.validations && bat.validations[version.id] ? bat.validations[version.id] : null;

  if (!validation) {
    return res.status(404).render('404');
  }

  let emailObject = validation.emails && validation.emails[validator];
  if (!emailObject) {
    return res.status(404).render('404');
  }

  if (validation.status != BatStatus.waiting) {
    let variables = {
      bat,
      content,
      versions,
      version,
      validation,
      emailObject
    };
    res.render('bat/done', variables);
    return;
  }

  let success = false;
  let submited = false;
  if (req.body && req.body.action) {
    let comment = req.body.comment
      ? {
          date: new Date(),
          author: validator,
          message: req.body.comment
        }
      : null;

    if (comment) {
      if (!bat.comments) {
        bat.comments = [];
      }
      bat.comments.push(comment);

      bat.changed('comments', true);
    }

    await bat.save();

    if (req.body && req.body.action == 'reject') {
      await _batService.reject(bat, content, version, req.clientIp, req.get('User-Agent'), comment, validator);
    } else if (req.body && req.body.action == 'validate') {
      await _batService.validate(bat, content, version, req.clientIp, req.get('User-Agent'), comment, validator);
    }
    let variables = {
      bat,
      content,
      versions,
      version,
      validation,
      emailObject
    };
    res.render('bat/done', variables);
    return;
  }

  let variables = {
    submited,
    success,
    bat,
    content,
    versions,
    version,
    validation,
    validator,
    emailObject
  };

  res.render('bat/validate', variables);
};
