const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Sender',
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
      email: {
        allowNull: false,
        type: DataTypes.STRING
      },
      senderName: {
        allowNull: true,
        type: DataTypes.STRING
      },
      replyToName: {
        allowNull: true,
        type: DataTypes.STRING
      },
      replyToEmail: {
        allowNull: true,
        type: DataTypes.STRING
      },
      unsubscribeMailto: {
        allowNull: true,
        type: DataTypes.STRING
      },
      trackingDomain: {
        allowNull: true,
        type: DataTypes.STRING
      },
      hasSentSomething: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      deleted: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      }
    },
    {
      freezeTableName: true
    }
  );
};
