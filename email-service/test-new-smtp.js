// Test New SMTP Configuration - Updated Password Test
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🧪 Testing updated SMTP configuration...');
console.log('📋 Configuration:');
console.log('   Host:', process.env.SMTP_HOST);
console.log('   Port:', process.env.SMTP_PORT);
console.log('   Secure:', process.env.SMTP_SECURE);
console.log('   User:', process.env.SMTP_USER);
console.log('   Pass:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-3) : 'Not set');

async function testNewConfiguration() {
    // Test 1: Port 465 with SSL (new configuration)
    console.log('\n🔐 Test 1: SSL (Port 465) - New Password');
    try {
        const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            }
        });

        await transporter.verify();
        console.log('✅ SSL (465) verification successful!');
        
        // Try sending a test email
        console.log('📧 Sending test email...');
        const result = await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: 'info@dreamexdatalab.com',
            subject: 'SMTP Test - New Configuration ' + new Date().toISOString(),
            text: 'This is a test email with the updated SMTP configuration (port 465, SSL, new password).',
            html: '<p>This is a test email with the updated SMTP configuration (port 465, SSL, new password).</p>'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('📬 Message ID:', result.messageId);
        return true;
        
    } catch (error) {
        console.log('❌ SSL (465) failed:', error.message);
        if (error.responseCode) {
            console.log('📮 Response Code:', error.responseCode);
        }
    }

    // Test 2: Port 587 with STARTTLS (fallback)
    console.log('\n📨 Test 2: STARTTLS (Port 587) - New Password');
    try {
        const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: 587,
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

        await transporter.verify();
        console.log('✅ STARTTLS (587) verification successful!');
        
        // Try sending a test email
        console.log('📧 Sending test email...');
        const result = await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: 'info@dreamexdatalab.com',
            subject: 'SMTP Test - STARTTLS Configuration ' + new Date().toISOString(),
            text: 'This is a test email with STARTTLS configuration (port 587, new password).',
            html: '<p>This is a test email with STARTTLS configuration (port 587, new password).</p>'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('📬 Message ID:', result.messageId);
        return true;
        
    } catch (error) {
        console.log('❌ STARTTLS (587) failed:', error.message);
        if (error.responseCode) {
            console.log('📮 Response Code:', error.responseCode);
        }
    }

    console.log('\n🚨 Both configurations failed!');
    console.log('💡 Possible issues:');
    console.log('   1. Password "Im@m1409pP" might be incorrect');
    console.log('   2. Account may have 2FA enabled (need app password)');
    console.log('   3. SMTP may be disabled for this account');
    console.log('   4. Server configuration may have changed');
    console.log('   5. Firewall/network issues');
    
    return false;
}

testNewConfiguration().then(success => {
    if (success) {
        console.log('\n🎉 SMTP configuration is working!');
        console.log('📧 Email service should now work properly.');
    } else {
        console.log('\n⚠️  SMTP configuration needs attention.');
        console.log('📧 EmailJS will be used as primary method.');
    }
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});
