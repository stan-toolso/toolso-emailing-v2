const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Permission',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      email: {
        allowNull: false,
        unique: true,
        type: DataTypes.STRING
      },
      value: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true
    }
  );
};
