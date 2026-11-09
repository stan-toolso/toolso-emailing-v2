const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContentTemplate',
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
      html: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      previewText: {
        allowNull: true,
        type: DataTypes.STRING
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
      }
    },
    {
      freezeTableName: true
    }
  );
};
