const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    sequelize.define("User", {
        id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            type: DataTypes.INTEGER,
        },
        email: {
            allowNull: false,
            type: DataTypes.STRING,
        },
        firstname: {
            allowNull: true,
            type: DataTypes.STRING,
        },
        lastname: {
            allowNull: true,
            type: DataTypes.STRING,
        },
        password: {
            allowNull: true,
            type: DataTypes.STRING,
        },
        
        resetToken: {
            allowNull: true,
            type: DataTypes.STRING,
        },     
        resetDate: {
            allowNull: true,
            type: DataTypes.DATE,
        }      
    }, {
        freezeTableName: true
    });
};
