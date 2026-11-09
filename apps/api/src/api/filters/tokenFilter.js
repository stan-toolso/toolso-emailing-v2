const log = require('../../util/log').getLogger('Token Filter');

module.exports = async (req, res, next) => {
  if (!req.token) {
    res.status(403).json({
      status: 'ko',
      code: 'authentificated',
      message: 'Request is not authentificated'
    });
    return;
  }

  next();
};
