const ContactStatus = require('../src/storage/models/ContactStatus');

function getContact() {
  return {
    email: 'stanboude@gmail.com',
    segment: 1,
    esp: 'gmail',
    firstname: 'Stan',
    lastname: 'Giraudet',
    activityScore: 60,
    status: ContactStatus.workable,
    dob: '1984-07-06',
    changed: () => {},
    save: () => {},
    segmentByFeatures: { marketingPressureStrategies: 1, bestOpenAndClick: 1, bestClick: 1, bestOpen: 1 },
    stats: { unique_open: 100 }
  };
}
exports.getContact = getContact;
