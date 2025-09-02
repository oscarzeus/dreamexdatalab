const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTPConnection() {
    console.log('🔧 Testing SMTP Connection...');
    console.log('📧 Using configuration:');
    console.log('  Host:', process.env.SMTP_HOST);
    console.log('  Port:', process.env.SMTP_PORT);
    console.log('  User:', process.env.SMTP_USER);
    console.log('  Secure:', process.env.SMTP_SECURE);

    // Enhanced configuration with multiple fallback options
    const configs = [
        {
            name: 'Primary Config (STARTTLS)',
            config: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT),
                secure: false, // Use STARTTLS
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2'
                },
                connectionTimeout: 10000,
                greetingTimeout: 5000,
                socketTimeout: 10000
            }
        },
        {
            name: 'Fallback Config (SSL)',
            config: {
                host: process.env.SMTP_HOST,
                port: 465,
                secure: true, // Use SSL
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2'
                },
                connectionTimeout: 10000,
                greetingTimeout: 5000,
                socketTimeout: 10000
            }
        },
        {
            name: 'Minimal Config (No TLS)',
            config: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 10000,
                greetingTimeout: 5000,
                socketTimeout: 10000
            }
        }
    ];

    for (const testConfig of configs) {
        try {
            console.log(`\n🧪 Testing ${testConfig.name}...`);
            
            const transporter = nodemailer.createTransport(testConfig.config);
            
            // Test connection
            await transporter.verify();
            console.log(`✅ ${testConfig.name} - Connection successful!`);
            
            // Test sending a small email
            console.log('📤 Testing email send...');
            const testEmail = {
                from: process.env.FROM_EMAIL,
                to: process.env.SMTP_USER, // Send to self for testing
                subject: 'SMTP Test - ' + new Date().toISOString(),
                text: 'This is a test email to verify SMTP functionality.',
                html: '<p>This is a test email to verify SMTP functionality.</p>'
            };
            
            const result = await transporter.sendMail(testEmail);
            console.log('✅ Test email sent successfully!');
            console.log('📨 Message ID:', result.messageId);
            
            // Close the connection
            transporter.close();
            
            console.log(`\n🎉 SMTP service is working with ${testConfig.name}!`);
            process.exit(0);
            
        } catch (error) {
            console.log(`❌ ${testConfig.name} failed:`, error.message);
            if (error.code) {
                console.log('   Error Code:', error.code);
            }
        }
    }
    
    console.log('\n💥 All SMTP configurations failed!');
    console.log('📝 Please check:');
    console.log('  1. SMTP credentials are correct');
    console.log('  2. Network connectivity');
    console.log('  3. Firewall settings');
    console.log('  4. Email provider settings');
    
    process.exit(1);
}

// Run the test
testSMTPConnection().catch(error => {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
});
