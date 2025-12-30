// Background service worker: open sidepanel when the action (toolbar icon) is clicked.
// This file is for Chrome extension mode and won't be used in VS Code extension
// @ts-nocheck
/// <reference types="chrome"/>

try {
  chrome.runtime.onInstalled.addListener(() => {
    // Set the side panel behavior
    if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    }
  })
} catch (e) {
  console.log("[ClearMetric] Background script error:", e)
}
