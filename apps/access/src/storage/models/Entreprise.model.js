const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Entreprise',
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
      settings: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true
    }
  );
};
