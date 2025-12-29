import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM_PROMPT = `You are a dashboard explainer for Power BI reports. Your role is to help users understand what they see on their dashboard.

STRICT RULES:
1. Use ONLY the provided dashboard text to explain what is present
2. If asked about information NOT in the provided text, respond exactly: "I cannot verify this from the current dashboard data."
3. Do NOT invent numbers, calculate new KPIs, or make predictions
4. Do NOT guess or make assumptions about data not shown
5. Be concise and helpful

Output your response as valid JSON with this schema:
{
  "explanation": "Your clear explanation here",
  "verifiable": true or false,
  "citations": ["exact text from dashboard that supports your explanation"]
}

Return ONLY the JSON object, no additional text.`

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

  const { text } = req.body || {}

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing "text" in request body' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY not set' })
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Here is the dashboard text. Analyze it and return JSON only:\n\n${text.substring(0, 8000)}`
    }
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
