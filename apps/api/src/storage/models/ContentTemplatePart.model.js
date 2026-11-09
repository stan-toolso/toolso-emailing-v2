const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContentTemplatePart',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      uid: {
        allowNull: true,
        type: DataTypes.STRING
      },
      name: {
        allowNull: true,
        type: DataTypes.STRING
      },
      html: {
        allowNull: true,
        type: DataTypes.TEXT
      }
    },
    {
      freezeTableName: true
    }
  );
};
