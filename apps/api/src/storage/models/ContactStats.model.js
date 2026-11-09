const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactStats',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.STRING
      },
      stats: {
        allowNull: false,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true
    }
  );
};
