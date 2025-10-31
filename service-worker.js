let currentUrl = null;
let currentTabId = null;
let timer = null;

// Helper function to extract website info
async function extractWebsiteInfo(tabId) {
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

        // Helper: get JSON-LD structured data
        const getJSONLD = () => {
          const scripts = [
            ...document.querySelectorAll('script[type="application/ld+json"]'),
          ];
          const data = [];
          for (const s of scripts) {
            try {
              const parsed = JSON.parse(s.textContent.trim());
              if (Array.isArray(parsed)) data.push(...parsed);
              else data.push(parsed);
            } catch (_) {}
          }
          return data;
        };

        // Helper: naive main text extraction
        const getMainText = () => {
          const article =
            document.querySelector("article") ||
            document.querySelector("main") ||
            document.body;
          const clone = article.cloneNode(true);
          // remove scripts, styles, nav, footer, etc.
          clone
            .querySelectorAll(
              "script, style, nav, footer, header, form, aside, noscript"
            )
            .forEach((el) => el.remove());
          let text = clone.innerText.replace(/\s+/g, " ").trim();
          // limit overly long texts
          return text.slice(0, 25000);
        };

        // Construct JSON
        const data = {
          url: location.href,
          canonical_url:
            document.querySelector("link[rel='canonical']")?.href ||
            location.href,
          fetched_at: new Date().toISOString(),
          site_name: getMeta("og:site_name") || location.hostname,
          title: document.title || getMeta("og:title"),
          meta: {
            description: getMeta("description"),
            og_title: getMeta("og:title"),
            og_description: getMeta("og:description"),
            author: getMeta("author"),
            published_time:
              getMeta("article:published_time") || getMeta("og:pubdate"),
            lang: document.documentElement.lang || navigator.language,
          },
          structured_data: getJSONLD(),
          headings: [...document.querySelectorAll("h1, h2, h3")].map((h) => ({
            level: Number(h.tagName[1]),
            text: h.textContent.trim(),
          })),
          main_text: getMainText(),
          media_alts: [...document.querySelectorAll("img[alt]")]
            .slice(0, 10)
            .map((img) => img.alt.trim())
            .filter(Boolean),
        };

        return data;
      },
    });
    return result;
  } catch (error) {
    console.error("Error extracting website info:", error);
    return null;
  }
}

// Function to reset the timer
function resetTimer(url, tabId) {
  // Clear existing timer
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  //   // Don't start timer for chrome://, edge://, about: URLs
  //   if (
  //     !url ||
  //     url.startsWith("chrome://") ||
  //     url.startsWith("edge://") ||
  //     url.startsWith("about:") ||
  //     url.startsWith("chrome-extension://")
  //   ) {
  //     return;
  //   }

  // Store current tab ID
  currentTabId = tabId;

  // Start new 3-second timer
  if (url && tabId) {
    timer = setTimeout(async () => {
      const pageData = await extractWebsiteInfo(tabId);
      if (pageData) {
        addToList(pageData);
      } else {
        console.log("Failed to extract page data, skipping...");
      }
    }, 3000);
  }
}

// Function to add extracted data to list
function addToList(pageData) {
  chrome.storage.local.get(["urlList"], (result) => {
    let urlList = result.urlList || [];
    urlList.push(pageData);

    chrome.storage.local.set({ urlList: urlList }, () => {
      console.log("Page data saved to storage.", pageData);
      console.log("Added to list:", pageData.url);
      console.log("Page title:", pageData.title);
    });
  });
}

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
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
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        currentUrl = tabs[0].url;
        resetTimer(currentUrl, tabs[0].id);
      }
    });
  }
});

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
