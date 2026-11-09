const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Content',
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
      isActive: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: false
      },
      startDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      endDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      config: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },
      delivStats: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },
      requests: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      lastDelivStats: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },
      hasToUpdateDelivStats: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        default: true
      },
      type: {
        allowNull: true,
        type: DataTypes.STRING,
        default: 'newsletter',
        isIn: [Object.values(require('./ContentType'))]
      },
      lastDelivStatsByEsp: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },
      incomesStats: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },
      suspended: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        default: false
      },
      suspensionReason: {
        allowNull: true,
        type: DataTypes.STRING
      },
      category: {
        allowNull: true,
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['isActive', 'type']
        }
      ]
    }
  );
};
