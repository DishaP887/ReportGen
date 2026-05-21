const fetch = require('node-fetch');

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { apiKey, excelCsv, pptxText, context, month } = req.body;
  if (!apiKey) return res.status(400).json({ ok: false, error: 'No API key provided' });
  if (!excelCsv) return res.status(400).json({ ok: false, error: 'No Excel data provided' });

  const prompt = `You are a senior marketing analyst. The user has an existing PowerPoint report template.
Preserve the EXACT same slide titles, count and section order from the template. Only update numbers and insights from the new Excel data.

PowerPoint template slide text:
${(pptxText || '').slice(0, 2000)}

Return ONLY valid JSON, absolutely no markdown, no backticks, no explanation. Start your response with { and end with }:
{
  "month": "${month}",
  "metrics": [
    { "label": "KPI name", "value": "formatted value", "delta": "+X% or empty", "direction": "up|down|neutral" }
  ],
  "slides": [
    { "title": "slide title", "subtitle": "one line", "bullets": ["bullet 1", "bullet 2", "bullet 3"] }
  ],
  "headline_insight": "one powerful sentence",
  "recommendations": ["action 1", "action 2", "action 3"]
}

Rules: 4-6 metrics from data, Indian formatting (Rs, L, Cr), bullets max 15 words with real numbers, match template slide titles exactly, 3 recommendations.
${context ? 'User context: ' + context : ''}

Excel data:
${(excelCsv || '').slice(0, 5000)}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 3000 }
        })
      }
    );
    if (!r.ok) {
      const e = await r.json();
      return res.status(400).json({ ok: false, error: e.error?.message || 'Gemini API error' });
    }
    const data = await r.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON even if there's extra text around it
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in Gemini response');
    const analysis = JSON.parse(match[0]);
    res.json({ ok: true, analysis });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
