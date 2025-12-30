// Enhanced API with rate limiting and usage tracking
// Copy this to your deployed clearmetric-api/api/analyze.js

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Fingerprint, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, analysisType, customQuestion, userId, fingerprint, isPro } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No dashboard text provided' });
  }

  // Optional: Server-side rate limiting with Supabase
  // Uncomment when Supabase is configured
  /*
  if (!isPro && process.env.SUPABASE_URL) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Check usage
    const usageCheck = await supabase.rpc('check_and_increment_usage', {
      p_user_id: userId,
      p_fingerprint: fingerprint || 'anonymous',
      p_usage_type: analysisType === 'custom' ? 'followup' : 'analysis'
    });

    if (usageCheck.data && !usageCheck.data.allowed) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: 'Upgrade to Pro for unlimited analyses',
        remaining: 0
      });
    }
  }
  */

  // System prompts for each analysis type
  const SYSTEM_PROMPTS = {
    trends: `You are a dashboard analyst specializing in trend detection.
Analyze the provided dashboard data and identify what has CHANGED compared to previous periods.

LOOK FOR:
- Percentages with +/- signs (e.g., "+12%", "-5%")
- Comparisons (vs last month, YoY, MoM, QoQ)
- Words like "increase", "decrease", "growth", "decline"

FORMAT YOUR RESPONSE:
• Start with the most significant change
• Use clear metrics and numbers
• Keep it to 3-4 bullet points maximum
• Be specific, not vague

If no comparison data exists, say "No trend data visible on this dashboard."`,

    drivers: `You are a dashboard analyst specializing in root cause analysis.
Analyze the provided dashboard data and identify what factors are DRIVING the key metrics.

LOOK FOR:
- Breakdowns by category, region, product, or segment
- The largest contributors (top performers)
- The smallest contributors (underperformers)
- Concentration risk (one thing driving everything)

FORMAT YOUR RESPONSE:
• Lead with the biggest driver
• Quantify contributions where possible
• Note any concerning concentration
• Keep it to 3-4 bullet points maximum

If no breakdown data exists, say "No driver breakdown visible."`,

    anomalies: `You are a dashboard analyst specializing in anomaly detection.
Analyze the provided dashboard data and spot anything UNUSUAL or potentially wrong.

LOOK FOR:
- Numbers that seem too high or too low
- Zeroes where there should be values
- Sudden spikes or drops
- Missing data or "N/A" values
- Data quality issues

FORMAT YOUR RESPONSE:
• Flag any suspicious data points
• Explain why they seem unusual
• Suggest what to investigate
• Rate severity: Low/Medium/High

If everything looks normal, say "No obvious anomalies detected."`,

    custom: `You are a helpful dashboard analyst. Answer the user's specific question about the dashboard data.

GUIDELINES:
• Be concise and direct
• Use specific numbers from the data
• If the data doesn't contain the answer, say so
• Don't make assumptions beyond what's visible`
  };

  const systemPrompt = SYSTEM_PROMPTS[analysisType] || SYSTEM_PROMPTS.custom;
  const userMessage = analysisType === 'custom' && customQuestion
    ? `Question: ${customQuestion}\n\nDashboard data:\n${text}`
    : `Dashboard data:\n${text}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        temperature: 0.2, // Lowered for more consistent outputs
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    res.status(200).json({
      success: true,
      result: {
        explanation: data.choices[0].message.content,
        analysisType,
        model: 'gpt-4o-mini'
      }
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}
