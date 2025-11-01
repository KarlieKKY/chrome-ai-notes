let currentUrl = null;
let currentTabId = null;
let timer = null;
let pageStartTime = null;

// Active time tracking variables
let activeTime = 0;
let lastActiveTimestamp = null;
let isActive = false;

// Helper function to summarize content
async function summarizeContent(text) {
  try {
    const summarizerAvailability = await Summarizer.availability();
    const languageModelAvailability = await LanguageModel.availability();

    if (summarizerAvailability === "unavailable") {
      // The Summarizer API isn't usable.
      return;
    }

    const tldr_medium_summarizer = await Summarizer.create({
      sharedContext: "This is the content of a website",
      type: "tldr",
      length: "medium",
    });

    const params = await LanguageModel.params();
    const languageModelSession = await LanguageModel.create({
      temperature: 0,
      topK: params.defaultTopK,
    });

    const summary = await tldr_medium_summarizer.summarize(text);
    const prompt = await languageModelSession.prompt([
      {
        role: "user",
        content:
          "The following text delimited by triple backticks is a summary of a website: ```" +
          summary +
          "``` Your task is to classify the website into the most matching category from one in the list below:\n\n" +
          "/Entertainment\n" +
          "/Gaming\n" +
          "/Adult\n" +
          "/Education\n" +
          "/Coffee\n\n" +
          "Return ONLY the matching category itself",
      },
    ]);

    return {
      summary: summary,
      category: prompt,
    };
  } catch (error) {
    console.error("Error during summarization:", error);
    return null;
  }
}

function getTodayDate() {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to extract website info for LLM processing
async function extractContentForLLM(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Helper: get meta by name or property
        const getMeta = (key) => {
          const el =
            document.querySelector(`meta[name='${key}']`) ||
            document.querySelector(`meta[property='${key}']`);
          return el ? el.content.trim() : null;
        };

        // Extract clean main content text
        const extractMainContent = () => {
          // Try to find main content container
          let mainContent =
            document.querySelector("main") ||
            document.querySelector("article") ||
            document.querySelector('[role="main"]') ||
            document.body;

          // Clone to avoid modifying the actual page
          const clone = mainContent.cloneNode(true);

          // Remove unwanted elements
          const unwantedSelectors = [
            "script",
            "style",
            "nav",
            "header",
            "footer",
            "aside",
            "iframe",
            "noscript",
            "form",
            ".ad",
            ".advertisement",
            ".social-share",
            ".comments",
            '[role="navigation"]',
            '[role="banner"]',
            '[role="complementary"]',
          ];

          unwantedSelectors.forEach((selector) => {
            clone.querySelectorAll(selector).forEach((el) => el.remove());
          });

          // Extract text content
          let text = clone.innerText || clone.textContent;

          // Clean up whitespace
          text = text
            .replace(/\s+/g, " ")
            .replace(/\n\s*\n/g, "\n")
            .trim();

          // Limit to reasonable size (adjust as needed)
          return text.slice(0, 50000);
        };

        // Construct data object
        const data = {
          url: location.href,
          canonical_url:
            document.querySelector("link[rel='canonical']")?.href ||
            location.href,
          fetched_at: new Date().toISOString(),
          site_name: getMeta("og:site_name") || location.hostname,
          title: document.title || getMeta("og:title"),
          description: getMeta("description") || getMeta("og:description"),
          author: getMeta("author"),
          published_time:
            getMeta("article:published_time") || getMeta("og:pubdate"),
          lang: document.documentElement.lang || navigator.language,

          // Main content for LLM
          main_content: extractMainContent(),

          // Additional context (useful for classification/retrieval)
          headings: [...document.querySelectorAll("h1, h2, h3")].map((h) => ({
            level: Number(h.tagName[1]),
            text: h.textContent.trim(),
          })),

          // Optional: keep first few image alts for context
          image_alts: [...document.querySelectorAll("img[alt]")]
            .slice(0, 5)
            .map((img) => img.alt.trim())
            .filter(Boolean),
        };

        return data;
      },
    });
    return result;
  } catch (error) {
    console.error("Error extracting content:", error);
    return null;
  }
}

function updateActiveState(tabId) {
  if (tabId !== currentTabId) return;

  chrome.tabs.get(tabId, (tab) => {
    if (!tab) return;

    chrome.windows.get(tab.windowId, (window) => {
      const newIsActive = tab.active && window.focused;

      if (newIsActive && !isActive) {
        // Became active
        lastActiveTimestamp = Date.now();
        isActive = true;
        console.log("✅ Tab became active");
      } else if (!newIsActive && isActive) {
        if (lastActiveTimestamp) {
          const sessionTime = Date.now() - lastActiveTimestamp;
          activeTime += sessionTime;
          console.log(
            `Session time: ${sessionTime}ms, Total active: ${activeTime}ms`
          );
        }
        isActive = false;
        lastActiveTimestamp = null;
      }
    });
  });
}

// Helper to save current page's active time to storage
async function saveCurrentPageActiveTime() {
  if (!currentUrl || activeTime === 0) return;

  let finalActiveTime = activeTime;
  if (isActive && lastActiveTimestamp) {
    finalActiveTime += Date.now() - lastActiveTimestamp;
  }

  const todayDate = getTodayDate();
  const result = await chrome.storage.local.get(["pageData"]);
  let pageData = result.pageData || {};

  if (!pageData[todayDate]) {
    pageData[todayDate] = {};
  }

  // If page exists, update its totalDuration
  if (pageData[todayDate][currentUrl]) {
    const additionalTime = Math.round(finalActiveTime / 1000);
    pageData[todayDate][currentUrl].totalDuration += additionalTime;
    await chrome.storage.local.set({ pageData: pageData });
    console.log(
      `💾 Updated active time for ${currentUrl}: +${additionalTime}s`
    );
  }
}

// Function to reset the timer
function resetTimer(url, tabId) {
  // Save previous page's active time before resetting
  if (currentUrl && currentTabId && activeTime > 0) {
    saveCurrentPageActiveTime();
  }

  // Reset active time tracking for new page
  activeTime = 0;
  lastActiveTimestamp = null;
  isActive = false;

  // Clear existing timer
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (
    !url ||
    url.startsWith("chrome://") ||
    // url.startsWith("edge://") ||
    // url.startsWith("about:") ||
    url.startsWith("chrome-extension://")
  ) {
    currentUrl = url;
    currentTabId = tabId;
    return;
  }

  // Record the start time when user lands on a new page
  pageStartTime = Date.now();

  // Store current tab ID and URL
  currentTabId = tabId;
  currentUrl = url;

  // Start tracking active state for this tab
  updateActiveState(tabId);

  // Start new 3-second timer
  if (url && tabId) {
    timer = setTimeout(async () => {
      const pageData = await extractContentForLLM(tabId);
      if (pageData) {
        // Get final active time
        let finalActiveTime = activeTime;
        if (isActive && lastActiveTimestamp) {
          finalActiveTime += Date.now() - lastActiveTimestamp;
        }
        const timeSpent = finalActiveTime / 1000; // Convert to seconds

        const stringifyObj = JSON.stringify(pageData);
        const result = await summarizeContent(stringifyObj);

        if (result) {
          await addToList(
            pageData.url,
            timeSpent,
            result.summary,
            result.category
          );
        }
      } else {
        console.log("Failed to extract page data, skipping...");
      }
    }, 3000);
  }
}

// Updated function to add extracted data to list with new structure
async function addToList(url, totalDuration, summary, category) {
  try {
    const todayDate = getTodayDate();
    const createdAt = Date.now() / 1000; // Current timestamp in seconds

    // Create page data object
    const pageInfo = {
      createdAt: createdAt,
      totalDuration: Math.round(totalDuration), // Round to nearest second
      category: category.toLowerCase().replace("/", ""),
      summaryMedium: summary,
    };

    // Get existing data from storage
    const result = await chrome.storage.local.get(["pageData"]);
    let pageData = result.pageData || {};

    // Initialize today's date if it doesn't exist
    if (!pageData[todayDate]) {
      pageData[todayDate] = {};
    }

    // Add the new page data under today's date
    pageData[todayDate][url] = pageInfo;

    // Save back to storage
    await chrome.storage.local.set({ pageData: pageData });

    console.log("📊 Page data saved to storage:", pageData);
  } catch (error) {
    console.error("Error saving page data:", error);
  }
}

// Function to retrieve page data for a specific date
async function getPageDataByDate(date) {
  const result = await chrome.storage.local.get(["pageData"]);
  const pageData = result.pageData || {};
  return pageData[date] || {};
}

// Function to retrieve all page data
async function getAllPageData() {
  const result = await chrome.storage.local.get(["pageData"]);
  return result.pageData || {};
}

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Save previous page's time
  if (currentUrl && currentTabId && activeTime > 0) {
    saveCurrentPageActiveTime();
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      currentUrl = tab.url;
      resetTimer(currentUrl, activeInfo.tabId);
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
        resetTimer(currentUrl, tabId);
      }
    });
  }

  // Also track when tab becomes active/inactive
  if (changeInfo.status === "complete" && tabId === currentTabId) {
    updateActiveState(tabId);
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  // Update active state when window focus changes
  if (currentTabId) {
    updateActiveState(currentTabId);
  }

  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        currentUrl = tabs[0].url;
        resetTimer(currentUrl, tabs[0].id);
      }
    });
  }
});

// Periodic save every 10 seconds to prevent data loss
setInterval(() => {
  if (isActive && currentUrl && activeTime > 0) {
    saveCurrentPageActiveTime();
    // Reset activeTime after saving to avoid double-counting
    activeTime = 0;
    lastActiveTimestamp = Date.now();
  }
}, 10000);

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      currentUrl = tabs[0].url;
      resetTimer(currentUrl, tabs[0].id);
    }
  });
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      currentUrl = tabs[0].url;
      resetTimer(currentUrl, tabs[0].id);
    }
  });
});
