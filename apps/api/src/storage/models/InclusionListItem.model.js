const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'InclusionListItem',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      value: {
        allowNull: false,
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['inclusionListId', 'value']
        }
      ]
    }
  );
};
