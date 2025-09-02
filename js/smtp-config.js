// SMTP Email Service for privateemail.com
// This configuration will work with any SMTP service including privateemail.com

export const smtpConfig = {
    // privateemail.com SMTP Configuration
    smtp: {
        host: 'mail.privateemail.com',
        port: 587, // Using 587 for STARTTLS
        secure: false, // false for STARTTLS
        auth: {
            user: 'info@dreamexdatalab.com', // Your privateemail.com email
            pass: process.env.SMTP_PASS // Password should be loaded from environment variables
        },
        tls: {
            rejectUnauthorized: true, // Enforce SSL certificate validation
            ciphers: 'HIGH:MEDIUM:!aNULL:!eNULL:!NULL:!DH:!EDH:!EXP:!LOW:!SSLv2:!MD5', // Strong cipher suite
            minVersion: 'TLSv1.2' // Minimum TLS version
        },
        pool: true, // Enable connection pooling
        maxConnections: 5,
        maxMessages: 100,
        // Connection timeout settings
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,   // 5 seconds
        socketTimeout: 10000     // 10 seconds
    },
    
    // Email settings
    emailSettings: {
        fromEmail: 'info@dreamexdatalab.com',
        fromName: 'Dreamex Datalab HSE System',
        replyTo: 'info@dreamexdatalab.com'
    },
    
    // Email templates for SMTP
    templates: {
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
                            <p style="color: #2c3e50; font-size: 16px; margin: 0 0 20px 0;">Dear {{approver_name}},</p>
                            <p style="color: #555; margin: 0 0 25px 0;">A {{#if is_update}}updated{{else}}new{{/if}} access request requires your approval:</p>
                            
                            <!-- Request Details Card -->
                            <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #3498db;">
                                <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">Request Details</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600; width: 30%;">Reference Number:</td>
                                        <td style="padding: 8px 0; color: #2c3e50;">{{reference_number}}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600;">Requester:</td>
                                        <td style="padding: 8px 0; color: #2c3e50;">{{requester_name}}</td>
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
                                        <td style="padding: 8px 0; color: #2c3e50;">{{start_date}} to {{end_date}}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600;">Priority:</td>
                                        <td style="padding: 8px 0; color: #2c3e50;">{{priority}}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Action Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{approval_link}}" 
                                   style="background: linear-gradient(135deg, #27ae60, #2ecc71); 
                                          color: white; 
                                          padding: 15px 30px; 
                                          text-decoration: none; 
                                          border-radius: 6px; 
                                          display: inline-block; 
                                          font-weight: 600;
                                          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                                          transition: all 0.3s ease;">
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
            `,
            text: `
Access Request Approval Required

Dear {{approver_name}},

A {{#if is_update}}updated{{else}}new{{/if}} access request requires your approval:

Request Details:
- Reference Number: {{reference_number}}
- Requester: {{requester_name}}
- Purpose: {{purpose}}
- Department: {{department}}
- Company: {{company}}
- Access Period: {{start_date}} to {{end_date}}
- Priority: {{priority}}

To review and approve this request, please visit:
{{approval_link}}

This is an automated notification from the Dreamex Datalab HSE System.
For support, contact info@dreamexdatalab.com
            `
        },
        
        completionNotification: {
            subject: 'Access Request {{finalStatus}} - {{reference_number}}',
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
                        <div style="background: {{finalStatus === 'approved' ? 'linear-gradient(135deg, #27ae60, #2ecc71)' : 'linear-gradient(135deg, #e74c3c, #c0392b)'}}; color: white; padding: 30px 20px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Access Request {{finalStatus}}</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Dreamex Datalab HSE System</p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 30px 20px; background: #f8f9fa;">
                            <p style="color: #2c3e50; font-size: 16px; margin: 0 0 20px 0;">Dear {{requester_name}},</p>
                            <p style="color: #555; margin: 0 0 25px 0;">Your access request has been <strong>{{finalStatus}}</strong>:</p>
                            
                            <!-- Status Details -->
                            <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid {{finalStatus === 'approved' ? '#27ae60' : '#e74c3c'}};">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600; width: 30%;">Reference Number:</td>
                                        <td style="padding: 8px 0; color: #2c3e50;">{{reference_number}}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600;">Status:</td>
                                        <td style="padding: 8px 0; color: {{finalStatus === 'approved' ? '#27ae60' : '#e74c3c'}}; font-weight: 600; text-transform: uppercase;">{{finalStatus}}</td>
                                    </tr>
                                    {{#if comments}}
                                    <tr>
                                        <td style="padding: 8px 0; color: #666; font-weight: 600;">Comments:</td>
                                        <td style="padding: 8px 0; color: #2c3e50;">{{comments}}</td>
                                    </tr>
                                    {{/if}}
                                </table>
                            </div>
                            
                            <!-- Action Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{request_link}}" 
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
                            
                            <!-- Footer -->
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
            `,
            text: `
Access Request {{finalStatus}}

Dear {{requester_name}},

Your access request has been {{finalStatus}}:

Reference Number: {{reference_number}}
Status: {{finalStatus}}
{{#if comments}}Comments: {{comments}}{{/if}}

To view the full request details, visit:
{{request_link}}

This is an automated notification from the Dreamex Datalab HSE System.
For support, contact info@dreamexdatalab.com
            `
        }
    }
};
