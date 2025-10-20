/**
 * Orange Money WebPay API via Firebase Cloud Functions (permanent HTTPS)
 */

const functions = require('firebase-functions');
const express = require('express');
const axios = require('axios');

// Build Express app
const app = express();
app.use(express.json());

// Minimal CORS allowing dreamexdatalab.com and subdomains
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin;
    if (origin) {
      const u = new URL(origin);
      const host = (u.hostname || '').toLowerCase();
      if (host === 'dreamexdatalab.com' || host.endsWith('.dreamexdatalab.com')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      }
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  } catch (e) {
    next();
  }
});

// Read Orange credentials from Firebase runtime config or env
// Set via: firebase functions:config:set orange.client_id="..." orange.client_secret="..." orange.merchant_key="..." orange.application_id="..."
const cfg = functions.config && functions.config();
const orangeCfg = (cfg && cfg.orange) || {};

const ORANGE_CONFIG = {
  client_id: process.env.ORANGE_CLIENT_ID || orangeCfg.client_id || '',
  client_secret: process.env.ORANGE_CLIENT_SECRET || orangeCfg.client_secret || '',
  merchant_key: process.env.ORANGE_MERCHANT_KEY || orangeCfg.merchant_key || '',
  application_id: process.env.ORANGE_APPLICATION_ID || orangeCfg.application_id || '',
};

let accessToken = null;
let tokenExpiry = 0;

async function getOrangeToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const basicHeader = 'Basic ' + Buffer.from(`${ORANGE_CONFIG.client_id}:${ORANGE_CONFIG.client_secret}`).toString('base64');
  const resp = await axios.post(
    'https://api.orange.com/oauth/v3/token',
    'grant_type=client_credentials',
    { headers: { Authorization: basicHeader, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 10000 }
  );
  accessToken = resp.data.access_token;
  tokenExpiry = Date.now() + (resp.data.expires_in * 1000) - 300000; // 5 min early
  return accessToken;
}

function getPublicBaseUrl() {
  return 'https://dreamexdatalab.com';
}

function getFunctionBase(req) {
  // Cloud Functions URL is https://<region>-<project>.cloudfunctions.net/orangePay
  const proto = (req.headers['x-forwarded-proto'] || 'https');
  const host = req.get('host');
  return `${proto}://${host}/orangePay`;
}

function getNotifBaseUrl(req) {
  const override = process.env.ORANGE_NOTIF_BASE || orangeCfg.notif_base;
  if (override && /^https?:\/\//i.test(override)) return override.replace(/\/$/, '');
  return getFunctionBase(req);
}

async function initiatePayment(req, res) {
  try {
    const { amount, phone: rawPhone, customerMsisdn, orderId: providedOrderId, description, nextUrl, currency } = req.body || {};

    const amt = parseInt(amount, 10);
    if (!amt || amt < 1000) return res.json({ success: false, error: 'Le montant minimum est de 1000 GNF' });

    const normalizedPhone = String((rawPhone ?? customerMsisdn ?? '')).replace(/\D/g, '');
    if (!normalizedPhone || !/^[0-9]{9}$/.test(normalizedPhone)) {
      return res.json({ success: false, error: 'Numéro de téléphone invalide. Utilisez 9 chiffres.' });
    }

    // Ensure credentials present
    if (!ORANGE_CONFIG.client_id || !ORANGE_CONFIG.client_secret || !ORANGE_CONFIG.merchant_key) {
      return res.json({ success: false, error: 'Configuration Orange Money manquante côté serveur' });
    }

    const token = await getOrangeToken();

    const orderId = providedOrderId && String(providedOrderId).trim() ? String(providedOrderId).trim() : 'CMD' + Date.now();
    const payload = {
      merchant_key: ORANGE_CONFIG.merchant_key,
      currency: (currency && typeof currency === 'string' ? currency.toUpperCase() : 'GNF'),
      order_id: orderId,
      amount: amt,
      return_url: nextUrl && typeof nextUrl === 'string' && nextUrl.startsWith('http')
        ? `${nextUrl}${nextUrl.includes('?') ? '&' : '?'}order_id=${orderId}`
        : `${getPublicBaseUrl()}/success.html?order_id=${orderId}`,
      cancel_url: `${getPublicBaseUrl()}/cancel.html?order_id=${orderId}`,
      notif_url: `${getNotifBaseUrl(req)}/api/webhook`,
      lang: 'fr',
      reference: description && String(description).trim() ? String(description).trim() : `REF${orderId}`,
      phone: normalizedPhone,
    };
    if (ORANGE_CONFIG.application_id) payload.application_id = ORANGE_CONFIG.application_id;

    // Debug mode: just echo payload (without merchant_key)
    if (req.query && req.query.debug === '1') {
      const { merchant_key, ...safe } = payload;
      return res.json({ success: true, debug: true, payload: safe });
    }

    const omResp = await axios.post(
      'https://api.orange.com/orange-money-webpay/gn/v1/webpayment',
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    return res.json({ success: true, ok: true, payment_url: omResp.data.payment_url, redirectUrl: omResp.data.payment_url, order_id: orderId });
  } catch (err) {
    const msg = err.response?.data?.message || (err.code === 'ECONNABORTED' ? 'Timeout - Service Orange Money non disponible' : 'Erreur lors de la création du paiement');
    return res.json({ success: false, ok: false, error: msg, details: err.response?.data || undefined });
  }
}

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.post('/api/pay', initiatePayment);
app.post('/api/checkout', initiatePayment);
app.post('/api/webhook', (req, res) => {
  // Log and acknowledge; production: verify signature if provided by Orange
  console.log('OM Webhook:', req.body);
  res.status(200).send('OK');
});
app.get('/api/debug/config', (req, res) => {
  res.json({
    public_base_url: getPublicBaseUrl(),
    function_base_url: getFunctionBase(req),
    notif_base_url: getNotifBaseUrl(req),
    merchant_key_present: !!ORANGE_CONFIG.merchant_key,
    application_id_present: !!ORANGE_CONFIG.application_id,
    has_client: !!ORANGE_CONFIG.client_id,
  });
});

// Export Cloud Function
module.exports = functions.region('us-central1').https.onRequest(app);
