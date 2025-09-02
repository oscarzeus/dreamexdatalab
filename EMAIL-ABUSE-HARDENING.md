Email abuse hardening steps (Namecheap PrivateEmail)

1) Accounts and devices
- Reset all PrivateEmail mailbox passwords (unique, long).
- Enable 2FA on Namecheap account and all mailboxes.
- Scan endpoints and hosting for malware/webshells.
- Remove unknown forwarders/filters in PrivateEmail.

2) Application
- Client-side EmailJS removed. All emails go via secure SMTP backend.
- API key required on /send/secure. Configure ALLOWED_ORIGINS.
- Rate limits enabled and content filtering active.

3) DNS authentication
- SPF (example): v=spf1 include:spf.privateemail.com -all
- DKIM: enable in PrivateEmail dashboard; publish provided records.
- DMARC (monitor then enforce):
  _dmarc TXT: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain; ruf=mailto:dmarc@yourdomain; pct=100; adkim=s; aspf=s; fo=1
  After 1–2 weeks, consider p=reject.

4) Bulk/marketing mail
- Do not send bulk via PrivateEmail. Use Mailchimp/Brevo/Mailersend, etc.

5) Operations
- Rotate API keys and SMTP credentials periodically.
- Review logs under email-service/logs.
- Investigate Namecheap abuse reports by matching timestamps and recipients.
