const XLSX = require('xlsx');

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { data } = req.body; // base64 encoded file
    if (!data) return res.status(400).json({ ok: false, error: 'No file data received' });

    const buf = Buffer.from(data, 'base64');
    const wb  = XLSX.read(buf, { type: 'buffer', sheetRows: 300, cellStyles: false });
    const out = {};
    wb.SheetNames.forEach(n => {
      out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', raw: false });
    });
    const lines = [];
    Object.entries(out).forEach(([sheet, rows]) => {
      if (!rows.length) return;
      lines.push(`=== ${sheet} ===`);
      const headers = Object.keys(rows[0]);
      lines.push(headers.join(', '));
      rows.slice(0, 150).forEach(r => lines.push(headers.map(h => r[h] ?? '').join(', ')));
    });
    const rowCount = Object.values(out).reduce((a, r) => a + r.length, 0);
    res.json({ ok: true, csv: lines.join('\n').slice(0, 8000), rowCount });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}
