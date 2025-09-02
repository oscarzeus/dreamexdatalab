/**
 * Dreamex System Configuration
 * Global configuration for the Dreamex DataLab HSE System
 * Includes secure email service settings
 */

window.DREAMEX_CONFIG = {
    // Email Service Configuration
    emailService: {
        baseUrl: 'http://localhost:3001',
        apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual API key
        timeout: 30000,
        retryAttempts: 3
    },
    
    // Security Settings
    security: {
        enableContentValidation: true,
        enableRateLimiting: true,
        logSecurityEvents: true
    },
    
    // Application Settings
    app: {
        name: 'Dreamex DataLab HSE System',
        version: '2.0.0',
        environment: 'production'
    },
    
    // API Key for secure email client (legacy compatibility)
    apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual API key
    
    // Email Service URL (legacy compatibility)
    emailServiceUrl: 'http://localhost:3001'
};

// Initialize secure email client when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if email service is available
    if (window.DreamexEmailClient) {
        window.DreamexEmailClient.checkHealth().then(health => {
            if (health.healthy) {
                console.log('✅ Dreamex Email Service: Connected and healthy');
            } else {
                console.warn('⚠️ Dreamex Email Service: Health check failed', health.error);
            }
        }).catch(error => {
            console.error('❌ Dreamex Email Service: Connection failed', error.message);
        });
    }
});

// Legacy email function for backward compatibility
async function sendEmailNotification(emailData) {
    if (!window.DreamexEmailClient) {
        console.error('Dreamex Email Client not loaded');
        throw new Error('Email service not available');
    }
    
    try {
        const result = await window.DreamexEmailClient.sendEmail(emailData);
        return {
            success: true,
            messageId: result.messageId,
            securityScore: result.securityScore
        };
    } catch (error) {
        console.error('Email sending failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Show security status in console (for debugging)
if (typeof console !== 'undefined' && console.log) {
    console.log('%c🔒 Dreamex Security System Loaded', 'color: green; font-weight: bold;');
    console.log('Email Security Features: Content Filtering, Rate Limiting, Spam Detection');
    console.log('Configuration:', window.DREAMEX_CONFIG);
}
