// Requires:

var async = require('async');

// Exports

module.exports = function imgSrcReplace(cheerioLoadedHtml, replacer, done) {
  var imgs = cheerioLoadedHtml('img');
  async.map(
    imgs.get(),
    function (img, cb) {
      var src = cheerioLoadedHtml(img).attr('src');
      replacer(src, cb);
    },
    function (err, replaced) {
      if (err) {
        // Return the error and the original HTML.
        return done(cheerioLoadedHtml.html());
      }
      // Replace the hrefs
      imgs.each(function (idx, a) {
        var url = replaced[idx];
        if (url) {
          var img = cheerioLoadedHtml(a);
          img.attr('src', url);
        }
      });
      // Done!
      done(null, cheerioLoadedHtml.html());
    }
  );
};
