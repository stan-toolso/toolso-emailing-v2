const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactMessageRule',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: true,
        default: false,
        type: DataTypes.STRING
      },
      enabled: {
        allowNull: true,
        default: false,
        type: DataTypes.BOOLEAN
      },
      filter: {
        allowNull: true,
        type: DataTypes.JSON
      },
      actions: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true
    }
  );
};
