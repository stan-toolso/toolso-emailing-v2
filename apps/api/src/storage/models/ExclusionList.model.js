const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ExclusionList',
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
      field: {
        allowNull: true,
        type: DataTypes.STRING
      },
      stats: {
        allowNull: true,
        type: DataTypes.JSON
      },
      uploadStatus: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true
    }
  );
};
