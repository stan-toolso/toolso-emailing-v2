const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'BlacklistedContact',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },

      email: {
        allowNull: true,
        type: DataTypes.STRING
      },
      md5: {
        allowNull: true,
        type: DataTypes.STRING
      },
      sha1: {
        allowNull: true,
        type: DataTypes.STRING
      },
      sha256: {
        allowNull: true,
        type: DataTypes.STRING
      },
      stats: {
        allowNull: true,
        type: DataTypes.JSON
      },
      history: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['email']
        },
        {
          unique: true,
          fields: ['sha1']
        },
        {
          unique: true,
          fields: ['md5']
        },
        {
          unique: true,
          fields: ['sha256']
        }
      ]
    }
  );
};
