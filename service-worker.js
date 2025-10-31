let currentUrl = null;
let currentTabId = null;
let timer = null;

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

// Function to reset the timer
function resetTimer(url, tabId) {
  // Clear existing timer
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  // Don't start timer for chrome://, edge://, about: URLs
  if (
    !url ||
    url.startsWith("chrome://") ||
    // url.startsWith("edge://") ||
    // url.startsWith("about:") ||
    url.startsWith("chrome-extension://")
  ) {
    return;
  }

  // Store current tab ID
  currentTabId = tabId;

  // Start new 3-second timer
  if (url && tabId) {
    timer = setTimeout(async () => {
      const pageData = await extractContentForLLM(tabId);
      if (pageData) {
        const stringifyObj = JSON.stringify(pageData);
        const result = await summarizeContent(stringifyObj);

        // Add summary to page data
        pageData.ai_summary = result.summary || "";
        pageData.ai_tag_category = result.category || "";
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
      console.log("AI Summary:", pageData.ai_summary);
      console.log("AI Category:", pageData.ai_tag_category);
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
