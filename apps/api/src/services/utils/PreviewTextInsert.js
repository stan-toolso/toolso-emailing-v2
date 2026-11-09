// Exports
module.exports = function previewTextInsert(cheerioLoadedHtml, previewText) {
  cheerioLoadedHtml('body').prepend(`<table cellpadding="0" border="0" cellspacing="0" style=" mso-hide: all; display: none;"><tr><td>${previewText}</td></tr></table>`);
  return cheerioLoadedHtml.html();
};
