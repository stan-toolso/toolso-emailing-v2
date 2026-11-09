const log = require('../../../util/log').getLogger('uploadInclusionListFile');
const ActionType = require('../../../services/ActionType');

let _inclusionListService = null;
let _actionService = null;
module.exports = async (parent, { inclusionListId, s3Key, fileName }, context, info) => {
  if (!_inclusionListService) {
    let InclusionListService = require('../../../services/InclusionListService');
    _inclusionListService = new InclusionListService();

    let ActionService = require('../../../services/ActionService');
    _actionService = new ActionService();
  }
  let inclusionList = await _inclusionListService.findWithId(inclusionListId);
  if (!inclusionList) {
    return null;
  }

  log.debug(`Upload inclusion list file for id ${inclusionListId}`);

  inclusionList.uploadStatus = {
    fileName,
    s3FileName: s3Key,
    s3Location: `tmp/${s3Key}`,
    status: 'waiting',
    contactImported: 0
  };
  await inclusionList.save();
  await _actionService.newAction(ActionType.upload_inclusion_list, {
    id: inclusionList.id
  });

  return inclusionList;
};
