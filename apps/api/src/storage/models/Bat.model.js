const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Bat',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      uid: {
        allowNull: false,
        type: DataTypes.STRING
      },
      date: {
        allowNull: false,
        type: DataTypes.DATE
      },
      message: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./BatStatus'))]
      },
      comments: {
        allowNull: true,
        type: DataTypes.JSON
      },
      author: {
        allowNull: true,
        type: DataTypes.STRING
      },
      validatorsEmails: {
        allowNull: true,
        type: DataTypes.STRING
      },
      validations: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['contentId']
        }
      ]
    }
  );
};
