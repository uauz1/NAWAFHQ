const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-24).map((m) => ({
    role: m?.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m?.text || '').slice(0, 12000) }],
  })).filter((m) => m.parts[0].text.trim());
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      provider: 'gemini',
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: MODEL,
      secretExposed: false,
    });
  }

  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (!process.env.GEMINI_API_KEY) return send(res, 503, { ok: false, error: 'GEMINI_NOT_CONFIGURED' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const messages = cleanMessages(body.messages);
    const system = String(body.system || '').slice(0, 16000);
    if (!messages.length) return send(res, 400, { ok: false, error: 'EMPTY_MESSAGES' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: messages,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1800,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Gemini upstream error', upstream.status, data?.error?.status || 'UNKNOWN');
      return send(res, 502, { ok: false, error: 'GEMINI_UPSTREAM_ERROR', status: upstream.status });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!text) return send(res, 502, { ok: false, error: 'EMPTY_GEMINI_RESPONSE' });

    let result;
    try { result = JSON.parse(text); } catch { result = { message: text }; }
    return send(res, 200, { ok: true, provider: 'gemini', model: MODEL, result });
  } catch (error) {
    console.error('Gemini endpoint failure', error?.message || error);
    return send(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
