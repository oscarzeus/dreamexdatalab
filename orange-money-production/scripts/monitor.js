import axios from 'axios';

async function healthCheck() {
  try {
    const url = process.env.HEALTH_URL || 'https://yourdomain.com/health';
    const response = await axios.get(url, { timeout: 5000 });
    console.log('✅ Health check passed:', response.data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    // TODO: Send alert email/SMS via your provider
  }
}

// Run every 5 minutes
setInterval(healthCheck, 5 * 60 * 1000);

// Run immediately on start
healthCheck();
