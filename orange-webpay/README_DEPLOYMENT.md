# Orange WebPay — Ubuntu (systemd) Deployment Guide

This guide shows how to deploy the `orange-webpay` server on Ubuntu using systemd. It assumes you have a domain and will run behind a reverse proxy (e.g., Nginx) over HTTPS.

## 1) Install Node 20 LTS and git (Ubuntu)

```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

## 2) Clone & build

```bash
sudo mkdir -p /var/www/orange-webpay && sudo chown $USER:$USER /var/www/orange-webpay
cd /var/www/orange-webpay
# Replace with your repository URL
git clone <your-repo-url> .

# Install dependencies
npm install --no-fund --no-audit

# Create logs dir
mkdir -p logs
```

## 3) Create production env file

Create `/var/www/orange-webpay/.env.prod` from the example and edit values:

```bash
cp .env.example.prod .env.prod
nano .env.prod
```

Example content (see `.env.example.prod` in repo):

```ini
NODE_ENV=production
PORT=8080
HOST=0.0.0.0
BASE_URL=https://your-domain.tld

# Comma-separated list
CORS_ALLOWED_ORIGINS=https://your-domain.tld,https://www.your-domain.tld

# Orange Money credentials
OM_AUTHORIZATION=Basic <base64(client_id:client_secret)>
OM_MERCHANT_KEY=your-merchant-key
OM_CURRENCY=GNF

# Orange Money endpoints (from your operator portal)
OM_TOKEN_URL=https://prod.orange-money/api/oauth/v1/token
OM_INIT_URL=https://prod.orange-money/api/webpayment/v1/transactions
OM_STATUS_URL=https://prod.orange-money/api/webpayment/v1/transactions/status

# Optional
WEBHOOK_SECRET=choose-a-long-random-string
SUCCESS_URL=/success.html
CANCEL_URL=/cancel.html
```

Notes:
- Ensure `BASE_URL` matches your public HTTPS domain.
- If you run behind Nginx, expose the Node server on 127.0.0.1:8080 and reverse proxy 443 to it.

## 4) Create a systemd service file

```bash
sudo tee /etc/systemd/system/orange-webpay.service >/dev/null <<'SERVICE'
[Unit]
Description=Orange Money WebPay (Node)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/var/www/orange-webpay/.env.prod
WorkingDirectory=/var/www/orange-webpay
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE
```

Give write permission for logs to www-data:

```bash
sudo chown -R www-data:www-data /var/www/orange-webpay/logs
```

## 5) Start & enable

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now orange-webpay
sudo systemctl status orange-webpay --no-pager
```

If you update the code later:

```bash
cd /var/www/orange-webpay
git pull
npm install --no-fund --no-audit
sudo systemctl restart orange-webpay
```

## 6) (Optional) Nginx reverse proxy

```nginx
server {
  listen 80;
  server_name your-domain.tld www.your-domain.tld;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.tld www.your-domain.tld;

  ssl_certificate /etc/letsencrypt/live/your-domain.tld/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.tld/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

Reload Nginx: `sudo nginx -t && sudo systemctl reload nginx`

## Troubleshooting
- Check logs: `journalctl -u orange-webpay -n 200 --no-pager`
- Health: `curl -s http://127.0.0.1:8080/health`
- CORS errors: verify `CORS_ALLOWED_ORIGINS` includes your site URLs.
- Orange 400s: check service logs; details from the gateway are included in error responses.
