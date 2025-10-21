# 🚀 Production Deployment Guide - Orange Money Payment Gateway

## Prerequisites
- Domain: `dreamexdatalab.com` pointing to your server
- SSL certificate (Let's Encrypt recommended)
- Ubuntu/CentOS server with Node.js 18+
- PM2 process manager
- Nginx reverse proxy

## 🔧 1. Server Setup

### Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Deploy Application
```bash
# Clone/upload your project to server
cd /var/www/
sudo git clone <your-repo> orange-money-production
# OR upload via FTP/SCP

# Set permissions
sudo chown -R $USER:$USER /var/www/orange-money-production
cd /var/www/orange-money-production

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs
```

## 🔒 3. SSL Certificate Setup

### Option A: Let's Encrypt (Recommended)
```bash
# Obtain SSL certificate
sudo certbot --nginx -d dreamexdatalab.com

# Auto-renewal (optional)
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option B: Custom Certificate
```bash
# If you have custom SSL files:
sudo mkdir -p /etc/ssl/private/
sudo cp your-certificate.crt /etc/ssl/certs/dreamexdatalab.com.crt
sudo cp your-private-key.key /etc/ssl/private/dreamexdatalab.com.key
sudo chmod 600 /etc/ssl/private/dreamexdatalab.com.key
```

## 🌐 4. Nginx Configuration

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/dreamexdatalab.com
```

### Nginx Config Content:
```nginx
server {
    listen 80;
    server_name dreamexdatalab.com www.dreamexdatalab.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dreamexdatalab.com www.dreamexdatalab.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/dreamexdatalab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dreamexdatalab.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Specific routes for Orange Money callbacks
    location /payment/success.html {
        proxy_pass http://localhost:3000/payment/success.html;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /payment/cancel.html {
        proxy_pass http://localhost:3000/payment/cancel.html;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/payments/webhook {
        proxy_pass http://localhost:3000/api/payments/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/dreamexdatalab.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 5. Production Environment Configuration

Update your production `.env`:
```bash
cd /var/www/orange-money-production
sudo nano .env
```

## 🚀 6. Start Application with PM2

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# Monitor application
pm2 monit
```

## 🔍 7. Verification Steps

### Test HTTPS:
```bash
curl -I https://dreamexdatalab.com/health
```

### Test Payment Flow:
1. Visit: https://dreamexdatalab.com
2. Submit test payment
3. Verify Orange Money redirect works
4. Check webhook reception

### Monitor Logs:
```bash
pm2 logs orange-money-payment
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🔐 8. Security Checklist

- [ ] SSL certificate installed and working
- [ ] HTTP redirects to HTTPS
- [ ] Security headers configured
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Node.js app runs as non-root user
- [ ] Environment variables secured
- [ ] Regular security updates scheduled

## 🚨 9. Troubleshooting

### Common Issues:
1. **SSL Certificate Issues**: Check certbot logs: `sudo journalctl -u certbot`
2. **Nginx 502 Error**: Check if Node.js app is running: `pm2 status`
3. **Orange Money Webhook Issues**: Check firewall and callback URLs
4. **Performance Issues**: Monitor with `pm2 monit` and check logs

### Important Files:
- Application: `/var/www/orange-money-production/`
- Nginx config: `/etc/nginx/sites-available/dreamexdatalab.com`
- SSL certificates: `/etc/letsencrypt/live/dreamexdatalab.com/`
- PM2 logs: `~/.pm2/logs/`

## 📱 10. Orange Money Portal Configuration

Configure these exact URLs in your Orange Money merchant portal:
- **Success URL**: `https://dreamexdatalab.com/payment/success.html`
- **Cancel URL**: `https://dreamexdatalab.com/payment/cancel.html`  
- **Notification URL**: `https://dreamexdatalab.com/api/payments/webhook`

---

**🎉 Your Orange Money payment gateway is now ready for production!**