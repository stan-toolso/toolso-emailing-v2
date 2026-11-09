const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define(
    'Contact',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      email: {
        allowNull: false,
        type: DataTypes.STRING
      },
      firstname: {
        allowNull: true,
        type: DataTypes.STRING
      },
      lastname: {
        allowNull: true,
        type: DataTypes.STRING
      },
      gender: {
        allowNull: true,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./ContactGender'))]
      },
      dob: {
        allowNull: true,
        type: DataTypes.DATEONLY
      },
      street: {
        allowNull: true,
        type: DataTypes.STRING
      },
      zipcode: {
        allowNull: true,
        type: DataTypes.STRING
      },
      city: {
        allowNull: true,
        type: DataTypes.STRING
      },
      phone: {
        allowNull: true,
        type: DataTypes.STRING
      },

      customFields: {
        allowNull: true,
        type: DataTypes.JSON
      },

      segment: {
        allowNull: false,
        type: DataTypes.SMALLINT
      },

      esp: {
        allowNull: false,
        type: DataTypes.STRING
      },
      md5: {
        allowNull: false,
        type: DataTypes.STRING
      },
      sha1: {
        allowNull: false,
        type: DataTypes.STRING
      },
      sha256: {
        allowNull: true,
        type: DataTypes.STRING
      },
      //status
      nextStatusUpdateDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      lastStatusUpdateQueuedDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      statusQueued: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
        isIn: [Object.values(require('./ContactStatus'))]
      },
      statusDetail: {
        allowNull: true,
        type: DataTypes.JSON
      },
      lastWorkableStatusDate: {
        allowNull: true,
        type: DataTypes.DATE
      },
      activated: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      blacklisted: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },
      pixelTrackingConsent: {
        allowNull: true,
        type: DataTypes.BOOLEAN
      },

      //scores
      activityScore: {
        allowNull: true,
        type: DataTypes.FLOAT
      },
      customScores: {
        allowNull: true,
        type: DataTypes.JSON
      },
      recommendations: {
        allowNull: true,
        type: DataTypes.JSON
      },
      //stats
      stats: {
        allowNull: true,
        type: DataTypes.JSON
      },
      segmentByFeatures: {
        allowNull: true,
        type: DataTypes.JSON,
        default: {}
      },

      lastRequestDate: {
        allowNull: true,
        type: DataTypes.DATE
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
          fields: ['md5']
        },
        {
          unique: true,
          fields: ['sha1']
        },
        {
          unique: true,
          fields: ['sha256']
        },
        {
          fields: ['nextStatusUpdateDate']
        },
        {
          fields: ['esp', 'activityScore']
        }
      ]
    }
  );
};
