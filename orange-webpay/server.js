require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const axios = require('axios');

// Load env
const PORT = process.env.PORT || 5019;
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ORIGIN = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || BASE_URL; // comma-separated list allowed

// Orange WebPay / Orange Money configuration (supports both legacy and OM_* envs)
const ORANGE = {
  appId: process.env.APP_ID, // optional, informational
  clientId: process.env.CLIENT_ID, // optional
  clientSecret: process.env.CLIENT_SECRET, // optional
  basicAuth: process.env.OM_AUTHORIZATION || process.env.BASIC_AUTH, // "Basic <base64(clientId:clientSecret)>"
  merchantKey: process.env.OM_MERCHANT_KEY, // if required by your operator
  tokenUrl: process.env.OM_TOKEN_URL || process.env.TOKEN_URL,
  paymentUrl: process.env.OM_INIT_URL || process.env.PAYMENT_URL,
  statusUrl: process.env.OM_STATUS_URL || process.env.STATUS_URL,
  currency: process.env.OM_CURRENCY || process.env.CURRENCY || 'GNF'
};
// Compute Basic header if not explicitly provided
if (!ORANGE.basicAuth && ORANGE.clientId && ORANGE.clientSecret) {
  const base = Buffer.from(`${ORANGE.clientId}:${ORANGE.clientSecret}`).toString('base64');
  ORANGE.basicAuth = `Basic ${base}`;
}

const CALLBACKS = {
  success: process.env.SUCCESS_URL || '/success.html',
  cancel: process.env.CANCEL_URL || '/cancel.html',
};
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional shared secret to guard webhook
const defaultWebhookUrl = new URL('/api/orange/webhook', BASE_URL);
if (WEBHOOK_SECRET) defaultWebhookUrl.searchParams.set('secret', WEBHOOK_SECRET);
const NOTIF_URL = process.env.NOTIF_URL || defaultWebhookUrl.toString();

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: process.env.LOG_MAX_FILES || '14d',
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();

// Security & perf
app.use(helmet());
// Flexible CORS: allow comma-separated origins, localhost patterns, and file:// (Origin null)
const allowedOrigins = (ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser or file:// (Origin is null)
    if (!origin) return callback(null, true);

    // If no list configured, reflect the request origin
    if (allowedOrigins.length === 0) return callback(null, true);

    // Direct match
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Common localhost dev patterns
    try {
      const u = new URL(origin);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return callback(null, true);
      }
    } catch {}

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

// Preflight support
app.options('*', cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// HTTP logs
app.use(morgan('combined'));

// Static
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));
// Also serve the parent workspace so we can host the registration page over HTTP
app.use('/app', express.static(path.resolve(__dirname, '..'), {
  extensions: ['html', 'htm']
}));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// In-memory order store (optional, for demo)
const orders = new Map();

// Helper: fetch OAuth token from Orange API
async function getOrangeAccessToken() {
  if (!ORANGE.tokenUrl) throw Object.assign(new Error('TOKEN_URL not configured'), { status: 500 });
  const headers = {
    Authorization: ORANGE.basicAuth,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const body = new URLSearchParams({ grant_type: 'client_credentials' }).toString();
  try {
    const { data } = await axios.post(ORANGE.tokenUrl, body, { headers, timeout: 15000 });
    if (!data || !data.access_token) throw Object.assign(new Error('Failed to obtain access token'), { status: 502 });
    return data.access_token;
  } catch (err) {
    const status = err.response?.status || 500;
    const details = err.response?.data;
    logger.error('Token error', { status, details });
    const e = new Error('Failed to get access token');
    e.status = status;
    e.details = details;
    throw e;
  }
}

// Orange WebPay: create checkout session (initiate web payment)
app.post('/api/checkout', async (req, res, next) => {
  try {
  const { amount, currency, orderId, customerEmail, customerMsisdn, description, nextUrl } = req.body || {};

    if (!amount || !orderId) {
      return res.status(400).json({ error: 'amount and orderId are required' });
    }
    if (!ORANGE.paymentUrl) {
      return res.status(500).json({ error: 'PAYMENT_URL not configured' });
    }

  const effectiveCurrency = (currency || ORANGE.currency || 'GNF').toUpperCase();

  // Coerce amount to integer string (no minor units for GNF)
  const amt = Number(amount);
  const amountInt = Number.isFinite(amt) ? Math.max(0, Math.trunc(amt)) : 0;

    // Acquire OAuth token
    const token = await getOrangeAccessToken();

    // Build payload per Orange Money WebPay spec for your geography.
    // Field names can vary by country; adjust once docs are confirmed.
    // Build success/cancel URLs with passthrough params
    const successUrl = new URL(CALLBACKS.success, BASE_URL);
    const cancelUrl = new URL(CALLBACKS.cancel, BASE_URL);
    if (orderId) {
      successUrl.searchParams.set('orderId', String(orderId));
      cancelUrl.searchParams.set('orderId', String(orderId));
    }
    if (nextUrl) {
      successUrl.searchParams.set('next', nextUrl);
      cancelUrl.searchParams.set('next', nextUrl);
    }

    // Build a conservative payload: avoid nested objects; only include commonly accepted fields
    const payload = {
      amount: (process.env.OM_AMOUNT_AS_NUMBER === '1' || process.env.OM_AMOUNT_AS_NUMBER === 'true') ? amountInt : String(amountInt), // default string
      currency: effectiveCurrency,
      order_id: String(orderId),
    };
    const returnField = process.env.OM_RETURN_FIELD || 'return_url';
    const cancelField = process.env.OM_CANCEL_FIELD || 'cancel_url';
    const notifField = process.env.OM_NOTIF_FIELD || 'notif_url';
    payload[returnField] = successUrl.toString();
    payload[cancelField] = cancelUrl.toString();
    payload[notifField] = NOTIF_URL;
    const forceDesc = process.env.OM_FORCE_DESCRIPTION === '1' || process.env.OM_FORCE_DESCRIPTION === 'true';
    if (description) payload.description = description;
    else if (forceDesc) payload.description = `Order ${orderId}`;
    if (customerEmail) payload.customer_email = customerEmail;
    if (customerMsisdn) payload.customer_msisdn = customerMsisdn;
    // Some operators require merchant_key in the init payload
    if (ORANGE.merchantKey) {
      payload.merchant_key = ORANGE.merchantKey;
    }
    // Optional helpers (ignored if not used by operator)
  // Include optional fields only when explicitly configured
  if (process.env.OM_COUNTRY) payload.country = process.env.OM_COUNTRY;
  if (process.env.OM_LANG) payload.lang = process.env.OM_LANG;

    logger.info('Creating Orange WebPay checkout', { orderId, amount, currency: effectiveCurrency });

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (process.env.OM_SEND_X_TOKEN === '1' || process.env.OM_SEND_X_TOKEN === 'true') {
      headers['X-Token'] = token;
    }

    let data;
    try {
      // Some operators require JSON; others accept form-encoded. Allow opt-in via env.
      const bodyMode = (process.env.OM_INIT_BODY_MODE || 'json').toLowerCase();
      if (bodyMode === 'form') {
        const form = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        ({ data } = await axios.post(ORANGE.paymentUrl, form.toString(), { headers, timeout: 20000 }));
      } else {
        headers['Content-Type'] = 'application/json';
        ({ data } = await axios.post(ORANGE.paymentUrl, payload, { headers, timeout: 20000 }));
      }
    } catch (err) {
      const status = err.response?.status || 500;
      const details = err.response?.data;
      logger.error('Gateway init error', { status, details, payload: { ...payload, merchant_key: undefined, notif_url: undefined } });
      return res.status(status).json({ ok: false, error: 'Gateway rejected request', details });
    }

    // Common response fields include payment_url or redirect_url
    const redirectUrl = data?.payment_url || data?.redirect_url || data?.redirectUrl || data?.checkoutUrl;
    if (!redirectUrl) {
      logger.warn('Unexpected payment init response', { data: typeof data === 'object' ? { ...data, access_token: undefined } : data });
      return res.status(502).json({ error: 'Unexpected gateway response' });
    }

    res.json({ ok: true, redirectUrl, gatewayResponse: data });
  } catch (err) {
    logger.error('Checkout error', { error: err.message, details: err.details });
    res.status(err.status || 500).json({ ok: false, error: err.message, details: err.details });
  }
});

// Alternate init endpoint returning { order_id, payment_url } and storing order
app.post('/api/init', async (req, res) => {
  try {
    const { amount, currency, orderId, customerEmail, customerMsisdn, description, nextUrl } = req.body || {};
    if (!amount || !orderId) return res.status(400).json({ error: 'amount and orderId are required' });
    if (!ORANGE.paymentUrl) return res.status(500).json({ error: 'PAYMENT_URL not configured' });

    const effectiveCurrency = (currency || ORANGE.currency || 'GNF').toUpperCase();
    const amt = Number(amount);
    const amountInt = Number.isFinite(amt) ? Math.max(0, Math.trunc(amt)) : 0;

    const successUrl = new URL(CALLBACKS.success, BASE_URL);
    const cancelUrl = new URL(CALLBACKS.cancel, BASE_URL);
    if (orderId) {
      successUrl.searchParams.set('orderId', String(orderId));
      cancelUrl.searchParams.set('orderId', String(orderId));
    }
    if (nextUrl) {
      successUrl.searchParams.set('next', nextUrl);
      cancelUrl.searchParams.set('next', nextUrl);
    }

    const token = await getOrangeAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (process.env.OM_SEND_X_TOKEN === '1' || process.env.OM_SEND_X_TOKEN === 'true') {
      headers['X-Token'] = token;
    }

    const payload = {
      amount: (process.env.OM_AMOUNT_AS_NUMBER === '1' || process.env.OM_AMOUNT_AS_NUMBER === 'true') ? amountInt : String(amountInt),
      currency: effectiveCurrency,
      order_id: String(orderId),
    };
    const returnField = process.env.OM_RETURN_FIELD || 'return_url';
    const cancelField = process.env.OM_CANCEL_FIELD || 'cancel_url';
    const notifField = process.env.OM_NOTIF_FIELD || 'notif_url';
    payload[returnField] = successUrl.toString();
    payload[cancelField] = cancelUrl.toString();
    payload[notifField] = NOTIF_URL;
    const forceDesc = process.env.OM_FORCE_DESCRIPTION === '1' || process.env.OM_FORCE_DESCRIPTION === 'true';
    if (description) payload.description = description;
    else if (forceDesc) payload.description = `Order ${orderId}`;
    if (customerEmail) payload.customer_email = customerEmail;
    if (customerMsisdn) payload.customer_msisdn = customerMsisdn;
    if (ORANGE.merchantKey) payload.merchant_key = ORANGE.merchantKey;
  if (process.env.OM_COUNTRY) payload.country = process.env.OM_COUNTRY;
  if (process.env.OM_LANG) payload.lang = process.env.OM_LANG;

    let data;
    try {
      const bodyMode = (process.env.OM_INIT_BODY_MODE || 'json').toLowerCase();
      if (bodyMode === 'form') {
        const form = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        ({ data } = await axios.post(ORANGE.paymentUrl, form.toString(), { headers, timeout: 20000 }));
      } else {
        headers['Content-Type'] = 'application/json';
        ({ data } = await axios.post(ORANGE.paymentUrl, payload, { headers, timeout: 20000 }));
      }
    } catch (err) {
      const status = err.response?.status || 500;
      const details = err.response?.data;
      logger.error('Gateway init error', { status, details, payload: { ...payload, merchant_key: undefined, notif_url: undefined } });
      return res.status(400).json({ error: 'init_failed', details });
    }

    const payment_url = data?.payment_url || data?.redirect_url || data?.redirectUrl || data?.checkoutUrl;
    if (!payment_url) return res.status(400).json({ error: 'No payment_url in response', details: data });

    const out = { order_id: String(orderId), payment_url };
    orders.set(String(orderId), out);
    res.json(out);
  } catch (e) {
    logger.error('Init error', { error: e.message });
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Orange WebPay: payment status query (if STATUS_URL configured)
app.get('/api/status/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    if (!ORANGE.statusUrl) return res.status(501).json({ error: 'STATUS_URL not configured' });

    const token = await getOrangeAccessToken();
    let url = ORANGE.statusUrl;
    let params = undefined;
    if (url.includes(':orderId')) {
      url = url.replace(':orderId', encodeURIComponent(orderId));
    } else {
      // Many variants expect order_id as query param
      params = { order_id: String(orderId) };
    }

    const headers = { Authorization: `Bearer ${token}` };
    const { data } = await axios.get(url, { headers, params, timeout: 15000 });

    res.json({ ok: true, status: data });
  } catch (err) {
    logger.error('Status error', { error: err.message });
    next(err);
  }
});

// Orange WebPay webhook receiver (async notifications)
app.post('/api/orange/webhook', async (req, res) => {
  // In production, validate Orange signature/auth if provided by the API.
  // For now, just log and ack.
  try {
    if (WEBHOOK_SECRET) {
      const ok = req.query?.secret === WEBHOOK_SECRET;
      if (!ok) {
        logger.warn('Webhook rejected due to invalid secret');
        return res.status(401).json({ ok: false });
      }
    }
    logger.info('Webhook received', { body: req.body });
    res.status(200).json({ ok: true });
  } catch (e) {
    logger.error('Webhook error', { error: e.message });
    res.status(200).end(); // Always 200 to avoid retries storms; adjust if needed
  }
});

// POST /api/status with JSON body { order_id } – some operators require POST with merchant_key
app.post('/api/status', async (req, res) => {
  try {
    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id required' });
    if (!ORANGE.statusUrl) return res.status(501).json({ error: 'STATUS_URL not configured' });

    const token = await getOrangeAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const body = { order_id: String(order_id) };
    if (ORANGE.merchantKey) body.merchant_key = ORANGE.merchantKey;

    let data;
    try {
      ({ data } = await axios.post(ORANGE.statusUrl, body, { headers, timeout: 15000 }));
    } catch (err) {
      const status = err.response?.status || 500;
      const details = err.response?.data;
      logger.error('Gateway status error', { status, details });
      return res.status(400).json({ error: 'status_failed', details });
    }

    res.json(data);
  } catch (e) {
    logger.error('Status error', { error: e.message });
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  logger.error('Unhandled error', { status, message: err.message });
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

// Webhook with Bearer secret (compat with requested snippet)
app.post('/api/notify', (req, res) => {
  try {
    const auth = req.headers['authorization'];
    if (WEBHOOK_SECRET) {
      const ok = auth === `Bearer ${WEBHOOK_SECRET}` || req.query?.secret === WEBHOOK_SECRET;
      if (!ok) return res.status(401).end();
    }
    logger.info('Notify webhook received', { body: req.body });
    res.status(200).json({ received: true });
  } catch (e) {
    logger.error('Notify webhook error', { error: e.message });
    res.status(500).end();
  }
});

// Fallback to public/checkout.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.listen(PORT, HOST, () => {
  logger.info(`Server listening on http://${HOST}:${PORT}`);
});
