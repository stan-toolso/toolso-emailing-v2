module.exports = async (payload) => {
  const { exportContacts } = require('../ContactExportService');
  await exportContacts(payload.fields, payload.format, payload.filter, payload.tos, payload.databaseName);
};
