const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    sequelize.define("UserEntreprise", {
        id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            type: DataTypes.INTEGER,
        },        
        role : {
            allowNull: false,
            type: DataTypes.STRING,    
            isIn: [Object.values(require('./UserRole'))],      
            default : require('./UserRole').worker
        },
        disabled : {
            allowNull: false,
            type: DataTypes.BOOLEAN,    
            default : false
        }, 
        pending : {
            type: DataTypes.BOOLEAN,    
            default : false
        }          
    }, {
        freezeTableName: true
    });
};
