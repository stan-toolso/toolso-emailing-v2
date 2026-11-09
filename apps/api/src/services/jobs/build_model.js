const { syncModel } = require('../../storage/syncModel');

module.exports = async (sequelize) => {
  await syncModel(sequelize);
};
