import { getStartTime } from "./utils/utils.js";

const startTime = getStartTime();

let urlList = [];

function updateCurrentURL() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      document.getElementById("url").textContent = tabs[0].url;
    } else {
      document.getElementById("url").textContent = "No active tab found.";
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

chrome.tabs.onActivated.addListener(() => {
  updateCurrentURL();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        updateCurrentURL();
      }
    });
  }
});

updateCurrentURL();
loadList();
