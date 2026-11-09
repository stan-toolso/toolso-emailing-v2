const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactEvents',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },

      events: {
        allowNull: true,
        type: DataTypes.JSON
      },

      lastImportedId: {
        allowNull: true,
        type: DataTypes.BIGINT
      },
      lastImportedDate: {
        allowNull: true,
        type: DataTypes.DATE
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['contactId']
        }
      ]
    }
  );
};
