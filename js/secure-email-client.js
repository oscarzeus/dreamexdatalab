// Minimal backend email client (browser-safe wrapper)
// Do not expose real API key in production; call this from server-side or via a secured proxy.

window.secureEmailClient = {
  async sendEmail({ to, subject, text, html, cc, bcc }) {
    if (!Array.isArray(to)) to = [to].filter(Boolean);
    const body = { to, subject, text, html, cc, bcc };

    // API key must not be hardcoded on the client; rely on server session or omit to force server-side only.
    const apiKey = null;

    const resp = await fetch('http://localhost:3001/send/secure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Email send failed');
    }
    return resp.json();
  }
};
