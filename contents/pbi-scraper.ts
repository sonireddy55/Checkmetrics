import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://app.powerbi.com/*",
    "https://playground.powerbi.com/*",
    "https://microsoft.github.io/*",
    "https://*.powerbi.com/*",
    "<all_urls>"
  ],
  run_at: "document_idle"
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CLEARMETRIC_SCRAPE") {
    let reportText = ""

    // Try multiple selectors to find dashboard content
    const selectors = [
      ".reportContainer",
      ".report-canvas",
      "[data-testid='report-page']",
      ".visualContainer",
      ".exploration",
      "iframe.report-embed",
      "iframe[title*='Power']",
      "iframe[src*='powerbi']"
    ]

    // First, try to find text directly in the page
    for (const selector of selectors) {
      if (selector.startsWith("iframe")) {
        // Try to access iframe content
        const iframe = document.querySelector(selector) as HTMLIFrameElement
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
            if (iframeDoc) {
              const content = iframeDoc.body?.innerText || ""
              if (content.length > 50) {
                reportText = content
                break
              }
            }
          } catch (e) {
            // Cross-origin iframe, can't access
            console.log("[ClearMetric] Cannot access iframe (cross-origin)")
          }
        }
      } else {
        const el = document.querySelector(selector) as HTMLElement
        if (el?.innerText && el.innerText.length > 50) {
          reportText = el.innerText
          break
        }
      }
    }

    // Fallback: grab all visible text from the page body
    if (!reportText || reportText.length < 50) {
      const bodyText = document.body?.innerText || ""
      if (bodyText.length > 100) {
        reportText = bodyText.substring(0, 10000) // Limit to first 10k chars
      }
    }

    console.log("[ClearMetric] Scraped content length:", reportText.length)
    sendResponse({ text: reportText.trim() })
  }
  return true
})