// @ts-nocheck
import React, { useState, useEffect } from "react"
import "./style.css"

/// <reference types="chrome"/>

const BACKEND_URL = "https://checkmetrics-rbpp.vercel.app/api/explain"

// Usage limits - optimized for conversion
const FREE_ANALYSES_LIMIT = 10
const FREE_FOLLOWUPS_LIMIT = 3 // TOTAL lifetime, not monthly

interface UserState {
  isPro: boolean
  analysesThisMonth: number
  followUpsUsed: number
  usageResetDate: string
  licenseKey?: string
}

function getNextMonthFirstDay(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
}

const defaultUserState: UserState = {
  isPro: false,
  analysesThisMonth: 0,
  followUpsUsed: 0,
  usageResetDate: getNextMonthFirstDay()
}

function SidePanel() {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [rawText, setRawText] = useState("")
  const [showProvenance, setShowProvenance] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState("")
  const [userState, setUserState] = useState<UserState>(defaultUserState)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showLicenseInput, setShowLicenseInput] = useState(false)
  const [licenseKey, setLicenseKey] = useState("")
  const [licenseError, setLicenseError] = useState("")

  // Load user state on mount
  useEffect(() => {
    chrome.storage.sync.get(['clearmetric_user'], (result) => {
      if (result.clearmetric_user) {
        const stored = result.clearmetric_user as UserState
        // Check if we need to reset monthly usage (analyses only, NOT follow-ups)
        if (new Date(stored.usageResetDate) <= new Date()) {
          const updated = {
            ...stored,
            analysesThisMonth: 0,
            // followUpsUsed is LIFETIME - don't reset
            usageResetDate: getNextMonthFirstDay()
          }
          chrome.storage.sync.set({ clearmetric_user: updated })
          setUserState(updated)
        } else {
          setUserState(stored)
        }
      } else {
        chrome.storage.sync.set({ clearmetric_user: defaultUserState })
      }
    })
  }, [])

  // Save user state when it changes
  const updateUserState = (updates: Partial<UserState>) => {
    const newState = { ...userState, ...updates }
    setUserState(newState)
    chrome.storage.sync.set({ clearmetric_user: newState })
  }

  const analysesLeft = FREE_ANALYSES_LIMIT - userState.analysesThisMonth
  const followUpsLeft = FREE_FOLLOWUPS_LIMIT - userState.followUpsUsed
  const usagePercent = (analysesLeft / FREE_ANALYSES_LIMIT) * 100

  const canUseFeature = (feature: 'trends' | 'drivers' | 'anomalies' | 'followup' | 'source'): boolean => {
    if (userState.isPro) return true
    // Free tier: only "What changed?" available, Key Drivers & Spot Issues are PRO
    if (feature === 'trends') return analysesLeft > 0
    if (feature === 'followup') return followUpsLeft > 0
    return false // drivers, anomalies, source are PRO only
  }

  const handleFeatureClick = (feature: 'trends' | 'drivers' | 'anomalies', actionType: string) => {
    if (!canUseFeature(feature)) {
      setShowUpgradeModal(true)
      return
    }
    analyzeDashboard(actionType)
  }

  const validateLicenseKey = async () => {
    setLicenseError("")
    if (licenseKey.startsWith("CM-PRO-") && licenseKey.length >= 15) {
      updateUserState({ isPro: true, licenseKey })
      setShowLicenseInput(false)
      setShowUpgradeModal(false)
    } else {
      setLicenseError("Invalid license key")
    }
  }

  async function analyzeDashboard(actionType?: string) {
    // Check limits
    if (!userState.isPro) {
      if (actionType === 'custom' && followUpsLeft <= 0) {
        setShowUpgradeModal(true)
        return
      }
      if (actionType !== 'custom' && analysesLeft <= 0) {
        setShowUpgradeModal(true)
        return
      }
    }

    setLoading(true)
    setExplanation("")
    setError(null)
    setRawText("")

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
        const tab = tabs?.[0]
        if (!tab?.id) {
          setError("No active tab found")
          setLoading(false)
          return
        }

        chrome.tabs.sendMessage(tab.id, { type: "CLEARMETRIC_SCRAPE" }, async (resp: any) => {
          const scraped = resp?.text || ""
          setRawText(scraped)

          if (!scraped) {
            setError("No dashboard text found. Make sure you're on a Power BI report page.")
            setLoading(false)
            return
          }

          try {
            const r = await fetch(BACKEND_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                text: scraped,
                analysisType: actionType || 'custom',
                customQuestion: actionType === 'custom' ? followUp : undefined
              }),
            })

            const json = await r.json()
            if (!r.ok) {
              setError(json?.error || `Backend error ${r.status}`)
              setLoading(false)
              return
            }

            if (json?.success && json?.result) {
              const result = json.result
              setExplanation(result.explanation || JSON.stringify(result))
              
              // Increment usage after success
              if (!userState.isPro) {
                if (actionType === 'custom') {
                  updateUserState({ followUpsUsed: userState.followUpsUsed + 1 })
                } else {
                  updateUserState({ analysesThisMonth: userState.analysesThisMonth + 1 })
                }
              }
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

  // PRO Badge Component
  const ProBadge = ({ small = false }: { small?: boolean }) => (
    <span className={`bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold rounded ${small ? 'text-[8px] px-1' : 'text-[9px] px-1.5 py-0.5'}`}>
      PRO
    </span>
  )

  // Lock Icon Component
  const LockIcon = () => (
    <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )

  return (
    <div className="w-full h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg px-4 py-3 border-b border-white/5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-base font-semibold text-white m-0">ClearMetric</h1>
            <p className="text-[10px] text-gray-500 m-0 mt-1">AI Dashboard Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            {userState.isPro ? (
              <ProBadge />
            ) : (
              <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">FREE</span>
            )}
          </div>
        </div>
      </div>

      {/* Usage Bar - Only show for free users */}
      {!userState.isPro && (
        <div className="px-4 py-2 bg-black/10 border-b border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-400">{analysesLeft} of {FREE_ANALYSES_LIMIT} analyses left</span>
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-medium"
            >
              Upgrade →
            </button>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                usagePercent > 70 ? 'bg-green-500' : usagePercent > 30 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        
        {/* Quick Actions - Show when no results */}
        {!explanation && !error && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Quick Analysis</p>
            
            {/* What Changed - FREE */}
            <button
              onClick={() => handleFeatureClick('trends', 'trends')}
              disabled={loading}
              className="group flex items-center gap-3 p-3 w-full text-left bg-white/5 hover:bg-white/10 active:scale-[0.99] border border-white/10 hover:border-blue-500/30 backdrop-blur-md rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:text-blue-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="block text-sm font-medium text-gray-200 group-hover:text-white">What changed?</span>
                <span className="text-[10px] text-gray-500 group-hover:text-gray-400">Analyze trends vs. last period</span>
              </div>
              {!userState.isPro && analysesLeft <= 0 && <LockIcon />}
            </button>

            {/* Key Drivers - PRO ONLY */}
            <button
              onClick={() => handleFeatureClick('drivers', 'drivers')}
              disabled={loading}
              className={`group flex items-center gap-3 p-3 w-full text-left bg-white/5 hover:bg-white/10 active:scale-[0.99] border backdrop-blur-md rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                !userState.isPro ? 'border-amber-500/20 opacity-60' : 'border-white/10 hover:border-purple-500/30'
              }`}
            >
              <div className={`p-2 bg-purple-500/20 rounded-lg transition-colors ${!userState.isPro ? 'text-purple-400/50' : 'text-purple-400 group-hover:text-purple-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${!userState.isPro ? 'text-gray-400' : 'text-gray-200 group-hover:text-white'}`}>Key Drivers</span>
                  {!userState.isPro && <ProBadge small />}
                </div>
                <span className={`text-[10px] ${!userState.isPro ? 'text-gray-600' : 'text-gray-500 group-hover:text-gray-400'}`}>Find what impacts key metrics</span>
              </div>
              {!userState.isPro && <LockIcon />}
            </button>

            {/* Spot Issues - PRO ONLY */}
            <button
              onClick={() => handleFeatureClick('anomalies', 'anomalies')}
              disabled={loading}
              className={`group flex items-center gap-3 p-3 w-full text-left bg-white/5 hover:bg-white/10 active:scale-[0.99] border backdrop-blur-md rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                !userState.isPro ? 'border-amber-500/20 opacity-60' : 'border-white/10 hover:border-red-500/30'
              }`}
            >
              <div className={`p-2 bg-red-500/20 rounded-lg transition-colors ${!userState.isPro ? 'text-red-400/50' : 'text-red-400 group-hover:text-red-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${!userState.isPro ? 'text-gray-400' : 'text-gray-200 group-hover:text-white'}`}>Spot Issues</span>
                  {!userState.isPro && <ProBadge small />}
                </div>
                <span className={`text-[10px] ${!userState.isPro ? 'text-gray-600' : 'text-gray-500 group-hover:text-gray-400'}`}>Find data anomalies</span>
              </div>
              {!userState.isPro && <LockIcon />}
            </button>

            {/* Privacy Badge */}
            <div className="flex items-center justify-center gap-2 mt-4 px-3 py-2 bg-green-500/5 border border-green-500/20 rounded-lg">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[11px] text-green-400/80 font-medium">Analyzes visible data only. Privacy protected.</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <span className="text-sm text-gray-400">Analyzing dashboard...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-300 m-0">{error}</p>
            </div>
          </div>
        )}

        {/* Explanation Display */}
        {explanation && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-xs">🤖</span>
                <span className="text-xs text-blue-400 font-medium">ClearMetric AI</span>
              </div>
              <button
                onClick={() => {
                  if (!userState.isPro) {
                    setShowUpgradeModal(true)
                    return
                  }
                  navigator.clipboard.writeText(explanation)
                }}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                {!userState.isPro && <LockIcon />}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            <p className="text-sm text-gray-200 m-0 whitespace-pre-wrap leading-relaxed">{explanation}</p>
          </div>
        )}

        {/* Provenance Display */}
        {showProvenance && rawText && (
          <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 m-0">📄 Source Data</p>
            <pre className="text-[10px] text-blue-300 m-0 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">{rawText}</pre>
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="border-t border-white/5 bg-black/20 backdrop-blur-lg p-4">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && followUp.trim() && analyzeDashboard('custom')}
            placeholder="Ask a follow-up question..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            onClick={() => followUp.trim() && analyzeDashboard('custom')}
            disabled={!followUp.trim() || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            ➤
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label 
            className={`flex items-center gap-2 text-xs cursor-pointer ${
              !userState.isPro ? 'text-gray-600' : 'text-gray-500'
            }`}
            onClick={() => !userState.isPro && setShowUpgradeModal(true)}
          >
            <input
              type="checkbox"
              checked={showProvenance}
              onChange={(e) => userState.isPro && setShowProvenance(e.target.checked)}
              disabled={!userState.isPro}
              className="accent-blue-500"
            />
            Show Source Data
            {!userState.isPro && <ProBadge small />}
          </label>
          
          {!userState.isPro && (
            <span className="text-[10px] text-gray-500">
              {followUpsLeft > 0 ? `${followUpsLeft} follow-ups left` : '0 follow-ups left'}
            </span>
          )}
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Upgrade to Pro</h2>
                <p className="text-xs text-gray-400 mt-1">Unlock all features</p>
              </div>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                'Unlimited "What changed?" analyses',
                'Unlock Key Drivers analysis',
                'Unlock Spot Issues detection',
                'Unlimited follow-up questions',
                'Export & copy results',
                'View source data'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="space-y-2 mb-4">
              <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold rounded-lg hover:opacity-90 transition-opacity">
                $20/month
              </button>
              <button className="w-full py-3 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors">
                $150/year <span className="text-green-400 text-xs">(Save 37%)</span>
              </button>
            </div>

            <div className="text-center">
              <button 
                onClick={() => setShowLicenseInput(!showLicenseInput)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Have a license key?
              </button>
            </div>

            {showLicenseInput && (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="CM-PRO-XXXXXXXXXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
                {licenseError && <p className="text-xs text-red-400">{licenseError}</p>}
                <button 
                  onClick={validateLicenseKey}
                  className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Activate License
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SidePanel
