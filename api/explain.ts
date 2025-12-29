// Vercel serverless function: /api/explain
// Purpose: receive scraped dashboard text, call OpenAI (gpt-4o-mini),
// enforce a server-side system prompt (ignore any client-supplied prompt),
// and return a strict JSON response containing an explanation and optional citations.

const SYSTEM_PROMPT = `You are a dashboard explainer. Use ONLY the provided dashboard text to explain what is present. If the user asks about information not contained in the provided text, reply exactly: "I cannot verify this." Do NOT invent numbers, calculate new KPIs, or make unverifiable claims. Output MUST be valid JSON following this schema: {"explanation": string, "verifiable": boolean, "citations": string[]}. Return JSON only.`

// Minimal helper to safely extract JSON from model response
function tryParseJsonMaybe(text: string) {
  try {
    // first try direct parse
    return JSON.parse(text)
  } catch (e) {
    // try to extract JSON block from surrounding text
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch (e2) {
        return null
      }
    }
    return null
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed, use POST" })
  }

  const body = req.body || {}
  const dashboardText = (body.text || "").toString()

  if (!dashboardText || dashboardText.trim().length === 0) {
    return res.status(400).json({ error: "Missing 'text' in request body" })
  }

  // Enforce server-side system prompt. Ignore any system_prompt sent by client.
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    return res.status(500).json({ error: "Server misconfigured: OPENAI_API_KEY not set" })
  }

  // Build the conversation: server system prompt + user message containing the text
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Here is the dashboard text you must use (do not use anything else). Return JSON only.\n\n" +
        dashboardText,
    },
  ]

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.0,
        max_tokens: 800,
        // ensure the model isn't creative
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(502).json({ error: `OpenAI error: ${resp.status}`, detail: txt })
    }

    const j = await resp.json()
    // The responses are usually in j.choices[0].message.content
    const content = j?.choices?.[0]?.message?.content || j?.output?.[0]?.content || ""

    if (!content) {
      return res.status(502).json({ error: "Empty response from OpenAI" })
    }

    const parsed = tryParseJsonMaybe(content)
    if (!parsed) {
      // Return the raw content for debugging, but mark as failure
      return res.status(200).json({
        success: false,
        error: "Model output was not valid JSON",
        raw: content,
      })
    }

    // Basic validation: ensure required fields exist
    if (typeof parsed.explanation !== "string" || typeof parsed.verifiable !== "boolean") {
      return res.status(200).json({
        success: false,
        error: "JSON did not match expected schema",
        parsed,
      })
    }

    // Return the parsed JSON as the canonical response
    return res.status(200).json({ success: true, result: parsed })
  } catch (err: any) {
    return res.status(500).json({ error: `Server error: ${err?.message || String(err)}` })
  }
}
