export const canViewContacts = (permission)=>{
    if(!permission || !('contacts' in permission) || !(permission.contacts)){
      return true;
    }

    let contactsPerm = permission.contacts;
    switch(contactsPerm.perm){
      case 'none':
        return false;
      default:
        return true;
    }

}