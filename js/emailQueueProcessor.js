/**
 * Email Queue Processor
 * Monitors Firebase emailQueue and processes pending emails using the mail notification service
 */

class EmailQueueProcessor {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        this.processInterval = 10000; // Check every 10 seconds
        
        // Initialize Firebase if not already done
        this.initializeFirebase();
        
        // Start processing when document is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startProcessing());
        } else {
            this.startProcessing();
        }
    }
    
    initializeFirebase() {
        // Firebase should already be initialized by the parent page
        if (typeof firebase === 'undefined') {
            console.error('Firebase not available for email queue processor');
            return;
        }
        
        this.database = firebase.database();
        console.log('Email Queue Processor: Firebase initialized');
    }
    
    startProcessing() {
        if (this.isProcessing) {
            console.log('Email queue processor already running');
            return;
        }
        
        this.isProcessing = true;
        console.log('Starting email queue processor...');
        
        // Process immediately, then set interval
        this.processQueue();
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, this.processInterval);
        
        // Listen for new emails in real-time
        this.listenForNewEmails();
    }
    
    stopProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.isProcessing = false;
        console.log('Email queue processor stopped');
    }
    
    listenForNewEmails() {
        if (!this.database) return;
        
        // Listen for new pending emails
        this.database.ref('emailQueue').orderByChild('status').equalTo('pending')
            .on('child_added', (snapshot) => {
                const emailData = snapshot.val();
                console.log('New email detected in queue:', snapshot.key);
                
                // Process immediately if it's a high priority email
                if (emailData.priority === 'high' || emailData.type === 'job-closure-notification') {
                    this.processEmail(snapshot.key, emailData);
                }
            });
    }
    
    async processQueue() {
        if (!this.database) {
            console.error('Database not available for email processing');
            return;
        }
        
        try {
            console.log('Processing email queue...');
            
            // Get all pending emails
            const snapshot = await this.database.ref('emailQueue')
                .orderByChild('status')
                .equalTo('pending')
                .once('value');
            
            const emails = snapshot.val();
            if (!emails) {
                console.log('No pending emails in queue');
                return;
            }
            
            const emailIds = Object.keys(emails);
            console.log(`Found ${emailIds.length} pending emails`);
            
            // Process each email
            for (const emailId of emailIds) {
                await this.processEmail(emailId, emails[emailId]);
                
                // Add small delay between emails to avoid overwhelming the service
                await this.delay(1000);
            }
            
        } catch (error) {
            console.error('Error processing email queue:', error);
        }
    }
    
    async processEmail(emailId, emailData) {
        try {
            console.log(`Processing email ${emailId}:`, emailData.type);
            
            // Check if email has exceeded max retries
            if (emailData.attempts >= this.maxRetries) {
                await this.markEmailAsFailed(emailId, 'Max retries exceeded');
                return;
            }
            
            // Mark as processing
            await this.updateEmailStatus(emailId, 'processing');
            
            // Send email based on type
            let result;
            switch (emailData.type) {
                case 'job-closure-notification':
                    result = await this.sendJobClosureNotification(emailData);
                    break;
                case 'recruitment-notification':
                    result = await this.sendRecruitmentNotification(emailData);
                    break;
                case 'approval-notification':
                    result = await this.sendApprovalNotification(emailData);
                    break;
                case 'completion-notification':
                    result = await this.sendCompletionNotification(emailData);
                    break;
                default:
                    throw new Error(`Unknown email type: ${emailData.type}`);
            }
            
            // Mark as sent
            await this.markEmailAsSent(emailId, result);
            console.log(`Email ${emailId} sent successfully`);
            
        } catch (error) {
            console.error(`Error processing email ${emailId}:`, error);
            await this.handleEmailError(emailId, emailData, error);
        }
    }
    
    async sendJobClosureNotification(emailData) {
        const endpoint = 'http://localhost:3001/send/recruitment-notification';
        
        const payload = {
            to: emailData.to,
            subject: emailData.subject,
            body: emailData.body,
            type: 'job-closure',
            metadata: {
                jobId: emailData.jobId,
                jobTitle: emailData.jobTitle,
                timestamp: new Date().toISOString(),
                closureReason: emailData.closureReason || 'Manual closure'
            }
        };
        
        return await this.sendEmailToService(endpoint, payload);
    }
    
    async sendRecruitmentNotification(emailData) {
        const endpoint = 'http://localhost:3001/send/recruitment-notification';
        return await this.sendEmailToService(endpoint, emailData);
    }
    
    async sendApprovalNotification(emailData) {
        const endpoint = 'http://localhost:3001/send/approval-notification';
        return await this.sendEmailToService(endpoint, emailData);
    }
    
    async sendCompletionNotification(emailData) {
        const endpoint = 'http://localhost:3001/send/completion-notification';
        return await this.sendEmailToService(endpoint, emailData);
    }
    
    async sendEmailToService(endpoint, payload) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'dreemex_hse_email_service_2025'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Email service error (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        return result;
    }
    
    async updateEmailStatus(emailId, status) {
        await this.database.ref(`emailQueue/${emailId}`).update({
            status: status,
            lastUpdated: new Date().toISOString()
        });
    }
    
    async markEmailAsSent(emailId, result) {
        await this.database.ref(`emailQueue/${emailId}`).update({
            status: 'sent',
            sentAt: new Date().toISOString(),
            messageId: result.messageId || 'unknown',
            lastUpdated: new Date().toISOString()
        });
    }
    
    async markEmailAsFailed(emailId, error) {
        await this.database.ref(`emailQueue/${emailId}`).update({
            status: 'failed',
            error: error.toString(),
            failedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });
    }
    
    async handleEmailError(emailId, emailData, error) {
        const attempts = (emailData.attempts || 0) + 1;
        
        if (attempts >= this.maxRetries) {
            await this.markEmailAsFailed(emailId, error);
        } else {
            // Schedule retry
            await this.database.ref(`emailQueue/${emailId}`).update({
                status: 'pending',
                attempts: attempts,
                lastError: error.toString(),
                nextRetryAt: new Date(Date.now() + this.retryDelay * attempts).toISOString(),
                lastUpdated: new Date().toISOString()
            });
            
            console.log(`Email ${emailId} scheduled for retry (attempt ${attempts}/${this.maxRetries})`);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Cleanup old emails (sent/failed emails older than 7 days)
    async cleanupOldEmails() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            const cutoffIso = cutoffDate.toISOString();
            
            const snapshot = await this.database.ref('emailQueue').once('value');
            const emails = snapshot.val();
            
            if (!emails) return;
            
            const toDelete = [];
            Object.keys(emails).forEach(emailId => {
                const email = emails[emailId];
                if ((email.status === 'sent' || email.status === 'failed') && 
                    email.lastUpdated < cutoffIso) {
                    toDelete.push(emailId);
                }
            });
            
            console.log(`Cleaning up ${toDelete.length} old emails`);
            
            for (const emailId of toDelete) {
                await this.database.ref(`emailQueue/${emailId}`).remove();
            }
            
        } catch (error) {
            console.error('Error cleaning up old emails:', error);
        }
    }
    
    // Get queue statistics
    async getQueueStats() {
        try {
            const snapshot = await this.database.ref('emailQueue').once('value');
            const emails = snapshot.val();
            
            if (!emails) {
                return { pending: 0, sent: 0, failed: 0, processing: 0, total: 0 };
            }
            
            const stats = { pending: 0, sent: 0, failed: 0, processing: 0, total: 0 };
            
            Object.values(emails).forEach(email => {
                stats[email.status] = (stats[email.status] || 0) + 1;
                stats.total++;
            });
            
            return stats;
            
        } catch (error) {
            console.error('Error getting queue stats:', error);
            return { error: error.message };
        }
    }
}

// Create global instance
window.emailQueueProcessor = new EmailQueueProcessor();

// Cleanup old emails daily
setInterval(() => {
    window.emailQueueProcessor.cleanupOldEmails();
}, 24 * 60 * 60 * 1000); // 24 hours

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailQueueProcessor;
}
