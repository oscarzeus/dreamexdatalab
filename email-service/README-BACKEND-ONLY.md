Backend-only email policy

- All email must go through the secure SMTP service: http://localhost:3001/send/secure
- Provide x-api-key in request headers. Do not call from public browser code.
- Allowed origins are restricted by ALLOWED_ORIGINS in .env.

Minimal POST payload

{
  "to": ["user@example.com"],
  "subject": "Subject",
  "text": "Plain text",
  "html": "<p>HTML</p>"
}

Security

- Rotate API_KEY regularly.
- Keep SMTP_USER and SMTP_PASS secret.
- Enforce SPF, DKIM, DMARC in DNS.
- Remove any client-side EmailJS usage and rotate those keys at the provider.
