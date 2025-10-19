# Orange WebPay Scaffold

A minimal Express-based backend and static checkout pages to integrate Orange Web Payment Gateway.

## Prerequisites
- Node.js 18+

## Configure
1. Copy `.env` and fill in the required values.
   - Set TOKEN_URL, PAYMENT_URL, and optionally STATUS_URL according to your Orange country endpoint.
   - CURRENCY is preset to GNF.

## Install
From the `orange-webpay` directory:

```powershell
npm install
```

## Run (development)
```powershell
npm run dev
```
The server will start on http://localhost:5019 (or PORT from `.env`).

## Try it
Open http://localhost:5019/checkout.html and submit a test payment.

> Note: Do not expose client secret to the browser; this server mediates OAuth and payment initiation securely on the server side.
