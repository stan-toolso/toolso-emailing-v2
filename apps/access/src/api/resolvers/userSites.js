let UserRole = require('../../storage/models/UserRole');
const log = require('../../log').getLogger('userSites');

let _siteService = null;
let _userEntrepriseService = null;
module.exports = async (user, {entrepriseId}, context, info)=>{
    log.debug(`Get sites of user ${user.id}, ${user.email}`);
    if(!_siteService){
        let SiteService = require('../../services/SiteService');
        let UserEntrepriseService = require('../../services/UserEntrepriseService');
        _siteService = new SiteService();
        _userEntrepriseService = new UserEntrepriseService();
    }
    if(!entrepriseId){
        return [];
    }
    let canList = await _userEntrepriseService.canListSite(user.id, entrepriseId);

    if(canList){
        return await _siteService.getAllOfEntreprise(entrepriseId);
    }else {
        return [];
    }
   
  
}