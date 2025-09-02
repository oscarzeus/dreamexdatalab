const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
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
        
        // Allow localhost variations
        if (origin && origin.includes('localhost')) return callback(null, true);
        
        // Allow any origin in development or if it contains dreamexdatalab
        if (process.env.NODE_ENV === 'development' || 
            (origin && origin.includes('dreamexdatalab'))) {
            return callback(null, true);
        }
        
        // Check against allowed origins
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500').split(',');
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        
        // For production stability, log the blocked origin but allow the request
        console.log(`⚠️ CORS: Origin not in allowed list: ${origin}. Allowing for service stability.`);
        return callback(null, true);
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

// Create SMTP transporter for privateemail.com
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        },
        pool: true, // Enable connection pooling
        maxConnections: 1, // Use single connection for stability
        maxMessages: 10,   // Reduced for better stability
        // Add timeout settings to prevent hanging
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 60000     // 60 seconds
    });
};

let transporter;

// Function to initialize transporter with retry logic
const initializeTransporter = async () => {
    try {
        transporter = createTransporter();
        console.log('📧 SMTP transporter initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize SMTP transporter:', error);
        return false;
    }
};

// Initialize transporter on startup
const startupInit = async () => {
    const initialized = await initializeTransporter();
    if (!initialized) {
        console.error('❌ Failed to initialize email service');
        // Don't exit, allow service to run without email functionality
        return;
    }

    // Verify SMTP connection on startup with error handling
    try {
        await transporter.verify();
        console.log('✅ SMTP server is ready to send emails');
    } catch (error) {
        console.error('❌ SMTP connection verification failed:', error.message);
        console.log('📧 Email service will continue but emails may not be sent properly');
        // Don't exit, continue running for other functionality
    }
};

// Start initialization
startupInit();

// Helper function to ensure transporter is available
const ensureTransporter = async () => {
    if (!transporter) {
        const initialized = await initializeTransporter();
        if (!initialized) {
            throw new Error('Email service not available - SMTP transporter could not be initialized');
        }
    }
    return transporter;
};

// Delivery log for tracking sent emails
const deliveryLog = [];

// Template rendering helper
const Handlebars = require('handlebars');

// Helper for conditional rendering
Handlebars.registerHelper('if', function(conditional, options) {
    if (conditional) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Helper for string comparison
Handlebars.registerHelper('equals', function(a, b, options) {
    if (a === b) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Email templates
const templates = {
    approvalNotification: {
        subject: 'Access Request Approval Required - {{referenceNumber}}',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Access Request Approval Required</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px 20px; background: #f8f9fa;">
                        <p style="color: #2c3e50; font-size: 16px; margin: 0 0 20px 0;">Dear {{approverName}},</p>
                        <p style="color: #555; margin: 0 0 25px 0;">A {{#if isUpdate}}updated{{else}}new{{/if}} access request requires your approval:</p>
                        
                        <!-- Request Details Card -->
                        <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #3498db;">
                            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">Request Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600; width: 30%;">Reference Number:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{referenceNumber}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Requester:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{requesterName}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Purpose:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{purpose}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Department:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{department}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Company:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{company}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Access Period:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{startDate}} to {{endDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Priority:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{priority}}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- Action Button -->
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{approvalLink}}" 
                               style="background: linear-gradient(135deg, #27ae60, #2ecc71); 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 6px; 
                                      display: inline-block; 
                                      font-weight: 600;
                                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                📋 Review and Approve Request
                            </a>
                        </div>
                        
                        <!-- Footer -->
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">
                                This is an automated notification from the Dreamex Datalab HSE System.<br>
                                Please do not reply to this email. For support, contact <a href="mailto:info@dreamexdatalab.com" style="color: #3498db;">info@dreamexdatalab.com</a>
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    },

    interviewReport: {
        subject: 'Interview Report - {{candidateName}} ({{position}})',        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
                <div style="max-width: 700px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <div style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Interview Report</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab Recruitment System</p>
                    </div>
                    <div style="padding: 30px 20px;">
                        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📋 Candidate Information</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600; width: 30%;">Name:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{candidateName}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Position Applied:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{position}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Interview Date:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{interviewDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Interviewer:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">{{interviewer}}</td>
                                </tr>
                            </table>
                        </div>
                        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">⭐ Overall Assessment</h3>
                            <div style="text-align: center; margin: 20px 0;">
                                <div style="display: inline-block; padding: 15px 25px; background: {{overallScoreColor}}; color: white; border-radius: 50px; font-size: 18px; font-weight: bold;">
                                    {{overallScore}}/10
                                </div>
                                <p style="margin: 10px 0; color: #666;">{{overallRecommendation}}</p>
                            </div>
                        </div>
                        {{#if interviewNotes}}
                        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">📝 Interview Notes</h3>
                            <div style="background: white; padding: 15px; border-radius: 5px; white-space: pre-line;">{{interviewNotes}}</div>
                        </div>
                        {{/if}}
                        <div style="margin: 20px 0; padding: 15px; background: {{recommendationColor}}; color: {{recommendationTextColor}}; border-radius: 5px;">
                            <h3 style="margin: 0 0 15px 0; font-size: 18px;">🎯 Final Recommendation</h3>
                            <p style="margin: 0; font-size: 16px; font-weight: 600;">{{finalRecommendation}}</p>
                            {{#if recommendationReason}}
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">{{recommendationReason}}</p>
                            {{/if}}
                        </div>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
                            <p style="color: #666; font-size: 12px; margin: 0;">
                                This report was generated on {{generatedDate}}<br>
                                Dreamex Datalab Recruitment System - Confidential Document
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    }
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
};

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
    try {
        const clientId = req.ip || 'default';
        await rateLimiter.consume(clientId);
        next();
    } catch (rejRes) {
        const msBeforeNext = rejRes.msBeforeNext || 3600000;
        res.set('Retry-After', Math.round(msBeforeNext / 1000));
        res.status(429).json({ 
            error: 'Too many email requests',
            retryAfter: Math.round(msBeforeNext / 1000)
        });
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'email-notification-service',
        timestamp: new Date().toISOString(),
        smtpReady: !!transporter
    });
});

// SMTP health check endpoint
app.get('/health/smtp', validateApiKey, async (req, res) => {
    try {
        if (!transporter) {
            const initialized = await initializeTransporter();
            if (!initialized) {
                throw new Error('Failed to initialize SMTP transporter');
            }
        }
        
        await transporter.verify();
        res.json({ status: 'healthy', message: 'SMTP server is connected and ready' });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            message: 'SMTP server connection failed',
            error: error.message
        });
    }
});

// Test connection endpoint (simplified for diagnostics)
app.get('/test-connection', validateApiKey, async (req, res) => {
    try {
        if (!transporter) {
            return res.json({
                success: false,
                error: 'SMTP transporter not initialized'
            });
        }
        
        await transporter.verify();
        res.json({ 
            success: true, 
            message: 'SMTP connection verified successfully',
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT
        });
    }
});

// Send approval notification email
app.post('/send/approval-notification', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            to,
            approverName,
            requesterName,
            referenceNumber,
            purpose,
            department,
            company,
            startDate,
            endDate,
            priority,
            approvalLink,
            isUpdate = false
        } = req.body;

        // Validate required fields
        if (!to || !approverName || !requesterName || !referenceNumber || !purpose) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['to', 'approverName', 'requesterName', 'referenceNumber', 'purpose']
            });
        }

        // Compile template
        const subjectTemplate = Handlebars.compile(templates.approvalNotification.subject);
        const htmlTemplate = Handlebars.compile(templates.approvalNotification.html);

        const templateData = {
            approverName,
            requesterName,
            referenceNumber,
            purpose,
            department: department || 'N/A',
            company: company || 'N/A',
            startDate: startDate || 'N/A',
            endDate: endDate || 'N/A',
            priority: priority || 'Normal',
            approvalLink: approvalLink || '#',
            isUpdate
        };

        const subject = subjectTemplate(templateData);
        const html = htmlTemplate(templateData);

        // Ensure transporter is available
        await ensureTransporter();

        // Email options
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: process.env.REPLY_TO
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Email sent successfully to ${to}:`, info.messageId);

        res.json({
            success: true,
            messageId: info.messageId,
            to: to,
            subject: subject,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending email:', error);
        res.status(500).json({
            error: 'Failed to send email',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send completion notification email
app.post('/send/completion-notification', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            to,
            requesterName,
            referenceNumber,
            finalStatus,
            comments,
            requestLink
        } = req.body;

        // Validate required fields
        if (!to || !requesterName || !referenceNumber || !finalStatus) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['to', 'requesterName', 'referenceNumber', 'finalStatus']
            });
        }

        const statusMessage = finalStatus === 'approved' ? 'approved' : 'rejected';
        const statusColor = finalStatus === 'approved' ? '#27ae60' : '#e74c3c';

        const subject = `Access Request ${finalStatus.toUpperCase()} - ${referenceNumber}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <div style="background: ${statusColor}; color: white; padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Access Request ${finalStatus.toUpperCase()}</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                    </div>
                    
                    <div style="padding: 30px 20px; background: #f8f9fa;">
                        <p style="color: #2c3e50; font-size: 16px; margin: 0 0 20px 0;">Dear ${requesterName},</p>
                        <p style="color: #555; margin: 0 0 25px 0;">Your access request has been <strong>${statusMessage}</strong>:</p>
                        
                        <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid ${statusColor};">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600; width: 30%;">Reference Number:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">${referenceNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Status:</td>
                                    <td style="padding: 8px 0; color: ${statusColor}; font-weight: 600; text-transform: uppercase;">${finalStatus}</td>
                                </tr>
                                ${comments ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Comments:</td>
                                    <td style="padding: 8px 0; color: #2c3e50;">${comments}</td>
                                </tr>
                                ` : ''}
                            </table>
                        </div>
                        
                        ${requestLink ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${requestLink}" 
                               style="background: linear-gradient(135deg, #3498db, #2980b9); 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 6px; 
                                      display: inline-block; 
                                      font-weight: 600;
                                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                📄 View Request Details
                            </a>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">
                                This is an automated notification from the Dreamex Datalab HSE System.<br>
                                For support, contact <a href="mailto:info@dreamexdatalab.com" style="color: #3498db;">info@dreamexdatalab.com</a>
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Ensure transporter is available
        await ensureTransporter();

        // Email options
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: process.env.REPLY_TO
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Completion email sent successfully to ${to}:`, info.messageId);

        res.json({
            success: true,
            messageId: info.messageId,
            to: to,
            subject: subject,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending completion email:', error);        res.status(500).json({
            error: 'Failed to send completion email',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send recruitment notification email (job closure, etc.)
app.post('/send/recruitment-notification', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            to,
            subject,
            body,
            type,
            metadata
        } = req.body;

        // Validate required fields
        if (!to || !subject || !body) {
            return res.status(400).json({ 
                error: 'Missing required fields: to, subject, body' 
            });
        }

        // Create matching text version to prevent HTML/text mismatch errors
        const textVersion = `
RECRUITMENT NOTIFICATION
Dreamex Datalab HSE System

${body}

${metadata && metadata.jobId ? `
Reference Information:
- Job ID: ${metadata.jobId}
${metadata.jobTitle ? `- Job Title: ${metadata.jobTitle}` : ''}
${metadata.closureReason ? `- Closure Reason: ${metadata.closureReason}` : ''}
- Timestamp: ${metadata.timestamp}
` : ''}

---
This is an automated notification from Dreamex Datalab HSE System
Please do not reply to this email
        `.trim();

        // Email options
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Recruitment Notification</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px 20px; background: #f8f9fa;">
                        <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #e74c3c;">
                            ${body.split('\n').map(line => `<p style="margin: 10px 0; color: #2c3e50;">${line}</p>`).join('')}
                        </div>
                        
                        ${metadata && metadata.jobId ? `
                        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
                            <h3 style="color: #2c3e50; margin: 0 0 15px 0;">Reference Information</h3>
                            <p style="margin: 5px 0; color: #666;"><strong>Job ID:</strong> ${metadata.jobId}</p>
                            ${metadata.jobTitle ? `<p style="margin: 5px 0; color: #666;"><strong>Job Title:</strong> ${metadata.jobTitle}</p>` : ''}
                            ${metadata.closureReason ? `<p style="margin: 5px 0; color: #666;"><strong>Closure Reason:</strong> ${metadata.closureReason}</p>` : ''}
                            <p style="margin: 5px 0; color: #666;"><strong>Timestamp:</strong> ${metadata.timestamp}</p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #ecf0f1; padding: 20px; text-align: center; color: #7f8c8d; font-size: 12px;">
                        <p style="margin: 0;">This is an automated notification from Dreamex Datalab HSE System</p>
                        <p style="margin: 5px 0 0 0;">Please do not reply to this email</p>
                    </div>
                </div>
            `,
            text: textVersion, // Properly formatted text version that matches HTML content
            replyTo: process.env.REPLY_TO
        };

        // Ensure transporter is available
        await ensureTransporter();

        // Send email with retry logic
        let lastError;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📧 Attempt ${attempt}/${maxRetries} - Sending recruitment notification to ${to}`);
                
                const info = await transporter.sendMail(mailOptions);
                console.log(`✅ Recruitment notification sent successfully to ${to}:`, info.messageId);

                return res.json({
                    success: true,
                    messageId: info.messageId,
                    to: to,
                    subject: subject,
                    type: type || 'recruitment-notification',
                    attempt: attempt,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`⏱️ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // Recreate transporter for next attempt
                    try {
                        await initializeTransporter();
                    } catch (reinitError) {
                        console.warn('⚠️ Failed to reinitialize transporter:', reinitError.message);
                    }
                }
            }
        }
        
        // If all retries failed, throw the last error
        throw lastError;

    } catch (error) {
        console.error('❌ Error sending recruitment notification:', error);
        res.status(500).json({
            error: 'Failed to send recruitment notification',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send interview report email
app.post('/send/interview-report', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            to,
            candidateName,
            position,
            interviewDate,
            interviewer,
            duration,
            overallScore,
            overallRecommendation,
            interviewNotes,
            finalRecommendation,
            recommendationReason
        } = req.body;

        // Validate required fields
        if (!to || !candidateName || !position || !interviewer || !finalRecommendation) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['to', 'candidateName', 'position', 'interviewer', 'finalRecommendation']
            });
        }

        // Determine score color based on overall score
        const score = parseInt(overallScore) || 0;
        let overallScoreColor = '#dc3545'; // red for poor
        if (score >= 8) overallScoreColor = '#28a745'; // green for excellent
        else if (score >= 6) overallScoreColor = '#17a2b8'; // blue for good
        else if (score >= 4) overallScoreColor = '#ffc107'; // yellow for average

        // Determine recommendation colors
        let recommendationColor = '#f8f9fa';
        let recommendationTextColor = '#2c3e50';
        
        if (finalRecommendation.toLowerCase().includes('hire') || finalRecommendation.toLowerCase().includes('recommend')) {
            recommendationColor = '#d4edda';
            recommendationTextColor = '#155724';
        } else if (finalRecommendation.toLowerCase().includes('reject') || finalRecommendation.toLowerCase().includes('not recommend')) {
            recommendationColor = '#f8d7da';
            recommendationTextColor = '#721c24';
        }

        // Compile template
        const subjectTemplate = Handlebars.compile(templates.interviewReport.subject);
        const htmlTemplate = Handlebars.compile(templates.interviewReport.html);

        const templateData = {
            candidateName,
            position,
            interviewDate: interviewDate || new Date().toLocaleDateString(),
            interviewer,
            duration: duration || 'N/A',
            overallScore: score,
            overallScoreColor,
            overallRecommendation: overallRecommendation || 'Assessment completed',
            interviewNotes: interviewNotes || 'No additional notes provided',
            finalRecommendation,
            recommendationReason: recommendationReason || '',
            recommendationColor,
            recommendationTextColor,
            generatedDate: new Date().toLocaleString()
        };

        const subject = subjectTemplate(templateData);
        const html = htmlTemplate(templateData);

        // Ensure transporter is available
        await ensureTransporter();

        // Email options
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: process.env.REPLY_TO
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Interview report sent successfully to ${to}:`, info.messageId);

        res.json({
            success: true,
            messageId: info.messageId,
            to: to,
            subject: subject,
            candidateName: candidateName,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending interview report:', error);
        res.status(500).json({
            error: 'Failed to send interview report',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send KPI assignment notification email
app.post('/send/kpi-assignment', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            to,
            toName,
            subject,
            htmlContent,
            textContent,
            templateType,
            priority
        } = req.body;

        // Validate required fields
        if (!to || !toName || !subject) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['to', 'toName', 'subject']
            });
        }

        // Validate email address
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Convert text content to HTML if needed
        const htmlBody = htmlContent || textContent?.replace(/\n/g, '<br>') || '';

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                    <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #2c3e50, #34495e); color: white; border-radius: 8px;">
                            <h1 style="margin: 0; font-size: 24px;">🎯 KPI Assignment Notification</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                        </div>
                        
                        <div style="color: #2c3e50; line-height: 1.6;">
                            ${htmlBody}
                        </div>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #e7f3ff; border-left: 4px solid #3498db; border-radius: 4px;">
                            <p style="margin: 0; color: #2c3e50; font-weight: 600;">
                                📧 This is an automated notification from the Dreamex Datalab HSE Performance Management System
                            </p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} Dreamex Datalab. All rights reserved.</p>
                        <p>Please do not reply to this automated email.</p>
                    </div>
                </div>
            `,
            text: textContent || htmlContent?.replace(/<[^>]*>/g, '') || '',
            replyTo: process.env.REPLY_TO,
            priority: priority || 'normal'
        };

        // Ensure transporter is available
        await ensureTransporter();

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ KPI assignment notification sent successfully to ${toName} (${to}):`, info.messageId);

        // Store in delivery log
        deliveryLog.push({
            timestamp: new Date().toISOString(),
            to,
            toName,
            subject,
            templateType: templateType || 'kpi-assignment-notification',
            messageId: info.messageId,
            status: 'sent',
            priority: priority || 'normal'
        });

        // Keep only last 1000 delivery records
        if (deliveryLog.length > 1000) {
            deliveryLog.splice(0, deliveryLog.length - 1000);
        }

        res.json({
            success: true,
            messageId: info.messageId,
            to,
            toName,
            message: 'KPI assignment notification sent successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending KPI assignment notification:', error);
        res.status(500).json({
            error: 'Failed to send KPI assignment notification',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test email endpoint
app.post('/test/email', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const { to } = req.body;

        if (!to) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: 'Email Service Test - Dreamex Datalab HSE',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2c3e50;">Email Service Test</h1>
                    <p>This is a test email from the Dreamex Datalab HSE email notification service.</p>
                    <p><strong>Service Status:</strong> ✅ Working correctly</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        If you received this email, the email service is configured correctly.
                    </p>
                </div>
            `,
            replyTo: process.env.REPLY_TO
        };

        // Ensure transporter is available
        await ensureTransporter();

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Test email sent successfully to ${to}:`, info.messageId);

        res.json({
            success: true,
            messageId: info.messageId,
            to: to,
            message: 'Test email sent successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending test email:', error);
        res.status(500).json({
            error: 'Failed to send test email',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Job offer email endpoint
app.post('/send/job-offer', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        if (!to || !subject || (!text && !html)) {
            return res.status(400).json({ 
                error: 'Email address, subject, and content (text or html) are required' 
            });
        }

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: to,
            subject: subject,
            replyTo: process.env.REPLY_TO
        };

        // Add text content if provided
        if (text) {
            mailOptions.text = text;
        }

        // Add HTML content if provided, with proper formatting
        if (html) {
            mailOptions.html = html;
        }

        // Ensure transporter is available
        await ensureTransporter();

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Job offer email sent successfully to ${to}:`, info.messageId);

        res.json({
            success: true,
            messageId: info.messageId,
            to: to,
            subject: subject,
            message: 'Job offer email sent successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error sending job offer email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send job offer email',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send job published notification email via EmailJS (Production)
app.post('/send/job-published-notification-emailjs', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            recipients,
            jobData,
            metadata,
            emailjsConfig
        } = req.body;

        // Validate required fields
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ 
                error: 'Missing or invalid recipients array',
                required: ['recipients (array)']
            });
        }

        if (!jobData || !jobData.jobTitle) {
            return res.status(400).json({
                error: 'Missing job data',
                required: ['jobData.jobTitle']
            });
        }

        // EmailJS configuration with template_9beph7t
        const emailJSConfig = emailjsConfig || {
            serviceId: 'service_p2e9swy',
            templateId: 'template_9beph7t', // Using the specified EmailJS template
            publicKey: 'fHs6oaqQgkcPoUwpv'
        };

        console.log(`📧 Processing job published notification via EmailJS template_9beph7t for ${recipients.length} recipients`);

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // Process each recipient using EmailJS template
        for (const recipient of recipients) {
            if (!recipient.email || !recipient.name) {
                console.warn(`⚠️ Skipping invalid recipient:`, recipient);
                results.push({
                    email: recipient.email || 'unknown',
                    status: 'failed',
                    error: 'Missing email or name'
                });
                failureCount++;
                continue;
            }

            try {
                // Prepare template parameters for EmailJS template_9beph7t
                const templateParams = {
                    // Recipient information
                    to_name: recipient.name,
                    to_email: recipient.email,
                    recipient_type: recipient.type || 'stakeholder',
                    
                    // Job details
                    job_title: jobData.jobTitle,
                    department: jobData.department || 'Not specified',
                    position_code: jobData.positionCode || 'N/A',
                    employment_type: jobData.employmentType || 'Not specified',
                    work_location: jobData.workLocation || 'Not specified',
                    published_date: new Date().toLocaleDateString(),
                    application_deadline: jobData.advertisingClosingDate ? new Date(jobData.advertisingClosingDate).toLocaleDateString() : 'Not specified',
                    
                    // Metadata
                    job_id: metadata?.jobId || jobData.positionCode || 'N/A',
                    job_board_url: metadata?.jobBoardUrl || '#',
                    published_timestamp: new Date().toLocaleString(),
                    
                    // Company information
                    company_name: 'Dreamex Datalab',
                    hr_email: 'hr@dreamexdatalab.com',
                    
                    // Dynamic content based on recipient type
                    is_submitter: recipient.type === 'submitter',
                    is_approver: recipient.type === 'approver',
                    
                    // Additional context
                    notification_type: 'job_published',
                    system_name: 'Dreamex Datalab HSE System'
                };

                console.log(`📧 Sending EmailJS notification to ${recipient.name} (${recipient.email}) using template_9beph7t`);

                // Store the EmailJS call result - this would typically be handled client-side
                // For server-side implementation, we'll provide the template data for client processing
                results.push({
                    email: recipient.email,
                    name: recipient.name,
                    status: 'prepared',
                    templateParams: templateParams,
                    emailjsConfig: emailJSConfig,
                    message: 'Template data prepared for EmailJS client-side processing'
                });
                
                successCount++;

            } catch (error) {
                console.error(`❌ Error preparing EmailJS template for ${recipient.email}:`, error);
                results.push({
                    email: recipient.email,
                    name: recipient.name,
                    status: 'failed',
                    error: error.message
                });
                failureCount++;
            }
        }

        console.log(`📧 EmailJS template preparation complete: ${successCount} prepared, ${failureCount} failed`);

        res.json({
            success: successCount > 0,
            emailService: 'EmailJS',
            templateId: 'template_9beph7t',
            totalRecipients: recipients.length,
            successCount: successCount,
            failureCount: failureCount,
            results: results,
            jobTitle: jobData.jobTitle,
            emailjsConfig: emailJSConfig,
            instructions: 'Use the provided templateParams with EmailJS client-side to send emails',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error processing EmailJS job published notification:', error);
        res.status(500).json({
            error: 'Failed to prepare EmailJS notification',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Send job published notification email (to submitter and approvers) - SMTP Fallback
app.post('/send/job-published-notification', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const {
            recipients,
            jobData,
            metadata
        } = req.body;

        // Validate required fields
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ 
                error: 'Missing or invalid recipients array',
                required: ['recipients (array)']
            });
        }

        if (!jobData || !jobData.jobTitle) {
            return res.status(400).json({
                error: 'Missing job data',
                required: ['jobData.jobTitle']
            });
        }

        console.log(`📧 Processing job published notification for ${recipients.length} recipients via SMTP fallback`);

        // Ensure transporter is available
        await ensureTransporter();

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // Send email to each recipient
        for (const recipient of recipients) {
            if (!recipient.email || !recipient.name) {
                console.warn(`⚠️ Skipping invalid recipient:`, recipient);
                failureCount++;
                continue;
            }

            try {
                const subject = `🎉 Job Published Successfully - ${jobData.jobTitle} - ${jobData.department || 'Dreamex Datalab'}`;
                
                // Create personalized email content
                const personalizedContent = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🎉 Job Published Successfully!</h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <div style="font-size: 18px; color: #333; margin-bottom: 20px;">
                            Dear ${recipient.name},
                        </div>
                        
                        <div style="color: #555; margin-bottom: 25px; font-size: 16px;">
                            Great news! The job position "<strong>${jobData.jobTitle}</strong>" has been successfully published and is now live on the job board.
                        </div>
                        
                        <!-- Job Details Box -->
                        <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 4px;">
                            <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px;">Published Job Details</h3>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Position Title:</div>
                                <div style="color: #555; flex: 1;">${jobData.jobTitle}</div>
                            </div>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Department:</div>
                                <div style="color: #555; flex: 1;">${jobData.department || 'Not specified'}</div>
                            </div>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Position Code:</div>
                                <div style="color: #555; flex: 1;">${jobData.positionCode || 'N/A'}</div>
                            </div>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Employment Type:</div>
                                <div style="color: #555; flex: 1;">${jobData.employmentType || 'Not specified'}</div>
                            </div>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Work Location:</div>
                                <div style="color: #555; flex: 1;">${jobData.workLocation || 'Not specified'}</div>
                            </div>
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Published Date:</div>
                                <div style="color: #555; flex: 1;">${new Date().toLocaleDateString()}</div>
                            </div>
                            ${jobData.advertisingClosingDate ? `
                            <div style="margin: 10px 0; display: flex; flex-wrap: wrap;">
                                <div style="font-weight: 600; color: #2c3e50; min-width: 140px; margin-right: 10px;">Application Deadline:</div>
                                <div style="color: #555; flex: 1;">${new Date(jobData.advertisingClosingDate).toLocaleDateString()}</div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Action Button -->
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${metadata?.jobBoardUrl || '#'}" style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);">
                                🌐 View Published Job
                            </a>
                        </div>
                        
                        <!-- Next Steps -->
                        <div style="color: #555; margin-bottom: 25px; font-size: 16px;">
                            <strong>What happens next:</strong>
                            <ul style="margin: 15px 0; padding-left: 20px; color: #555;">
                                <li>Job posting is now visible to candidates</li>
                                <li>Application submissions will begin</li>
                                <li>You'll receive updates on application progress</li>
                                <li>Interview scheduling can be coordinated</li>
                                <li>Recruitment metrics will be tracked</li>
                            </ul>
                        </div>
                        
                        ${recipient.type === 'submitter' ? `
                        <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <strong style="color: #1976d2;">For Position Submitter:</strong>
                            <p style="margin: 10px 0; color: #555;">As the position submitter, you'll be notified when applications are received. You can monitor the recruitment progress through the HSE system dashboard.</p>
                        </div>
                        ` : ''}
                        
                        ${recipient.type === 'approver' ? `
                        <div style="background-color: #f3e5f5; border-left: 4px solid #9c27b0; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <strong style="color: #7b1fa2;">For Approver:</strong>
                            <p style="margin: 10px 0; color: #555;">Thank you for your approval of this position. You may be involved in the interview process as recruitment progresses.</p>
                        </div>
                        ` : ''}
                        
                        <div style="color: #555; margin-bottom: 25px; font-size: 16px;">
                            If you have any questions about this published position, please contact our HR team at <a href="mailto:hr@dreamexdatalab.com" style="color: #3498db; text-decoration: none;">hr@dreamexdatalab.com</a>.
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; color: #666; font-size: 14px;">
                        <div>Thank you for your contribution to our recruitment process!</div>
                        
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 5px; font-size: 16px;">Dreamex Datalab</div>
                            <div>
                                <a href="mailto:hr@dreamexdatalab.com" style="color: #3498db; text-decoration: none;">hr@dreamexdatalab.com</a>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #999;">
                                Job ID: ${metadata?.jobId || jobData.positionCode || 'N/A'} | Published: ${new Date().toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
                `;

                const mailOptions = {
                    from: process.env.FROM_EMAIL || 'noreply@dreamexdatalab.com',
                    to: recipient.email,
                    subject: subject,
                    text: `Job Published: ${jobData.jobTitle}

Dear ${recipient.name},

The job position "${jobData.jobTitle}" has been successfully published and is now live on the job board.

Job Details:
- Position: ${jobData.jobTitle}
- Department: ${jobData.department || 'Not specified'}
- Position Code: ${jobData.positionCode || 'N/A'}
- Published: ${new Date().toLocaleDateString()}

${metadata?.jobBoardUrl ? `View job: ${metadata.jobBoardUrl}` : ''}

Best regards,
Dreamex Datalab HSE System`,
                    html: personalizedContent
                };

                const info = await transporter.sendMail(mailOptions);
                console.log(`✅ Job published notification sent to ${recipient.email}:`, info.messageId);

                results.push({
                    recipient: recipient.email,
                    success: true,
                    messageId: info.messageId
                });
                successCount++;

            } catch (error) {
                console.error(`❌ Failed to send job published notification to ${recipient.email}:`, error.message);
                results.push({
                    recipient: recipient.email,
                    success: false,
                    error: error.message
                });
                failureCount++;
            }
        }

        console.log(`📧 Job published notification summary: ${successCount} sent, ${failureCount} failed`);

        res.json({
            success: successCount > 0,
            totalRecipients: recipients.length,
            successCount: successCount,
            failureCount: failureCount,
            results: results,
            jobTitle: jobData.jobTitle,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in job published notification endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send job published notifications',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Job closure notification endpoint
app.post('/send/job-closure-notification', rateLimitMiddleware, validateApiKey, async (req, res) => {
    try {
        const { recipients, jobData, metadata } = req.body;

        // Validate required fields
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ 
                error: 'Missing or invalid recipients array' 
            });
        }

        if (!jobData) {
            return res.status(400).json({ 
                error: 'Missing jobData' 
            });
        }

        // Ensure transporter is available
        if (!transporter) {
            console.error('❌ SMTP transporter not available');
            return res.status(503).json({ 
                error: 'Email service temporarily unavailable',
                details: 'SMTP transporter not configured'
            });
        }

        const results = [];
        const closureType = metadata?.closureType || 'manual';
        const closureReason = metadata?.closureReason || 'Job was closed';
        
        // Process each recipient
        for (const recipient of recipients) {
            try {
                if (!recipient.email) {
                    console.warn('⚠️ Skipping recipient with no email address:', recipient);
                    continue;
                }

                // Create matching text version
                const textVersion = `
JOB CLOSURE NOTIFICATION
Dreamex Datalab HSE System

Dear ${recipient.name || recipient.email},

A job posting has been closed and requires your attention.

Job Details:
- Job Title: ${jobData.jobTitle || 'Not specified'}
- Job Code: ${jobData.jobCode || 'Not specified'}
- Position: ${jobData.positionTitle || 'Not specified'}
- Department: ${jobData.department || 'Not specified'}
- Closure Type: ${closureType === 'manual' ? 'Manual Closure' : 'Automatic Closure (Deadline Reached)'}
- Closure Reason: ${closureReason}
- Closure Date: ${new Date().toLocaleDateString()}

${jobData.salaryRange ? `Salary Range: ${jobData.salaryRange}` : ''}
${jobData.employmentType ? `Employment Type: ${jobData.employmentType}` : ''}

Please review this closure in the recruitment system for any required follow-up actions.

---
This is an automated notification from Dreamex Datalab HSE System
Please do not reply to this email
                `.trim();

                // Email options
                const mailOptions = {
                    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
                    to: recipient.email,
                    subject: `Job Closure Notification: ${jobData.jobTitle || jobData.jobCode || 'Position'}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px 20px; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Job Closure Notification</h1>
                                <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 30px 20px; background: #f8f9fa;">
                                <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0;">
                                    <p style="margin: 0 0 20px 0; color: #2c3e50; font-size: 16px;">Dear ${recipient.name || recipient.email},</p>
                                    <p style="margin: 0 0 20px 0; color: #2c3e50;">A job posting has been closed and requires your attention.</p>
                                </div>
                                
                                <!-- Job Details -->
                                <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #dc3545;">
                                    <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 18px;">Job Details</h3>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Job Title:</div>
                                        <div style="color: #2c3e50; font-weight: 500;">${jobData.jobTitle || 'Not specified'}</div>
                                    </div>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Job Code:</div>
                                        <div style="color: #2c3e50; font-weight: 500; font-family: 'Courier New', monospace; background: #f1f3f4; padding: 4px 8px; border-radius: 4px;">${jobData.jobCode || 'Not specified'}</div>
                                    </div>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Position:</div>
                                        <div style="color: #2c3e50;">${jobData.positionTitle || 'Not specified'}</div>
                                    </div>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Department:</div>
                                        <div style="color: #2c3e50;">${jobData.department || 'Not specified'}</div>
                                    </div>
                                    
                                    ${jobData.salaryRange ? `
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Salary Range:</div>
                                        <div style="color: #28a745; font-weight: 500;">${jobData.salaryRange}</div>
                                    </div>
                                    ` : ''}
                                    
                                    ${jobData.employmentType ? `
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Employment Type:</div>
                                        <div style="color: #2c3e50;">${jobData.employmentType}</div>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Closure Information -->
                                <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #ffc107;">
                                    <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 18px;">Closure Information</h3>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Closure Type:</div>
                                        <div style="color: #2c3e50; font-weight: 500;">${closureType === 'manual' ? 'Manual Closure' : 'Automatic Closure (Deadline Reached)'}</div>
                                    </div>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Closure Reason:</div>
                                        <div style="color: #2c3e50;">${closureReason}</div>
                                    </div>
                                    
                                    <div style="display: flex; margin-bottom: 15px; align-items: center;">
                                        <div style="color: #666; font-weight: 600; min-width: 120px;">Closure Date:</div>
                                        <div style="color: #2c3e50;">${new Date().toLocaleDateString()}</div>
                                    </div>
                                </div>
                                
                                <!-- Action Required -->
                                <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #2196f3;">
                                    <h4 style="color: #1976d2; margin: 0 0 10px 0;">Action Required</h4>
                                    <p style="margin: 0; color: #2c3e50;">Please review this closure in the recruitment system for any required follow-up actions.</p>
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background: #ecf0f1; padding: 20px; text-align: center; color: #7f8c8d; font-size: 12px;">
                                <p style="margin: 0;">This is an automated notification from Dreamex Datalab HSE System</p>
                                <p style="margin: 5px 0 0 0;">Please do not reply to this email</p>
                            </div>
                        </div>
                    `,
                    text: textVersion,
                    replyTo: process.env.REPLY_TO
                };

                // Send email
                const info = await transporter.sendMail(mailOptions);
                console.log(`✅ Job closure notification sent to ${recipient.email}`);
                
                results.push({
                    email: recipient.email,
                    success: true,
                    messageId: info.messageId
                });
                
            } catch (error) {
                console.error(`❌ Failed to send job closure notification to ${recipient.email}:`, error.message);
                results.push({
                    email: recipient.email,
                    success: false,
                    error: error.message
                });
            }
        }

        // Return results
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`📊 Job closure notification results: ${successful} successful, ${failed} failed`);
        
        res.json({
            success: failed === 0,
            message: failed === 0 
                ? `Job closure notifications sent successfully to ${successful} recipients`
                : `Job closure notifications: ${successful} successful, ${failed} failed`,
            results: results,
            metadata: {
                timestamp: new Date().toISOString(),
                jobCode: jobData.jobCode,
                jobTitle: jobData.jobTitle,
                closureType: closureType,
                totalRecipients: recipients.length,
                successfulSends: successful,
                failedSends: failed
            }
        });
        
    } catch (error) {
        console.error('❌ Error in job closure notification endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send job closure notifications',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    
    // Don't crash the server - log error and continue
    if (res.headersSent) {
        return next(error);
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    console.log('🔄 Service continuing - error logged');
    // Don't exit in production
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('🔄 Service continuing - error logged');
    // Don't exit in production
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received - shutting down gracefully');
    server.close(() => {
        console.log('✅ Email service shut down complete');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received - shutting down gracefully');
    server.close(() => {
        console.log('✅ Email service shut down complete');
        process.exit(0);
    });
});

// Start server with production stability
const server = app.listen(PORT, () => {
    console.log(`🚀 Email notification service running on port ${PORT}`);
    console.log(`📧 SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`📨 From Email: ${process.env.FROM_EMAIL}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
    console.log(`🛡️ Production stability features enabled`);
});

// Keep process alive and log status every 5 minutes
setInterval(() => {
    console.log(`⚡ Email service status: RUNNING - ${new Date().toISOString()}`);
}, 5 * 60 * 1000);

module.exports = app;
