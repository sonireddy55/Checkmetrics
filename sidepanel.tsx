// @ts-nocheck
import React, { useState, useEffect } from "react"
import { TrendingUp, Target, AlertTriangle, ChevronRight, X, Check, ExternalLink, RefreshCw, Shield, Copy, Settings, LogOut, User, Zap } from "lucide-react"
import "./style.css"

/// <reference types="chrome"/>

const BACKEND_URL = "https://clearmetric-api.vercel.app/api/analyze"

// Usage limits
const FREE_ANALYSES_LIMIT = 10
const FREE_FOLLOWUPS_LIMIT = 3

interface UserState {
  isPro: boolean
  analysesThisMonth: number
  followUpsUsed: number
  usageResetDate: string
  email?: string
  userId?: string
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
  const [showSource, setShowSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState("")
  const [userState, setUserState] = useState<UserState>(defaultUserState)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isOnPowerBI, setIsOnPowerBI] = useState<boolean | null>(null)
  const [checkingTab, setCheckingTab] = useState(true)
  const [copied, setCopied] = useState(false)

  // Check if on Power BI
  const checkIfOnPowerBI = async () => {
    setCheckingTab(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const onPowerBI = tab?.url?.includes('powerbi.com') || false
      setIsOnPowerBI(onPowerBI)
    } catch (err) {
      setIsOnPowerBI(false)
    }
    setCheckingTab(false)
  }

  useEffect(() => {
    checkIfOnPowerBI()
  }, [])

  useEffect(() => {
    chrome.storage.sync.get(['clearmetric_user'], (result) => {
      if (result.clearmetric_user) {
        const stored = result.clearmetric_user as UserState
        if (new Date(stored.usageResetDate) <= new Date()) {
          const updated = { ...stored, analysesThisMonth: 0, usageResetDate: getNextMonthFirstDay() }
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

  const updateUserState = (updates: Partial<UserState>) => {
    const newState = { ...userState, ...updates }
    setUserState(newState)
    chrome.storage.sync.set({ clearmetric_user: newState })
  }

  const analysesLeft = FREE_ANALYSES_LIMIT - userState.analysesThisMonth
  const followUpsLeft = FREE_FOLLOWUPS_LIMIT - userState.followUpsUsed

  const canUseFeature = (feature: 'trends' | 'drivers' | 'anomalies' | 'followup'): boolean => {
    if (userState.isPro) return true
    if (feature === 'trends') return analysesLeft > 0
    if (feature === 'followup') return followUpsLeft > 0
    return false
  }

  const handleFeatureClick = (feature: 'trends' | 'drivers' | 'anomalies', actionType: string) => {
    if (!canUseFeature(feature)) {
      setShowUpgradeModal(true)
      return
    }
    analyzeDashboard(actionType)
  }

  async function analyzeDashboard(actionType?: string) {
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
            setError("No dashboard data found. Make sure you're viewing a Power BI report.")
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
              setError(json?.error || `Error ${r.status}`)
              setLoading(false)
              return
            }

            if (json?.success && json?.result) {
              setExplanation(json.result.explanation || JSON.stringify(json.result))
              if (!userState.isPro) {
                if (actionType === 'custom') {
                  updateUserState({ followUpsUsed: userState.followUpsUsed + 1 })
                } else {
                  updateUserState({ analysesThisMonth: userState.analysesThisMonth + 1 })
                }
              }
            } else {
              setError("Unexpected response")
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

  const copyToClipboard = async () => {
    if (!userState.isPro) {
      setShowUpgradeModal(true)
      return
    }
    await navigator.clipboard.writeText(explanation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearResults = () => {
    setExplanation("")
    setRawText("")
    setError(null)
    setFollowUp("")
  }

  // Loading state
  if (checkingTab) {
    return (
      <div className="cm-container">
        <div className="cm-loading-screen">
          <div className="cm-spinner" />
        </div>
      </div>
    )
  }

  // Not on Power BI
  if (!isOnPowerBI) {
    return (
      <div className="cm-container">
        <Header userState={userState} onSettingsClick={() => setShowSettings(true)} />
        <div className="cm-error-screen">
          <div className="cm-error-icon">
            <AlertTriangle size={32} />
          </div>
          <h2>No Dashboard Detected</h2>
          <p>Open a Power BI report to analyze your data.</p>
          <div className="cm-error-actions">
            <button className="cm-btn cm-btn-primary" onClick={() => chrome.tabs.create({ url: 'https://app.powerbi.com' })}>
              <ExternalLink size={16} />
              Open Power BI
            </button>
            <button className="cm-btn cm-btn-secondary" onClick={checkIfOnPowerBI}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Main UI
  return (
    <div className="cm-container">
      <Header userState={userState} onSettingsClick={() => setShowSettings(true)} />

      {/* Usage bar for free users */}
      {!userState.isPro && (
        <div className="cm-usage-bar">
          <div className="cm-usage-info">
            <span>{analysesLeft} of {FREE_ANALYSES_LIMIT} analyses remaining</span>
            <button className="cm-upgrade-link" onClick={() => setShowUpgradeModal(true)}>
              Upgrade
            </button>
          </div>
          <div className="cm-usage-track">
            <div className="cm-usage-fill" style={{ width: `${(analysesLeft / FREE_ANALYSES_LIMIT) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="cm-content">
        {/* Analysis buttons - show when no results */}
        {!explanation && !error && !loading && (
          <div className="cm-analysis-section">
            <div className="cm-section-label">Analysis</div>

            {/* Trend Analysis - FREE */}
            <button
              className="cm-analysis-btn"
              onClick={() => handleFeatureClick('trends', 'trends')}
              disabled={loading}
            >
              <div className="cm-analysis-icon cm-icon-blue">
                <TrendingUp size={20} />
              </div>
              <div className="cm-analysis-text">
                <span className="cm-analysis-title">Trend Analysis</span>
                <span className="cm-analysis-desc">Compare to previous period</span>
              </div>
              <ChevronRight size={16} className="cm-analysis-arrow" />
            </button>

            {/* Impact Analysis - PRO */}
            <button
              className={`cm-analysis-btn ${!userState.isPro ? 'cm-locked' : ''}`}
              onClick={() => handleFeatureClick('drivers', 'drivers')}
              disabled={loading}
            >
              <div className="cm-analysis-icon cm-icon-purple">
                <Target size={20} />
              </div>
              <div className="cm-analysis-text">
                <span className="cm-analysis-title">
                  Impact Analysis
                  {!userState.isPro && <span className="cm-pro-badge">PRO</span>}
                </span>
                <span className="cm-analysis-desc">Find key drivers</span>
              </div>
              <ChevronRight size={16} className="cm-analysis-arrow" />
            </button>

            {/* Anomaly Detection - PRO */}
            <button
              className={`cm-analysis-btn ${!userState.isPro ? 'cm-locked' : ''}`}
              onClick={() => handleFeatureClick('anomalies', 'anomalies')}
              disabled={loading}
            >
              <div className="cm-analysis-icon cm-icon-red">
                <AlertTriangle size={20} />
              </div>
              <div className="cm-analysis-text">
                <span className="cm-analysis-title">
                  Anomaly Detection
                  {!userState.isPro && <span className="cm-pro-badge">PRO</span>}
                </span>
                <span className="cm-analysis-desc">Spot data issues</span>
              </div>
              <ChevronRight size={16} className="cm-analysis-arrow" />
            </button>

            {/* Trust badge */}
            <div className="cm-trust-badge">
              <Shield size={14} />
              <span>Analyzes visible data only</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="cm-loading-card">
            <div className="cm-spinner" />
            <span>Analyzing dashboard...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="cm-error-card">
            <AlertTriangle size={18} />
            <p>{error}</p>
            <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={clearResults}>
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {explanation && (
          <div className="cm-result-section">
            <div className="cm-result-card">
              <div className="cm-result-header">
                <div className="cm-result-label">Analysis Result</div>
                <div className="cm-result-actions">
                  <button
                    className={`cm-icon-btn ${!userState.isPro ? 'cm-locked' : ''}`}
                    onClick={copyToClipboard}
                    title={userState.isPro ? "Copy to clipboard" : "PRO feature"}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button className="cm-icon-btn" onClick={clearResults} title="New analysis">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="cm-result-content">
                {explanation}
              </div>
            </div>

            {/* Source data toggle */}
            <button
              className={`cm-source-toggle ${showSource ? 'cm-active' : ''}`}
              onClick={() => setShowSource(!showSource)}
            >
              {showSource ? 'Hide' : 'Show'} source data
            </button>

            {showSource && rawText && (
              <div className="cm-source-card">
                <pre>{rawText}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Follow-up input */}
      <div className="cm-input-area">
        <div className="cm-input-wrapper">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && followUp.trim() && analyzeDashboard('custom')}
            placeholder="Ask a follow-up question..."
            disabled={loading}
          />
          <button
            className="cm-send-btn"
            onClick={() => followUp.trim() && analyzeDashboard('custom')}
            disabled={!followUp.trim() || loading}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {!userState.isPro && (
          <div className="cm-input-hint">
            {followUpsLeft > 0 ? `${followUpsLeft} follow-ups remaining` : 'No follow-ups remaining'}
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          userState={userState}
          updateUserState={updateUserState}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          userState={userState}
          updateUserState={updateUserState}
        />
      )}
    </div>
  )
}

// Header Component
function Header({ userState, onSettingsClick }: { userState: UserState, onSettingsClick: () => void }) {
  return (
    <div className="cm-header">
      <div className="cm-header-left">
        <div className="cm-logo">
          <Zap size={18} />
        </div>
        <div className="cm-header-text">
          <h1>ClearMetric</h1>
          <span>Dashboard Analysis</span>
        </div>
      </div>
      <div className="cm-header-right">
        {userState.isPro ? (
          <span className="cm-plan-badge cm-plan-pro">PRO</span>
        ) : (
          <span className="cm-plan-badge cm-plan-free">FREE</span>
        )}
        <button className="cm-icon-btn" onClick={onSettingsClick}>
          <Settings size={16} />
        </button>
      </div>
    </div>
  )
}

// Footer Component
function Footer() {
  return (
    <div className="cm-footer">
      <span>Works with app.powerbi.com</span>
    </div>
  )
}

// Upgrade Modal
function UpgradeModal({ onClose, userState, updateUserState }: any) {
  const [licenseKey, setLicenseKey] = useState("")
  const [licenseError, setLicenseError] = useState("")
  const [showLicense, setShowLicense] = useState(false)

  const validateLicense = () => {
    setLicenseError("")
    if (licenseKey.startsWith("CM-PRO-") && licenseKey.length >= 15) {
      updateUserState({ isPro: true, licenseKey })
      onClose()
    } else {
      setLicenseError("Invalid license key")
    }
  }

  const handleCheckout = (plan: 'monthly' | 'annual') => {
    // TODO: Integrate with Stripe
    const url = plan === 'monthly'
      ? 'https://buy.stripe.com/test_monthly'
      : 'https://buy.stripe.com/test_annual'
    chrome.tabs.create({ url })
  }

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cm-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="cm-modal-header">
          <h2>Upgrade to Pro</h2>
          <p>Unlock unlimited analysis and advanced features</p>
        </div>

        <div className="cm-features-list">
          {[
            'Unlimited analyses',
            'Impact Analysis',
            'Anomaly Detection',
            'Unlimited follow-ups',
            'Copy to clipboard',
            'Priority support'
          ].map((feature, i) => (
            <div key={i} className="cm-feature-item">
              <Check size={14} />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="cm-pricing-cards">
          <button className="cm-pricing-card" onClick={() => handleCheckout('monthly')}>
            <span className="cm-price">$20</span>
            <span className="cm-period">/month</span>
          </button>
          <button className="cm-pricing-card cm-featured" onClick={() => handleCheckout('annual')}>
            <span className="cm-save-badge">Save 37%</span>
            <span className="cm-price">$150</span>
            <span className="cm-period">/year</span>
          </button>
        </div>

        <button className="cm-license-toggle" onClick={() => setShowLicense(!showLicense)}>
          Have a license key?
        </button>

        {showLicense && (
          <div className="cm-license-form">
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="CM-PRO-XXXXXXXXXXXX"
            />
            {licenseError && <span className="cm-license-error">{licenseError}</span>}
            <button className="cm-btn cm-btn-primary" onClick={validateLicense}>
              Activate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Settings Modal
function SettingsModal({ onClose, userState, updateUserState }: any) {
  const resetUsage = () => {
    updateUserState({
      analysesThisMonth: 0,
      followUpsUsed: 0,
      usageResetDate: getNextMonthFirstDay()
    })
  }

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal cm-modal-sm" onClick={(e) => e.stopPropagation()}>
        <button className="cm-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="cm-modal-header">
          <h2>Settings</h2>
        </div>

        <div className="cm-settings-content">
          <div className="cm-settings-item">
            <span className="cm-settings-label">Plan</span>
            <span className="cm-settings-value">{userState.isPro ? 'Pro' : 'Free'}</span>
          </div>
          <div className="cm-settings-item">
            <span className="cm-settings-label">Analyses used</span>
            <span className="cm-settings-value">{userState.analysesThisMonth} / {userState.isPro ? '∞' : FREE_ANALYSES_LIMIT}</span>
          </div>
          <div className="cm-settings-item">
            <span className="cm-settings-label">Follow-ups used</span>
            <span className="cm-settings-value">{userState.followUpsUsed} / {userState.isPro ? '∞' : FREE_FOLLOWUPS_LIMIT}</span>
          </div>

          {/* Dev tools - remove in production */}
          <div className="cm-settings-divider" />
          <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={resetUsage}>
            Reset Usage (Dev)
          </button>
          <button
            className="cm-btn cm-btn-secondary cm-btn-sm"
            onClick={() => updateUserState({ isPro: !userState.isPro })}
          >
            Toggle Pro (Dev)
          </button>
        </div>
      </div>
    </div>
  )
}

export default SidePanel
