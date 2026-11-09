const log = require('../util/log').getLogger('ContactExportService');

const { convertResultToFormatAndAsendToS3, ExportFormat } = require('./utils/ExportUtils');
const ContactService = require('./ContactService');
const { sendEmail } = require('./ToolsoEmailService');

const Fields = Object.freeze({
  email: 'email',
  md5: 'md5',
  sha1: 'sha1',
  sha256: 'sha256',
  lastname: 'lastname',
  firstname: 'firstname',
  gender: 'gender',
  street: 'street',
  zipcode: 'zipcode',
  dob: 'dob',
  phone: 'phone',
  esp: 'esp',
  status: 'status',
  createdAt: 'createdAt',
  city: 'city',
  ip: 'ip',
  collectUrl: 'collectUrl'
});

const exportContacts = async (fields, format, filter, tos, databaseName) => {
  if (!fields) {
    fields = Object.values(Fields);
  }
  if (!filter) {
    filter = {};
  }
  if (!format) {
    format = ExportFormat.csv_semicolon;
  }
  log.debug(`Export contact fields ${fields}. Filter ${filter}`);

  let result = {};
  await _exportContactFromOffset(0, fields, result, filter);
  log.debug(`Export contains ${result._values.length} contacts`);

  let fileName = `contacts_${new Date().getTime()}`;
  let formatResult = await convertResultToFormatAndAsendToS3(fileName, result, format);

  console.log(formatResult);

  await sendEmail(
    'contactExportCompleted',
    databaseName ? `[${databaseName}] Contact export ready` : 'Contact export ready',
    {
      databaseName,
      link: formatResult.link
    },
    tos
  );
};

module.exports = {
  exportContacts,
  Fields
};

const _exportContactFromOffset = async (offset, fields, result, filter) => {
  log.debug(`_exportContactFromOffset with offset ${offset}`);
  if (!result._labels) {
    result._labels = {};
    for (let field of fields) {
      switch (field) {
        case Fields.email:
          result._labels[field] = 'Email';
          break;
        case Fields.md5:
          result._labels[field] = 'MD5';
          break;
        case Fields.sha1:
          result._labels[field] = 'Sha1';
          break;
        case Fields.sha256:
          result._labels[field] = 'Sha256';
          break;
        case Fields.firstname:
          result._labels[field] = 'Firstname';
          break;
        case Fields.lastname:
          result._labels[field] = 'Lastname';
          break;
        case Fields.gender:
          result._labels[field] = 'Gender';
          break;
        case Fields.street:
          result._labels[field] = 'Street';
          break;
        case Fields.zipcode:
          result._labels[field] = 'Zipcode';
          break;
        case Fields.dob:
          result._labels[field] = 'Dob';
          break;
        case Fields.phone:
          result._labels[field] = 'Phone';
          break;
        case Fields.esp:
          result._labels[field] = 'Esp';
          break;
        case Fields.status:
          result._labels[field] = 'Status';
          break;
        case Fields.createdAt:
          result._labels[field] = 'Insertion Date';
          break;
        case Fields.ip:
          result._labels[field] = 'IP';
          break;
        case Fields.collectUrl:
          result._labels[field] = 'Collect Url';
          break;
        case Fields.city:
          result._labels[field] = 'City';
          break;
        default:
          result._labels[field] = field;
          break;
      }
    }
    result._values = [];
  }

  let limit = 5000;

  let contacts = await new ContactService().findAll(offset, limit, filter, [...fields]);

  for (let contact of contacts) {
    let item = {};
    for (let field of fields) {
      switch (field) {
        case Fields.email:
        case Fields.sha1:
        case Fields.sha256:
        case Fields.md5:
        case Fields.lastname:
        case Fields.firstname:
        case Fields.gender:
        case Fields.street:
        case Fields.zipcode:
        case Fields.dob:
        case Fields.phone:
        case Fields.esp:
        case Fields.status:
        case Fields.createdAt:
        case Fields.city:
          item[field] = contact[field];
          break;
        case Fields.ip:
        case Fields.collectUrl:
          item[field] = contact.lastInscription && contact.lastInscription[field];
          break;
        default:
          break;
      }
    }
    result._values.push(item);
  }
  if (contacts.length == limit) {
    await _exportContactFromOffset(offset + limit, fields, result, filter);
  }
};
