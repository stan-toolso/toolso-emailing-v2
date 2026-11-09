const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContentIncome',
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
      type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      validationRate: {
        allowNull: false,
        type: DataTypes.FLOAT
      },
      recordedIncome: {
        allowNull: false,
        type: DataTypes.FLOAT
      },
      estimatedIncome: {
        allowNull: false,
        type: DataTypes.FLOAT
      },
      stats: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['date', 'contentId']
        },
        {
          unique: true,
          fields: ['contentId', 'date']
        }
      ]
    }
  );
};
