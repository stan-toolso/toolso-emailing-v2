const InscriptionService = require('../../../services/InscriptionService');
const inscriptionService = new InscriptionService();
const emailValidator = require('email-validator');
const isIp = require('is-ip');
const validUrl = require('valid-url');
var moment = require('moment-timezone');

const { filterEsp } = require('../../../services/inscription_filters/EspFilter');
const { filterEmailPatterns } = require('../../../services/inscription_filters/EmailFilter');
const { filterBlacklist } = require('../../../services/inscription_filters/BacklistFilter');
const { extractEsp } = require('../../../services/EspService');

const validateCapping = async (source) => {
  let errors = [];
  let dailyCappingFilters = source.apiSettings?.filters?.filter((filter) => filter?.type === 'dailyCapping');
  if (dailyCappingFilters) {
    await Promise.all(
      dailyCappingFilters.map(async (dailyCappingFilter) => {
        let dailyThresold = dailyCappingFilter?.threshold;
        if (dailyThresold != null || dailyThresold != undefined) {
          let dailyRequests = await inscriptionService.getDailyRequestCount(source, dailyCappingFilter?.subtype);
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
          let monthlyRequests = await inscriptionService.getMonthlyRequestCount(source, monthlyCappingFilter?.subtype);
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
          if (!emailValidator.validate(fieldValue)) {
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
          if (!validUrl.isUri(fieldValue)) {
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
          if (!isIp(fieldValue)) {
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

const validateEmail = async (email) => {
  if (!emailValidator.validate(email)) {
    return {
      error: {
        accepted: false,
        code: 'email_invalid',
        message: `Email ${email} is invalid`
      }
    };
  }

  let espFilter = filterEsp(email);
  if (!espFilter) {
    return {
      accepted: false,
      errorCode: 'esp_excluded',
      message: `Email ${email} belongs to excluded esp list.`
    };
  }
  let emailPattnerFilter = filterEmailPatterns(email);

  if (!emailPattnerFilter) {
    return {
      accepted: false,
      errorCode: 'email_pattern_excluded',
      message: `Email ${email} matched an exclusion pattern.`
    };
  }

  let emailBlacklistFilter = await filterBlacklist(email);
  if (!emailBlacklistFilter) {
    return {
      accepted: false,
      errorCode: 'email_blacklisted',
      message: `Email ${email} is blacklisted.`
    };
  }
  return { success: true };
};

const validateApiSettings = (email, source) => {
  let esp = extractEsp(email);
  if (source.apiSettings && source.apiSettings.filters) {
    for (let filter of source.apiSettings.filters) {
      if (!filter) {
        continue;
      }
      switch (filter.type) {
        case 'espExclude':
          if (esp && filter.esps && filter.esps.includes(esp)) {
            return {
              accepted: false,
              errors: [
                {
                  errorCode: 'esp_excluded',
                  message: `Email ${email} belongs to excluded esp list.`
                }
              ]
            };
          }
          break;
        case 'espInclude':
          if (!esp || (filter.esps && !filter.esps.includes(esp))) {
            return {
              accepted: false,
              errors: [
                {
                  errorCode: 'esp_excluded',
                  message: `Email ${email} belongs to excluded esp list.`
                }
              ]
            };
          }
          break;
        default:
          continue;
      }
    }
  }
  return {
    accepted: true
  };
};

module.exports = {
  validateCapping,
  validateFields,
  validateField,
  validateEmail,
  validateApiSettings
};
