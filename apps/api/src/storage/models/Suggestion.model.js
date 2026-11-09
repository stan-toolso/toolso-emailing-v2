const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Suggestion',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./SuggestionStatus'))]
      },
      unique_id: {
        type: DataTypes.STRING
      },
      user: {
        allowNull: false,
        type: DataTypes.STRING
      },
      suggestion_date: {
        allowNull: false,
        type: DataTypes.DATE
      },
      details: {
        allowNull: false,
        type: DataTypes.JSON
      },
      priority: {
        type: DataTypes.STRING,
        defaultValue: 'low'
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['unique_id']
        },
        {
          fields: ['createdAt']
        }
      ]
    }
  );
};
