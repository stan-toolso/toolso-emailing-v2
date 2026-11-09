const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'History',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      ressource_id: {
        type: DataTypes.INTEGER
      },
      ressource_type: {
        type: DataTypes.STRING
      },
      user: {
        allowNull: false,
        type: DataTypes.STRING
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      activity: {
        allowNull: false,
        type: DataTypes.JSON
      },
      log_level: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      need_notification: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        default: false
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['ressource_type', 'ressource_id']
        },
        {
          fields: ['createdAt']
        }
      ]
    }
  );
};
