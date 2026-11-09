const { readFile: readFromS3, Folders: Buckets } = require('../FileStorageService');

let _inclusionListService = null;

module.exports = async (payload) => {
  if (!_inclusionListService) {
    const InclusionListService = require('../InclusionListService');
    _inclusionListService = new InclusionListService();
  }
  let inclusionList = await _inclusionListService.findWithId(payload.id);
  if (inclusionList && inclusionList.uploadStatus && inclusionList.uploadStatus.s3FileName) {
    let result = await readFromS3(inclusionList.uploadStatus.s3FileName, Buckets.emailing_tmp_files);
    if (result && result.Body) {
      let fileContent = result.Body.toString();
      var data = fileContent
        .replace(new RegExp('\r', 'g'), '\n')
        .split('\n') // split string to lines
        .map((e) => e.trim()) // remove white spaces for each line
        .map((e) => e.split(',')[0].trim()); // split each line to array

      await _inclusionListService.replaceAllInclusionListItem(payload.id, data);
    }
  }
};
