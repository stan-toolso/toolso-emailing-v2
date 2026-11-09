const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    sequelize.define("Site", {
        id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            type: DataTypes.INTEGER,
        },
        uid: {
            allowNull: false,
            type: DataTypes.STRING,
        },
        name: {
            allowNull: false,
            type: DataTypes.STRING,
        },
        host : {
            allowNull: false,
            type: DataTypes.STRING,
        },
        enabled: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            default: false
        },
        apiEndpoint : {
            allowNull : true,
            type : DataTypes.STRING
        },
        buildConfig: {
            allowNull: false,
            type: DataTypes.JSON
        },
        pricingConfig: {
            allowNull: true,
            type: DataTypes.JSON
        },

    }, {
        freezeTableName : true
    });
};
