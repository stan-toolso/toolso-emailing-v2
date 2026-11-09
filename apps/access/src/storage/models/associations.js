const sequelize = require('../sequelize');

module.exports = (sequelize) => {
  const { EmailingDatabase, User, Entreprise, Site, UserEntreprise, SuperUser } = sequelize.models;

  EmailingDatabase.belongsTo(Entreprise, { as: 'entreprise', foreignKey: 'entrepriseId' });
  Site.belongsTo(Entreprise, { as: 'entreprise', foreignKey: 'entrepriseId' });

  UserEntreprise.belongsTo(Entreprise, { as: 'entreprise', foreignKey: 'entrepriseId' });
  UserEntreprise.belongsTo(User, { as: 'user', foreignKey: 'userId' });

  User.hasMany(UserEntreprise, { as: 'entreprises', foreignKey: 'userId' });
  Entreprise.hasMany(UserEntreprise, { as: 'users', foreignKey: 'entrepriseId' });

  SuperUser.belongsTo(User, { as: 'user', foreignKey: 'userId' });
  User.hasOne(SuperUser, { as: 'superUser', foreignKey: 'userId' });
};
