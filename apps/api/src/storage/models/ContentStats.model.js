const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContentStats',
    {
      content_id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      requests: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_requests: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      opened: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      clicked: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      delivered: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      unsubcribed: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      complainted: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      proxy_loaded: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      click_accepted: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      soft_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      contact_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      content_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      hard_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_opened: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_clicked: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_delivered: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_unsubcribed: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_complainted: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_proxy_loaded: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_click_accepted: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_soft_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_contact_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_content_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ref_hard_bounced: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      contact_scores: {
        allowNull: true,
        type: DataTypes.DOUBLE,
        defaultValue: 0
      },
      ref_contact_scores: {
        allowNull: true,
        type: DataTypes.DOUBLE,
        defaultValue: 0
      }
    },
    {
      freezeTableName: true
    }
  );
};
