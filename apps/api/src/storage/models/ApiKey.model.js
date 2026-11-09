const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ApiKey',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      apiKey: {
        allowNull: false,
        type: DataTypes.STRING
      },
      enabled: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: true
      },
      permissions: {
        allowNull: false,
        type: DataTypes.JSON,
        default: {}
      }
    },
    {
      freezeTableName: true
    }
  );
};
