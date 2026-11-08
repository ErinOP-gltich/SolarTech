// Ask AI: answers visitors' questions with Cloudflare Workers AI, briefed by _brief.js (written by seo.mjs from the
// catalogue, the contact details and the road planner's rules). Limits: 20 questions an hour per visitor, 600 a day in all.
import { BRIEF } from './_brief.js';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, { error: 'Not allowed.' });
  const raw = await request.text();
  if (raw.length > 24000) return reply(413, { error: 'That is too long.' });
  let b; try { b = JSON.parse(raw); } catch (e) { return reply(400, { error: 'Not valid JSON.' }); }
  const msgs = (Array.isArray(b && b.messages) ? b.messages : []).slice(-10)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return reply(400, { error: 'Ask a question.' });
  if (!env.AI) return reply(503, { error: 'The assistant is not switched on.' });

  // count this question: per visitor (a salted hash of the IP, never the IP itself) per hour, and for the whole day
  const ip = request.headers.get('cf-connecting-ip') || '';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + (env.STATS_SALT || ''))))].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
  const hour = new Date().toISOString().slice(0, 13), day = hour.slice(0, 10);
  const bump = k => env.DB.prepare('INSERT INTO asks (k, n) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(k);
  const [mine, all] = await env.DB.batch([bump(hour + ':' + hash), bump('day:' + day)]);
  if (mine.results[0].n > 20 || all.results[0].n > 600) return reply(429, { error: 'Lots of questions right now. Please try again later, or WhatsApp us.' });
  if (Math.random() < .03) waitUntil(env.DB.prepare("DELETE FROM asks WHERE (k NOT LIKE 'day:%' AND k < ?1) OR (k LIKE 'day:%' AND k < ?2)")
    .bind(new Date(Date.now() - 864e5).toISOString().slice(0, 13), 'day:' + new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)).run());

  try {
    const r = await env.AI.run(MODEL, { messages: [{ role: 'system', content: BRIEF }].concat(msgs), max_tokens: 700, temperature: .3 });
    const text = String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();
    if (!text) throw new Error('empty');
    return reply(200, { reply: text.slice(0, 4000) });
  } catch (e) {
    return reply(502, { error: 'The assistant is busy. Please try again, or WhatsApp us.' });
  }
}
