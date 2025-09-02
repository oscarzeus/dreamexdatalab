/**
 * Comprehensive Email Security Validator
 * Prevents email abuse and ensures compliance with email provider policies
 * Designed for Namecheap and other strict email providers
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class EmailSecurityValidator {
    constructor() {
        this.suspiciousPatterns = [
            // Spam keywords
            /\b(free money|click here|urgent|act now|limited time|guarantee|winner|congratulations)\b/i,
            // Suspicious characters
            /[^\x00-\x7F]/g, // Non-ASCII characters
            // Multiple exclamation marks
            /!{3,}/g,
            // Excessive caps
            /[A-Z]{10,}/g,
            // Suspicious links
            /bit\.ly|tinyurl|t\.co|goo\.gl/i,
            // Email harvesting patterns
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
        ];

        this.blockedDomains = [
            'tempmail.org', '10minutemail.com', 'guerrillamail.com',
            'mailinator.com', 'temp-mail.org', 'throwaway.email',
            'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com'
        ];

        this.rateLimits = new Map();
        this.emailHashes = new Set();
        this.suspiciousIPs = new Map();
        this.trustedSenders = new Set();
        
        // Load trusted senders from config
        this.loadTrustedSenders();
        
        // Cleanup old rate limit entries every hour
        setInterval(() => this.cleanupRateLimits(), 3600000);
    }

    async loadTrustedSenders() {
        try {
            const configPath = path.join(__dirname, 'trusted-senders.json');
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            this.trustedSenders = new Set(config.trustedSenders || []);
        } catch (error) {
            // Create default trusted senders file
            const defaultConfig = {
                trustedSenders: [
                    'info@dreamexdatalab.com',
                    'admin@dreamexdatalab.com',
                    'hr@dreamexdatalab.com'
                ]
            };
            await this.saveTrustedSenders(defaultConfig);
            this.trustedSenders = new Set(defaultConfig.trustedSenders);
        }
    }

    async saveTrustedSenders(config) {
        const configPath = path.join(__dirname, 'trusted-senders.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    /**
     * Validate email content for security and spam patterns
     */
    validateEmailContent(emailData) {
        const errors = [];
        const warnings = [];

        // Check for suspicious patterns in subject and body
        const textToCheck = `${emailData.subject || ''} ${emailData.text || ''} ${emailData.html || ''}`;
        
        this.suspiciousPatterns.forEach(pattern => {
            if (pattern.test(textToCheck)) {
                errors.push(`Suspicious pattern detected: ${pattern.source}`);
            }
        });

        // Check for excessive length
        if (textToCheck.length > 50000) {
            errors.push('Email content exceeds maximum length (50,000 characters)');
        }

        // Check for suspicious attachment patterns
        if (emailData.attachments && emailData.attachments.length > 0) {
            emailData.attachments.forEach(attachment => {
                const filename = attachment.filename || '';
                const suspiciousExtensions = /\.(exe|scr|bat|cmd|com|pif|vbs|js|jar|zip|rar)$/i;
                if (suspiciousExtensions.test(filename)) {
                    errors.push(`Suspicious attachment type: ${filename}`);
                }
                if (attachment.size && attachment.size > 10 * 1024 * 1024) { // 10MB
                    errors.push(`Attachment too large: ${filename} (${attachment.size} bytes)`);
                }
            });
        }

        // Check for HTML injection attempts
        if (emailData.html) {
            const htmlPatterns = [
                /<script/i,
                /<iframe/i,
                /javascript:/i,
                /onclick=/i,
                /onerror=/i
            ];
            
            htmlPatterns.forEach(pattern => {
                if (pattern.test(emailData.html)) {
                    errors.push('Potentially malicious HTML detected');
                }
            });
        }

        return { errors, warnings };
    }

    /**
     * Validate email addresses
     */
    validateEmailAddresses(emailData) {
        const errors = [];
        
        // Validate sender
        if (!this.isValidEmail(emailData.from)) {
            errors.push('Invalid sender email address');
        }

        // Check for blocked domains
        const recipients = [
            ...(Array.isArray(emailData.to) ? emailData.to : [emailData.to]),
            ...(Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc || '']),
            ...(Array.isArray(emailData.bcc) ? emailData.bcc : [emailData.bcc || ''])
        ].filter(Boolean);

        recipients.forEach(email => {
            if (!this.isValidEmail(email)) {
                errors.push(`Invalid recipient email: ${email}`);
                return;
            }

            const domain = email.split('@')[1]?.toLowerCase();
            if (this.blockedDomains.includes(domain)) {
                errors.push(`Blocked domain detected: ${domain}`);
            }
        });

        // Check for excessive recipient count
        if (recipients.length > 50) {
            errors.push(`Too many recipients (${recipients.length}). Maximum allowed: 50`);
        }

        return { errors, recipients };
    }

    /**
     * Rate limiting validation
     */
    validateRateLimit(senderIP, senderEmail) {
        const now = Date.now();
        const hourAgo = now - 3600000; // 1 hour
        const errors = [];

        // IP-based rate limiting
        if (!this.rateLimits.has(senderIP)) {
            this.rateLimits.set(senderIP, []);
        }
        
        const ipRequests = this.rateLimits.get(senderIP);
        const recentIPRequests = ipRequests.filter(timestamp => timestamp > hourAgo);
        
        if (recentIPRequests.length >= 100) { // 100 emails per hour per IP
            errors.push('IP rate limit exceeded (100 emails per hour)');
        }

        // Email-based rate limiting
        const emailKey = `email:${senderEmail}`;
        if (!this.rateLimits.has(emailKey)) {
            this.rateLimits.set(emailKey, []);
        }
        
        const emailRequests = this.rateLimits.get(emailKey);
        const recentEmailRequests = emailRequests.filter(timestamp => timestamp > hourAgo);
        
        if (recentEmailRequests.length >= 50) { // 50 emails per hour per email
            errors.push('Email rate limit exceeded (50 emails per hour)');
        }

        // Update rate limits if validation passes
        if (errors.length === 0) {
            recentIPRequests.push(now);
            recentEmailRequests.push(now);
            this.rateLimits.set(senderIP, recentIPRequests);
            this.rateLimits.set(emailKey, recentEmailRequests);
        }

        return { errors };
    }

    /**
     * Detect duplicate emails (prevent spam loops)
     */
    validateDuplicateEmail(emailData) {
        const emailHash = this.generateEmailHash(emailData);
        const errors = [];

        if (this.emailHashes.has(emailHash)) {
            errors.push('Duplicate email detected within recent timeframe');
        } else {
            this.emailHashes.add(emailHash);
            // Remove hash after 1 hour
            setTimeout(() => {
                this.emailHashes.delete(emailHash);
            }, 3600000);
        }

        return { errors };
    }

    /**
     * Validate sender authorization
     */
    validateSenderAuthorization(senderEmail, apiKey, userAgent, referer) {
        const errors = [];
        const warnings = [];

        // Check if sender is in trusted list
        if (!this.trustedSenders.has(senderEmail)) {
            warnings.push('Sender not in trusted list');
        }

        // Validate API key format
        if (!apiKey || apiKey.length < 32) {
            errors.push('Invalid or weak API key');
        }

        // Check for suspicious user agents
        const suspiciousUserAgents = [
            /bot/i, /crawler/i, /spider/i, /scraper/i,
            /curl/i, /wget/i, /python/i, /script/i
        ];

        suspiciousUserAgents.forEach(pattern => {
            if (pattern.test(userAgent || '')) {
                warnings.push('Suspicious user agent detected');
            }
        });

        // Validate referer if provided
        if (referer) {
            const validDomains = ['dreamexdatalab.com', 'localhost', '127.0.0.1'];
            const refererDomain = new URL(referer).hostname;
            if (!validDomains.some(domain => refererDomain.includes(domain))) {
                warnings.push('Suspicious referer domain');
            }
        }

        return { errors, warnings };
    }

    /**
     * Check IP reputation
     */
    async validateIPReputation(ip) {
        const errors = [];
        const warnings = [];

        // Track suspicious IPs
        if (this.suspiciousIPs.has(ip)) {
            const ipData = this.suspiciousIPs.get(ip);
            if (ipData.violations > 5) {
                errors.push('IP address has been flagged for suspicious activity');
            } else if (ipData.violations > 2) {
                warnings.push('IP address has previous violations');
            }
        }

        // Check for common malicious IP patterns
        const maliciousPatterns = [
            /^10\./, /^172\.16\./, /^192\.168\./, // Private IPs (shouldn't be sending external emails)
            /^169\.254\./, // Link-local
            /^127\./ // Loopback
        ];

        maliciousPatterns.forEach(pattern => {
            if (pattern.test(ip)) {
                warnings.push('Email originating from internal/private IP address');
            }
        });

        return { errors, warnings };
    }

    /**
     * Comprehensive email validation
     */
    async validateEmail(emailData, metadata = {}) {
        const validationResults = {
            isValid: true,
            errors: [],
            warnings: [],
            securityScore: 100
        };

        try {
            // 1. Content validation
            const contentValidation = this.validateEmailContent(emailData);
            validationResults.errors.push(...contentValidation.errors);
            validationResults.warnings.push(...contentValidation.warnings);

            // 2. Email address validation
            const addressValidation = this.validateEmailAddresses(emailData);
            validationResults.errors.push(...addressValidation.errors);

            // 3. Rate limiting
            if (metadata.ip && emailData.from) {
                const rateLimitValidation = this.validateRateLimit(metadata.ip, emailData.from);
                validationResults.errors.push(...rateLimitValidation.errors);
            }

            // 4. Duplicate detection
            const duplicateValidation = this.validateDuplicateEmail(emailData);
            validationResults.errors.push(...duplicateValidation.errors);

            // 5. Sender authorization
            const authValidation = this.validateSenderAuthorization(
                emailData.from,
                metadata.apiKey,
                metadata.userAgent,
                metadata.referer
            );
            validationResults.errors.push(...authValidation.errors);
            validationResults.warnings.push(...authValidation.warnings);

            // 6. IP reputation
            if (metadata.ip) {
                const ipValidation = await this.validateIPReputation(metadata.ip);
                validationResults.errors.push(...ipValidation.errors);
                validationResults.warnings.push(...ipValidation.warnings);
            }

            // Calculate security score
            validationResults.securityScore = this.calculateSecurityScore(
                validationResults.errors.length,
                validationResults.warnings.length
            );

            validationResults.isValid = validationResults.errors.length === 0;

            // Log validation attempt
            this.logValidationAttempt(emailData, metadata, validationResults);

            return validationResults;

        } catch (error) {
            validationResults.isValid = false;
            validationResults.errors.push(`Validation error: ${error.message}`);
            return validationResults;
        }
    }

    /**
     * Helper methods
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    generateEmailHash(emailData) {
        const hashContent = `${emailData.to}-${emailData.subject}-${emailData.text || emailData.html}`;
        return crypto.createHash('sha256').update(hashContent).digest('hex');
    }

    calculateSecurityScore(errorCount, warningCount) {
        const baseScore = 100;
        const errorPenalty = errorCount * 20;
        const warningPenalty = warningCount * 5;
        return Math.max(0, baseScore - errorPenalty - warningPenalty);
    }

    logValidationAttempt(emailData, metadata, results) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sender: emailData.from,
            recipients: Array.isArray(emailData.to) ? emailData.to.length : 1,
            subject: emailData.subject?.substring(0, 100),
            ip: metadata.ip,
            userAgent: metadata.userAgent?.substring(0, 100),
            securityScore: results.securityScore,
            errors: results.errors.length,
            warnings: results.warnings.length,
            isValid: results.isValid
        };

        console.log('EMAIL_VALIDATION:', JSON.stringify(logEntry));
    }

    cleanupRateLimits() {
        const oneHourAgo = Date.now() - 3600000;
        
        for (const [key, timestamps] of this.rateLimits.entries()) {
            const recentTimestamps = timestamps.filter(timestamp => timestamp > oneHourAgo);
            if (recentTimestamps.length === 0) {
                this.rateLimits.delete(key);
            } else {
                this.rateLimits.set(key, recentTimestamps);
            }
        }
    }

    /**
     * Mark IP as suspicious
     */
    markIPSuspicious(ip, reason) {
        if (!this.suspiciousIPs.has(ip)) {
            this.suspiciousIPs.set(ip, { violations: 0, reasons: [] });
        }
        
        const ipData = this.suspiciousIPs.get(ip);
        ipData.violations++;
        ipData.reasons.push({ reason, timestamp: new Date().toISOString() });
        
        console.log('SUSPICIOUS_IP_MARKED:', JSON.stringify({ ip, reason, violations: ipData.violations }));
    }

    /**
     * Add trusted sender
     */
    async addTrustedSender(email) {
        this.trustedSenders.add(email);
        const config = { trustedSenders: Array.from(this.trustedSenders) };
        await this.saveTrustedSenders(config);
    }

    /**
     * Remove trusted sender
     */
    async removeTrustedSender(email) {
        this.trustedSenders.delete(email);
        const config = { trustedSenders: Array.from(this.trustedSenders) };
        await this.saveTrustedSenders(config);
    }
}

module.exports = EmailSecurityValidator;
