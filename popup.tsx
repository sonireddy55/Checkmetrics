// @ts-nocheck
import React, { useEffect, useState } from "react"

// Chrome extension types
/// <reference types="chrome"/>

const BACKEND_URL = "https://your-vercel-proxy.vercel.app/api/explain" // <-- replace with your backend URL

const SYSTEM_PROMPT = `You are a dashboard explainer. Use ONLY provided text to explain. If data is missing, respond: I cannot verify this. Never guess or calculate new KPIs.`

type Message = { role: "assistant" | "user" | "system"; content: string }

function IndexPopup() {
  const [messages, setMessages] = useState<Message[]>([])
  const [rawText, setRawText] = useState("")
  const [loading, setLoading] = useState(false)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    // optional: listen for window.postMessage events from the content script
    function onWindowMessage(e: MessageEvent) {
      try {
        const data = e.data || {}
        if (data?.type === "CLEARMETRIC_SCRAPED_TEXT") {
          setRawText(data.text || "")
        }
      } catch (err) {
        // ignore
      }
    }

    window.addEventListener("message", onWindowMessage)
    return () => window.removeEventListener("message", onWindowMessage)
  }, [])

  async function analyzeDashboard() {
    setLoading(true)
    setMessages([])
    setRawText("")

    try {
      // ask the active tab to run the content script scraper
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
        const tab = tabs?.[0]
        if (!tab?.id) {
          setMessages([{ role: "system", content: "No active tab found." }])
          setLoading(false)
          return
        }

        chrome.tabs.sendMessage(tab.id!, { type: "CLEARMETRIC_SCRAPE" }, async (response: any) => {
          const scraped = response?.text || ""
          setRawText(scraped)

          if (!scraped) {
            setMessages([{ role: "system", content: "No dashboard text found in .reportContainer." }])
            setLoading(false)
            return
          }

          // show a user message with the scraped text (shortened)
          setMessages([{ role: "user", content: "Analyze dashboard content (redacted)." }])

          // send to backend
          try {
            const res = await fetch(BACKEND_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: scraped, system_prompt: SYSTEM_PROMPT }),
            })

            if (!res.ok) {
              const txt = await res.text()
              setMessages([{ role: "system", content: `Backend error: ${res.status} ${txt}` }])
              setLoading(false)
              return
            }

            const payload = await res.json()
            // assume payload { explanation: string } or { content: string }
            const explanation = payload?.explanation || payload?.content || payload?.result || ""
            if (!explanation) {
              setMessages([{ role: "system", content: "No explanation returned from backend." }])
            } else {
              setMessages([{ role: "assistant", content: explanation }])
            }
          } catch (err: any) {
            setMessages([{ role: "system", content: `Request failed: ${err?.message || err}` }])
          } finally {
            setLoading(false)
          }
        })
      })
    } catch (err: any) {
      setMessages([{ role: "system", content: `Unexpected error: ${err?.message || err}` }])
      setLoading(false)
    }
  }

  return (
    <div className="w-96 max-w-full bg-white text-slate-900 p-4 rounded-lg shadow-md font-sans">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">ClearMetric — Dashboard Explainer</h3>
        <button
          className="text-sm text-slate-500 hover:underline"
          onClick={() => setShowSource((s) => !s)}>
          Source Data
        </button>
      </header>

      <div className="mb-3">
        <button
          className="w-full bg-slate-800 text-white py-2 px-3 rounded hover:bg-slate-700 disabled:opacity-60"
          onClick={analyzeDashboard}
          disabled={loading}
        >
          {loading ? "Analyzing…" : "Analyze Dashboard"}
        </button>
      </div>

      <main className="mb-3">
        <div className="h-56 overflow-auto bg-slate-50 p-3 rounded">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">No analysis yet — click Analyze Dashboard.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 ${m.role === "assistant" ? "text-slate-900" : "text-slate-600"}`}>
              <div className="text-xs font-medium text-slate-400">{m.role}</div>
              <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>
      </main>

      {showSource && (
        <section className="mt-2">
          <h4 className="text-sm font-medium mb-1">Raw scraped text (verify):</h4>
          <pre className="max-h-40 overflow-auto text-xs bg-black text-white p-2 rounded">{rawText || "(no text)"}</pre>
        </section>
      )}

      <footer className="mt-3 text-xs text-slate-400">
        <div>Trust-first: explanations use only the provided text.</div>
      </footer>
    </div>
  )
}

export default IndexPopup
