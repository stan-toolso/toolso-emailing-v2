const log = require('../../../util/log').getLogger('uploadExclusionListFile');
const ActionType = require('../../../services/ActionType');

let _exclusionListService = null;
let _actionService = null;
module.exports = async (parent, { exclusionListId, s3Key, fileName }, context, info) => {
  if (!_exclusionListService) {
    let ExclusionListService = require('../../../services/ExclusionListService');
    _exclusionListService = new ExclusionListService();

    let ActionService = require('../../../services/ActionService');
    _actionService = new ActionService();
  }
  let exclusionList = await _exclusionListService.findWithId(exclusionListId);
  if (!exclusionList) {
    return null;
  }

  log.debug(`Upload exclusion list file for id ${exclusionListId}`);

  exclusionList.uploadStatus = {
    fileName,
    s3FileName: s3Key,
    s3Location: `tmp/${s3Key}`,
    status: 'waiting',
    contactImported: 0
  };
  await exclusionList.save();
  await _actionService.newAction(ActionType.upload_exclusion_list, {
    id: exclusionList.id
  });

  return exclusionList;
};
