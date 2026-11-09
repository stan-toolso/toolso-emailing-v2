const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Schedule',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      type: {
        allowNull: true,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./ScheduleType'))]
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./ScheduleStatus'))]
      },
      statusDetails: {
        allowNull: true,
        type: DataTypes.JSON
      },
      statusLastDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      isActive: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: false
      },
      uniqueContent: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: true
      },
      config: {
        allowNull: false,
        type: DataTypes.JSON,
        default: {}
      },
      scheduleDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      rate: {
        allowNull: true,
        type: DataTypes.STRING
      },
      uid: {
        allowNull: true,
        type: DataTypes.STRING
      },
      report: {
        allowNull: true,
        type: DataTypes.JSON
      },
      contents_stats: {
        allowNull: true,
        type: DataTypes.JSONB
      }
    },
    {
      freezeTableName: true
    }
  );
};
