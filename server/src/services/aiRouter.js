import { config } from '../config.js';

const cooldownUntil = { groq: 0, gemini: 0 };

async function timedFetch(url, opts, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function httpError(name, res) {
  const err = new Error(`${name} http ${res.status}`);
  err.status = res.status;
  return err;
}

async function viaGroq(system, user) {
  const res = await timedFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.ai.groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ai.groqModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw httpError('groq', res);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function viaGemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent`;
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': config.ai.geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw httpError('gemini', res);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
}

function parseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try to find an object inside */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export function providers() {
  return { groq: Boolean(config.ai.groqKey), gemini: Boolean(config.ai.geminiKey) };
}

// groq first, gemini when groq is rate limited / down. returns null when nothing is configured or both fail
export async function askJson(system, user) {
  const chain = [
    ['groq', config.ai.groqKey, viaGroq],
    ['gemini', config.ai.geminiKey, viaGemini],
  ];
  for (const [name, key, fn] of chain) {
    if (!key || Date.now() < cooldownUntil[name]) continue;
    try {
      const json = parseJson(await fn(system, user));
      if (json) return { provider: name, json };
      console.warn(`[ai] ${name} returned unparseable output`);
    } catch (err) {
      const wait = err.status === 401 || err.status === 403 ? 600000 : 60000;
      cooldownUntil[name] = Date.now() + wait;
      console.warn(`[ai] ${name} failed (${err.message}), trying next provider`);
    }
  }
  return null;
}
