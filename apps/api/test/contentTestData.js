function getGoodContent() {
  return {
    name: 'a good Content',
    id: 2,
    requests: 10000,
    delivStats: {
      request: 10000,
      delivered: 9900,
      soft_bounce: 3,
      hard_bounce: 1,
      click: 200,
      open: 3000,
      proxy_loaded: 400,
      unsub: 10,
      complaint: 0,
      unique_click: 180,
      unique_open: 2800,
      unique_proxy_loaded: 350,
      contact_scores: 50
    },
    lastDelivStats: {
      request: 10000,
      delivered: 9900,
      soft_bounce: 3,
      hard_bounce: 1,
      click: 200,
      open: 3000,
      proxy_loaded: 400,
      unsub: 10,
      complaint: 0,
      unique_click: 180,
      unique_open: 2800,
      unique_proxy_loaded: 350,
      contact_scores: 50
    },
    lastDelivStatsByEsp: {}
  };
}
exports.getGoodContent = getGoodContent;
function getBadContent() {
  return {
    id: 1,
    name: 'a bad Content',
    requests: 10000,
    delivStats: {
      request: 10000,
      delivered: 9900,
      soft_bounce: 300,
      hard_bounce: 100,
      click: 20,
      open: 300,
      proxy_loaded: 40,
      unsub: 100,
      complaint: 0,
      unique_click: 18,
      unique_open: 280,
      unique_proxy_loaded: 35,
      contact_scores: 60
    },
    lastDelivStats: {
      request: 10000,
      delivered: 9900,
      soft_bounce: 300,
      hard_bounce: 100,
      click: 20,
      open: 300,
      proxy_loaded: 40,
      unsub: 100,
      complaint: 0,
      unique_click: 18,
      unique_open: 280,
      unique_proxy_loaded: 35,
      contact_scores: 60
    },
    lastDelivStatsByEsp: {}
  };
}
exports.getBadContent = getBadContent;

function getGoodNewContent() {
  return {
    name: 'a good new Content',
    id: 4,
    requests: 100,
    delivStats: {
      request: 100,
      delivered: 100,
      soft_bounce: 0,
      hard_bounce: 0,
      click: 100,
      open: 100,
      proxy_loaded: 0,
      unsub: 0,
      complaint: 0,
      unique_click: 100,
      unique_open: 100,
      unique_proxy_loaded: 0,
      contact_scores: 20
    },
    lastDelivStats: {
      request: 100,
      delivered: 100,
      soft_bounce: 0,
      hard_bounce: 0,
      click: 100,
      open: 100,
      proxy_loaded: 0,
      unsub: 0,
      complaint: 0,
      unique_click: 100,
      unique_open: 100,
      unique_proxy_loaded: 0,
      contact_scores: 20
    },
    lastDelivStatsByEsp: {}
  };
}
exports.getGoodNewContent = getGoodNewContent;
