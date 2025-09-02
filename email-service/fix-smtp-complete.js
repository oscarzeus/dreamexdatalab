#!/usr/bin/env node

/**
 * Complete SMTP Fix Script for Dreamex Datalab Email Service
 * This script diagnoses and fixes common SMTP issues
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.blue);
}

async function fixSMTPIssues() {
    log('🔧 DREAMEX DATALAB EMAIL SERVICE - SMTP FIX TOOL', colors.bright);
    log('================================================\n', colors.bright);

    // Step 1: Check environment configuration
    logInfo('Step 1: Checking environment configuration...');
    
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        logError(`Missing environment variables: ${missingVars.join(', ')}`);
        logInfo('Please ensure your .env file contains all required SMTP settings');
        return false;
    }
    
    logSuccess('All required environment variables are set');

    // Step 2: Test multiple SMTP configurations
    logInfo('\nStep 2: Testing SMTP configurations...');
    
    const configurations = [
        {
            name: 'Current Configuration (STARTTLS)',
            config: {
                host: process.env.SMTP_HOST,
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
            }
        },
        {
            name: 'Alternative Configuration (SSL)',
            config: {
                host: process.env.SMTP_HOST,
                port: 465,
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            }
        },
        {
            name: 'Enhanced Configuration (STARTTLS + Connection Pool)',
            config: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                    ciphers: 'TLSv1.2'
                },
                pool: true,
                maxConnections: 1,
                maxMessages: 10,
                connectionTimeout: 60000,
                greetingTimeout: 30000,
                socketTimeout: 60000
            }
        }
    ];

    let workingConfig = null;

    for (const { name, config } of configurations) {
        log(`\n🔗 Testing: ${name}`, colors.cyan);
        
        try {
            const transporter = nodemailer.createTransport(config);
            await transporter.verify();
            logSuccess(`${name} - Connection verified successfully!`);
            
            // Test sending an email
            const testEmail = {
                from: `"${process.env.FROM_NAME || 'Dreamex Datalab HSE'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
                to: process.env.SMTP_USER,
                subject: `SMTP Test - ${name} - ${new Date().toISOString()}`,
                html: `
                    <h2>🔧 SMTP Configuration Test</h2>
                    <p><strong>Configuration:</strong> ${name}</p>
                    <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Status:</strong> ✅ SUCCESSFUL</p>
                    <hr>
                    <p>This email confirms that the SMTP configuration is working correctly.</p>
                `
            };
            
            const result = await transporter.sendMail(testEmail);
            logSuccess(`Test email sent successfully - Message ID: ${result.messageId}`);
            
            workingConfig = { name, config };
            break;
            
        } catch (error) {
            logError(`${name} - Failed: ${error.message}`);
            
            // Provide specific troubleshooting advice
            if (error.code === 'ENOTFOUND') {
                logWarning('  → DNS resolution failed. Check SMTP_HOST setting.');
            } else if (error.code === 'ECONNREFUSED') {
                logWarning('  → Connection refused. Check SMTP_PORT and firewall settings.');
            } else if (error.responseCode === 535) {
                logWarning('  → Authentication failed. Check SMTP_USER and SMTP_PASS credentials.');
            } else if (error.code === 'ETIMEDOUT') {
                logWarning('  → Connection timeout. Check network connectivity.');
            } else if (error.message.includes('wrong version number')) {
                logWarning('  → TLS/SSL version mismatch. Trying alternative configuration...');
            }
        }
    }

    // Step 3: Update configuration if needed
    if (workingConfig) {
        logSuccess(`\n🎉 Working configuration found: ${workingConfig.name}`);
        
        // Write the working configuration to a file for reference
        const configContent = `// Working SMTP Configuration - ${new Date().toISOString()}
const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransporter(${JSON.stringify(workingConfig.config, null, 4)});
};

module.exports = { createTransporter };
`;
        
        fs.writeFileSync(path.join(__dirname, 'working-smtp-config.js'), configContent);
        logSuccess('Working configuration saved to working-smtp-config.js');
        
        // Update .env file if needed
        if (workingConfig.name.includes('SSL') && process.env.SMTP_PORT !== '465') {
            logInfo('\nUpdating .env file for SSL configuration...');
            updateEnvFile();
        }
        
        return true;
    } else {
        logError('\n❌ No working SMTP configuration found!');
        logInfo('\n🔧 Troubleshooting suggestions:');
        log('1. Verify email account credentials are correct', colors.yellow);
        log('2. Check if the email account allows SMTP access', colors.yellow);
        log('3. Verify network connectivity to mail.privateemail.com', colors.yellow);
        log('4. Check if firewall is blocking SMTP ports (587, 465)', colors.yellow);
        log('5. Contact your email provider for SMTP settings', colors.yellow);
        
        return false;
    }
}

function updateEnvFile() {
    const envPath = path.join(__dirname, '.env');
    
    try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Update SMTP settings for SSL
        envContent = envContent.replace(/SMTP_PORT=587/, 'SMTP_PORT=465');
        envContent = envContent.replace(/SMTP_SECURE=false/, 'SMTP_SECURE=true');
        
        // Backup original .env
        fs.writeFileSync(envPath + '.backup', fs.readFileSync(envPath));
        fs.writeFileSync(envPath, envContent);
        
        logSuccess('Environment file updated for SSL configuration');
        logInfo('Original .env backed up to .env.backup');
        
    } catch (error) {
        logError(`Failed to update .env file: ${error.message}`);
    }
}

// Enhanced SMTP transporter creation function
function createEnhancedTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.privateemail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 10,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        // Enhanced retry configuration
        retry: {
            times: 3,
            delay: 2000
        }
    });
}

// Test function for the email service endpoints
async function testEmailServiceEndpoints() {
    logInfo('\nStep 3: Testing email service endpoints...');
    
    try {
        const axios = require('axios');
        const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
        
        // Test health endpoint
        log('🔍 Testing health endpoint...', colors.cyan);
        const healthResponse = await axios.get(`${baseUrl}/health`);
        if (healthResponse.status === 200) {
            logSuccess('Health endpoint is working');
        }
        
        // Test SMTP status endpoint
        log('🔍 Testing SMTP status endpoint...', colors.cyan);
        const smtpResponse = await axios.get(`${baseUrl}/smtp-status`);
        if (smtpResponse.status === 200) {
            logSuccess('SMTP status endpoint is working');
            logInfo(`SMTP Status: ${JSON.stringify(smtpResponse.data, null, 2)}`);
        }
        
    } catch (error) {
        logWarning('Email service endpoints not available (service may not be running)');
        logInfo('Start the service with: npm start');
    }
}

// Main execution
async function main() {
    try {
        const success = await fixSMTPIssues();
        
        if (success) {
            await testEmailServiceEndpoints();
            
            log('\n🎉 SMTP FIX COMPLETED SUCCESSFULLY!', colors.green + colors.bright);
            log('✅ Email service should now be working correctly', colors.green);
            log('\n📝 Next steps:', colors.blue);
            log('1. Restart the email service: npm start', colors.blue);
            log('2. Test with a real notification from the staff.html page', colors.blue);
            log('3. Monitor the service logs for any issues', colors.blue);
        } else {
            log('\n❌ SMTP FIX FAILED', colors.red + colors.bright);
            log('Please check the troubleshooting suggestions above', colors.red);
        }
        
    } catch (error) {
        logError(`Unexpected error during SMTP fix: ${error.message}`);
        console.error(error);
    }
}

// Export for use in other modules
module.exports = {
    fixSMTPIssues,
    createEnhancedTransporter,
    testEmailServiceEndpoints
};

// Run if called directly
if (require.main === module) {
    main();
}
