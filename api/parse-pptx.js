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
        const buf  = Buffer.concat(chunks);
        const raw  = buf.toString('utf-8', 0, Math.min(buf.length, 2 * 1024 * 1024));
        const nodes = raw.match(/<a:t[^>]*>([^<]{1,300})<\/a:t>/g) || [];
        const text  = nodes
          .map(n => n.replace(/<[^>]+>/g, '').trim())
          .filter(t => t.length > 1)
          .slice(0, 400)
          .join('\n');
        res.json({ ok: true, text: text || 'Template uploaded' });
      } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
      }
    });
  });

  bb.on('error', e => res.status(400).json({ ok: false, error: e.message }));
  req.pipe(bb);
}
