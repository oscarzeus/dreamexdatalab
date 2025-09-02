// EmailJS backend polyfill: routes emailjs.send() calls to a secure server relay
// No secrets are exposed. Requires a server endpoint at /api/send-email that injects the API key.

(function(){
  if (window.emailjs && typeof window.emailjs.send === 'function') {
    // Already provided; do not override
    return;
  }

  async function send(serviceId, templateId, params) {
    try {
      const to = params.to_email || params.to || params.recipient || params.recipientEmail;
      const subject = params.subject || 'Notification';
      const text = params.message || params.text || JSON.stringify(params, null, 2);
      const html = params.html || null;

      if (!to) throw new Error('Recipient not provided');

      const body = { to, subject, text, html };
      const resp = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Backend relay error');
      }
      return { text: data.messageId || 'queued' };
    } catch (err) {
      console.error('emailjs polyfill send failed:', err);
      throw err;
    }
  }

  window.emailjs = { send };
})();
