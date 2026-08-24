// 机械防线：盲盒塔防 — Cloudflare Worker
// 职责：
//   1. /api/* 提供后端接口（排行榜）
//   2. 其余请求交给静态资源（public/ 目录）

const MAX_KEEP = 100; // KV 里最多保留的成绩条数
const MAX_LIST = 20; // 单次返回给前端的条数

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ ok: false, error: 'server_error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health') {
    return json({ ok: true, storage: env.SCORES ? 'kv' : 'none' });
  }

  if (url.pathname === '/api/scores') {
    // 未绑定 KV 时明确告知前端，前端会退回 localStorage
    if (!env.SCORES) {
      return json({ ok: false, error: 'no_storage', scores: [] });
    }
    if (request.method === 'GET') {
      const scores = await loadScores(env);
      return json({ ok: true, scores: scores.slice(0, MAX_LIST) });
    }
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'bad_json' }, 400);
      }
      const entry = sanitizeEntry(body);
      if (!entry) {
        return json({ ok: false, error: 'bad_data' }, 400);
      }
      const scores = await loadScores(env);
      scores.push(entry);
      scores.sort((a, b) => b.score - a.score || a.at - b.at);
      const kept = scores.slice(0, MAX_KEEP);
      await env.SCORES.put('scores', JSON.stringify(kept));
      const rank = kept.indexOf(entry) + 1; // 0 表示没进前 MAX_KEEP 名
      return json({ ok: true, rank, scores: kept.slice(0, MAX_LIST) });
    }
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

function sanitizeEntry(body) {
  if (!body || typeof body !== 'object') return null;
  const score = Math.floor(Number(body.score));
  const wave = Math.floor(Number(body.wave));
  if (!Number.isFinite(score) || score < 0 || score > 10_000_000) return null;
  if (!Number.isFinite(wave) || wave < 0 || wave > 10_000) return null;
  let name = String(body.name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 16);
  if (!name) name = '无名机械师';
  return { name, score, wave, at: Date.now() };
}

async function loadScores(env) {
  const raw = await env.SCORES.get('scores');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
