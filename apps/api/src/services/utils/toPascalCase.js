module.exports = function toPascalCase(string) {
  if (!string) {
    return string;
  }
  return string.replaceAll('_', ' ').replace(/\w+/g, function (w) {
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  });
};
