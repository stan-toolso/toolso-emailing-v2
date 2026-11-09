const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ActivationConfig',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      esp: {
        allowNull: true,
        type: DataTypes.STRING
      },
      date: {
        allowNull: false,
        type: DataTypes.STRING
      },
      config: {
        allowNull: false,
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
