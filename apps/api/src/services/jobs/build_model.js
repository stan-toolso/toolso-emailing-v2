const { postSynchroSQL } = require('../../storage/models/postSynchroSQL');

module.exports = async (sequelize) => {
  await sequelize.sync({
    force: false,
    alter: true
  });
  await sequelize.query(postSynchroSQL);
};
