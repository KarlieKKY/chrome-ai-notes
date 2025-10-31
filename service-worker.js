let currentUrl = null;
let timer = null;

function resetTimer(url) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (url) {
    timer = setTimeout(() => {
      addToList(url);
    }, 3000);
  }
}

// Function to add URL to list
function addToList(url) {
  chrome.storage.local.get(["urlList"], (result) => {
    let urlList = result.urlList || [];
    urlList.push({ url: url });

    chrome.storage.local.set({ urlList: urlList }, () => {
      console.log("Added to list:", url);
      console.log("Current list:", urlList);
    });
  });
}

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      currentUrl = tab.url;
      resetTimer(currentUrl);
    }
  });
});

// Listen for tab updates (when URL changes in current tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Check if this is the active tab
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        currentUrl = changeInfo.url;
        resetTimer(currentUrl);
      }
    });
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        currentUrl = tabs[0].url;
        resetTimer(currentUrl);
      }
    });
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      currentUrl = tabs[0].url;
      resetTimer(currentUrl);
    }
  });
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      currentUrl = tabs[0].url;
      resetTimer(currentUrl);
    }
  });
});
