const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ActivationStats',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      esp: {
        allowNull: false,
        type: DataTypes.STRING
      },
      date: {
        allowNull: false,
        type: DataTypes.STRING
      },

      request: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      wm_request: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_open: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_click: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_proxy_loaded: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unsub: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      complaint: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      hard_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      soft_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },

      request0Attempt: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      request1Attempt: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      request2Attempt: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      request3Attempt: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      newsStats: {
        allowNull: true,
        type: DataTypes.JSON,
        defaultValue: {}
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['esp', 'date']
        }
      ]
    }
  );
};
