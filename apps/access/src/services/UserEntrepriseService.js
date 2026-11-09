const UserRole = require('../storage/models/UserRole');
const sequelize = require('../storage/sequelize');
const { sendEmail } = require('./ToolsoEmailService');
const config = require('../config');
const log = require('../log').getLogger('UserEntrepriseService');

module.exports = class {
  constructor() {
    this.UserEntreprise = sequelize.get().models.UserEntreprise;
    this.User = sequelize.get().models.User;
    this.Entreprise = sequelize.get().models.Entreprise;
    this.EmailingDatabase = sequelize.get().models.EmailingDatabase;
  }

  canEditEntreprise = async (userId, entrepriseId) => {
    let item = await this.getByEnterpriseId(userId, entrepriseId);
    return item && item.role == 'admin';
  };

  canListSite = async (userId, entrepriseId) => {
    return (await this.getByUSerId(userId, entrepriseId)) != null;
  };

  async get(id) {
    return await this.UserEntreprise.findOne({
      where: { id }
    });
  }

  async getByEnterpriseId(userId, entrepriseId) {
    return await this.UserEntreprise.findOne({
      where: {
        entrepriseId: entrepriseId,
        userId: userId,
        disabled: false
      }
    });
  }

  async GetEnterpriseAndUsers(uid) {
    let emailingDatabase = await this.EmailingDatabase.findOne({
      where: { uid }
    });
    if (emailingDatabase) {
      let entreprise = await emailingDatabase.getEntreprise();
      let userEntreprises = await this.UserEntreprise.findAll({ where: { entrepriseId: entreprise.id, disabled: false } });
      entreprise.users = userEntreprises;
      return { emailingDatabase, entreprise };
    }
  }

  async getByUSerId(userId, entrepriseId) {
    let user = await this.User.findByPk(userId);
    let superUser = await user.getSuperUser();
    if (superUser && !superUser.disabled) {
      let where = entrepriseId ? { id: entrepriseId } : {};
      let allEnterprises = await this.Entreprise.findAll({ where });
      return allEnterprises.map((enterprise) => {
        let result = { ...superUser, id: -enterprise.id, role: 'superAdmin', getUser: () => user, getEntreprise: () => enterprise };
        return result;
      });
    } else {
      let where = {
        userId: userId,
        disabled: false
      };
      if (parseInt(entrepriseId)) {
        where.entrepriseId = entrepriseId;
      }

      return await this.UserEntreprise.findAll({ where });
    }
  }

  async update(userEntreprise) {
    let existingUserEntreprise = await this.get(userEntreprise.id);
    if (userEntreprise) {
      ['disabled', 'role'].forEach((item) => {
        if (item in userEntreprise) {
          existingUserEntreprise[item] = userEntreprise[item];
        }
      });
      await existingUserEntreprise.save();
    }
    return existingUserEntreprise;
  }

  async create({ entrepriseId, email, firstname, lastname, role }) {
    email = email.toLowerCase().trim();
    let existingUser = await this.User.findOne({ where: { email } });
    if (!existingUser) {
      let UserService = require('./UserService');
      let userService = new UserService();

      existingUser = await userService.create({
        email,
        firstname,
        lastname
      });
      await userService.generateResetToken(existingUser);
    }
    if (!role) {
      role = UserRole.worker;
    }

    let userEntreprise = {
      userId: existingUser.id,
      entrepriseId: entrepriseId,
      role,
      disabled: false,
      pending: true
    };
    userEntreprise = await this.UserEntreprise.create(userEntreprise);
    let entreprise = await userEntreprise.getEntreprise();

    let joinLink = `${config.publicUrl()}/`;

    if (!existingUser.password) {
      joinLink = `${config.publicUrl()}/#/join/${existingUser.resetToken}`;
    }

    try {
      await sendEmail(
        'entrepriseInvitation',
        `[${entreprise.name}] - Join invitation`,
        {
          entreprise,
          joinLink
        },
        [existingUser.email]
      );
    } catch (ex) {
      log.error(`Failed to send invitation`, ex);
    }

    return userEntreprise;
  }
};
