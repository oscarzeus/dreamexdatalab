const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTPConnection() {
    console.log('🔍 SMTP Diagnostic Tool');
    console.log('========================');
    
    // Display current configuration
    console.log('\n📋 Current Configuration:');
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`Secure: ${process.env.SMTP_SECURE}`);
    console.log(`User: ${process.env.SMTP_USER}`);
    console.log(`Password: ${process.env.SMTP_PASS ? '[SET]' : '[NOT SET]'}`);
    
    // Test 1: Create transporter
    console.log('\n🔧 Test 1: Creating SMTP transporter...');
    let transporter;
    try {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'mail.privateemail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        console.log('✅ Transporter created successfully');
    } catch (error) {
        console.log('❌ Failed to create transporter:', error.message);
        return;
    }
    
    // Test 2: Verify connection
    console.log('\n🔗 Test 2: Verifying SMTP connection...');
    try {
        const verified = await transporter.verify();
        console.log('✅ SMTP connection verified successfully');
        console.log('📧 Ready to send emails');
    } catch (error) {
        console.log('❌ SMTP verification failed:', error.message);
        console.log('\n🔧 Troubleshooting suggestions:');
        
        if (error.code === 'ENOTFOUND') {
            console.log('• Check SMTP_HOST setting');
            console.log('• Verify internet connection');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('• Check SMTP_PORT setting');
            console.log('• Verify firewall settings');
        } else if (error.responseCode === 535) {
            console.log('• Check SMTP_USER and SMTP_PASS credentials');
            console.log('• Verify email account is active');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('• Check network connectivity');
            console.log('• Try different SMTP port (465 for SSL)');
        }
        
        console.log('\n🔧 Alternative configurations to try:');
        console.log('For SSL (port 465):');
        console.log('  SMTP_PORT=465');
        console.log('  SMTP_SECURE=true');
        
        console.log('\nFor STARTTLS (port 587):');
        console.log('  SMTP_PORT=587');
        console.log('  SMTP_SECURE=false');
        
        return;
    }
    
    // Test 3: Send test email
    console.log('\n📨 Test 3: Sending test email...');
    try {
        const testEmail = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: process.env.SMTP_USER, // Send to self for testing
            subject: 'SMTP Test - ' + new Date().toISOString(),
            html: `
                <h2>SMTP Test Email</h2>
                <p>This is a test email sent at ${new Date().toLocaleString()}</p>
                <p><strong>Configuration tested:</strong></p>
                <ul>
                    <li>Host: ${process.env.SMTP_HOST}</li>
                    <li>Port: ${process.env.SMTP_PORT}</li>
                    <li>Secure: ${process.env.SMTP_SECURE}</li>
                    <li>User: ${process.env.SMTP_USER}</li>
                </ul>
            `
        };
        
        const result = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully');
        console.log(`📧 Message ID: ${result.messageId}`);
        console.log(`📧 Response: ${result.response}`);
        
    } catch (error) {
        console.log('❌ Failed to send test email:', error.message);
        if (error.responseCode) {
            console.log(`📧 SMTP Response Code: ${error.responseCode}`);
        }
    }
    
    console.log('\n🎯 Diagnostic complete');
}

// Run the diagnostic
testSMTPConnection().catch(console.error);
