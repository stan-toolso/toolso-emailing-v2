// Requires:

var async = require('async');

// Exports

module.exports = function hrefReplace(cheerioLoadedHtml, replacer, done) {
  var anchors = cheerioLoadedHtml('a');
  async.map(
    anchors.get(),
    function (anchor, cb) {
      var href = cheerioLoadedHtml(anchor).attr('href');
      replacer(href, cb, cheerioLoadedHtml(anchor) && cheerioLoadedHtml(anchor).length > 0 ? cheerioLoadedHtml(anchor)[0].attribs : {});
    },
    function (err, replaced) {
      if (err) {
        // Return the error and the original HTML.
        return cheerioLoadedHtml.html();
      }
      // Replace the hrefs
      anchors.each(function (idx, a) {
        var url = replaced[idx];
        if (url) {
          var anchor = cheerioLoadedHtml(a);
          anchor.attr('title', url);
          anchor.attr('href', url);
          anchor.removeAttr('toolso:no-track');
          anchor.removeAttr('toolso:unsub');
        }
      });
      // Done!
      done(null, cheerioLoadedHtml.html());
    }
  );
};
