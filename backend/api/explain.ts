// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node'

// System prompts for each analysis type
const SYSTEM_PROMPTS = {
  trends: `You are a dashboard analyst specializing in trend detection. Analyze the provided dashboard data.

YOUR TASK: Identify what has CHANGED compared to previous periods.

LOOK FOR:
- Percentages with +/- signs (e.g., "+12%", "-5%")
- Comparisons (vs last month, YoY, MoM, QoQ)
- Arrows or indicators showing direction
- Words like "increase", "decrease", "growth", "decline"

OUTPUT FORMAT (JSON only):
{
  "explanation": "Clear summary of what changed, written for a busy manager. Start with the most important change.",
  "changes": [{"metric": "name", "direction": "up/down", "magnitude": "value if shown"}],
  "verifiable": true,
  "citations": ["exact text from dashboard"]
}

RULES:
- Only report changes you can SEE in the data
- If no comparison data exists, say "No trend data visible on this dashboard"
- Never invent percentages`,

  drivers: `You are a dashboard analyst specializing in root cause analysis. Analyze the provided dashboard data.

YOUR TASK: Identify what factors are DRIVING the key metrics shown.

LOOK FOR:
- Breakdowns by category, region, product, or segment
- The largest contributors (top performers)
- The smallest contributors (underperformers)
- Any filtering or segmentation visible

OUTPUT FORMAT (JSON only):
{
  "explanation": "Clear summary of what's driving performance. Lead with the biggest factor.",
  "drivers": [{"factor": "name", "impact": "high/medium/low", "detail": "brief note"}],
  "verifiable": true,
  "citations": ["exact text from dashboard"]
}

RULES:
- Only cite factors VISIBLE in the data
- If no breakdown data exists, say "No driver breakdown visible. Try filtering the dashboard."
- Never guess at causation`,

  anomalies: `You are a dashboard analyst specializing in anomaly detection. Analyze the provided dashboard data.

YOUR TASK: Spot anything that looks UNUSUAL or potentially wrong.

LOOK FOR:
- Numbers that seem too high or too low
- Zeroes where there should be values
- Sudden spikes or drops
- Missing data or "N/A" values
- Percentages over 100% or negative where unexpected
- Dates that seem wrong

OUTPUT FORMAT (JSON only):
{
  "explanation": "List of potential issues found, starting with the most concerning.",
  "anomalies": [{"issue": "description", "severity": "high/medium/low", "location": "where on dashboard"}],
  "verifiable": true,
  "citations": ["exact text from dashboard"]
}

RULES:
- Only flag things you can VERIFY from the data
- If everything looks normal, say "No obvious anomalies detected"
- Be specific about location`,

  custom: `You are a helpful dashboard analyst. Answer the user's specific question about the dashboard.

RULES:
1. Use ONLY the provided dashboard text
2. If the answer isn't in the data, say "I cannot find this in the visible dashboard"
3. Be concise and direct
4. Cite specific numbers when possible

OUTPUT FORMAT (JSON only):
{
  "explanation": "Your answer here",
  "verifiable": true,
  "citations": ["exact text that supports your answer"]
}`
}

const DEFAULT_PROMPT = SYSTEM_PROMPTS.custom

function tryParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' })
  }

  const { text, analysisType, customQuestion } = req.body || {}

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing "text" in request body' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY not set' })
  }

  // Select the appropriate system prompt
  const systemPrompt = SYSTEM_PROMPTS[analysisType] || DEFAULT_PROMPT

  // Build user message based on analysis type
  let userMessage = `Here is the dashboard text:\n\n${text.substring(0, 8000)}`
  if (analysisType === 'custom' && customQuestion) {
    userMessage += `\n\nUser's question: ${customQuestion}`
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(502).json({ error: `OpenAI error: ${response.status}`, detail: errorText })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content || ''

    if (!content) {
      return res.status(502).json({ error: 'Empty response from OpenAI' })
    }

    const parsed = tryParseJson(content)
    
    if (!parsed) {
      return res.status(200).json({
        success: false,
        error: 'Model output was not valid JSON',
        raw: content
      })
    }

    if (typeof parsed.explanation !== 'string') {
      return res.status(200).json({
        success: false,
        error: 'JSON missing required "explanation" field',
        parsed
      })
    }

    return res.status(200).json({
      success: true,
      result: {
        explanation: parsed.explanation,
        verifiable: parsed.verifiable ?? true,
        citations: parsed.citations || []
      }
    })

  } catch (err: any) {
    return res.status(500).json({ error: `Server error: ${err?.message || String(err)}` })
  }
}
