const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactInscription',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      inscriptionDate: {
        allowNull: false,
        type: DataTypes.DATE
      },
      ip: {
        allowNull: true,
        type: DataTypes.STRING
      },
      sourceName: {
        allowNull: true,
        type: DataTypes.STRING
      },
      collectUrl: {
        allowNull: true,
        type: DataTypes.STRING(1000)
      },
      fields: {
        allowNull: false,
        type: DataTypes.JSON
      },
      isFirst: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      isFirstToday: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      activated: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },

      //stats
      stats: {
        allowNull: true,
        type: DataTypes.JSON
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          fields: ['contactId']
        },
        {
          fields: ['inscriptionDate']
        }
      ]
    }
  );
};
