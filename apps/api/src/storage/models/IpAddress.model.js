const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'IpAddress',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: true,
        type: DataTypes.STRING
      },

      domain: {
        allowNull: true,
        type: DataTypes.STRING
      },
      ip: {
        allowNull: true,
        type: DataTypes.STRING
      },
      default: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      }
    },
    {
      freezeTableName: true
    }
  );
};
