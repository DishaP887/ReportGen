const XLSX = require('xlsx');
const Busboy = require('busboy');

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const bb = Busboy({ headers: req.headers });
  const chunks = [];

  bb.on('file', (name, stream) => {
    stream.on('data', d => chunks.push(d));
    stream.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
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
    });
  });

  bb.on('error', e => res.status(400).json({ ok: false, error: e.message }));
  req.pipe(bb);
}
