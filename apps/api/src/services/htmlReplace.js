const { htmlToText } = require('html-to-text');
const log = require('../util/log').getLogger('htmlReplace');
var CryptoJS = require('crypto-js');
var hrefReplace = require('./utils/hrefReplace');
var imgSrcReplace = require('./utils/ImgSrcReplace');
var previewTextInsert = require('./utils/PreviewTextInsert');
const openPixelInsert = require('./utils/OpenPixelInsert');
const appendCode = require('./utils/CodeAppender');
var cheerio = require('cheerio');
const config = require('../util/config');

function htmlReplace({ trackingDomain, html, mirrorId, schedule, contact, language, countryCode, encryptKey, previewText, bodyPrefix }) {
  let trackClickDomain = trackingDomain ? trackingDomain : config.apiPublicUrl();
  var cheerioLoadedHtml = cheerio.load(html);
  hrefReplace(
    cheerioLoadedHtml,
    function (href, callback, attrs) {
      if (href && href != '#') {
        let obj = { href: href.trim(), mirrorId };
        if (attrs && 'toolso:no-track' in attrs) {
          obj.noTrack = true;
        }
        if (attrs && 'toolso:unsub' in attrs) {
          obj.unsub = true;
        }
        if (schedule?.config && schedule.config.protectionLevel !== undefined) {
          obj.pl = schedule.config.protectionLevel;
        }
        if (contact?.customScores?.clickQualityScore) {
          obj.cql = contact.customScores.clickQualityScore;
        }
        if (language) {
          obj.ln = language;
        }
        if (countryCode) {
          obj.ecc = countryCode;
        }
        let encryptedObj = CryptoJS.AES.encrypt(JSON.stringify(obj), encryptKey).toString();
        let encodedObj = encodeURIComponent(encryptedObj);
        href = `${trackClickDomain}/tkc/v1/${encryptKey}/${encodedObj}`;
      }
      callback(null, href);
    },
    function (err, replaced) {
      if (err) {
        log.error(`Failed to replace all links`, err);
      }
      html = replaced;
    }
  );

  if (trackingDomain) {
    imgSrcReplace(
      cheerioLoadedHtml,
      function (src, callback) {
        if (!src) {
          callback(null, src);
          return;
        }
        callback(null, `${trackingDomain}/tk/v1/${encryptKey}/${encodeURIComponent(CryptoJS.AES.encrypt(src.trim(), encryptKey).toString())}`);
      },
      function (err, replaced) {
        if (err) {
          log.error(`Failed to replace all links`, err);
        }
        html = replaced;
      }
    );
  }

  let trackOpenDomain = trackingDomain ? trackingDomain : config.apiPublicUrl();
  let openPixelHref = `${trackOpenDomain}/tko/v1/${encryptKey}/${encodeURIComponent(CryptoJS.AES.encrypt(JSON.stringify({ mirrorId }), encryptKey).toString())}`;
  html = openPixelInsert(cheerioLoadedHtml, openPixelHref);

  let textVersion = htmlToText(html);
  if (previewText) {
    html = previewTextInsert(cheerioLoadedHtml, previewText);
  }

  let fullHtml = html;
  if (bodyPrefix) {
    fullHtml = appendCode(html, cheerioLoadedHtml, bodyPrefix, 'top');
  }

  return { fullHtml, textVersion, html };
}
exports.htmlReplace = htmlReplace;
