const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { apiKey, excelCsv, pptxText, context, month } = req.body;
  if (!apiKey) return res.status(400).json({ ok: false, error: 'No API key' });

  const prompt = `You are a senior marketing analyst. The user has an existing PowerPoint report template. 
Preserve the EXACT same slide titles, count and section order from the template. Only update numbers and insights from the new Excel data.

PowerPoint template slide text:
${(pptxText || '').slice(0, 2500)}

Return ONLY valid JSON with no markdown fences or explanation:
{
  "month": "${month}",
  "metrics": [
    { "label": "KPI name", "value": "formatted value e.g. 1.4M or 4.8% or ₹1.2L", "delta": "+X% vs last month or empty string", "direction": "up|down|neutral" }
  ],
  "slides": [
    { "title": "exact slide title from template", "subtitle": "one-line subtitle", "bullets": ["insight 1 with real numbers", "insight 2", "insight 3"] }
  ],
  "headline_insight": "one powerful sentence summarizing the month",
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"]
}

Rules:
- metrics: extract 4-6 real KPIs from the data (impressions, clicks, CTR, CPC, conversions, ROAS, spend etc). Use Indian formatting (₹, L, Cr).
- bullets: max 15 words, use actual numbers from data
- Match template slide titles and count exactly
- recommendations: 3 specific, data-driven actions
${context ? '\nUser context: ' + context : ''}

Excel data:
${excelCsv}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        })
      }
    );

    if (!r.ok) {
      const e = await r.json();
      return res.status(400).json({ ok: false, error: e.error?.message || `Gemini error ${r.status}` });
    }

    const data = await r.json();
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);
    res.json({ ok: true, analysis });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
