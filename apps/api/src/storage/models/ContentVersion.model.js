const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContentVersion',
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
      isDefault: {
        allowNull: false,
        type: DataTypes.BOOLEAN
      },
      html: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      subject: {
        allowNull: true,
        type: DataTypes.STRING
      },
      frenchEspsSubject: {
        allowNull: true,
        type: DataTypes.STRING
      },
      senderName: {
        allowNull: true,
        type: DataTypes.STRING
      },
      previewText: {
        allowNull: true,
        type: DataTypes.STRING
      },
      templateVariables: {
        allowNull: true,
        type: DataTypes.JSON
      },
      disabled: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
