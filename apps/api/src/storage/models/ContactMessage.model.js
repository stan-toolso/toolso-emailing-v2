const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactMessage',
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
      from: {
        allowNull: true,
        type: DataTypes.STRING
      },
      to: {
        allowNull: true,
        type: DataTypes.STRING
      },
      title: {
        allowNull: true,
        type: DataTypes.STRING
      },
      message: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      extract: {
        allowNull: true,
        type: DataTypes.STRING
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
        default: require('./ContactMessageStatus').pending,
        isIn: [Object.values(require('./ContactMessageStatus'))]
      },
      sendFromToolso: {
        allowNull: true,
        default: false,
        type: DataTypes.BOOLEAN
      },
      author: {
        allowNull: true,
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['contactId']
        }
      ]
    }
  );
};
