const { readFile: readFromS3, Folders: Buckets } = require('../FileStorageService');

let _exclusionListService = null;

module.exports = async (payload) => {
  if (!_exclusionListService) {
    const ExclusionListService = require('../ExclusionListService');
    _exclusionListService = new ExclusionListService();
  }
  let exclusionList = await _exclusionListService.findWithId(payload.id);
  if (exclusionList && exclusionList.uploadStatus && exclusionList.uploadStatus.s3FileName) {
    let result = await readFromS3(exclusionList.uploadStatus.s3FileName, Buckets.emailing_tmp_files);
    if (result && result.Body) {
      let fileContent = result.Body.toString();
      var data = fileContent
        .split('\n') // split string to lines
        .map((e) => e.trim()) // remove white spaces for each line
        .map((e) => e.split(',')[0].trim()); // split each line to array

      await _exclusionListService.replaceAllExclusionListItem(payload.id, data);
    }
  }
};
