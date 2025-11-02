const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Restrictive CORS; adjust origin via env
const allowedOrigin = process.env.FRONTEND_ORIGIN || null;
app.use(cors({ origin: (o, cb) => (!allowedOrigin || o === allowedOrigin ? cb(null, true) : cb(new Error('CORS denied'))) }));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Secure email relay: inject API key server-side
app.post('/api/send-email', async (req, res) => {
	try {
		const { to, subject, text, html, cc, bcc } = req.body || {};
		if (!to || !subject || (!text && !html)) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		const payload = { to: Array.isArray(to) ? to : [to], subject, text, html, cc, bcc };
		const apiKey = process.env.EMAIL_SERVICE_API_KEY || process.env.API_KEY;
		const baseUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:3001';
		if (!apiKey) return res.status(500).json({ error: 'Email service API key not configured' });
		const resp = await fetch(`${baseUrl}/send/secure`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
			body: JSON.stringify(payload)
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok) return res.status(resp.status).json({ error: data.error || 'Email service error' });
		return res.json(data);
	} catch (err) {
		console.error('Relay error:', err);
		return res.status(500).json({ error: 'Server error' });
	}
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Relay server listening on ${port}`));

