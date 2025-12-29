// Background service worker: open sidepanel when the action (toolbar icon) is clicked.

chrome.runtime.onInstalled.addListener(() => {
  // Set the side panel behavior
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
})
