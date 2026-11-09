const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactSource',
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
      regexp: {
        allowNull: true,
        type: DataTypes.STRING
      },
      utmSource: {
        allowNull: true,
        type: DataTypes.STRING
      },
      apiEnabled: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      apiKey: {
        allowNull: true,
        type: DataTypes.STRING
      },
      apiFields: {
        allowNull: true,
        type: DataTypes.JSON
      },
      apiScheduleIds: {
        allowNull: true,
        type: DataTypes.JSON
      },
      apiSettings: {
        allowNull: true,
        type: DataTypes.JSON
      },
      childConfig: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['apiKey']
        }
      ]
    }
  );
};
