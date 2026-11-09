const { DataTypes } = require('sequelize');

/**
 * File d'actions (remplace les files SQS `actions_<uid>` et `huge_actions`).
 * Les workers réservent les lignes avec `FOR UPDATE SKIP LOCKED` et les suppriment une fois traitées.
 */
module.exports = (sequelize) => {
  sequelize.define(
    'ActionQueue',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.BIGINT
      },
      queue: {
        allowNull: false,
        type: DataTypes.STRING(32),
        defaultValue: 'default'
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING(64)
      },
      payload: {
        allowNull: true,
        type: DataTypes.JSONB
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING(16),
        defaultValue: 'pending'
      },
      availableAt: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      attempts: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      lockedAt: {
        allowNull: true,
        type: DataTypes.DATE
      },
      lastError: {
        allowNull: true,
        type: DataTypes.TEXT
      }
    },
    {
      freezeTableName: true,
      indexes: [{ fields: ['queue', 'status', 'availableAt', 'id'] }]
    }
  );
};
