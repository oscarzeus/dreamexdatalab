// Simple live check script for Orange Money deployment
// Usage (PowerShell):
//   node server/test-endpoints.js
//   node server/test-endpoints.js --health=https://api.example.com/health
//   node server/test-endpoints.js --reg=https://example.com/company-complete-registration.html

/*
Contract
- Inputs (all optional via args):
	--health=<url>   Health endpoint to probe (default: https://api.dreamexdatalab.com/health)
	--index=<url>    Backend index page (default: https://api.dreamexdatalab.com/)
	--reg=<url>      Registration page (default: https://dreamexdatalab.com/company-complete-registration.html)
	--succ=<url>     Fallback success page (default: https://dreamexdatalab.com/payment/success.html)
	--cancel=<url>   Fallback cancel page (default: https://dreamexdatalab.com/payment/cancel.html)

- Outputs: Console report with PASS/FAIL per probe
- Error modes: Network errors, TLS/hostname mismatch, 4xx/5xx, content missing
*/

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(url, opts = {}) {
	const t0 = Date.now();
	try {
		const res = await fetch(url, { method: opts.method || 'GET', redirect: 'manual' });
		const dt = Date.now() - t0;
		const ct = (res.headers.get('content-type') || '').toLowerCase();
		let body = '';
		if (ct.includes('application/json')) {
			try {
				const json = await res.json();
				body = JSON.stringify(json);
			} catch {
				body = await res.text();
			}
		} else if (ct.includes('text/')) {
			body = (await res.text()).slice(0, 5000);
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
	const statusLine = result.error
		? `ERROR: ${result.error}`
		: `${result.status} in ${result.timeMs}ms`;
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

	// 1) Health
	const health = await probe(cfg.health);
	const healthOk = printResult('API Health', health, [
		(r) => r.status === 200,
		(r) => /healthy|ok|status/i.test(r.body || ''),
	]);

	// 2) Backend index page
	const index = await probe(cfg.index);
	const indexOk = printResult('API Index Page', index, [
		(r) => r.status === 200,
		(r) => /Orange Money|WebPay|Payment/i.test(r.body || ''),
	]);

	// 3) Registration page wiring
	const reg = await probe(cfg.reg);
	const regOk = printResult('Registration Page', reg, [
		(r) => r.status === 200,
		(r) => /Pay with Orange Money|WEBPAY_API_BASE|WEBPAY_INDEX_URL/i.test(r.body || ''),
	]);

	// 4) Static fallback pages
	const succ = await probe(cfg.succ);
	const succOk = printResult('Fallback Success Page', succ, [
		(r) => [200, 301, 302].includes(r.status),
		(r) => /company-complete-registration\.html|payment=success/i.test(r.body || '') ||
						/meta.*refresh/i.test(r.body || ''),
	]);

	const cancel = await probe(cfg.cancel);
	const cancelOk = printResult('Fallback Cancel Page', cancel, [
		(r) => [200, 301, 302].includes(r.status),
		(r) => /company-complete-registration\.html|payment=cancel/i.test(r.body || '') ||
						/meta.*refresh/i.test(r.body || ''),
	]);

	// Summary
	const summary = { healthOk, indexOk, regOk, succOk, cancelOk };
	const allOk = Object.values(summary).every(Boolean);
	console.log('\nSummary:', summary);
	console.log(allOk ? '\n✅ Live deployment looks healthy.' : '\n❌ Some checks failed. See details above.');
})();

