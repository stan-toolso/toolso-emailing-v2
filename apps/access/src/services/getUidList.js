const sequelize = require('../storage/sequelize');
const Sequelize = require('sequelize');
const { QueryTypes } = Sequelize;

async function getUidList() {
  let sequelizeAccessConnection = await sequelize.initAccess();
  const result = await sequelizeAccessConnection.query(`SELECT uid from "EmailingDatabase"`, { type: QueryTypes.SELECT });
  sequelizeAccessConnection.close();
  return result.map((result) => result.uid);
}
exports.getUidList = getUidList;
