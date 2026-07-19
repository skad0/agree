const base = process.argv[2] ?? "http://127.0.0.1:3000";
const sustained = await scheduled(100, 40, () => fetch(`${base}/en`));
const burst = await batch(50, () => fetch(`${base}/en`));
const posts = await Promise.all(Array.from({ length: 10 }, (_, index) => support(index)));
report("GET sustained 25 rps", sustained, 300); report("GET burst 50", burst, 300); report("support POST burst 10", posts, 500);

async function support(index: number) {
  const started = performance.now(); const ip = `198.51.100.${index + 1}`; const form = await fetch(`${base}/en/support`, { headers: { "CF-Connecting-IP": ip } }); const html = await form.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1]; const cookie = form.headers.get("set-cookie")?.split(";")[0]; if (!csrf || !cookie) return { ms: performance.now() - started, ok: false };
  const response = await fetch(`${base}/en/support`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie, "CF-Connecting-IP": ip }, body: new URLSearchParams({ csrf, email: `load-${Date.now()}-${index}@example.org`, consent: "yes" }) });
  return { ms: performance.now() - started, ok: response.ok };
}
async function batch(total: number, request: () => Promise<Response>) { return Promise.all(Array.from({ length: total }, async () => timed(request))); }
async function scheduled(total: number, interval: number, request: () => Promise<Response>) { const results: Promise<{ ms: number; ok: boolean }>[] = []; for (let i = 0; i < total; i++) { results.push(timed(request)); await new Promise((resolve) => setTimeout(resolve, interval)); } return Promise.all(results); }
async function timed(request: () => Promise<Response>) { const started = performance.now(); try { const response = await request(); return { ms: performance.now() - started, ok: response.ok }; } catch { return { ms: performance.now() - started, ok: false }; } }
function report(label: string, results: { ms: number; ok: boolean }[], target: number) { const sorted = results.map((result) => result.ms).sort((a, b) => a - b); const p95 = sorted[Math.ceil(sorted.length * .95) - 1] ?? Infinity; const errors = results.filter((result) => !result.ok).length / results.length; console.log(`${label}: p95=${p95.toFixed(1)}ms errors=${(errors * 100).toFixed(1)}%`); if (p95 > target || errors >= .01) process.exitCode = 1; }

