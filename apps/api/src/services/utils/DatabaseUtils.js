const mergeFieldsInObject = (fields, fromObject, toObject) => {
  for (let field of fields) {
    if (field in fromObject) {
      toObject[field] = fromObject[field];
    }
  }
};

module.exports = {
  mergeFieldsInObject
};
