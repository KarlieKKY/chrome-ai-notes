import getStartTime from "./utils/utils.js";

const startTime = getStartTime();

let currentTab = null;
let timer = null;
let urlList = JSON.parse(localStorage.getItem("urlList") || "[]");

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
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
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

function loadList() {
  chrome.storage.local.get(["urlList"], (result) => {
    urlList = result.urlList || [];
    updateListDisplay();
  });
}

function updateListDisplay() {
  const listElement = document.getElementById("list");
  listElement.innerHTML = "";

  urlList.forEach((item, index) => {
    const div = document.createElement("div");
    div.textContent = `${index + 1}. ${item.url}`;
    div.style.marginBottom = "8px";
    listElement.appendChild(div);
  });
}

// Listen for storage changes to update the list in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.urlList) {
    urlList = changes.urlList.newValue || [];
    updateListDisplay();
  }
});

updateURL();
loadList();

chrome.tabs.onActivated.addListener(() => {
  updateURL();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        updateURL();
      }
    });
  }
});
