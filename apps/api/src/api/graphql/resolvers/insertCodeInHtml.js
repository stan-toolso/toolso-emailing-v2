const log = require('../../../util/log').getLogger('ContentVersion/insertCode');
var cheerio = require('cheerio');

let _contentService = null;
module.exports = async (parent, { html, code, position }, _context, _info) => {
  log.debug(`Insert code in html @ ${position}`);

  const appendCode = require('../../../services/utils/CodeAppender');
  var cheerioLoadedHtml = cheerio.load(html);
  return appendCode(html, cheerioLoadedHtml, code, position);
};
