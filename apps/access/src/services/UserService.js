const sequelize = require('../storage/sequelize');
const log = require('../log').getLogger('UserService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { sendEmail } = require('./ToolsoEmailService');
const Crypto = require('crypto');

const TOKEN_EXPIRATION_TIME = 7 * 24 * 3600;
const RESET_TOKEN_VALIDITY_MS = 7 * 24 * 3600 * 1000;
let _jwt_secret = null;
module.exports = class {
  constructor() {
    this.User = sequelize.get().models.User;
  }

  // Secret JWT depuis l'environnement (JWT_SECRET), partagé avec les API emailing.
  _getJwtSecret = async () => {
    if (_jwt_secret) {
      return _jwt_secret;
    }
    _jwt_secret = config.jwtSecret();
    return _jwt_secret;
  };
  get = async (id) => {
    let user = await this.User.findOne({
      where: { id }
    });
    return user;
  };
  getWithEmail = async (email) => {
    email = email.toLowerCase().trim();
    return await this.User.findOne({
      where: {
        email: email
      }
    });
  };

  getWithToken = async (token) => {
    let user = await this.User.findOne({
      where: { resetToken: token }
    });
    if (user && user.resetDate) {
      if (user.resetDate <= new Date(Date.now() - RESET_TOKEN_VALIDITY_MS)) {
        user.resetDate = null;
        user.resetToken = null;
        await user.save();
        user = null;
      }
    }

    return user;
  };

  createUserWithPassword = async (user, password) => {
    user.password = await bcrypt.hash(password, 10);
    return await this.User.create(user);
  };
  setUserPassword = async (user, password) => {
    user.password = await bcrypt.hash(password, 10);
    await user.save();
  };

  async create(user) {
    return await this.User.create(user);
  }

  async generateResetToken(user, sendEmailToUser = false) {
    let token = Crypto.randomBytes(48).toString('hex').slice(0, 48);
    user.resetToken = token;
    user.resetDate = new Date();
    await user.save();

    if (sendEmailToUser) {
      let resetLink = `${config.publicUrl()}/#/resetpassword/${user.resetToken}`;

      await sendEmail(
        'resetPasswordLink',

        `[Toolso] - Reset password`,
        {
          resetLink
        },
        [user.email]
      );
    }
  }

  authWithPassword = async (email, password) => {
    email = email.toLowerCase().trim();
    let user = await this.User.findOne({
      where: {
        email: email
      }
    });
    if (!user) {
      throw new Error('user_not_found');
    }
    let passwordMatched = await bcrypt.compare(password, user.password);
    if (passwordMatched) {
      return await this.createToken(user);
    } else {
      throw new Error('bad_password');
    }
  };

  createToken = async (user) => {
    let secret = await this._getJwtSecret();
    return jwt.sign({ id: user.id, email: user.email }, secret, {
      expiresIn: TOKEN_EXPIRATION_TIME
    });
  };

  verifyToken = async (token) => {
    let secret = await this._getJwtSecret();
    let verifiedToken = jwt.verify(token, secret);
    let user = token ? await this.get(verifiedToken.id) : null;
    return { user, token: verifiedToken };
  };
};
