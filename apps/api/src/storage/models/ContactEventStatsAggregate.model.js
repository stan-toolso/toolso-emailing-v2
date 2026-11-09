const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactEventStatsAggregate',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      date: {
        allowNull: false,
        type: DataTypes.STRING
      },
      aggregateType: {
        allowNull: false,
        type: DataTypes.STRING
      },
      aggregateUid: {
        allowNull: false,
        type: DataTypes.STRING
      },

      esp: {
        allowNull: false,
        type: DataTypes.STRING,
        defaultValue: 'unknown'
      },

      request: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      delivered: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      soft_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      hard_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      contact_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      content_bounce: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      click: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      open: {
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
      unique_click: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_open: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      proxy_loaded: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_proxy_loaded: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      contact_scores: {
        allowNull: true,
        type: DataTypes.DOUBLE,
        defaultValue: 0
      },
      click_validation_asked: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      click_validation_checked: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_click_accepted: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      unique_delivered: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['date', 'aggregateType', 'aggregateUid']
        },
        {
          fields: ['contentId', 'aggregateType']
        }
      ]
    }
  );
};
