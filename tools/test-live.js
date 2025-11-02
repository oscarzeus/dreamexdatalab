// Simple live check script for Orange Money deployment
// Usage (PowerShell): node tools/test-live.js [--health=...] [--index=...] [--reg=...] [--succ=...] [--cancel=...]

const defaults = {
  health: 'https://api.dreamexdatalab.com/health',
  index: 'https://api.dreamexdatalab.com/',
  reg: 'https://dreamexdatalab.com/company-complete-registration.html',
  succ: 'https://dreamexdatalab.com/payment/success.html',
  cancel: 'https://dreamexdatalab.com/payment/cancel.html',
};

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((s) => s.startsWith('--'))
    .map((s) => {
      const [k, ...rest] = s.replace(/^--/, '').split('=');
      return [k, rest.join('=') || true];
    })
);

const cfg = {
  health: args.health || process.env.API_HEALTH_URL || defaults.health,
  index: args.index || process.env.API_INDEX_URL || defaults.index,
  reg: args.reg || process.env.REG_URL || defaults.reg,
  succ: args.succ || process.env.SUCC_URL || defaults.succ,
  cancel: args.cancel || process.env.CANCEL_URL || defaults.cancel,
};

async function probe(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const dt = Date.now() - t0;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let body = '';
    if (ct.includes('application/json')) {
      try { body = JSON.stringify(await res.json()); } catch { body = await res.text(); }
    } else if (ct.includes('text/')) {
      body = (await res.text()).slice(0, 2000);
    } else {
      body = `[non-text body: ${ct || 'unknown'}]`;
    }
    return { ok: res.ok, status: res.status, timeMs: dt, headers: Object.fromEntries(res.headers), body };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function printResult(name, result, validators = []) {
  const passAll = result && result.ok && validators.every((fn) => {
    try { return fn(result); } catch { return false; }
  });
  const statusLine = result.error ? `ERROR: ${result.error}` : `${result.status} in ${result.timeMs}ms`;
  console.log(`\n[${passAll ? 'PASS' : 'FAIL'}] ${name} -> ${statusLine}`);
  if (!result || !result.ok || validators.length) {
    console.log('Headers:', result.headers || {});
    if (result.body) {
      const snippet = result.body.slice(0, 500);
      console.log('Body:', snippet, snippet.length === 500 ? '... [truncated]' : '');
    }
  }
  return passAll;
}

(async () => {
  console.log('Live Deployment Verification');
  console.log('Targets:', cfg);

  const health = await probe(cfg.health);
  const healthOk = printResult('API Health', health, [ (r) => r.status === 200, (r) => /healthy|ok|status/i.test(r.body || '') ]);

  const index = await probe(cfg.index);
  const indexOk = printResult('API Index Page', index, [ (r) => r.status === 200, (r) => /Orange Money|WebPay|Payment/i.test(r.body || '') ]);

  const reg = await probe(cfg.reg);
  const regOk = printResult('Registration Page', reg, [ (r) => r.status === 200, (r) => /Pay with Orange Money|WEBPAY_API_BASE|WEBPAY_INDEX_URL/i.test(r.body || '') ]);

  const succ = await probe(cfg.succ);
  const succOk = printResult('Fallback Success Page', succ, [ (r) => [200,301,302].includes(r.status) ]);

  const cancel = await probe(cfg.cancel);
  const cancelOk = printResult('Fallback Cancel Page', cancel, [ (r) => [200,301,302].includes(r.status) ]);

  const summary = { healthOk, indexOk, regOk, succOk, cancelOk };
  const allOk = Object.values(summary).every(Boolean);
  console.log('\nSummary:', summary);
  console.log(allOk ? '\n✅ Live deployment looks healthy.' : '\n❌ Some checks failed. See details above.');
})();
