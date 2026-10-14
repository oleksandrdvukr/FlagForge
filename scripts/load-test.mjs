#!/usr/bin/env node
// NFR-01 load test: p95 < 15 ms for POST /api/v1/evaluate at an aggregate 500 req/s,
// spread across SDK keys so no key exceeds its rate limit (SRS v1.3.0, SEC-04).
// Open-loop: requests are sent on a fixed schedule regardless of response times, so slow
// responses show up as latency instead of silently lowering the request rate.
// No dependencies; Node 22+.
//
//   node scripts/load-test.mjs
//   BASE_URL=http://localhost:3000 RPS=500 DURATION_S=30 KEYS=40 node scripts/load-test.mjs

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@flagforge.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'flagforge-demo';
const RPS = Number(process.env.RPS ?? 500);
const DURATION_S = Number(process.env.DURATION_S ?? 30);
const KEYS = Number(process.env.KEYS ?? 40); // 500 / 40 = 12.5 req/s = 750/min per key
const WARMUP_S = 3;
const API = `${BASE_URL}/api/v1`;

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res;
}

async function setup() {
  const login = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const keys = [];
  for (let i = 0; keys.length < KEYS; i++) {
    const res = await call(
      'POST',
      '/workspaces',
      { name: `load-test-${Date.now()}-${i}` },
      { Cookie: cookie },
    );
    const { environments } = await res.json();
    for (const env of environments) {
      if (keys.length >= KEYS) break;
      await call(
        'POST',
        `/environments/${env.id}/flags`,
        {
          key: 'load-flag',
          name: 'Load test',
          isEnabled: true,
          percentageRollout: 50,
          targetingRules: [
            { attribute: 'plan', operator: 'EQUALS', values: ['enterprise'], value: true },
          ],
        },
        { Cookie: cookie },
      );
      keys.push(env.sdkKey);
    }
  }
  return keys;
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

async function run(keys) {
  const latencies = [];
  const statuses = new Map();
  let errors = 0;
  let sent = 0;
  const inFlight = new Set();
  const start = performance.now();
  const totalMs = (WARMUP_S + DURATION_S) * 1000;
  const intervalMs = 1000 / RPS;

  const fire = (n) => {
    const key = keys[n % keys.length];
    const t0 = performance.now();
    const measured = t0 - start >= WARMUP_S * 1000;
    const p = fetch(`${API}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Environment-Key': key },
      body: JSON.stringify({
        flagKey: 'load-flag',
        userId: `user-${n}`,
        attributes: { plan: n % 10 === 0 ? 'enterprise' : 'free', country: 'UA' },
      }),
    })
      .then(async (res) => {
        await res.arrayBuffer();
        if (!measured) return;
        latencies.push(performance.now() - t0);
        statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      })
      .catch(() => {
        if (measured) errors++;
      })
      .finally(() => inFlight.delete(p));
    inFlight.add(p);
  };

  // Dispatch on a 5 ms tick, catching up to the exact schedule each time.
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const elapsed = performance.now() - start;
      const due = Math.min(Math.floor(elapsed / intervalMs), Math.floor(totalMs / intervalMs));
      while (sent < due) fire(sent++);
      if (elapsed >= totalMs) {
        clearInterval(timer);
        resolve();
      }
    }, 5);
  });
  await Promise.all(inFlight);

  latencies.sort((a, b) => a - b);
  return { latencies, statuses, errors };
}

const keys = await setup();
console.log(
  `Load test: ${RPS} req/s for ${DURATION_S}s (+${WARMUP_S}s warm-up) across ${keys.length} SDK keys → ${BASE_URL}`,
);
const { latencies, statuses, errors } = await run(keys);

const p50 = percentile(latencies, 0.5);
const p95 = percentile(latencies, 0.95);
const p99 = percentile(latencies, 0.99);
const ok200 = statuses.get(200) ?? 0;
const nonOk = latencies.length - ok200 + errors;
console.log(
  `requests:  ${latencies.length + errors} measured (${(latencies.length / DURATION_S).toFixed(0)} req/s achieved)`,
);
console.log(
  `statuses:  ${[...statuses].map(([s, n]) => `${s}×${n}`).join(', ')}${errors ? `, network errors×${errors}` : ''}`,
);
console.log(
  `latency:   p50 ${p50.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms · p99 ${p99.toFixed(2)} ms · max ${latencies.at(-1).toFixed(2)} ms`,
);

const pass = p95 < 15 && nonOk === 0;
console.log(pass ? 'NFR-01: PASS (p95 < 15 ms, all 200)' : 'NFR-01: FAIL');
process.exit(pass ? 0 : 1);
