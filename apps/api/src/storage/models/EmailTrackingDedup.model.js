const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'EmailTrackingDedup',
    {
      //hash non réversible (messageId + type + secret), aucune donnée contact
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true
    }
  );
};
