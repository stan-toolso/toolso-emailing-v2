const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'SuperUser',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      disabled: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: false
      }
    },
    {
      freezeTableName: true
    }
  );
};
