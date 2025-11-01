function updateCurrentURL() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      document.getElementById("url").textContent = tabs[0].url;
    } else {
      document.getElementById("url").textContent = "No active tab found.";
    }
  });
}

function getTodayDate() {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

function loadList() {
  chrome.storage.local.get(["categories"], (result) => {
    updateListDisplay(result.categories || []);
  });
}

function updateListDisplay(categories) {
  const listElement = document.getElementById("list");
  listElement.innerHTML = "";

  if (categories.length === 0) {
    listElement.innerHTML = `<p class="no-category">No categories added yet.</p>`;
    return;
  }

  // Create a card for each category
  categories.forEach((category, index) => {
    const card = document.createElement("div");
    card.className = "card";

    const cardContent = document.createElement("div");
    cardContent.className = "card-content";

    const categoryName = document.createElement("div");
    categoryName.className = "card-category";
    categoryName.textContent = category;
    cardContent.appendChild(categoryName);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteCategory(index));

    card.appendChild(cardContent);
    card.appendChild(deleteBtn);
    listElement.appendChild(card);
  });
}

function addCategory() {
  const categoryInput = document.getElementById("categoryInput");
  const newCategory = categoryInput.value.trim();

  if (!newCategory) {
    alert("Please enter a category name");
    return;
  }

  chrome.storage.local.get(["categories"], (result) => {
    const categories = result.categories || [];

    // Check if category already exists
    if (categories.includes(newCategory)) {
      alert("Category already exists");
      return;
    }

    // Add new category to array
    categories.push(newCategory);

    // Save to storage
    chrome.storage.local.set({ categories: categories }, () => {
      console.log("Category added:", newCategory);
      categoryInput.value = ""; // Clear input
      loadList(); // Refresh display
    });
  });
}

function deleteCategory(index) {
  chrome.storage.local.get(["categories"], (result) => {
    const categories = result.categories || [];

    // Remove category at index
    categories.splice(index, 1);

    // Save to storage
    chrome.storage.local.set({ categories: categories }, () => {
      console.log("Category deleted at index:", index);
      loadList(); // Refresh display
    });
  });
}

// Add button event listener
document.getElementById("addBtn").addEventListener("click", addCategory);

// Allow Enter key to add category
document.getElementById("categoryInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addCategory();
  }
});

// Listen for storage changes to update the list in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.categories) {
    loadList();
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
