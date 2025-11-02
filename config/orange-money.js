import dotenv from 'dotenv';
dotenv.config();

class OrangeMoneyConfig {
  constructor() {
    this.validateConfig();
  }

  validateConfig() {
    const required = [
      'ORANGE_CLIENT_ID',
      'ORANGE_CLIENT_SECRET',
      'ORANGE_MERCHANT_KEY',
      'DOMAIN',
    ];
    const missing = required.filter((field) => !process.env[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  get credentials() {
    return {
      clientId: process.env.ORANGE_CLIENT_ID,
      clientSecret: process.env.ORANGE_CLIENT_SECRET,
      merchantKey: process.env.ORANGE_MERCHANT_KEY,
    };
  }

  get applicationId() {
    return process.env.ORANGE_APPLICATION_ID || null;
  }

  get urls() {
    // Support separate domains for frontend redirects and API webhook if provided
    const apiDomain = process.env.API_DOMAIN || process.env.DOMAIN;
    const frontendDomain = process.env.FRONTEND_DOMAIN || process.env.DOMAIN;
    return {
      token: process.env.ORANGE_TOKEN_URL,
      payment: process.env.ORANGE_PAYMENT_URL,
      // Redirect back to dedicated success/cancel pages on the API domain
      // This avoids unintended redirects and keeps the user on a confirmation screen.
      return: `${apiDomain}/payment/success.html`,
      cancel: `${apiDomain}/payment/cancel.html`,
      notification: `${apiDomain}/api/payments/webhook`,
    };
  }

  get currency() {
    return 'GNF';
  }

  get language() {
    return 'fr';
  }
}

export default new OrangeMoneyConfig();
