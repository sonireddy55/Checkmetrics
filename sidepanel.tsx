import React, { useState } from "react"

const BACKEND_URL = "https://your-vercel-proxy.vercel.app/api/explain" // replace with deployed endpoint

function SidePanel() {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [rawText, setRawText] = useState("")
  const [showProvenance, setShowProvenance] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState("")

  async function analyzeDashboard() {
    setLoading(true)
    setExplanation("")
    setError(null)
    setRawText("")

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0]
        if (!tab?.id) {
          setError("No active tab found")
          setLoading(false)
          return
        }

        chrome.tabs.sendMessage(tab.id, { type: "CLEARMETRIC_SCRAPE" }, async (resp) => {
          const scraped = resp?.text || ""
          setRawText(scraped)

          if (!scraped) {
            setError("No dashboard text found. Make sure you're on a Power BI report page with a visible dashboard.")
            setLoading(false)
            return
          }

          try {
            const r = await fetch(BACKEND_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: scraped }),
            })

            const json = await r.json()
            if (!r.ok) {
              setError(json?.error || `Backend error ${r.status}`)
              setLoading(false)
              return
            }

            if (json?.success && json?.result) {
              const result = json.result
              const out = result.explanation || JSON.stringify(result)
              setExplanation(out)
            } else if (json?.success === false && json?.raw) {
              setError("Model did not return valid JSON. See raw output.")
              setExplanation(json.raw || "")
            } else {
              setError("Unexpected response from backend")
            }
          } catch (err: any) {
            setError(err?.message || String(err))
          } finally {
            setLoading(false)
          }
        })
      })
    } catch (err: any) {
      setError(err?.message || String(err))
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100%",
      backgroundColor: "#1e1e1e",
      color: "#cccccc",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid #333",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#fff" }}>ClearMetric</h1>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#858585" }}>Dashboard Explainer</p>
        </div>
        <span style={{
          fontSize: "10px",
          backgroundColor: "#0e639c",
          padding: "4px 8px",
          borderRadius: "4px",
          color: "#fff"
        }}>BETA</span>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        {!explanation && !error && (
          <div style={{
            backgroundColor: "#252526",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #333"
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#858585" }}>
              👋 Welcome! Click <strong style={{ color: "#9cdcfe" }}>Analyze Dashboard</strong> to get an AI-powered explanation of the current Power BI report.
            </p>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: "#3a1d1d",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #5a2a2a"
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#f48771" }}>⚠️ {error}</p>
          </div>
        )}

        {explanation && (
          <div style={{
            backgroundColor: "#252526",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #333"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{
                width: "24px",
                height: "24px",
                backgroundColor: "#0e639c",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px"
              }}>🤖</span>
              <span style={{ fontSize: "12px", color: "#9cdcfe", fontWeight: 500 }}>ClearMetric AI</span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{explanation}</p>
          </div>
        )}

        {showProvenance && rawText && (
          <div style={{
            backgroundColor: "#0d0d0d",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #333"
          }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#858585", textTransform: "uppercase", letterSpacing: "0.5px" }}>📄 Source Data (Provenance)</p>
            <pre style={{
              margin: 0,
              fontSize: "11px",
              color: "#9cdcfe",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "150px",
              overflowY: "auto",
              fontFamily: "monospace"
            }}>{rawText}</pre>
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div style={{
        padding: "16px",
        borderTop: "1px solid #333",
        backgroundColor: "#252526"
      }}>
        {/* Analyze Button */}
        <button
          onClick={analyzeDashboard}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#1e4a6e" : "#0e639c",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "12px",
            transition: "background-color 0.2s"
          }}
        >
          {loading ? "⏳ Analyzing..." : "🔍 Analyze Dashboard"}
        </button>

        {/* Chat Input */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px"
        }}>
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a follow-up question..."
            style={{
              flex: 1,
              padding: "10px 12px",
              backgroundColor: "#3c3c3c",
              border: "1px solid #4a4a4a",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "13px",
              outline: "none"
            }}
          />
          <button
            style={{
              padding: "10px 16px",
              backgroundColor: "#0e639c",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            ➤
          </button>
        </div>

        {/* Footer Options */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "#858585"
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showProvenance}
              onChange={(e) => setShowProvenance(e.target.checked)}
              style={{ accentColor: "#0e639c" }}
            />
            Show Source Data
          </label>
        </div>
      </div>
    </div>
  )
}

export default SidePanel
