# Dreamex Datalab Email Service

Email notification service for the Dreamex Datalab HSE System. Provides SMTP-based email delivery for access requests, KPI assignments, interview notifications, and other system communications.

## Quick Start

### Windows
```bash
# Double-click or run in Command Prompt
start-email-service.bat
```

### Linux/Mac
```bash
# Make executable and run
chmod +x start-email-service.sh
./start-email-service.sh
```

### Manual Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your email settings
# Start the service
npm start
```

## Features

- 📧 SMTP email delivery via Privateemail.com
- 🔐 API key authentication
- 🚦 Rate limiting (100 emails/hour default)
- 📊 Health monitoring endpoints
- 🔄 Auto-retry with connection pooling
- 📝 Multiple email templates
- 🛡️ CORS protection
- 📋 Delivery logging

## Email Templates Supported

- **Access Request Notifications** - Approval required alerts
- **Request Completion** - Approval/rejection confirmations  
- **KPI Assignment** - Line manager notifications
- **Interview Reports** - Candidate evaluation summaries
- **Recruitment Notifications** - Position closure alerts

## API Endpoints

### Health Checks
- `GET /health` - Service status
- `GET /health/smtp` - SMTP connection status

### Email Sending
- `POST /send/approval-notification` - Access request approvals
- `POST /send/completion-notification` - Request completions
- `POST /send/kpi-assignment` - KPI assignments
- `POST /send/interview-report` - Interview reports
- `POST /send/recruitment-notification` - Recruitment updates
- `POST /test/email` - Test email delivery

## Configuration

Create `.env` file with:

```properties
# SMTP Settings
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@dreamexdatalab.com
SMTP_PASS=your-password

# Service Settings
FROM_EMAIL=your-email@dreamexdatalab.com
FROM_NAME="Dreamex Datalab HSE System"
REPLY_TO=your-email@dreamexdatalab.com

# Server Settings
PORT=3001
NODE_ENV=development
API_KEY=dreemex_hse_email_service_2025

# Security
ALLOWED_ORIGINS=http://localhost:5500,file://,null
EMAIL_RATE_LIMIT=100
```

## Usage Example

```javascript
// Send KPI assignment notification
const response = await fetch('http://localhost:3001/send/kpi-assignment', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dreemex_hse_email_service_2025'
    },
    body: JSON.stringify({
        to: 'manager@dreamexdatalab.com',
        toName: 'John Manager',
        subject: 'KPI Assignment Period Started',
        htmlContent: '<h1>KPI assignments are now open...</h1>',
        templateType: 'kpi-assignment-notification'
    })
});

const result = await response.json();
console.log('Email sent:', result.messageId);
```

## Troubleshooting

### Common Issues

1. **SMTP Connection Failed**
   - Verify email credentials in `.env`
   - Check network connectivity
   - Run `npm run test` to validate settings

2. **Service Won't Start**  
   - Check if port 3001 is available
   - Install dependencies: `npm install`
   - Verify Node.js version (14+ required)

3. **401 Unauthorized**
   - Confirm API key in request headers
   - Check `API_KEY` in `.env` file

4. **CORS Errors**
   - Add your origin to `ALLOWED_ORIGINS`
   - Use correct protocol (http/https)

For detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Development

```bash
# Development mode with auto-restart
npm run dev

# Run tests
npm run test

# Check service health
curl http://localhost:3001/health
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use process manager (PM2, systemd)
3. Configure reverse proxy (nginx)
4. Enable HTTPS
5. Set up monitoring and logging

## Security

- API keys required for all endpoints
- Rate limiting prevents abuse
- CORS protection enabled
- Input validation and sanitization
- No sensitive data in logs

## Support

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Monitor service logs for errors
- Test SMTP connection with health endpoints
- Verify email provider settings
