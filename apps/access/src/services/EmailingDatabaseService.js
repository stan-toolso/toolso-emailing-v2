const sequelize = require("../storage/sequelize");
const log = require('../log').getLogger('EmailingDatabaseService');

module.exports = class {

    constructor() {
        this.EmailingDatabase = sequelize.get().models.EmailingDatabase;
    }
    getAllEnabled = async (uid)=> {
        return await this.EmailingDatabase.findAll({
            where : {
                enabled : true
            }
        })
    }
    getAllOfEntreprise = async (entrepriseId)=> {
        log.debug(`Get all of entreprise ${entrepriseId}`);
        return await this.EmailingDatabase.findAll({
            where : {
                entrepriseId : entrepriseId
            }
        })
    }

    getWithUid = async (uid)=> {
        return await this.EmailingDatabase.findOne({
            where :{uid}
        })
    }
    updateBuildConfig = async (uid, configId, config)=> {
        let emailingDatabase = await this.EmailingDatabase.findOne({
            where :{uid}
        })
        if(emailingDatabase){
            if(!emailingDatabase.buildConfig){
                emailingDatabase.buildConfig = {};
            }
            emailingDatabase.buildConfig[configId] = config;
            await emailingDatabase.save();
        }
        return emailingDatabase;
    }

}