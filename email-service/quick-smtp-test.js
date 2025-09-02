const nodemailer = require('nodemailer');
require('dotenv').config();

async function quickSMTPTest() {
    console.log('🔧 Quick SMTP Connection Test');
    console.log('==============================');
    
    // Test basic STARTTLS configuration
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        }
    });

    try {
        console.log('📧 Testing SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        
        // Send a quick test email
        const testEmail = {
            from: process.env.SMTP_USER,
            to: process.env.SMTP_USER,
            subject: 'SMTP Test - ' + new Date().toISOString(),
            text: 'This is a test email to verify SMTP is working.'
        };
        
        const result = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully!');
        console.log('📧 Message ID:', result.messageId);
        
        return true;
    } catch (error) {
        console.log('❌ SMTP test failed:', error.message);
        
        // Try SSL fallback
        console.log('\n🔄 Trying SSL configuration...');
        
        const sslTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'mail.privateemail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        try {
            await sslTransporter.verify();
            console.log('✅ SSL SMTP connection successful!');
            
            const sslTestEmail = {
                from: process.env.SMTP_USER,
                to: process.env.SMTP_USER,
                subject: 'SSL SMTP Test - ' + new Date().toISOString(),
                text: 'This is a test email using SSL configuration.'
            };
            
            const sslResult = await sslTransporter.sendMail(sslTestEmail);
            console.log('✅ SSL test email sent successfully!');
            console.log('📧 Message ID:', sslResult.messageId);
            
            console.log('\n💡 Recommendation: Update your .env file to use SSL configuration:');
            console.log('   SMTP_PORT=465');
            console.log('   SMTP_SECURE=true');
            
            return true;
        } catch (sslError) {
            console.log('❌ SSL SMTP also failed:', sslError.message);
            return false;
        }
    }
}

quickSMTPTest().then(success => {
    if (success) {
        console.log('\n🎉 SMTP is working! You can now start the email service.');
    } else {
        console.log('\n❌ SMTP connection failed. Please check your configuration.');
    }
}).catch(console.error);
