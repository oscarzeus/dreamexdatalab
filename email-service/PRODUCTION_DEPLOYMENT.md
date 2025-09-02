# Dreamex Email Service - Production Deployment Guide

## 🚀 Production Deployment Checklist

### Prerequisites
- [ ] Node.js 16 LTS or higher installed
- [ ] npm or yarn package manager
- [ ] Production email credentials (privateemail.com)
- [ ] SSL certificate for HTTPS (recommended)
- [ ] Firewall configured for port 3001
- [ ] Domain/subdomain for email service

### 1. Environment Setup

#### Create Production Environment File
```bash
cp .env.production .env
```

#### Configure Critical Settings
Edit `.env` file with production values:
```bash
# SMTP Configuration
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@dreamexdatalab.com
SMTP_PASS=YOUR_ACTUAL_PASSWORD

# Production Settings
NODE_ENV=production
PORT=3001

# Security - CRITICAL: Generate strong API key
API_KEY=GENERATE_STRONG_32_CHAR_KEY_HERE

# Domains - Update with your actual production domains
ALLOWED_ORIGINS=https://dreamexdatalab.com,https://www.dreamexdatalab.com,https://app.dreamexdatalab.com

# Rate Limiting
EMAIL_RATE_LIMIT=500

# Monitoring
ENABLE_METRICS=true
ENABLE_EMAIL_LOGGING=true
```

### 2. Security Configuration

#### API Key Generation
Generate a secure API key:
```bash
# Use a password generator or run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### CORS Configuration
Ensure `ALLOWED_ORIGINS` includes only your production domains:
- No localhost URLs
- All URLs must use HTTPS in production
- No wildcard origins (*)

#### SSL/TLS Settings
The service is configured for TLS 1.2+ with secure ciphers.

### 3. Installation & Dependencies

#### Install Production Dependencies
```bash
npm ci --only=production --no-audit --no-fund
```

### 4. Production Process Management

#### Option A: PM2 (Recommended)
Install PM2 globally:
```bash
npm install -g pm2
```

Start with PM2:
```bash
pm2 start ecosystem.config.json --env production
pm2 save
pm2 startup
```

#### Option B: Direct Node.js
```bash
NODE_ENV=production node email-server-production.js
```

### 5. Monitoring & Health Checks

#### Health Check Endpoint
```
GET http://localhost:3001/health
```

Expected Response:
```json
{
  "status": "healthy",
  "service": "dreamex-email-service",
  "healthy": true,
  "uptime": 123456,
  "stats": {
    "emailsSent": 42,
    "emailsFailed": 1
  }
}
```

#### Metrics Endpoint
```
GET http://localhost:3001/metrics
```

### 6. Logging

#### Log Locations
- Combined logs: `./logs/combined.log`
- Error logs: `./logs/error.log`
- Output logs: `./logs/out.log`

#### Log Rotation (Recommended)
Set up log rotation for production:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:max_size 10M
```

### 7. Firewall Configuration

#### Open Required Ports
```bash
# Windows Firewall
netsh advfirewall firewall add rule name="Dreamex Email Service" dir=in action=allow protocol=TCP localport=3001

# UFW (Linux)
sudo ufw allow 3001/tcp
```

### 8. Reverse Proxy Setup (Nginx)

#### Sample Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name email.dreamexdatalab.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for email processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 9. Database Backup (If Applicable)

#### Email Log Backup
If using file-based logging, ensure logs are backed up:
```bash
# Daily backup script
tar -czf email-logs-$(date +%Y%m%d).tar.gz logs/
```

### 10. Testing Production Deployment

#### 1. Health Check Test
```bash
curl -f http://localhost:3001/health || echo "Health check failed"
```

#### 2. SMTP Test
```bash
curl -X POST http://localhost:3001/send-email \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "to": "test@yourdomain.com",
    "subject": "Production Test",
    "text": "Email service production test"
  }'
```

#### 3. Rate Limiting Test
```bash
# Send multiple requests to test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3001/send-email \
    -H "Content-Type: application/json" \
    -H "X-API-Key: YOUR_API_KEY" \
    -d '{"to":"test@yourdomain.com","subject":"Rate Test '$i'","text":"Test"}' &
done
```

### 11. Monitoring & Alerts

#### PM2 Monitoring
```bash
pm2 monit
```

#### System Resource Monitoring
Monitor CPU, memory, and disk usage:
```bash
# Check service resource usage
pm2 show dreamex-email-service
```

#### Email Delivery Monitoring
Set up alerts for:
- Failed email deliveries
- SMTP connection failures
- High error rates
- Service downtime

### 12. Maintenance

#### Update Dependencies
```bash
npm audit
npm update
```

#### Log Maintenance
```bash
# Clear old logs (older than 30 days)
find logs/ -name "*.log" -mtime +30 -delete
```

#### Backup Configuration
```bash
# Backup critical files
tar -czf email-service-backup-$(date +%Y%m%d).tar.gz \
  .env package.json ecosystem.config.json logs/
```

### 13. Troubleshooting

#### Common Issues

1. **SMTP Authentication Failed**
   - Check email credentials
   - Verify SMTP server settings
   - Check firewall/network connectivity

2. **High Memory Usage**
   - Check for memory leaks
   - Adjust PM2 max memory restart
   - Monitor email queue size

3. **Rate Limiting Issues**
   - Adjust EMAIL_RATE_LIMIT
   - Check IP-based rate limiting
   - Implement retry logic in client applications

4. **CORS Errors**
   - Verify ALLOWED_ORIGINS configuration
   - Check request headers
   - Ensure HTTPS in production

#### Debug Mode
Enable debug logging:
```bash
LOG_LEVEL=debug pm2 restart dreamex-email-service
```

### 14. Security Best Practices

- [ ] Use HTTPS only in production
- [ ] Regularly rotate API keys
- [ ] Monitor for unauthorized access attempts
- [ ] Keep dependencies updated
- [ ] Use strong SMTP passwords
- [ ] Implement request signing for critical applications
- [ ] Regular security audits

### 15. Backup & Recovery

#### Full Service Backup
```bash
# Create complete backup
tar -czf dreamex-email-service-full-backup-$(date +%Y%m%d).tar.gz \
  email-server-production.js package.json .env ecosystem.config.json logs/
```

#### Recovery Procedure
1. Restore backup files
2. Install dependencies: `npm ci --only=production`
3. Verify .env configuration
4. Start service with PM2
5. Run health checks

---

## 🚨 Emergency Contacts & Procedures

### Service Down Emergency
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs dreamex-email-service`
3. Restart service: `pm2 restart dreamex-email-service`
4. If persistent, check SMTP credentials and network connectivity

### High Error Rate
1. Check SMTP server status
2. Verify rate limiting settings
3. Check for network issues
4. Review recent configuration changes

---

**This production deployment ensures high availability, security, and monitoring for the Dreamex Email Service.**
