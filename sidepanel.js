import getStartTime from "./utils/utils.js";

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

const startTime = getStartTime();

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
let timer = null;
let urlList = [];

function resetTimer(url) {
  clearTimer();
  timer = setTimeout(() => {
    addToList(url);
  }, 3000);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function updateURL() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      currentTab = tabs[0];
      console.log("Current tab:", currentTab);
      document.getElementById("url").textContent = currentTab.url;
      resetTimer(currentTab.url);
    } else {
      console.log("No active tab found.");
      document.getElementById("url").textContent = "No active tab found.";
      clearTimer();
    }
  });
}

function addToList(url) {
  urlList.push(url);
  console.log("Added to list:", url);
  console.log("Current list:", urlList);

  updateList();
}

function updateList() {
  const listElement = document.getElementById("list");
  listElement.innerHTML = "";

  urlList.forEach((url, index) => {
    const item = document.createElement("div");
    item.textContent = `${index + 1}. ${url}`;
    item.style.marginBottom = "8px";
    listElement.appendChild(item);
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
