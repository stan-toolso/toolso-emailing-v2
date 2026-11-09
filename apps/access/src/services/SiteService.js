const sequelize = require("../storage/sequelize");
const log = require('../log').getLogger('SiteService');

module.exports = class {

    constructor() {
        this.Site = sequelize.get().models.Site;
    }
    getAllEnabled = async (uid)=> {
        return await this.Site.findAll({
            where : {
                enabled : true
            }
        })
    }
    getAllOfEntreprise = async (entrepriseId)=> {
        log.debug(`Get all of entreprise ${entrepriseId}`);
        return await this.Site.findAll({
            where : {
                entrepriseId : entrepriseId
            }
        })
    }

    getWithUid = async (uid)=> {
        return await this.Site.findOne({
            where :{uid}
        })
    }
    updateBuildConfig = async (uid, configId, config)=> {
        let site = await this.Site.findOne({
            where :{uid}
        })
        if(site){
            if(!site.buildConfig){
                site.buildConfig = {};
            }
            site.buildConfig[configId] = config;
            await site.save();
        }
        return site;
    }

}