import getYesterdayAt3AM from "./utils/utils.js";

setTimeout(() => {
  console.log("heeeyyy");
}, 3000);

// const availability = await Summarizer.availability();
// console.log("Summarizer availability:", availability);
// const summarizer = await Summarizer.create({
//   monitor(m) {
//     m.addEventListener("downloadprogress", (e) => {
//       console.log(`Downloaded ${e.loaded * 100}%`);
//     });
//   },
// });

// // Get all tab groups
// chrome.tabGroups.query({}, function (groups) {
//   groups.forEach((group) => {
//     console.log(`Group: ${group.title}, Color: ${group.color}`);

//     // Get tabs in this group
//     chrome.tabs.query({ groupId: group.id }, function (tabs) {
//       console.log(`Tabs in ${group.title}:`, tabs);
//     });
//   });
// });

// // Get ungrouped tabs
// chrome.tabs.query(
//   { groupId: chrome.tabGroups.TAB_GROUP_ID_NONE },
//   function (tabs) {
//     console.log("Ungrouped tabs:", tabs);
//   }
// );

const startTime = getYesterdayAt3AM();

// chrome.history.search(
//   { text: "", startTime: startTime, endTime: Date.now(), maxResults: 10000 },
//   (results) => {
//     console.log(`Found ${results.length} visits since 3 AM yesterday`);

//     results.forEach((page) => {
//       const visitDate = new Date(page.lastVisitTime);
//       console.log(`${visitDate.toLocaleTimeString()}: ${page.title}`);
//     });
//   }
// );

let currentTab = null;

function updateURL() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      currentTab = tabs[0];
      console.log("Current tab:", currentTab);
      document.getElementById("url").textContent = currentTab.url;
    } else {
      console.log("No active tab found.");
      document.getElementById("url").textContent = "No active tab found.";
    }
  });
}

updateURL();

chrome.tabs.onActivated.addListener(() => {
  updateURL();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        updateURL();
      }
    });
  }
});
