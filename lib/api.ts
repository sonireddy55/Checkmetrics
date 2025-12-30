// API client for backend calls
const API_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://clearmetric-api.vercel.app'

export interface AnalysisRequest {
  text: string
  analysisType: 'trends' | 'drivers' | 'anomalies' | 'custom'
  customQuestion?: string
  userId?: string
  isPro?: boolean
}

export interface AnalysisResponse {
  success: boolean
  result?: {
    explanation: string
  }
  error?: string
  remaining?: number
}

export async function analyzeData(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  
  return response.json()
}

export async function createCheckoutSession(userId: string, email: string, plan: 'monthly' | 'annual') {
  const response = await fetch(`${API_URL}/api/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, plan })
  })
  
  return response.json()
}
