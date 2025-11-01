let categoryChart = null;

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

function generateDailyAnalysis() {
  const todayDate = getTodayDate();
  console.log("Generating analysis for date:", todayDate);

  chrome.storage.local.get(["pageData"], (result) => {
    console.log("Retrieved pageData:", result.pageData);
    const pageData = result.pageData;

    if (!pageData || !pageData[todayDate]) {
      alert("No browsing data found for today (" + todayDate + ")");
      console.log("No data for:", todayDate);
      return;
    }

    const todayData = pageData[todayDate];

    if (Object.keys(todayData).length === 0) {
      alert("No browsing data found for today (" + todayDate + ")");
      console.log("No data for:", todayDate);
      return;
    }

    console.log("Today's browsing data:", todayData);

    // Process the data
    const analysis = processAnalysisData(todayData);

    console.log("Analysis results:", analysis);

    // Display the chart and stats
    displayChart(analysis);
    displayStats(analysis);

    // Show the chart container
    const chartContainer = document.getElementById("chartContainer");
    console.log("Chart container element:", chartContainer);
    chartContainer.classList.add("visible");
    console.log("Chart container classes:", chartContainer.className);
  });
}

function processAnalysisData(data) {
  const categoryTotals = {};
  const urlDetails = [];
  let totalTime = 0;

  // Process each URL
  Object.entries(data).forEach(([url, details]) => {
    const category = details.category.trim();
    const duration = details.totalDuration || 0;

    // Accumulate time per category
    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }
    categoryTotals[category] += duration;
    totalTime += duration;

    // Store URL details
    urlDetails.push({
      url: url,
      category: category,
      duration: duration,
      summary: details.summaryMedium || "No summary available",
    });
  });

  return {
    categoryTotals,
    urlDetails,
    totalTime,
    totalUrls: urlDetails.length,
  };
}

function displayChart(analysis) {
  console.log("displayChart called with:", analysis);

  const svg = document.getElementById("categoryChart");
  console.log("SVG element:", svg);

  if (!svg) {
    console.error("SVG element not found!");
    return;
  }

  svg.innerHTML = ""; // Clear previous chart

  const categories = Object.keys(analysis.categoryTotals);
  const values = Object.values(analysis.categoryTotals);
  const colors = generateColors(categories.length);

  console.log("Categories:", categories);
  console.log("Values:", values);
  console.log("Colors:", colors);

  const total = values.reduce((sum, val) => sum + val, 0);
  const centerX = 150;
  const centerY = 150;
  const radius = 120;

  // Special case: if there's only one category, draw a full circle
  if (categories.length === 1) {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", centerX);
    circle.setAttribute("cy", centerY);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", colors[0]);
    circle.setAttribute("stroke", "#fff");
    circle.setAttribute("stroke-width", "2");

    svg.appendChild(circle);
    console.log("Drew full circle for single category");

    displayLegend(categories, values, colors, total);
    return;
  }

  let currentAngle = -90; // Start from top

  // Draw pie slices
  categories.forEach((category, index) => {
    const value = values[index];
    const sliceAngle = (value / total) * 360;

    // If this slice is nearly 100%, draw it as a full circle
    if (sliceAngle >= 359.9) {
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", centerX);
      circle.setAttribute("cy", centerY);
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", colors[index]);
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", "2");
      svg.appendChild(circle);
      return;
    }

    const endAngle = currentAngle + sliceAngle;

    console.log(
      `Drawing slice for ${category}: angle ${currentAngle} to ${endAngle}`
    );

    // Calculate path for pie slice
    const startX = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
    const startY = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);
    const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
    const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `Z`,
    ].join(" ");

    console.log("Path data:", pathData);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", colors[index]);
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "2");

    // Add hover effect
    path.style.cursor = "pointer";
    path.addEventListener("mouseenter", function () {
      this.style.opacity = "0.8";
    });
    path.addEventListener("mouseleave", function () {
      this.style.opacity = "1";
    });

    svg.appendChild(path);
    console.log("Path added to SVG");

    currentAngle = endAngle;
  });

  console.log("SVG children count:", svg.children.length);

  // Display legend
  displayLegend(categories, values, colors, total);
}

function displayLegend(categories, values, colors, total) {
  console.log("displayLegend called");
  const legend = document.getElementById("chartLegend");
  console.log("Legend element:", legend);

  legend.innerHTML = "";

  categories.forEach((category, index) => {
    const value = values[index];
    const percentage = ((value / total) * 100).toFixed(1);

    const item = document.createElement("div");
    item.className = "legend-item";

    const colorBox = document.createElement("div");
    colorBox.className = "legend-color";
    colorBox.style.backgroundColor = colors[index];

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = category;

    const valueSpan = document.createElement("span");
    valueSpan.className = "legend-value";
    valueSpan.textContent = `${formatTime(value)} (${percentage}%)`;

    item.appendChild(colorBox);
    item.appendChild(label);
    item.appendChild(valueSpan);
    legend.appendChild(item);
  });

  console.log("Legend items added:", legend.children.length);
}

function displayStats(analysis) {
  console.log("displayStats called");
  const statsSummary = document.getElementById("statsSummary");
  statsSummary.innerHTML = "";

  // Total stats
  const totalStat = document.createElement("div");
  totalStat.className = "stat-item";
  totalStat.innerHTML = `
    <span class="stat-label">Total Time Tracked:</span>
    <span class="stat-value">${formatTime(analysis.totalTime)}</span>
  `;
  statsSummary.appendChild(totalStat);

  const urlsStat = document.createElement("div");
  urlsStat.className = "stat-item";
  urlsStat.innerHTML = `
    <span class="stat-label">Total URLs Visited:</span>
    <span class="stat-value">${analysis.totalUrls}</span>
  `;
  statsSummary.appendChild(urlsStat);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function generateColors(count) {
  const colors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#E74C3C",
    "#3498DB",
    "#2ECC71",
    "#F39C12",
  ];

  // If we need more colors than predefined, generate random ones
  while (colors.length < count) {
    colors.push(`hsl(${Math.random() * 360}, 70%, 60%)`);
  }

  return colors.slice(0, count);
}

// Add button event listener
document.getElementById("addBtn").addEventListener("click", addCategory);

// Add generate analysis button event listener
document
  .getElementById("generateAnalysisBtn")
  .addEventListener("click", generateDailyAnalysis);

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
