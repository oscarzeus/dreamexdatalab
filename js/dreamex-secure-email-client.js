/**
 * Dreamex Secure Email Client
 * Provides secure email sending with built-in validation and error handling
 * Compatible with the new security-enhanced email service
 */

class DreamexSecureEmailClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:3001';
        this.apiKey = options.apiKey || this.getApiKeyFromConfig();
        this.timeout = options.timeout || 30000; // 30 seconds
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        
        // Validate configuration
        if (!this.apiKey) {
            console.error('Dreamex Email Client: API key not configured');
        }
    }

    /**
     * Get API key from configuration or environment
     */
    getApiKeyFromConfig() {
        // Try to get from global config object
        if (typeof window !== 'undefined' && window.DREAMEX_CONFIG && window.DREAMEX_CONFIG.apiKey) {
            return window.DREAMEX_CONFIG.apiKey;
        }
        
        // Try to get from local storage (for development)
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('dreamex_api_key');
        }
        
        return null;
    }

    /**
     * Validate email data before sending
     */
    validateEmailData(emailData) {
        const errors = [];
        
        // Required fields
        if (!emailData.to) {
            errors.push('Recipient email (to) is required');
        }
        
        if (!emailData.subject) {
            errors.push('Email subject is required');
        }
        
        if (!emailData.text && !emailData.html) {
            errors.push('Email content (text or html) is required');
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
        
        recipients.forEach(email => {
            if (email && !emailRegex.test(email)) {
                errors.push(`Invalid email format: ${email}`);
            }
        });
        
        // Content length validation
        const totalContent = (emailData.subject || '') + (emailData.text || '') + (emailData.html || '');
        if (totalContent.length > 50000) {
            errors.push('Email content is too long (max 50,000 characters)');
        }
        
        // Attachment validation
        if (emailData.attachments && emailData.attachments.length > 0) {
            emailData.attachments.forEach(attachment => {
                if (attachment.size && attachment.size > 10 * 1024 * 1024) { // 10MB
                    errors.push(`Attachment too large: ${attachment.filename || 'unknown'}`);
                }
            });
        }
        
        return errors;
    }

    /**
     * Send email with security validation and retry logic
     */
    async sendEmail(emailData, options = {}) {
        // Validate email data
        const validationErrors = this.validateEmailData(emailData);
        if (validationErrors.length > 0) {
            throw new Error(`Email validation failed: ${validationErrors.join(', ')}`);
        }

        // Prepare request options
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'User-Agent': 'Dreamex-Frontend-Client/2.0'
            },
            body: JSON.stringify(emailData),
            signal: AbortSignal.timeout(this.timeout)
        };

        // Add custom headers if provided
        if (options.headers) {
            Object.assign(requestOptions.headers, options.headers);
        }

        let lastError;
        
        // Retry logic
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`Dreamex Email: Sending email (attempt ${attempt}/${this.retryAttempts})`);
                
                const response = await fetch(`${this.baseUrl}/send/secure`, requestOptions);
                const responseData = await response.json();
                
                if (response.ok) {
                    console.log('Dreamex Email: Email sent successfully', {
                        messageId: responseData.messageId,
                        securityScore: responseData.securityScore,
                        responseTime: responseData.responseTime
                    });
                    
                    return {
                        success: true,
                        messageId: responseData.messageId,
                        securityScore: responseData.securityScore,
                        responseTime: responseData.responseTime,
                        requestId: responseData.requestId
                    };
                } else {
                    // Handle specific error cases
                    if (response.status === 401) {
                        throw new Error('Authentication failed: Invalid API key');
                    } else if (response.status === 400) {
                        const errorDetails = responseData.details ? 
                            responseData.details.join(', ') : 
                            responseData.error;
                        throw new Error(`Email validation failed: ${errorDetails}`);
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded: Please wait before sending more emails');
                    } else {
                        throw new Error(`Email service error: ${responseData.error || 'Unknown error'}`);
                    }
                }
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retryAttempts) {
                    // Don't retry on validation errors or auth errors
                    if (error.message.includes('validation failed') || 
                        error.message.includes('Authentication failed') ||
                        error.message.includes('Rate limit exceeded')) {
                        break;
                    }
                    
                    console.warn(`Dreamex Email: Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`, error.message);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                } else {
                    console.error('Dreamex Email: All retry attempts failed', error);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Send notification email (simplified interface)
     */
    async sendNotification(to, subject, message, options = {}) {
        const emailData = {
            to: to,
            subject: subject,
            text: message,
            html: options.html,
            cc: options.cc,
            bcc: options.bcc,
            attachments: options.attachments
        };
        
        return this.sendEmail(emailData, options);
    }

    /**
     * Send job-related notification
     */
    async sendJobNotification(recipientEmail, notificationType, jobData, templateData = {}) {
        const templates = {
            'job-published': {
                subject: `New Job Posted: ${jobData.title}`,
                getText: () => `A new job "${jobData.title}" has been posted.\n\nJob ID: ${jobData.id}\nDepartment: ${jobData.department}\nLocation: ${jobData.location}\n\nPlease review the job posting in the system.`
            },
            'job-closure': {
                subject: `Job Closing Notification: ${jobData.title}`,
                getText: () => `The job "${jobData.title}" is being closed.\n\nJob ID: ${jobData.id}\nReason: ${templateData.reason || 'Not specified'}\n\nThank you for your participation.`
            },
            'job-offer': {
                subject: `Job Offer: ${jobData.title}`,
                getText: () => `Congratulations! You have been selected for the position "${jobData.title}".\n\nJob ID: ${jobData.id}\nStart Date: ${templateData.startDate || 'To be determined'}\nSalary: ${templateData.salary || 'As discussed'}\n\nPlease respond within 48 hours.`
            }
        };
        
        const template = templates[notificationType];
        if (!template) {
            throw new Error(`Unknown notification type: ${notificationType}`);
        }
        
        return this.sendNotification(
            recipientEmail,
            template.subject,
            template.getText(),
            {
                html: templateData.html,
                cc: templateData.cc,
                bcc: templateData.bcc
            }
        );
    }

    /**
     * Check service health
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    healthy: data.status === 'healthy',
                    version: data.version,
                    timestamp: data.timestamp
                };
            } else {
                return { healthy: false, error: 'Health check failed' };
            }
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Get security status
     */
    async getSecurityStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/security/status`, {
                headers: {
                    'x-api-key': this.apiKey
                },
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`Security status check failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to get security status:', error);
            throw error;
        }
    }
}

// Create global instance for backward compatibility
if (typeof window !== 'undefined') {
    window.DreamexEmailClient = new DreamexSecureEmailClient();
    
    // Legacy compatibility - replace existing email functions
    window.sendSecureEmail = (emailData) => window.DreamexEmailClient.sendEmail(emailData);
    window.sendJobNotification = (email, type, jobData, templateData) => 
        window.DreamexEmailClient.sendJobNotification(email, type, jobData, templateData);
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DreamexSecureEmailClient;
}
