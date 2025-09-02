// Email service configuration
// Update these values with your actual email service credentials

export const emailConfig = {
    // EmailJS Configuration (Client-side email service)
    emailjs: {
        serviceId: 'your_emailjs_service_id',
        templateId: 'access_request_approval_template',
        publicKey: 'your_emailjs_public_key',
        endpoint: 'https://api.emailjs.com/api/v1.0/email/send'
    },
    
    // SendGrid Configuration (Server-side - requires backend)
    sendgrid: {
        apiKey: 'your_sendgrid_api_key',
        fromEmail: 'noreply@yourcompany.com',
        fromName: 'Dreamex Datalab HSE System'
    },
    
    // Azure Communication Services Configuration
    azure: {
        connectionString: 'your_azure_communication_services_connection_string',
        fromEmail: 'noreply@yourcompany.com'
    },
    
    // Email Templates
    templates: {
        approvalNotification: {
            subject: 'Access Request Approval Required - {{referenceNumber}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
                        <h1>Access Request Approval Required</h1>
                    </div>
                    <div style="padding: 20px; background: #f8f9fa;">
                        <p>Dear {{approver_name}},</p>
                        <p>A new access request requires your approval:</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3>Request Details</h3>
                            <p><strong>Reference Number:</strong> {{reference_number}}</p>
                            <p><strong>Requester:</strong> {{requester_name}}</p>
                            <p><strong>Purpose:</strong> {{purpose}}</p>
                            <p><strong>Department:</strong> {{department}}</p>
                            <p><strong>Access Period:</strong> {{start_date}} to {{end_date}}</p>
                            <p><strong>Priority:</strong> {{priority}}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{approval_link}}" 
                               style="background: #27ae60; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Review and Approve Request
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 12px;">
                            This is an automated notification from the Dreamex Datalab HSE System.
                        </p>
                    </div>
                </div>
            `
        },
        
        completionNotification: {
            subject: 'Access Request {{finalStatus}} - {{referenceNumber}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: {{finalStatus === 'approved' ? '#27ae60' : '#e74c3c'}}; color: white; padding: 20px; text-align: center;">
                        <h1>Access Request {{finalStatus}}</h1>
                    </div>
                    <div style="padding: 20px; background: #f8f9fa;">
                        <p>Dear {{requester_name}},</p>
                        <p>Your access request has been {{statusMessage}}:</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Reference Number:</strong> {{reference_number}}</p>
                            <p><strong>Status:</strong> {{finalStatus}}</p>
                            {{#if comments}}<p><strong>Comments:</strong> {{comments}}</p>{{/if}}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{request_link}}" 
                               style="background: #3498db; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                View Request Details
                            </a>
                        </div>
                    </div>
                </div>
            `
        }
    },    // PrivateEmail.com Configuration
    privateemail: {
        host: 'mail.privateemail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: 'info@dreamexdatalab.com',
            pass: 'Imoudre@m77n'
        },
        fromEmail: 'info@dreamexdatalab.com',
        fromName: 'Dreamex Datalab HSE System'
    },

    // Default settings
    defaults: {
        fromEmail: 'info@dreamexdatalab.com',
        fromName: 'Dreamex Datalab HSE System',
        replyToEmail: 'info@dreamexdatalab.com'
    }
};
