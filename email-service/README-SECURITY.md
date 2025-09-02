# Dreamex Email Security System

## 🔒 Strong Security Implementation for Email Abuse Prevention

This enhanced email service implements comprehensive security measures to prevent email abuse and comply with strict email provider policies (including Namecheap and other providers).

## 🚀 Quick Start

### 1. Configuration

1. Copy the secure environment template:
   ```bash
   copy .env.secure-v2 .env
   ```

2. Edit `.env` file with your settings:
   ```bash
   # Namecheap SMTP Settings
   SMTP_HOST=mail.privateemail.com
   SMTP_PORT=587
   SMTP_USER=info@dreamexdatalab.com
   SMTP_PASS=your_password_here
   
   # Generate strong API key (32+ characters)
   API_KEY=your_secure_32_character_api_key_here
   
   # Allowed domains (your website)
   ALLOWED_ORIGINS=https://dreamexdatalab.com
   ```

3. Generate a strong API key:
   ```bash
   # Using PowerShell
   [System.Web.Security.Membership]::GeneratePassword(32, 0)
   
   # Or online: https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
   ```

### 2. Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the secure email service:
   ```bash
   start-secure-email-service.bat
   ```

### 3. Testing

Run the security test suite:
```bash
npm run test:security
```

## 🛡️ Security Features

### Content Filtering
- **Spam Detection**: Blocks emails with suspicious patterns, excessive caps, multiple exclamation marks
- **Malicious Content**: Prevents HTML injection, suspicious scripts
- **Size Limits**: Enforces maximum email size (10MB by default)
- **Attachment Security**: Blocks dangerous file types (.exe, .scr, .bat, etc.)

### Rate Limiting
- **IP-based**: Maximum 100 emails per hour per IP address
- **Sender-based**: Maximum 50 emails per hour per sender email
- **Recipient Limits**: Maximum 50 recipients per email
- **Global Limits**: Configurable daily/hourly limits

### Authentication & Authorization
- **Strong API Keys**: Requires 32+ character API keys
- **Trusted Senders**: Maintains whitelist of approved sender emails
- **Domain Validation**: Blocks temporary/disposable email domains
- **CORS Protection**: Strict origin validation

### Abuse Prevention
- **Duplicate Detection**: Prevents spam loops and duplicate emails
- **IP Reputation**: Tracks and blocks suspicious IP addresses
- **Content Analysis**: Real-time scanning for abuse patterns
- **Automatic Blocking**: Temporarily blocks repeat offenders

### Monitoring & Alerts
- **Real-time Logging**: Comprehensive security event logging
- **Security Alerts**: Automatic notifications for suspicious activity
- **Health Monitoring**: Service availability and performance tracking
- **Audit Trails**: Complete history of all email attempts

## 📊 Monitoring

### Start Security Monitor
```bash
# PowerShell (run as Administrator)
PowerShell -ExecutionPolicy Bypass -File "Monitor-EmailSecurity.ps1"
```

### Log Files
- `logs/security.log` - Security events and violations
- `logs/error.log` - System errors and failures
- `logs/warn.log` - Warnings and suspicious activities
- `logs/info.log` - General service information

### Health Check
```bash
curl http://localhost:3001/health
```

### Security Status
```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3001/security/status
```

## 🔧 API Usage

### Send Secure Email
```javascript
const response = await fetch('http://localhost:3001/send/secure', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({
        to: 'recipient@example.com',
        subject: 'Your Subject',
        text: 'Your message content',
        html: '<p>Your HTML content</p>'
    })
});
```

### Add Trusted Sender
```javascript
const response = await fetch('http://localhost:3001/security/trust-sender', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({
        email: 'trusted@example.com'
    })
});
```

## ⚙️ Configuration Options

### Security Settings (`.env`)
```bash
# Rate Limiting
EMAIL_RATE_LIMIT=50                    # Emails per hour per sender
IP_RATE_LIMIT=100                      # Emails per hour per IP
MAX_RECIPIENTS_PER_EMAIL=10            # Max recipients per email

# Content Security
MAX_EMAIL_SIZE_MB=5                    # Maximum email size
ENABLE_CONTENT_FILTERING=true          # Enable spam detection
ENABLE_DUPLICATE_DETECTION=true        # Prevent duplicate emails
ENABLE_IP_REPUTATION=true              # Track suspicious IPs

# Provider Compliance (Namecheap)
MAX_DAILY_EMAILS=500                   # Daily sending limit
MAX_HOURLY_EMAILS=50                   # Hourly sending limit
REQUIRE_TLS=true                       # Force TLS encryption
```

### Trusted Senders (`trusted-senders.json`)
```json
{
  "trustedSenders": [
    "info@dreamexdatalab.com",
    "admin@dreamexdatalab.com",
    "hr@dreamexdatalab.com"
  ],
  "blockedDomains": [
    "tempmail.org",
    "10minutemail.com",
    "guerrillamail.com"
  ]
}
```

## 🚨 Troubleshooting

### Common Issues

1. **High Rate Limit Violations**
   - Reduce sending frequency
   - Implement client-side rate limiting
   - Check for automation scripts

2. **Authentication Failures**
   - Verify API key is correct
   - Check API key header format
   - Ensure key is 32+ characters

3. **Content Filtering Blocks**
   - Review email content for spam patterns
   - Avoid excessive caps and exclamation marks
   - Use professional language

4. **Namecheap Abuse Reports**
   - Monitor logs for blocked IPs
   - Implement additional content filtering
   - Report false positives to support

### Reset Security Settings
```bash
# Stop service
Ctrl+C

# Clear rate limits and suspicious IPs
# Restart service
start-secure-email-service.bat
```

## 📈 Performance Optimization

### Production Deployment
1. Use PM2 for process management
2. Configure log rotation
3. Set up health monitoring
4. Implement backup SMTP servers

### Scaling Considerations
- Implement Redis for distributed rate limiting
- Use message queues for high volume
- Configure load balancing
- Monitor system resources

## 🔐 Security Best Practices

1. **Regular Security Audits**
   - Review logs weekly
   - Update blocked domains list
   - Monitor rate limit thresholds

2. **API Key Management**
   - Rotate keys monthly
   - Use environment variables
   - Never commit keys to version control

3. **Network Security**
   - Use HTTPS in production
   - Configure firewall rules
   - Monitor network traffic

4. **Compliance**
   - Follow CAN-SPAM guidelines
   - Implement unsubscribe mechanisms
   - Maintain email sending records

## 📞 Support

For additional support or questions:
- Review logs in `logs/` directory
- Run security tests: `npm run test:security`
- Check service health: `curl http://localhost:3001/health`

## 🔄 Version History

- **v2.0.0**: Enhanced security implementation with comprehensive abuse prevention
- **v1.x**: Basic email service with standard rate limiting
