// Enhanced Email Service with SMTP Diagnostics and Fallback
// This file provides comprehensive email testing and fixes common SMTP issues

class EnhancedEmailService {
    constructor() {
        this.emailJSConfig = {
            publicKey: 'fHs6oaqQgkcPoUwpv',
            privateKey: 'DYBlzuRorbsDIdU5wGBru',
            serviceId: 'service_p2e9swy',
            templateId: 'template_l50h8ks'
        };
        
        this.localEmailService = {
            endpoint: 'http://localhost:3001/send-email',
            backupEndpoint: 'http://127.0.0.1:3001/send-email'
        };
        
        this.initialized = false;
        this.diagnostics = {
            emailJSStatus: 'unknown',
            localServiceStatus: 'unknown',
            lastTest: null,
            errors: []
        };
        
        this.init();
    }
    
    async init() {
        console.log('🔧 Initializing Enhanced Email Service...');
        
        // Test EmailJS
        await this.testEmailJS();
        
        // Test local email service
        await this.testLocalEmailService();
        
        this.initialized = true;
        console.log('✅ Enhanced Email Service initialized');
        this.printDiagnostics();
    }
    
    async testEmailJS() {
        try {
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library not loaded');
            }
            
            emailjs.init(this.emailJSConfig.publicKey);
            this.diagnostics.emailJSStatus = 'available';
            console.log('✅ EmailJS is available and initialized');
            
        } catch (error) {
            this.diagnostics.emailJSStatus = 'failed';
            this.diagnostics.errors.push(`EmailJS: ${error.message}`);
            console.log('❌ EmailJS failed:', error.message);
        }
    }
    
    async testLocalEmailService() {
        try {
            const response = await fetch(this.localEmailService.endpoint + '/health', {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                this.diagnostics.localServiceStatus = 'available';
                console.log('✅ Local email service is available');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            this.diagnostics.localServiceStatus = 'failed';
            this.diagnostics.errors.push(`Local Service: ${error.message}`);
            console.log('❌ Local email service failed:', error.message);
            
            // Try backup endpoint
            try {
                const backupResponse = await fetch(this.localEmailService.backupEndpoint + '/health', {
                    method: 'GET',
                    timeout: 5000
                });
                
                if (backupResponse.ok) {
                    this.diagnostics.localServiceStatus = 'available-backup';
                    console.log('✅ Local email service available on backup endpoint');
                }
            } catch (backupError) {
                console.log('❌ Backup endpoint also failed:', backupError.message);
            }
        }
    }
    
    async sendEmail(emailData) {
        console.log('📧 Sending email with enhanced service...');
        
        if (!this.initialized) {
            await this.init();
        }
        
        const methods = [];
        
        // Determine available methods
        if (this.diagnostics.emailJSStatus === 'available') {
            methods.push('emailjs');
        }
        
        if (this.diagnostics.localServiceStatus.includes('available')) {
            methods.push('local');
        }
        
        if (methods.length === 0) {
            throw new Error('No email services available. Please check EmailJS and local SMTP service.');
        }
        
        console.log('🎯 Available email methods:', methods);
        
        // Try each method
        for (const method of methods) {
            try {
                if (method === 'emailjs') {
                    return await this.sendViaEmailJS(emailData);
                } else if (method === 'local') {
                    return await this.sendViaLocalService(emailData);
                }
            } catch (error) {
                console.log(`❌ ${method} failed:`, error.message);
                if (method === methods[methods.length - 1]) {
                    // Last method failed, throw error
                    throw error;
                }
            }
        }
    }
    
    async sendViaEmailJS(emailData) {
        console.log('📤 Sending via EmailJS...');
        
        const emailParams = {
            to_email: emailData.to,
            to_name: emailData.toName || 'Recipient',
            from_name: 'Dreamex Datalab HSE System',
            subject: emailData.subject,
            message: emailData.text || emailData.html,
            
            // Additional parameters for staff notifications
            position_title: emailData.positionTitle || '',
            department: emailData.department || '',
            requesting_manager: emailData.requestingManager || '',
            position_id: emailData.positionId || '',
            approval_link: emailData.approvalLink || ''
        };
        
        const response = await emailjs.send(
            this.emailJSConfig.serviceId,
            this.emailJSConfig.templateId,
            emailParams,
            this.emailJSConfig.publicKey
        );
        
        console.log('✅ EmailJS send successful:', response);
        return {
            success: true,
            method: 'emailjs',
            messageId: response.text,
            timestamp: new Date().toISOString()
        };
    }
    
    async sendViaLocalService(emailData) {
        console.log('📤 Sending via local email service...');
        
        const endpoint = this.diagnostics.localServiceStatus === 'available-backup' 
            ? this.localEmailService.backupEndpoint 
            : this.localEmailService.endpoint;
        
        const response = await fetch(endpoint + '/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dreemex_hse_email_service_2025'
            },
            body: JSON.stringify({
                to: emailData.to,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Local service error: ${response.status} - ${errorData}`);
        }
        
        const result = await response.json();
        console.log('✅ Local service send successful:', result);
        
        return {
            success: true,
            method: 'local',
            messageId: result.messageId,
            timestamp: new Date().toISOString()
        };
    }
    
    printDiagnostics() {
        console.log('📊 Email Service Diagnostics:');
        console.log('  EmailJS Status:', this.diagnostics.emailJSStatus);
        console.log('  Local Service Status:', this.diagnostics.localServiceStatus);
        console.log('  Errors:', this.diagnostics.errors);
        
        // Show recommendations
        if (this.diagnostics.emailJSStatus === 'failed' && this.diagnostics.localServiceStatus === 'failed') {
            console.log('❌ Both email services failed!');
            console.log('📝 Recommendations:');
            console.log('  1. Check internet connection for EmailJS');
            console.log('  2. Start local email service: npm run start:prod');
            console.log('  3. Check SMTP configuration in .env file');
        } else if (this.diagnostics.emailJSStatus === 'failed') {
            console.log('⚠️  EmailJS not available, using local service');
        } else if (this.diagnostics.localServiceStatus === 'failed') {
            console.log('⚠️  Local service not available, using EmailJS');
        } else {
            console.log('✅ Both email services available');
        }
    }
    
    getStatus() {
        return {
            initialized: this.initialized,
            diagnostics: this.diagnostics,
            availableMethods: [
                ...(this.diagnostics.emailJSStatus === 'available' ? ['emailjs'] : []),
                ...(this.diagnostics.localServiceStatus.includes('available') ? ['local'] : [])
            ]
        };
    }
}

// Test function for immediate diagnostics
async function testEmailServices() {
    console.log('🧪 Running Email Service Tests...');
    
    const emailService = new EnhancedEmailService();
    await emailService.init();
    
    const status = emailService.getStatus();
    console.log('📋 Final Status:', status);
    
    // Try sending a test email if any service is available
    if (status.availableMethods.length > 0) {
        try {
            const testResult = await emailService.sendEmail({
                to: 'info@dreamexdatalab.com',
                subject: 'Email Service Test - ' + new Date().toISOString(),
                text: 'This is a test email to verify the enhanced email service is working.',
                html: '<p>This is a test email to verify the enhanced email service is working.</p>'
            });
            
            console.log('✅ Test email sent successfully:', testResult);
        } catch (error) {
            console.log('❌ Test email failed:', error.message);
        }
    }
    
    return emailService;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.enhancedEmailService = new EnhancedEmailService();
    
    // Add test function to window for manual testing
    window.testEmailServices = testEmailServices;
    
    console.log('💡 Enhanced Email Service loaded. Use testEmailServices() to run diagnostics.');
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedEmailService, testEmailServices };
}
