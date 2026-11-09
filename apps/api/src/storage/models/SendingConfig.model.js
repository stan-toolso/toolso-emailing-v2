const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'SendingConfig',
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
      config: {
        allowNull: false,
        type: DataTypes.JSON,
        default: {}
      },
      history: {
        allowNull: true,
        type: DataTypes.JSON,
        default: []
      }
    },
    {
      freezeTableName: true
    }
  );
};
