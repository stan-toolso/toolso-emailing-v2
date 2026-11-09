const { storeFile, Folders, ACL } = require('../FileStorageService');
const { parseAsync } = require('json2csv');

const ExportFormat = Object.freeze({
  csv_comma: 'csv_comma',
  csv_semicolon: 'csv_semicolon'
});

const convertResultToFormatAndAsendToS3 = async (fileName, result, format, bucket = Folders.exports, acl = ACL.public_read) => {
  let finalResult = null;

  switch (format) {
    case ExportFormat.csv_comma:
    case ExportFormat.csv_semicolon:
      finalResult = await _to_csv(result, format);
      fileName += '.csv';
      break;
    default:
      return {
        status: 'ko'
      };
  }

  let s3Result = await storeFile(fileName, finalResult, bucket, acl);

  return {
    link: s3Result ? s3Result.Location : null
  };
};

module.exports = {
  ExportFormat,
  convertResultToFormatAndAsendToS3
};

const _to_csv = async (result, format) => {
  let fields = [];
  for (let field in result._labels) {
    fields.push({
      value: field,
      label: result._labels[field]
    });
  }
  let data = Array.isArray(result._values) ? result._values : Object.values(result._values);
  return await parseAsync(data, {
    fields,
    delimiter: format == ExportFormat.csv_comma ? ',' : ';'
  });
};
