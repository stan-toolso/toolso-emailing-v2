const log = require('../util/log').getLogger('PermissionService');
const { Op } = require('sequelize');
const sequelize = require('../storage/sequelize');
const fetch = require('../infra/getNodeFetch')();
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./JwtSecretService');

const config = require('../util/config');

let _cache = {};
module.exports = class {
  constructor() {
    this.Permission = sequelize.get().models.Permission;
  }

  findWithId = async (id) => {
    return await this.Permission.findByPk(id);
  };

  findWithEmail = async (email) => {
    if (!email) {
      return null;
    }
    email = email.toLowerCase().trim();
    return await this.Permission.findOne({
      where: { email }
    });
  };

  getRole = async (token, uid) => {
    let result = await fetch(config.accessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `query getMyDatabaseRole($uid: String!) {getMyDatabaseRole(uid: $uid) {role}}`,
        variables: { uid: uid }
      })
    });
    let jsonResult = await result.json();
    return jsonResult?.data?.getMyDatabaseRole?.role;
  };

  getEmailingDatabase = async (token, entrepriseId, uid) => {
    let result = await fetch(config.accessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `query me($entrepriseId: ID!) {
          me {
            id
            email
            emailingDatabases(entrepriseId: $entrepriseId) {
              id
              uid
              name
              apiEndpoint
            }
          }
        }`,
        variables: { entrepriseId: entrepriseId }
      })
    });
    let jsonResult = await result.json();
    return jsonResult?.data?.me?.emailingDatabases ? jsonResult.data.me.emailingDatabases.find((emailingDatabase) => emailingDatabase.uid === uid) : null;
  };

  getEnterprise = async (token, id) => {
    let result = await fetch(config.accessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `
          query entreprise($id: ID!) {
            entreprise(id: $id) {
              id
              name
              users {
                id
                role
                disabled
                pending
                user {
                  id
                  email
                  firstname
                  lastname
                }
              }
            }
          }
        `,
        variables: { id: id }
      })
    });
    let jsonResult = await result.json();
    return jsonResult?.data?.entreprise;
  };

  findWithEmailInCache = async (email, token) => {
    if (!email) {
      return null;
    }
    email = email.toLowerCase().trim();

    if (!(email in _cache)) {
      let result = await this.Permission.findOne({
        where: { email }
      });
      _cache[email] = result ?? { value: {} };
      let role = await this.getRole(token, process.env.RESOURCE_UID);
      if (role) {
        _cache[email].value.role = role;
      }
    }
    return _cache[email];
  };

  findAll = async (offset = 0, limit = 100, filter = {}, order, attributes) => {
    let { where, includeFromFilter } = await this._buildWhereFromFilter(filter);
    if (!order) {
      order = [['id', 'DESC']];
    }

    let includes = await this._buildIncludes(includeFromFilter, attributes);
    let filteredAttributes = attributes && attributes.filter((value) => !this.lastInscriptionAttributes.includes(value));
    return await this.Permission.findAll({
      where,
      order,
      offset,
      limit,
      attributes: filteredAttributes,
      include: Object.keys(includes).length > 0 ? Object.values(includes) : null
    });
  };

  countAll = async (filter) => {
    let { where } = await this._buildWhereFromFilter(filter);
    return await this.Permission.count({
      where
    });
  };

  _buildWhereFromFilter = async (filter) => {
    let where = {};
    if ('email' in filter && filter.email) {
      where['email'] = { [Op.iLike]: `%${filter.email}%` };
    }

    return { where };
  };

  getEnterpriseAndUsers = async (uid) => {
    let token = await this._createAdminToken();
    let result = await fetch(config.accessApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `
        query GetEnterpriseAndUsers($uid: String!) {
          getEnterpriseAndUsers(uid: $uid) {
            emailingDatabase {
              name
            }
            entreprise {
              id
              name
              users {
                user {
                  email
                }
              }
            }
          }
        }
        `,
        variables: { uid }
      })
    });
    let jsonResult = await result.json();
    return jsonResult?.data?.getEnterpriseAndUsers;
  };

  _createAdminToken = async () => {
    let secret = await getJwtSecret();
    return jwt.sign({ id: 0 }, secret, {
      expiresIn: 3600
    });
  };
};
