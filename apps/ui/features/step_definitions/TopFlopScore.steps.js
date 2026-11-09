const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { GetTopScore } = require('../../src/views/database/contents/dashboard/Score');
const { GetFlopScore } = require('../../src/views/database/contents/dashboard/Score');

var contents = {};
var results = {};
function getStandardContent() {
  return {
    request: 214158,
    unique_open: 59351,
    unique_click: 5875,
    unsub: 504,
    bounces: 94,
    complaint: 1
  };
}

Given('content_{int} and content_{int} are identical contents', function (int, int2) {
  contents[int] = getStandardContent();
  contents[int2] = getStandardContent();
});

Given('content_{int} clicks is doubled', function (int) {
  contents[int].unique_click = 2 * contents[int].unique_click;
});

Given('content_{int} requests is doubled', function (int) {
  contents[int].request = 2 * contents[int].request;
});

Given('content_{int} complaints is doubled', function (int) {
  contents[int].complaint = 2 * contents[int].complaint;
});

Given('content_{int} unsubs is doubled', function (int) {
  contents[int].unsub = 2 * contents[int].unsub;
});

Given('content_{int} requests increase by {int}', function (int, increment) {
  contents[int].request = contents[int].request + increment;
});

Given('content_{int} clicks increase by {int}', function (int, increment) {
  contents[int].unique_click = contents[int].unique_click + increment;
});

Given('content_{int} complaints increase by {int}', function (int, increment) {
  contents[int].complaint = contents[int].complaint + increment;
});

Given('content_{int} unsubs increase by {int}', function (int, increment) {
  contents[int].unsub = contents[int].unsub + increment;
});

When('I calculate topScore of contents', function () {
  for (var key in contents) {
    results[key] = GetTopScore(contents[key]);
  }
});

When('I calculate flopScore of contents', function () {
  for (var key in contents) {
    results[key] = GetFlopScore(contents[key]);
  }
});

Then('score of content_{int} is equal to score of content_{int}', function (int, int2) {
  assert.equal(results[int], results[int2]);
});

Then('score of content_{int} is higher than score of content_{int}', function (int, int2) {
  assert.ok(results[int] - results[int2] > 0);
});
