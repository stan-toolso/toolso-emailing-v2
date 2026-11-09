let UserRole = require('../../storage/models/UserRole');
const log = require('../../log').getLogger('userEmailingDatabases');

let _emailingDatabaseService = null;
module.exports = async (user, {entrepriseId}, context, info)=>{
    log.debug(`Get emailing databases of user ${user.id}, ${user.email}`);
    if(!_emailingDatabaseService){

        let EmailingDatabaseService = require('../../services/EmailingDatabaseService');
        let UserEntrepriseService = require('../../services/UserEntrepriseService');
        
        _emailingDatabaseService = new EmailingDatabaseService();
        _userEntrepriseService = new UserEntrepriseService();

    }

    if(!entrepriseId){
        return [];
    }

    let canList = await _userEntrepriseService.canListSite(user.id, entrepriseId);


    if(canList){
        return await _emailingDatabaseService.getAllOfEntreprise(entrepriseId);
    }else {
        return [];
    }

   
  
}