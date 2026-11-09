// Exports

module.exports = function appendCode(html, cheerioLoadedHtml, code, position) {
  if (html.toLowerCase().indexOf('<body') >= 0) {
    switch (position) {
      case 'top':
        cheerioLoadedHtml('body').prepend(code);

        break;
      case 'bottom':
      default:
        cheerioLoadedHtml('body').append(code);
        break;
    }

    return cheerioLoadedHtml.html();
  } else {
    switch (position) {
      case 'top':
        return `${code}${html}`;
      case 'bottom':
      default:
        return `${html}${code}`;
    }
  }
};
