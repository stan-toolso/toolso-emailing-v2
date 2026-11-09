const log = require('../../../util/log').getLogger('uploadInclusionListFile');
const { getUploadUrl, Folders } = require('../../../services/FileStorageService');
const { v4: uuidv4 } = require('uuid');
const ActionType = require('../../../services/ActionType');

let _inclusionListService = null;
let _actionService = null;
module.exports = async (parent, { fileName, fileType }, context, info) => {
  const key = uuidv4();
  return {
    ...(await getUploadUrl(`${key}_${fileName}`, fileType, Folders.emailing_tmp_files, context && context.encryptedToken)),
    fileName
  };
};
