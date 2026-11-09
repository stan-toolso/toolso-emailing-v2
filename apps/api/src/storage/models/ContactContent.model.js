const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'ContactContent',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      contentIsUnique: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        default: true
      },
      activityScore: {
        allowNull: true,
        type: DataTypes.FLOAT
      },
      opened: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      clicked: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      delivered: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      unsubcribed: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      complainted: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      proxy_loaded: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      click_accepted: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      status: {
        allowNull: true,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./ContactStatus'))]
      },
      messageId: {
        allowNull: true,
        type: DataTypes.STRING
      },
      unique_opens: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      soft_bounced: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      contact_bounced: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      content_bounced: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      hard_bounced: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      esp: {
        allowNull: false,
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['scheduleId', 'contactId'],
          where: {
            contentIsUnique: true
          }
        },
        {
          fields: ['contactId', 'contentId']
        },
        {
          fields: ['contactId', 'createdAt']
        },
        {
          fields: ['messageId']
        },
        {
          fields: ['scheduleId']
        }
      ]
    }
  );
};
