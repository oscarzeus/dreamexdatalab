import axios from 'axios';
import OrangeMoneyConfig from '../config/orange-money.js';

let tokenCache = {
  accessToken: null,
  expiresAt: null,
};

export class OrangeMoneyAuth {
  async getAccessToken() {
    // Return cached token if valid
    if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
      console.log('🔄 Using cached Orange Money token');
      return tokenCache.accessToken;
    }

    console.log('🔑 Requesting new Orange Money token...');

    try {
      const { clientId, clientSecret } = OrangeMoneyConfig.credentials;
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post(
        OrangeMoneyConfig.urls.token,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      // Cache the token (expires in 1 hour, refresh after 55 minutes)
      tokenCache = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + response.data.expires_in * 1000 - 300000,
      };

      console.log('✅ New Orange Money token obtained successfully');
      return tokenCache.accessToken;
    } catch (error) {
      console.error('❌ Token acquisition failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error('ORANGE_MONEY_AUTH_FAILED');
    }
  }

  // Validate webhook signature (placeholder)
  validateWebhookSignature(signature, payload) {
    return true;
  }
}

export default new OrangeMoneyAuth();

