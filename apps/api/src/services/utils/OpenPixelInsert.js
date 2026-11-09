// Exports

module.exports = function openPixelInsert(cheerioLoadedHtml, href) {
  cheerioLoadedHtml('body').append(`<img alt="" src="${href}" style="display: none; width: 1px; height: 1px;">`);
  return cheerioLoadedHtml.html();
};
