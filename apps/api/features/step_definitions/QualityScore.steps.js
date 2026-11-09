const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { getQualityScore } = require('../../src/services/scoring/qualityScore');

var schedules = {};
var results = {};

function getStandardSchedule() {
  return {
    request: 214158,
    unique_open: 59351,
    unique_click: 5875,
    contact_scores: 8000000,
    unsub: 504,
    bounces: 94,
    complaint: 1
  };
}

Given('schedule_{int} and schedule_{int} have identical delivStats', function (int, int2) {
  schedules[int] = getStandardSchedule();
  schedules[int2] = getStandardSchedule();
});

Given(
  'schedule_{int} has {float}% clickRate and {int}% openRate and {float}% contactScore and {int} unsubs and {int} complaints',
  function (int, clickRate, OpenRate, contactScoreRate, unsubCount, complaintCount) {
    schedules[int] = getStandardSchedule();
    schedules[int].unique_click = (clickRate * schedules[int].request) / 100;
    schedules[int].unique_open = (OpenRate * schedules[int].request) / 100;
    schedules[int].contact_scores = contactScoreRate * schedules[int].request;
    schedules[int].unsub = unsubCount;
    schedules[int].complaint = complaintCount;
  }
);

Given('schedule_{int} contactScoreRate decreases by {int}%', function (int, deltaPercent) {
  schedules[int].contact_scores = (schedules[int].contact_scores / schedules[int].request - deltaPercent / 100) * schedules[int].request;
});

Given('schedule_{int} opens increased by {int}', function (int, increment) {
  schedules[int].unique_open = schedules[int].unique_open + increment;
});

Given('schedule_{int} unsubs increase by {int}', function (int, increment) {
  schedules[int].unsub = schedules[int].unsub + increment;
});

Given('schedule_{int} complaints increase by {int}', function (int, increment) {
  schedules[int].complaint = schedules[int].complaint + increment;
});

Given('schedule_{int} clicks increased by {int}', function (int, increment) {
  schedules[int].unique_click = schedules[int].unique_click + increment;
});

Given('schedule_{int} openRate increases by {int}%', function (int, deltaPercent) {
  schedules[int].unique_open = (schedules[int].unique_open / schedules[int].request + deltaPercent / 100) * schedules[int].request;
});

Given('schedule_{int} clickRate increases by {int}%', function (int, deltaPercent) {
  schedules[int].unique_click = (schedules[int].unique_click / schedules[int].request + deltaPercent / 100) * schedules[int].request;
});

When('I calculate qualityScore of schedules', function () {
  for (var key in schedules) {
    results[key] = Math.round(getQualityScore(schedules[key]));
  }
});

Then('score of schedule_{int} is equal to score of schedule_{int}', function (int, int2) {
  assert.equal(results[int], results[int2]);
});

Then('score of schedule_{int} is higher than score of schedule_{int}', function (int, int2) {
  assert.ok(results[int] - results[int2]);
});

Then('score of schedule_{int} is equal to {int}', function (int, expectedScore) {
  assert.equal(results[int], expectedScore);
});

Then('score of schedule_{int} is lower than {int}%', function (int, maxAuthorizedValue) {
  assert.ok(maxAuthorizedValue - 100 * results[int]);
});

Then('score of schedule_{int} is higher than {int}%', function (int, minAuthorizedValue) {
  assert.ok(100 * results[int] - minAuthorizedValue);
});
