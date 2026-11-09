const { DataTypes } = require('sequelize');

/**
 * Copie des messages envoyés (remplace la table DynamoDB `toolso-emailing-mirrors` et le bucket S3 `toolso-emailing-mirror-body`).
 * Sert à la page miroir (« voir en ligne »), au rattachement des événements de tracking (clic, ouverture, désabonnement)
 * et des plaintes FBL au message d'origine. Les lignes expirent après 30 jours (purge par le job database_cleaner).
 */
module.exports = (sequelize) => {
  sequelize.define(
    'Mirror',
    {
      mirrorId: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID
      },
      messageId: {
        allowNull: true,
        type: DataTypes.STRING
      },
      to: {
        allowNull: true,
        type: DataTypes.STRING
      },
      subject: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      source: {
        allowNull: true,
        type: DataTypes.STRING
      },
      compressedBody: {
        allowNull: true,
        type: DataTypes.BLOB
      },
      expDate: {
        allowNull: false,
        type: DataTypes.DATE
      }
    },
    {
      freezeTableName: true,
      indexes: [{ fields: ['expDate'] }]
    }
  );
};
