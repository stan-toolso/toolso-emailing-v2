const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'SendingStrategiesScheduleStats',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      scheduleId: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      date: { allowNull: false, type: DataTypes.DATEONLY },
      strategyType: {
        allowNull: false,
        type: DataTypes.STRING
      },
      strategyName: {
        allowNull: false,
        type: DataTypes.STRING
      },
      esp: {
        allowNull: true,
        type: DataTypes.STRING
      },
      type: {
        allowNull: true,
        type: DataTypes.STRING
      },
      config: {
        allowNull: false,
        type: DataTypes.JSON,
        default: {}
      },
      stats: {
        allowNull: false,
        type: DataTypes.JSON,
        default: {}
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['scheduleId']
        },
        {
          fields: ['date']
        },
        {
          fields: ['strategyType']
        },
        {
          fields: ['strategyName']
        },
        {
          fields: ['esp']
        },
        {
          fields: ['type']
        }
      ]
    }
  );
};
