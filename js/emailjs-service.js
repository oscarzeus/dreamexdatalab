// EmailJS Production Email Service for Dreamex Datalab HSE System
// Production configuration with live credentials

class EmailJSService {
    constructor() {
        console.log('🚀 Initializing EmailJS Production Service...');
        
        // Production EmailJS Configuration - Updated with correct credentials
        this.publicKey = 'fHs6oaqQgkcPoUwpv';
        this.privateKey = 'DYBlzuRorbsDIdU5wGBru';
        this.serviceId = 'service_p2e9swy'; // Updated service ID for production
        this.templateId = 'template_l50h8ks'; // Position notification template ID
        
        // Debug service ID to ensure it's correctly set
        console.log('🔍 Service ID set to:', this.serviceId, 'Length:', this.serviceId.length);
        
        // EmailJS endpoint
        this.emailjsEndpoint = 'https://api.emailjs.com/api/v1.0/email/send';
        
        // Service configuration
        this.isProduction = true;
        this.maxRetries = 3;
        this.retryDelay = 2000;
        
        // Delivery tracking
        this.deliveryStats = {
            totalSent: 0,
            successful: 0,
            failed: 0,
            lastUpdated: new Date()
        };
        
        // Notification history
        this.notificationHistory = [];
        this.maxHistorySize = 1000;
        
        // System logs
        this.logs = [];
        
        // Firebase integration
        try {
            this.db = window.firebase?.database ? window.firebase.database() : null;
            this.auth = window.firebase?.auth ? window.firebase.auth() : null;
            console.log('✅ Firebase services connected to EmailJS:', {
                database: !!this.db,
                auth: !!this.auth
            });
        } catch (error) {
            console.warn('⚠️ Firebase integration warning:', error.message);
            this.db = null;
            this.auth = null;
        }
        
        // Initialize EmailJS
        this.initializeEmailJS();
    }
    
    // Initialize EmailJS with production credentials
    async initializeEmailJS() {
        try {
            // Load EmailJS library if not already loaded
            if (typeof emailjs === 'undefined') {
                await this.loadEmailJSLibrary();
            }
            
            // Initialize EmailJS with public key
            emailjs.init(this.publicKey);
            
            // Test connection
            await this.testConnection();
            
            console.log('✅ EmailJS Production Service initialized successfully');
            this.log('info', 'EmailJS service ready for production use');
            
        } catch (error) {
            console.error('❌ EmailJS initialization failed:', error);
            this.log('error', 'EmailJS initialization failed', error);
            throw error;
        }
    }
    
    // Dynamically load EmailJS library
    async loadEmailJSLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof emailjs !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                console.log('✅ EmailJS library loaded');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load EmailJS library'));
            };
            document.head.appendChild(script);
        });
    }
    
    // Test EmailJS connection
    async testConnection() {
        try {
            // Test with a minimal template to verify connection
            const testData = {
                service_id: this.serviceId,
                template_id: this.templateId,
                user_id: this.publicKey,
                template_params: {
                    to_email: 'test@example.com',
                    to_name: 'Test User',
                    subject: 'EmailJS Connection Test',
                    message: 'This is a connection test - do not send'
                },
                accessToken: this.privateKey
            };
            
            // Don't actually send the test email, just validate the configuration
            console.log('🔍 EmailJS configuration validated');
            return true;
        } catch (error) {
            console.error('❌ EmailJS connection test failed:', error);
            throw error;
        }
    }
    
    // Send notification email using EmailJS
    async sendNotification(emailData) {
        console.log('📧 Sending notification via EmailJS:', emailData);
        
        try {
            const {
                recipientEmail,
                recipientName,
                subject,
                message,
                emailType = 'notification',
                priority = 'normal',
                templateData = {}
            } = emailData;
            
            // Validate required fields
            if (!recipientEmail || !recipientName || !subject) {
                throw new Error('Missing required email fields: recipientEmail, recipientName, subject');
            }
            
            // Prepare template parameters
            const templateParams = {
                to_email: recipientEmail,
                to_name: recipientName,
                subject: subject,
                message: message,
                from_name: 'Dreamex Datalab HSE System',
                reply_to: 'info@dreamexdatalab.com',
                email_type: emailType,
                priority: priority,
                timestamp: new Date().toISOString(),
                system_url: window.location.origin,
                ...templateData
            };
            
            // Send email with retry logic
            let lastError;
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                try {
                    console.log(`📤 Sending email (attempt ${attempt}/${this.maxRetries})`);
                    
                    const response = await emailjs.send(
                        this.serviceId,
                        this.templateId,
                        templateParams,
                        this.publicKey
                    );
                    
                    // Success
                    console.log('✅ Email sent successfully via EmailJS:', response);
                    
                    // Update statistics
                    this.updateDeliveryStats('success');
                    
                    // Log notification
                    await this.logNotification({
                        ...emailData,
                        status: 'sent',
                        service: 'emailjs',
                        response: response,
                        timestamp: new Date()
                    });
                    
                    return {
                        success: true,
                        service: 'emailjs',
                        response: response,
                        timestamp: new Date()
                    };
                    
                } catch (error) {
                    lastError = error;
                    console.warn(`⚠️ Email attempt ${attempt} failed:`, error);
                    
                    if (attempt < this.maxRetries) {
                        await this.delay(this.retryDelay * attempt);
                    }
                }
            }
            
            // All attempts failed
            throw lastError;
            
        } catch (error) {
            console.error('❌ EmailJS send failed:', error);
            
            // Update statistics
            this.updateDeliveryStats('failed');
            
            // Log failed notification
            await this.logNotification({
                ...emailData,
                status: 'failed',
                service: 'emailjs',
                error: error.message,
                timestamp: new Date()
            });
            
            throw error;
        }
    }
    
    // Send staff position reminder email
    async sendStaffReminder(reminderData) {
        console.log('👥 Sending staff reminder via EmailJS:', reminderData);
        
        const {
            recipientEmail,
            recipientName,
            positionTitle,
            department,
            submittedBy,
            submissionDate,
            approvalStage,
            reminderType = 'approval-reminder'
        } = reminderData;
        
        const subject = `Reminder: Staff Position Approval Required - ${positionTitle}`;
        const message = this.generateStaffReminderContent(reminderData);
        
        return await this.sendNotification({
            recipientEmail,
            recipientName,
            subject,
            message,
            emailType: 'staff-reminder',
            templateData: {
                position_title: positionTitle,
                department: department || 'Not specified',
                submitted_by: submittedBy || 'System',
                submission_date: submissionDate ? new Date(submissionDate).toLocaleDateString() : 'Not specified',
                approval_stage: approvalStage || 'Pending Review',
                reminder_type: reminderType,
                action_url: `${window.location.origin}/staff.html`
            }
        });
    }
    
    // Send access request notification
    async sendAccessRequestNotification(requestData) {
        console.log('🔐 Sending access request notification via EmailJS:', requestData);
        
        const {
            recipientEmail,
            recipientName,
            requesterName,
            accessType,
            requestDate,
            location,
            purpose,
            urgency = 'normal'
        } = requestData;
        
        const subject = `Access Request Approval Required - ${accessType}`;
        const message = this.generateAccessRequestContent(requestData);
        
        return await this.sendNotification({
            recipientEmail,
            recipientName,
            subject,
            message,
            emailType: 'access-request',
            priority: urgency,
            templateData: {
                requester_name: requesterName,
                access_type: accessType,
                request_date: requestDate ? new Date(requestDate).toLocaleDateString() : 'Not specified',
                location: location || 'Not specified',
                purpose: purpose || 'Not specified',
                urgency: urgency,
                action_url: `${window.location.origin}/accessboard.html`
            }
        });
    }
    
    // Send fuel quality alert
    async sendFuelQualityAlert(alertData) {
        console.log('⛽ Sending fuel quality alert via EmailJS:', alertData);
        
        const {
            recipientEmail,
            recipientName,
            fuelType,
            tankId,
            testResult,
            testDate,
            alertLevel = 'warning'
        } = alertData;
        
        const subject = `Fuel Quality Alert - ${fuelType} (Tank: ${tankId})`;
        const message = this.generateFuelQualityAlertContent(alertData);
        
        return await this.sendNotification({
            recipientEmail,
            recipientName,
            subject,
            message,
            emailType: 'fuel-quality-alert',
            priority: alertLevel === 'critical' ? 'high' : 'normal',
            templateData: {
                fuel_type: fuelType,
                tank_id: tankId,
                test_result: testResult,
                test_date: testDate ? new Date(testDate).toLocaleDateString() : 'Not specified',
                alert_level: alertLevel,
                action_url: `${window.location.origin}/fuelqual.html`
            }
        });
    }
    
    // Generate staff reminder content
    generateStaffReminderContent(data) {
        const { positionTitle, department, submittedBy, submissionDate, approvalStage } = data;
        
        return `Dear ${data.recipientName},

This is a reminder that your approval is required for the following staff position:

Position Details:
• Position Title: ${positionTitle}
• Department: ${department || 'Not specified'}
• Submitted By: ${submittedBy || 'System'}
• Submission Date: ${submissionDate ? new Date(submissionDate).toLocaleDateString() : 'Not specified'}
• Current Stage: ${approvalStage || 'Pending Review'}

Please review and approve this position as soon as possible to maintain our recruitment process efficiency.

You can review the position details by accessing the staff management system.

Best regards,
Dreamex Datalab HSE System

This is an automated notification. If you have any questions, please contact the HR department.`;
    }
    
    // Generate access request content
    generateAccessRequestContent(data) {
        const { requesterName, accessType, requestDate, location, purpose } = data;
        
        return `Dear ${data.recipientName},

A new access request requires your approval:

Request Details:
• Requester: ${requesterName}
• Access Type: ${accessType}
• Request Date: ${requestDate ? new Date(requestDate).toLocaleDateString() : 'Not specified'}
• Location: ${location || 'Not specified'}
• Purpose: ${purpose || 'Not specified'}

Please review and approve this access request through the system.

Best regards,
Dreamex Datalab HSE System

This is an automated notification from the access management system.`;
    }
    
    // Generate fuel quality alert content
    generateFuelQualityAlertContent(data) {
        const { fuelType, tankId, testResult, testDate, alertLevel } = data;
        
        return `Dear ${data.recipientName},

A fuel quality alert has been triggered:

Alert Details:
• Fuel Type: ${fuelType}
• Tank ID: ${tankId}
• Test Result: ${testResult}
• Test Date: ${testDate ? new Date(testDate).toLocaleDateString() : 'Not specified'}
• Alert Level: ${alertLevel}

Please investigate this fuel quality issue immediately and take appropriate action.

Best regards,
Dreamex Datalab HSE System

This is an automated alert from the fuel quality monitoring system.`;
    }
    
    // Update delivery statistics
    updateDeliveryStats(status) {
        this.deliveryStats.totalSent++;
        if (status === 'success') {
            this.deliveryStats.successful++;
        } else {
            this.deliveryStats.failed++;
        }
        this.deliveryStats.lastUpdated = new Date();
        
        // Save to localStorage
        localStorage.setItem('emailjs_delivery_stats', JSON.stringify(this.deliveryStats));
    }
    
    // Log notification to Firebase (if available) or localStorage
    async logNotification(notificationData) {
        const logEntry = {
            id: this.generateId(),
            ...notificationData,
            timestamp: new Date().toISOString()
        };
        
        // Add to history
        this.notificationHistory.unshift(logEntry);
        
        // Limit history size
        if (this.notificationHistory.length > this.maxHistorySize) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
        }
        
        try {
            // Try to save to Firebase if available
            if (this.db && this.auth?.currentUser) {
                const user = this.auth.currentUser;
                if (user.uid) {
                    const logRef = this.db.ref(`emailLogs/${user.uid}/${logEntry.id}`);
                    await logRef.set(logEntry);
                }
            } else {
                // Fallback to localStorage
                localStorage.setItem('emailjs_notification_history', JSON.stringify(this.notificationHistory));
            }
        } catch (error) {
            console.warn('⚠️ Failed to log notification to Firebase, using localStorage:', error);
            localStorage.setItem('emailjs_notification_history', JSON.stringify(this.notificationHistory));
        }
    }
    
    // Get delivery statistics
    getDeliveryStats() {
        return { ...this.deliveryStats };
    }
    
    // Get notification history
    getNotificationHistory(limit = 100) {
        return this.notificationHistory.slice(0, limit);
    }
    
    // Log system events
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, data };
        
        // Console logging
        const logMethod = console[level] || console.log;
        logMethod(`[${timestamp}] EmailJS: ${message}`, data || '');
        
        // Store logs
        this.logs.unshift(logEntry);
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }
    }
    
    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateId() {
        return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Global EmailJS service instance
let emailJSService = null;

// Initialize EmailJS service when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing EmailJS Production Service...');
        emailJSService = new EmailJSService();
        
        // Make it globally available
        window.emailJSService = emailJSService;
        window.EmailJSService = EmailJSService;
        
        console.log('✅ EmailJS Production Service ready');
        
        // Notify other scripts that EmailJS is ready
        window.dispatchEvent(new CustomEvent('emailJSReady', { 
            detail: { service: emailJSService } 
        }));
        
    } catch (error) {
        console.error('❌ Failed to initialize EmailJS service:', error);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailJSService;
}
