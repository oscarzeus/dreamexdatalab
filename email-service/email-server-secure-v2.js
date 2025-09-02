const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const EmailSecurityValidator = require('./EmailSecurityValidator');
require('dotenv').config();

const app = express();
const PORT = process.env.EMAIL_SERVICE_PORT || 3001;

// Initialize security validator
const securityValidator = new EmailSecurityValidator();

// Enhanced logging with security focus
const createLogger = () => {
    const logDir = path.join(__dirname, 'logs');
    
    // Ensure logs directory exists
    fs.mkdir(logDir, { recursive: true }).catch(console.error);
    
    return {
        info: (message, data = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message,
                data,
                service: 'secure-email-service'
            };
            console.log(JSON.stringify(logEntry));
            this.writeToFile('info.log', logEntry);
        },
        error: (message, error = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message,
                error: {
                    message: error.message,
                    stack: error.stack,
                    code: error.code
                },
                service: 'secure-email-service'
            };
            console.error(JSON.stringify(logEntry));
            this.writeToFile('error.log', logEntry);
        },
        warn: (message, data = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'WARN',
                message,
                data,
                service: 'secure-email-service'
            };
            console.warn(JSON.stringify(logEntry));
            this.writeToFile('warn.log', logEntry);
        },
        security: (message, data = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'SECURITY',
                message,
                data,
                service: 'secure-email-service'
            };
            console.log('SECURITY:', JSON.stringify(logEntry));
            this.writeToFile('security.log', logEntry);
        },
        writeToFile: async (filename, logEntry) => {
            try {
                const logPath = path.join(__dirname, 'logs', filename);
                const logLine = JSON.stringify(logEntry) + '\n';
                await fs.appendFile(logPath, logLine);
            } catch (error) {
                console.error('Failed to write log:', error);
            }
        }
    };
};

const logger = createLogger();

// Security-focused middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false
}));

// Strict CORS for production
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
        if (!allowedOrigins.length) {
            // Deny all if not explicitly configured
            logger.security('CORS denied (no ALLOWED_ORIGINS configured)', { origin });
            return callback(new Error('CORS not configured'));
        }
        // Allow same-origin (non-cross) and configured origins
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        logger.security('Blocked CORS request', { origin, allowedOrigins });
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-API-Key'],
    credentials: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Request parsing with size limits
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Additional validation for JSON payload
        if (buf.length > 10 * 1024 * 1024) { // 10MB
            throw new Error('Request payload too large');
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced rate limiting with security tracking
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Reduced from 100 for better security
    message: {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    onLimitReached: (req) => {
        logger.security('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        securityValidator.markIPSuspicious(req.ip, 'Rate limit exceeded');
    }
});

app.use('/send', limiter);

// API Key authentication middleware
const authenticateAPIKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey;
    const validApiKey = process.env.API_KEY;
    
    if (!validApiKey) {
        logger.error('API_KEY not configured');
        return res.status(500).json({ 
            success: false, 
            error: 'Service configuration error' 
        });
    }
    
    if (!apiKey || apiKey !== validApiKey) {
        logger.security('Invalid API key attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            providedKey: apiKey ? 'provided' : 'missing',
            referer: req.get('Referer')
        });
        
        securityValidator.markIPSuspicious(req.ip, 'Invalid API key');
        
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid authentication credentials' 
        });
    }
    
    next();
};

// SMTP transporter with enhanced error handling
const createTransporter = () => {
    const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        dnsTimeout: 10000,
        // Enhanced security options
        requireTLS: true,
        tls: {
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2'
        }
    };

    const transporter = nodemailer.createTransport(config);
    
    // Verify transporter configuration
    transporter.verify((error, success) => {
        if (error) {
            logger.error('SMTP configuration error', error);
        } else {
            logger.info('SMTP transporter ready');
        }
    });

    return transporter;
};

let transporter = createTransporter();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'secure-email-service',
        version: '2.0.0'
    });
});

// Enhanced email sending endpoint with comprehensive security
app.post('/send/secure', authenticateAPIKey, async (req, res) => {
    const startTime = Date.now();
    const requestId = require('crypto').randomUUID();
    
    try {
        logger.info('Email send request received', {
            requestId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer')
        });

        const emailData = req.body;
        
        // Validate required fields
        if (!emailData.to || !emailData.subject || (!emailData.text && !emailData.html)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields (to, subject, text/html)',
                requestId
            });
        }

        // Security validation
        const metadata = {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer'),
            apiKey: req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
        };

        const validationResult = await securityValidator.validateEmail(emailData, metadata);
        
        if (!validationResult.isValid) {
            logger.security('Email validation failed', {
                requestId,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                securityScore: validationResult.securityScore,
                sender: emailData.from,
                ip: req.ip
            });

            return res.status(400).json({
                success: false,
                error: 'Email validation failed',
                details: validationResult.errors,
                securityScore: validationResult.securityScore,
                requestId
            });
        }

        // Log security warnings
        if (validationResult.warnings.length > 0) {
            logger.warn('Email validation warnings', {
                requestId,
                warnings: validationResult.warnings,
                securityScore: validationResult.securityScore
            });
        }

        // Prepare email with security headers
        const mailOptions = {
            from: emailData.from || process.env.FROM_EMAIL,
            to: emailData.to,
            cc: emailData.cc,
            bcc: emailData.bcc,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html,
            attachments: emailData.attachments,
            headers: {
                'X-Email-Security-Score': validationResult.securityScore,
                'X-Request-ID': requestId,
                'X-Mailer': 'Dreamex Secure Email Service v2.0'
            }
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        const responseTime = Date.now() - startTime;
        
        logger.info('Email sent successfully', {
            requestId,
            messageId: info.messageId,
            responseTime,
            securityScore: validationResult.securityScore,
            recipients: Array.isArray(emailData.to) ? emailData.to.length : 1
        });

        res.json({
            success: true,
            messageId: info.messageId,
            securityScore: validationResult.securityScore,
            responseTime,
            requestId
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        logger.error('Email sending failed', {
            requestId,
            error: error.message,
            stack: error.stack,
            responseTime
        });

        // Mark IP as suspicious for repeated failures
        securityValidator.markIPSuspicious(req.ip, `Email sending error: ${error.message}`);

        res.status(500).json({
            success: false,
            error: 'Failed to send email',
            requestId,
            responseTime
        });
    }
});

// Legacy endpoint with security wrapper (for backward compatibility)
app.post('/send', authenticateAPIKey, async (req, res) => {
    // Redirect to secure endpoint
    req.url = '/send/secure';
    return app._router.handle(req, res);
});

// Additional legacy alias: /send-email -> /send/secure
app.post('/send-email', authenticateAPIKey, async (req, res) => {
    req.url = '/send/secure';
    return app._router.handle(req, res);
});

// Security management endpoints
app.post('/security/trust-sender', authenticateAPIKey, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !securityValidator.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Valid email address required'
            });
        }

        await securityValidator.addTrustedSender(email);
        
        logger.security('Trusted sender added', { email, ip: req.ip });
        
        res.json({
            success: true,
            message: `Added ${email} to trusted senders`
        });
    } catch (error) {
        logger.error('Failed to add trusted sender', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add trusted sender'
        });
    }
});

app.delete('/security/trust-sender', authenticateAPIKey, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email address required'
            });
        }

        await securityValidator.removeTrustedSender(email);
        
        logger.security('Trusted sender removed', { email, ip: req.ip });
        
        res.json({
            success: true,
            message: `Removed ${email} from trusted senders`
        });
    } catch (error) {
        logger.error('Failed to remove trusted sender', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove trusted sender'
        });
    }
});

// Security status endpoint
app.get('/security/status', authenticateAPIKey, (req, res) => {
    res.json({
        service: 'Dreamex Secure Email Service',
        version: '2.0.0',
        securityFeatures: {
            contentFiltering: true,
            rateLimiting: true,
            duplicateDetection: true,
            ipReputation: true,
            trustedSenders: true,
            apiKeyAuth: true,
            corsProtection: true,
            tlsRequired: true
        },
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        path: req.path,
        method: req.method
    });

    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('404 Not Found', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
    });

    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    logger.info(`Secure email service started on port ${PORT}`, {
        nodeEnv: process.env.NODE_ENV,
        version: '2.0.0'
    });
});

module.exports = app;
