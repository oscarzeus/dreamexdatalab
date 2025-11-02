# Orange Money Production (Scaffold)

A minimal Express server scaffold to integrate Orange Money WebPay. This includes views, routes, and placeholders for configuration and middleware.

## Quick start (Windows PowerShell)

1. Install Node.js 18+.
2. In this folder, install dependencies:

```
npm install
```

3. Copy `.env` and fill in your secrets:
- API_KEY
- OM_MERCHANT_KEY
- OM_MERCHANT_PASSWORD
- Adjust URLs if needed

4. Run the server:

```
npm run start
```

Open http://localhost:3000 to see the demo form.

## Endpoints

- GET `/` – Demo checkout page
- POST `/api/payments/create` – Creates a payment session (stub)
- POST `/api/payments/callback` – Provider callback (stub)
- GET `/success` – Success landing
- GET `/cancel` – Cancel landing
- GET `/health` – Health probe

## Next steps

- Implement real Orange Money authentication (OAuth/token) and payment creation per their WebPay spec.
- Validate callback signatures and update your order database.
- Protect create route with `requireApiKey` if exposing publicly.

## Security

Do not commit your `.env` file. Rotate keys on leaks. Use HTTPS in production.