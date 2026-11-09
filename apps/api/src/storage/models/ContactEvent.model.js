const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactEvent',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.DATE
      },
      requestDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./EventType'))]
      },
      messageId: {
        allowNull: true,
        type: DataTypes.STRING
      },
      esp: {
        allowNull: false,
        type: DataTypes.STRING
      },
      isUnique: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      details: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['date']
        },
        {
          fields: ['messageId']
        },
        {
          fields: ['contactId', 'id']
        },
        {
          fields: ['contentId']
        },
        {
          fields: ['inscriptionId']
        },
        {
          fields: ['scheduleId', 'date']
        },
        {
          fields: ['scheduleId', 'esp', 'senderId', 'date']
        }
      ]
    }
  );
};
