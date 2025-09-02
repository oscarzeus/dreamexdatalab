const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // Allow file:// protocol for local development
        if (origin.startsWith('file://')) return callback(null, true);
        
        // Check against allowed origins
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500').split(',');
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const { RateLimiterMemory } = require('rate-limiter-flexible');
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'email_service',
    points: parseInt(process.env.EMAIL_RATE_LIMIT) || 100, // Number of emails
    duration: 3600, // Per hour
});

// Enhanced SMTP transporter creation with multiple fallback configurations
const createTransporter = () => {
    // Primary configuration (STARTTLS)
    const primaryConfig = {
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2',
            secureProtocol: 'TLSv1_2_method'
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 10,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        ignoreTLS: false,
        requireTLS: true,
        logger: false,
        debug: false
    };

    console.log(`📧 Creating SMTP transporter: ${primaryConfig.host}:${primaryConfig.port} (secure: ${primaryConfig.secure})`);
    return nodemailer.createTransport(primaryConfig);
};

// Alternative SSL configuration function
const createSSLTransporter = () => {
    const sslConfig = {
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 10,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
    };

    console.log(`📧 Creating SSL SMTP transporter: ${sslConfig.host}:${sslConfig.port}`);
    return nodemailer.createTransport(sslConfig);
};

let transporter;
let transporterType = 'primary';

// Enhanced initialization with fallback support
const initializeTransporter = async () => {
    try {
        // Try primary configuration first
        console.log('📧 Attempting primary SMTP configuration...');
        transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Primary SMTP transporter verified successfully');
        transporterType = 'primary';
        return true;
    } catch (primaryError) {
        console.log(`⚠️  Primary SMTP failed: ${primaryError.message}`);
        
        try {
            // Fallback to SSL configuration
            console.log('📧 Attempting SSL fallback configuration...');
            transporter = createSSLTransporter();
            await transporter.verify();
            console.log('✅ SSL SMTP transporter verified successfully');
            transporterType = 'ssl';
            return true;
        } catch (sslError) {
            console.error(`❌ Both SMTP configurations failed:`);
            console.error(`  Primary: ${primaryError.message}`);
            console.error(`  SSL: ${sslError.message}`);
            return false;
        }
    }
};

// Startup initialization with enhanced error handling
const startupInit = async () => {
    console.log('🚀 Starting Dreamex Email Service...');
    
    // Validate environment variables
    const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
        console.error('Please check your .env file configuration');
        return;
    }

    const initialized = await initializeTransporter();
    if (!initialized) {
        console.error('❌ Failed to initialize email service with any configuration');
        console.log('📧 Email service will continue but emails will not be sent');
        return;
    }

    console.log(`✅ Email service initialized successfully using ${transporterType} configuration`);
};

// Enhanced transporter getter with automatic retry
const ensureTransporter = async () => {
    if (!transporter) {
        console.log('📧 Transporter not available, attempting to initialize...');
        const initialized = await initializeTransporter();
        if (!initialized) {
            throw new Error('Email service not available - SMTP transporter could not be initialized');
        }
    }
    return transporter;
};

// Email sending function with retry logic
const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const activeTransporter = await ensureTransporter();
            const info = await activeTransporter.sendMail(mailOptions);
            
            console.log(`✅ Email sent successfully on attempt ${attempt}`);
            console.log(`📧 Message ID: ${info.messageId}`);
            console.log(`📧 Response: ${info.response}`);
            
            return info;
        } catch (error) {
            console.error(`❌ Email send attempt ${attempt} failed: ${error.message}`);
            
            if (attempt < maxRetries) {
                // Exponential backoff delay
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Reinitialize transporter for retry
                await initializeTransporter();
            } else {
                throw error;
            }
        }
    }
};

// Initialize on startup
startupInit();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Dreamex Email Service',
        version: '2.1.0',
        transporterType: transporterType,
        transporterStatus: transporter ? 'available' : 'not available'
    });
});

// SMTP status endpoint
app.get('/smtp-status', async (req, res) => {
    try {
        if (!transporter) {
            return res.status(503).json({
                status: 'SMTP_NOT_AVAILABLE',
                message: 'SMTP transporter not initialized'
            });
        }

        await transporter.verify();
        res.json({
            status: 'SMTP_READY',
            transporterType: transporterType,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'SMTP_ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test email endpoint
app.post('/test-email', async (req, res) => {
    try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);

        const testEmail = {
            from: `"${process.env.FROM_NAME || 'Dreamex Datalab HSE'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: `SMTP Test - ${new Date().toISOString()}`,
            html: `
                <h2>🔧 SMTP Test Email</h2>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Transporter Type:</strong> ${transporterType}</p>
                <p><strong>Configuration:</strong></p>
                <ul>
                    <li>Host: ${process.env.SMTP_HOST}</li>
                    <li>Port: ${process.env.SMTP_PORT}</li>
                    <li>Secure: ${process.env.SMTP_SECURE}</li>
                </ul>
                <p>✅ SMTP service is working correctly!</p>
            `
        };

        const info = await sendEmailWithRetry(testEmail);
        
        res.json({
            success: true,
            messageId: info.messageId,
            transporterType: transporterType,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Test email failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Recruitment notification endpoint (enhanced)
app.post('/send/recruitment-notification', async (req, res) => {
    try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);

        const { to, subject, htmlContent, notificationType, companyId, referenceNumber } = req.body;

        if (!to || !subject || !htmlContent) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, subject, htmlContent'
            });
        }

        const mailOptions = {
            from: `"${process.env.FROM_NAME || 'Dreamex Datalab HSE'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            headers: {
                'X-Company-ID': companyId || 'unknown',
                'X-Reference-Number': referenceNumber || 'unknown',
                'X-Notification-Type': notificationType || 'recruitment'
            }
        };

        console.log(`📧 Sending recruitment notification to: ${to}`);
        console.log(`📧 Subject: ${subject}`);
        console.log(`📧 Company ID: ${companyId || 'not specified'}`);

        const info = await sendEmailWithRetry(mailOptions);

        res.json({
            success: true,
            messageId: info.messageId,
            transporterType: transporterType,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Recruitment notification failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Generic send email endpoint
app.post('/send', async (req, res) => {
    try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);

        const { to, subject, message, html } = req.body;

        if (!to || !subject || (!message && !html)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, subject, and either message or html'
            });
        }

        const mailOptions = {
            from: `"${process.env.FROM_NAME || 'Dreamex Datalab HSE'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: to,
            subject: subject
        };

        if (html) {
            mailOptions.html = html;
        } else {
            mailOptions.text = message;
        }

        console.log(`📧 Sending email to: ${to}`);
        console.log(`📧 Subject: ${subject}`);

        const info = await sendEmailWithRetry(mailOptions);

        res.json({
            success: true,
            messageId: info.messageId,
            transporterType: transporterType,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Email send failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Dreamex Email Service running on port ${PORT}`);
    console.log(`📧 Transporter type: ${transporterType}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 SMTP status: http://localhost:${PORT}/smtp-status`);
    console.log(`🧪 Test email: POST http://localhost:${PORT}/test-email`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📧 Gracefully shutting down email service...');
    if (transporter) {
        transporter.close();
    }
    process.exit(0);
});

module.exports = app;
