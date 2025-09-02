const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.EMAIL_SERVICE_PORT || 3001;

// Production logging setup
const createLogger = () => {
    const logLevel = process.env.LOG_LEVEL || 'info';
    return {
        info: (message, data = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message,
                data,
                service: 'email-service-production'
            };
            console.log(JSON.stringify(logEntry));
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
                service: 'email-service-production'
            };
            console.error(JSON.stringify(logEntry));
        },
        warn: (message, data = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'WARN',
                message,
                data,
                service: 'email-service-production'
            };
            console.warn(JSON.stringify(logEntry));
        }
    };
};

const logger = createLogger();

// Enhanced security middleware - Production ready
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API responses
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false
}));

// CORS Configuration - NO RESTRICTIONS FOR PRODUCTION DEPLOYMENT
app.use(cors({
    origin: '*', // Allow ALL origins - no CORS restrictions
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-API-Key'],
    credentials: false, // No credentials needed for API
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-API-Key');
    res.sendStatus(204);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Production Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/smtp-status';
    }
});
app.use('/send', limiter);
const { RateLimiterMemory } = require('rate-limiter-flexible');
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'email_service',
    points: parseInt(process.env.EMAIL_RATE_LIMIT) || 100,
    duration: 3600, // Per hour
});

// Memory optimization and cleanup
const memoryCleanup = () => {
    if (global.gc) {
        global.gc();
        logger.info('Memory cleanup performed');
    }
};

// Periodic memory cleanup every 30 minutes
setInterval(memoryCleanup, 30 * 60 * 1000);

// Prevent memory limit warnings from causing restarts
process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
        logger.warn('MaxListenersExceededWarning detected, but continuing operation');
    }
});

// API Key middleware for production
const apiKeyAuth = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        const validApiKey = process.env.API_KEY;
        
        if (!validApiKey) {
            logger.error('API_KEY not configured for production');
            return res.status(500).json({ error: 'Service misconfigured' });
        }
        
        if (!apiKey || apiKey !== validApiKey) {
            logger.warn('Invalid API key attempt', { 
                ip: req.ip, 
                userAgent: req.get('User-Agent'),
                providedKey: apiKey ? 'provided' : 'missing'
            });
            return res.status(401).json({ error: 'Invalid API key' });
        }
    }
    next();
};

// Circuit breaker for SMTP connections
class CircuitBreaker {
    constructor(threshold = 10, timeout = 60000) {
        this.threshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
                logger.info('Circuit breaker moving to HALF_OPEN state');
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
        logger.info('Circuit breaker reset to CLOSED state');
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            logger.error('Circuit breaker opened due to failures', { failureCount: this.failureCount });
        }
    }
}

const circuitBreaker = new CircuitBreaker(
    parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 10
);

// Enhanced SMTP transporter factory with failover
const createPrimaryTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
            ciphers: process.env.TLS_CIPHERS
        },
        pool: process.env.CONNECTION_POOL_SIZE ? true : false,
        maxConnections: parseInt(process.env.CONNECTION_POOL_SIZE) || 1,
        maxMessages: parseInt(process.env.MAX_MESSAGES_PER_CONNECTION) || 10,
        connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
        greetingTimeout: 30000,
        socketTimeout: parseInt(process.env.SOCKET_TIMEOUT) || 30000,
        logger: process.env.LOG_LEVEL === 'debug',
        debug: process.env.LOG_LEVEL === 'debug'
    });
};

const createBackupTransporter = () => {
    if (!process.env.BACKUP_SMTP_HOST) return null;
    
    return nodemailer.createTransport({
        host: process.env.BACKUP_SMTP_HOST,
        port: parseInt(process.env.BACKUP_SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.BACKUP_SMTP_USER,
            pass: process.env.BACKUP_SMTP_PASS
        },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            minVersion: 'TLSv1.2'
        }
    });
};

let primaryTransporter;
let backupTransporter;
let activeTransporter;

// Enhanced transporter initialization with retry logic
const initializeTransporters = async () => {
    const maxRetries = parseInt(process.env.RETRY_ATTEMPTS) || 3;
    const retryDelay = parseInt(process.env.RETRY_DELAY) || 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            primaryTransporter = createPrimaryTransporter();
            backupTransporter = createBackupTransporter();
            activeTransporter = primaryTransporter;

            await circuitBreaker.execute(async () => {
                await primaryTransporter.verify();
            });

            logger.info('Primary SMTP transporter initialized and verified successfully');
            
            if (backupTransporter) {
                try {
                    await backupTransporter.verify();
                    logger.info('Backup SMTP transporter also verified successfully');
                } catch (error) {
                    logger.warn('Backup SMTP transporter verification failed', error);
                }
            }
            
            return true;
        } catch (error) {
            logger.error(`Transporter initialization attempt ${attempt} failed`, error);
            
            if (attempt < maxRetries) {
                logger.info(`Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    return false;
};

// Health monitoring system
class HealthMonitor {
    constructor() {
        this.isHealthy = false;
        this.lastHealthCheck = null;
        this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 300000; // 5 minutes
        this.healthStats = {
            emailsSent: 0,
            emailsFailed: 0,
            uptime: Date.now(),
            lastError: null
        };
    }

    start() {
        this.performHealthCheck();
        setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);
    }

    async performHealthCheck() {
        try {
            if (activeTransporter) {
                await circuitBreaker.execute(async () => {
                    await activeTransporter.verify();
                });
                this.isHealthy = true;
                this.lastHealthCheck = new Date();
                logger.info('Health check passed');
            } else {
                this.isHealthy = false;
                logger.warn('Health check failed - no active transporter');
            }
        } catch (error) {
            this.isHealthy = false;
            this.healthStats.lastError = {
                message: error.message,
                timestamp: new Date()
            };
            logger.error('Health check failed', error);
        }
    }

    recordEmailSent() {
        this.healthStats.emailsSent++;
    }

    recordEmailFailed() {
        this.healthStats.emailsFailed++;
    }

    getHealthStatus() {
        return {
            healthy: this.isHealthy,
            lastHealthCheck: this.lastHealthCheck,
            uptime: Date.now() - this.healthStats.uptime,
            stats: this.healthStats,
            circuitBreakerState: circuitBreaker.state
        };
    }
}

const healthMonitor = new HealthMonitor();

// Email queue for high volume processing
class EmailQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrency = parseInt(process.env.QUEUE_CONCURRENCY) || 1;
        this.delay = parseInt(process.env.QUEUE_DELAY) || 1000;
    }

    async add(emailData) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                ...emailData,
                resolve,
                reject,
                addedAt: Date.now()
            });
            
            if (!this.processing) {
                this.process();
            }
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        logger.info(`Processing email queue: ${this.queue.length} items`);

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.concurrency);
            
            await Promise.all(batch.map(async (item) => {
                try {
                    const result = await this.sendEmailDirect(item);
                    item.resolve(result);
                } catch (error) {
                    item.reject(error);
                }
            }));

            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }

        this.processing = false;
    }

    async sendEmailDirect(emailData) {
        const transporter = await ensureTransporter();
        return await circuitBreaker.execute(async () => {
            return await transporter.sendMail(emailData);
        });
    }
}

const emailQueue = process.env.ENABLE_EMAIL_QUEUE === 'true' ? new EmailQueue() : null;

// Enhanced transporter management with failover
const ensureTransporter = async () => {
    if (!activeTransporter) {
        const initialized = await initializeTransporters();
        if (!initialized) {
            throw new Error('Email service not available - SMTP transporters could not be initialized');
        }
    }

    // Test current transporter
    try {
        await circuitBreaker.execute(async () => {
            await activeTransporter.verify();
        });
        return activeTransporter;
    } catch (error) {
        logger.warn('Primary transporter failed, attempting failover', error);
        
        if (backupTransporter && activeTransporter !== backupTransporter) {
            try {
                await backupTransporter.verify();
                activeTransporter = backupTransporter;
                logger.info('Successfully failed over to backup transporter');
                return activeTransporter;
            } catch (backupError) {
                logger.error('Backup transporter also failed', backupError);
            }
        }
        
        // Try to reinitialize primary
        try {
            await initializeTransporters();
            return activeTransporter;
        } catch (reinitError) {
            logger.error('Failed to reinitialize transporters', reinitError);
            throw new Error('All email transporters failed');
        }
    }
};

// Production startup initialization
const startupInit = async () => {
    logger.info('🚀 Starting Dreamex Email Service', {
        version: require('./package.json').version,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
        port: PORT
    });

    // Initialize transporters
    const initialized = await initializeTransporters();
    if (!initialized) {
        logger.error('❌ Failed to initialize email service');
        process.exit(1); // Exit in production if email service cannot start
    }

    // Start health monitoring
    healthMonitor.start();
    logger.info('✅ Health monitoring started');

    logger.info('✅ Email service fully initialized and ready');
};

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
    const health = healthMonitor.getHealthStatus();
    const statusCode = health.healthy ? 200 : 503;
    
    res.status(statusCode).json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'dreamex-email-service',
        version: require('./package.json').version,
        ...health
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    if (process.env.ENABLE_METRICS !== 'true') {
        return res.status(404).json({ error: 'Metrics not enabled' });
    }

    const health = healthMonitor.getHealthStatus();
    res.json({
        service: 'dreamex-email-service',
        timestamp: new Date().toISOString(),
        metrics: {
            uptime: health.uptime,
            emailsSent: health.stats.emailsSent,
            emailsFailed: health.stats.emailsFailed,
            successRate: health.stats.emailsSent > 0 ? 
                ((health.stats.emailsSent / (health.stats.emailsSent + health.stats.emailsFailed)) * 100).toFixed(2) : 0,
            circuitBreakerState: health.circuitBreakerState,
            queueLength: emailQueue ? emailQueue.queue.length : 0
        }
    });
});

// Main email sending endpoint with enhanced error handling
app.post('/send-email', apiKeyAuth, async (req, res) => {
    const startTime = Date.now();
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    try {
        // Rate limiting check
        try {
            await rateLimiter.consume(req.ip);
        } catch (rejRes) {
            logger.warn('Rate limit exceeded', { 
                ip: req.ip, 
                remainingPoints: rejRes.remainingPoints, 
                msBeforeNext: rejRes.msBeforeNext 
            });
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.round(rejRes.msBeforeNext / 1000)
            });
        }

        const { to, subject, template, data, priority = 'normal' } = req.body;

        // Enhanced input validation
        if (!to || !subject) {
            return res.status(400).json({ 
                error: 'Missing required fields: to, subject' 
            });
        }

        // Email address validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = Array.isArray(to) ? to : [to];
        const invalidEmails = recipients.filter(email => !emailRegex.test(email));
        
        if (invalidEmails.length > 0) {
            return res.status(400).json({ 
                error: 'Invalid email addresses',
                invalid: invalidEmails
            });
        }

        // Prepare email data
        const emailData = {
            from: `${process.env.FROM_NAME || 'Dreamex Datalab'} <${process.env.FROM_EMAIL}>`,
            to: recipients.join(', '),
            subject,
            replyTo: process.env.REPLY_TO,
            priority: priority === 'high' ? 'high' : 'normal',
            headers: {
                'X-Request-ID': requestId,
                'X-Service': 'dreamex-email-service'
            }
        };

        // Template rendering or plain content
        if (template && data) {
            // Template logic would go here
            emailData.html = `<h1>${subject}</h1><p>Template processing would happen here with data: ${JSON.stringify(data)}</p>`;
        } else if (req.body.html) {
            emailData.html = req.body.html;
        } else if (req.body.text) {
            emailData.text = req.body.text;
        } else {
            return res.status(400).json({ 
                error: 'Email content required: template+data, html, or text' 
            });
        }

        logger.info('Processing email request', {
            requestId,
            to: recipients,
            subject,
            template,
            priority
        });

        // Send email through queue or directly
        let result;
        if (emailQueue && priority !== 'high') {
            result = await emailQueue.add(emailData);
        } else {
            const transporter = await ensureTransporter();
            result = await circuitBreaker.execute(async () => {
                return await transporter.sendMail(emailData);
            });
        }

        healthMonitor.recordEmailSent();
        
        const duration = Date.now() - startTime;
        logger.info('Email sent successfully', {
            requestId,
            messageId: result.messageId,
            duration,
            to: recipients.length
        });

        res.json({
            success: true,
            messageId: result.messageId,
            requestId,
            duration,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        healthMonitor.recordEmailFailed();
        
        const duration = Date.now() - startTime;
        logger.error('Email sending failed', {
            requestId,
            error: error.message,
            duration,
            stack: error.stack
        });

        // Determine error type and response
        let statusCode = 500;
        let errorMessage = 'Internal server error';

        if (error.message.includes('Rate limit')) {
            statusCode = 429;
            errorMessage = 'Rate limit exceeded';
        } else if (error.message.includes('CORS')) {
            statusCode = 403;
            errorMessage = 'CORS policy violation';
        } else if (error.message.includes('Authentication failed')) {
            statusCode = 401;
            errorMessage = 'SMTP authentication failed';
        } else if (error.message.includes('Circuit breaker')) {
            statusCode = 503;
            errorMessage = 'Service temporarily unavailable';
        }

        res.status(statusCode).json({
            error: errorMessage,
            requestId,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    if (server) {
        server.close(() => {
            logger.info('Server closed');
            
            if (primaryTransporter) {
                primaryTransporter.close();
                logger.info('Primary transporter closed');
            }
            
            if (backupTransporter) {
                backupTransporter.close();
                logger.info('Backup transporter closed');
            }
            
            process.exit(0);
        });
    } else {
        logger.info('Server not started, exiting...');
        process.exit(0);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
});

// Start the service
let server;

startupInit().then(() => {
    const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
    
    server = app.listen(PORT, HOST, () => {
        logger.info(`🚀 Dreamex Email Service running on ${HOST}:${PORT}`, {
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
            host: HOST,
            port: PORT
        });
    });
    
    // Configure server timeouts for better stability
    server.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 65000;
    server.headersTimeout = parseInt(process.env.HEADERS_TIMEOUT) || 66000;
    
    // Handle server errors
    server.on('error', (error) => {
        logger.error('Server error', error);
        if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use`);
            process.exit(1);
        }
    });
    
    // Notify PM2 that the service is ready
    if (process.send) {
        process.send('ready');
        logger.info('Notified PM2 that service is ready');
    }
    
}).catch((error) => {
    logger.error('Failed to start service', error);
    process.exit(1);
});

module.exports = app;
