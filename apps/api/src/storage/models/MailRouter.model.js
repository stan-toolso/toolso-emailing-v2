const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'MailRouter',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      externalUid: {
        allowNull: true,
        type: DataTypes.STRING
      },
      type: {
        allowNull: true,
        type: DataTypes.STRING
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      credentials: {
        allowNull: true,
        type: DataTypes.STRING,
        default: {}
      },
      config: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      }
    },
    {
      freezeTableName: true
    }
  );
};
