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
    const domain = process.env.DOMAIN;
    return {
      token: process.env.ORANGE_TOKEN_URL,
      payment: process.env.ORANGE_PAYMENT_URL,
      return: `${domain}/payment/success`,
      cancel: `${domain}/payment/cancel`,
      notification: `${domain}/api/payments/webhook`,
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
