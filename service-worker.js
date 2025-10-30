chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;

  // ables the side panel on all other sites
  await chrome.sidePanel.setOptions({
    tabId,
    enabled: false,
  });
});
