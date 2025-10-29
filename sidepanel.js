console.log("heyyy");

// Get all tab groups
chrome.tabGroups.query({}, function (groups) {
  groups.forEach((group) => {
    console.log(`Group: ${group.title}, Color: ${group.color}`);

    // Get tabs in this group
    chrome.tabs.query({ groupId: group.id }, function (tabs) {
      console.log(`Tabs in ${group.title}:`, tabs);
    });
  });
});

// Get ungrouped tabs
chrome.tabs.query(
  { groupId: chrome.tabGroups.TAB_GROUP_ID_NONE },
  function (tabs) {
    console.log("Ungrouped tabs:", tabs);
  }
);
