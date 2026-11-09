const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('Partner', {
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
    validatorsEmails: {
      allowNull: true,
      type: DataTypes.STRING
    },
    defaultMessage: {
      allowNull: true,
      type: DataTypes.TEXT
    },

    contacts: {
      allowNull: true,
      type: DataTypes.JSON
    },
    defaultValidationRate: {
      allowNull: true,
      type: DataTypes.FLOAT
    },
    variables: {
      allowNull: true,
      type: DataTypes.JSON
    },
    kitMapping: {
      allowNull: true,
      type: DataTypes.JSON
    }
  });
};
