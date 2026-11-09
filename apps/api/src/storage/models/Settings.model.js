const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Settings',
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
      value: {
        allowNull: true,
        type: DataTypes.TEXT
      }
    },
    {
      freezeTableName: true
    }
  );
};
