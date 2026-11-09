const log = require('../../../util/log').getLogger('SourceContactInscriptionPost');
var moment = require('moment-timezone');

let _inscriptionService = null;
let _emailValidator = null;
let _isIp = null;
var _validUrl = null;
module.exports = async (req, res) => {
  let source = req.source;

  if (!source.apiEnabled || !source.apiFields) {
    res.json({
      status: 'ko',
      code: 'campaign_disabled'
    });
    return;
  }

  if (!_inscriptionService) {
    const InscriptionService = require('../../../services/InscriptionService');
    _inscriptionService = new InscriptionService();
    _emailValidator = require('email-validator');
    _isIp = require('is-ip');
    _validUrl = require('valid-url');
  }

  let { fields, email, collectUrl, ip, errors } = validateFields(source.apiFields, req.body);
  let cappingErrors = await validateCapping(source);
  errors = errors.concat(cappingErrors);
  if (!source.parentSourceId && source.defaultChildSourceId) {
    source = await _inscriptionService.getChildSource(source, email, collectUrl, fields, ip);
    let sourceCappingErrors = await validateCapping(source);
    errors = errors.concat(sourceCappingErrors);
  }

  if (errors && errors.length) {
    res.json({
      status: 'ko',
      errors
    });
    return;
  }

  log.debug(`New contact inscription received ${JSON.stringify(req.body)} for source ${source.name}`);

  let { success, inscription, errorCode, message } = await _inscriptionService.createContactInscriptionForSource(email, fields, ip, collectUrl, source);
  if (errorCode && ['esp_excluded'].includes(errorCode)) {
    return res.json({
      status: 'ko',
      accepted: false,
      errorCode,
      message
    });
  }

  let accepted = success && inscription && inscription.isFirstToday;
  if (!source.apiSettings || !source.apiSettings.acceptDuplicates) {
    if (inscription && !inscription.isFirst) {
      accepted = false;
    }
  }
  res.json({
    status: success && inscription ? 'ok' : 'ko',
    accepted,
    duplicated: success && inscription && !inscription.isFirst,
    alreadyReceivedToday: inscription && !inscription.isFirstToday
  });
};

const validateCapping = async (source) => {
  let errors = [];
  let dailyCappingFilters = source.apiSettings?.filters?.filter((filter) => filter?.type === 'dailyCapping');
  if (dailyCappingFilters) {
    await Promise.all(
      dailyCappingFilters.map(async (dailyCappingFilter) => {
        let dailyThresold = dailyCappingFilter?.threshold;
        if (dailyThresold != null || dailyThresold != undefined) {
          let dailyRequests = await _inscriptionService.getDailyRequestCount(source, dailyCappingFilter?.subtype);
          let dailyCappingOk = dailyRequests < parseInt(dailyThresold);
          if (!dailyCappingOk) {
            let error = {
              code: 'dailyCapping',
              message: `Daily threshold has been reached`
            };
            errors.push(error);
          }
        }
      })
    );
  }

  let monthlyCappingFilters = source.apiSettings?.filters?.filter((filter) => filter?.type === 'monthlyCapping');
  if (monthlyCappingFilters) {
    await Promise.all(
      monthlyCappingFilters.map(async (monthlyCappingFilter) => {
        let monthlyThresold = monthlyCappingFilter?.threshold;
        if (monthlyThresold != null || monthlyThresold != undefined) {
          let monthlyRequests = await _inscriptionService.getMonthlyRequestCount(source, monthlyCappingFilter?.subtype);
          let monthlyCappingOk = monthlyRequests < parseInt(monthlyThresold);
          if (!monthlyCappingOk) {
            let error = {
              code: 'monthlyCapping',
              message: `Monthly threshold has been reached`
            };
            errors.push(error);
          }
        }
      })
    );
  }

  return errors;
};

const validateFields = (apiFields, body) => {
  let fields = {};
  let errors = [];
  for (let field in apiFields) {
    if (!apiFields[field].enabled) {
      continue;
    }
    let { value, error } = validateField(field, apiFields[field], body);
    if (value !== undefined) {
      fields[field] = value;
    }
    if (error) {
      errors.push({ field, ...error });
    }
  }
  if (errors.length > 0) {
    return { errors };
  }
  let email = fields.email;
  let ip = fields.ip;
  let collectUrl = fields.collectUrl;

  delete fields['email'];
  delete fields['ip'];
  delete fields['collectUrl'];
  if (!email) {
    errors.push({
      field: 'email',
      code: 'field_required',
      message: `Field "email" is required`
    });
  }

  return { fields, email, ip, collectUrl, errors };
};

const validateField = (field, config, body) => {
  if (config.type && config.type == 'manual') {
    return { value: config.value };
  }

  let fieldValue = body[field];

  if (config.required) {
    if (fieldValue === '' || fieldValue === null || fieldValue === undefined) {
      return {
        error: {
          code: 'field_required',
          message: `Field "${field}" is required`
        }
      };
    }
  }
  if (config.validators) {
    for (let validator of config.validators) {
      switch (validator.type) {
        case 'email_validation':
          if (!_emailValidator.validate(fieldValue)) {
            return {
              error: {
                code: 'email_invalid',
                message: `Email ${fieldValue} is invalid`
              }
            };
          }
          break;
        case 'gender_validation':
          if (fieldValue !== 'm' && fieldValue !== 'f') {
            return {
              error: {
                code: 'field_invalid',
                message: `Field "${field}" is invalid. Accepted values are "m" and "f"`
              }
            };
          }
          break;
        case 'zip_code_fr_validation':
          if (fieldValue.length != 5 || !RegExp('^\\d+$').test(fieldValue)) {
            return {
              error: {
                code: 'field_invalid',
                message: `Field "${field}" is invalid.`
              }
            };
          }
          break;

        case 'only_letter_validation':
          if (!RegExp("^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]+$").test(fieldValue)) {
            return {
              error: {
                code: 'field_invalid',
                message: `Field "${field}" is invalid. Only letters are accepted.`
              }
            };
          }
          break;

        case 'date_format_validation':
          if (!moment(fieldValue, validator.format, true).isValid()) {
            if (fieldValue) {
              return {
                error: {
                  code: 'field_invalid',
                  message: `Field "${field}" is invalid. Date be ${validator.format} in format.`
                }
              };
            }
          }
          break;
        case 'timestamp_validation':
          if (fieldValue && !moment(parseInt(fieldValue)).isValid()) {
            if (fieldValue) {
              return {
                error: {
                  code: 'field_invalid',
                  message: `Field "${field}" is not a valid timestamp.`
                }
              };
            }
          }
          break;

        case 'url_validation':
          if (!_validUrl.isUri(fieldValue)) {
            if (fieldValue) {
              return {
                error: {
                  code: 'field_invalid',
                  message: `Field "${field}" is not a valid url. `
                }
              };
            }
          }
          break;

        case 'ip_validation':
          if (!_isIp(fieldValue)) {
            if (fieldValue) {
              return {
                error: {
                  code: 'field_invalid',
                  message: `Field "${field}" is not a valid IP.`
                }
              };
            }
          }
          break;
      }
    }
  }

  return { value: fieldValue };
};
