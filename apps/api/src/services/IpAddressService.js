const sequelize = require('../storage/sequelize');
const log = require('../util/log').getLogger('IpAddressService');

module.exports = class IpAddressService {
  constructor() {
    if (IpAddressService._instance) {
      return IpAddressService._instance;
    }
    IpAddressService._instance = this;
    this.IpAddress = sequelize.get()?.models?.IpAddress;
  }

  findWithId = async (id) => {
    return await this.IpAddress.findByPk(id);
  };

  ipAdressesCacheById = {};
  findWithIdFromCache = async (id) => {
    if (!(id in this.ipAdressesCacheById)) {
      this.ipAdressesCacheById[id] = await this.findWithId(id);
    }
    return this.ipAdressesCacheById[id];
  };

  getIpAddressFromIp = async (ip) => {
    if (!ip) {
      return null;
    }
    log.debug(`Get IpAddress with ip ${ip}`);

    let ipAddress = await this.IpAddress.findOne({
      where: {
        ip: ip
      }
    });
    if (!ipAddress) {
      ipAddress = await this.IpAddress.findOne({
        where: {
          default: true
        }
      });
    }

    return ipAddress;
  };

  ipAdressesCache = {};
  getIpAddressFromCache = async (ip) => {
    if (!(ip in this.ipAdressesCache)) {
      this.ipAdressesCache[ip] = await this.getIpAddressFromIp(ip);
    }
    return this.ipAdressesCache[ip];
  };
};
