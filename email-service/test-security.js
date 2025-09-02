/**
 * Security Test Suite for Dreamex Secure Email Service
 * Tests various security features and abuse prevention mechanisms
 */

const axios = require('axios').default;
require('dotenv').config();

const EMAIL_SERVICE_URL = 'http://localhost:3001';
const API_KEY = process.env.API_KEY;

// Test configuration
const VALID_EMAIL = 'info@dreamexdatalab.com';
const INVALID_EMAIL = 'invalid-email';
const TEMPORARY_EMAIL = 'test@10minutemail.com';
const SPAM_CONTENT = 'FREE MONEY!!! CLICK HERE NOW!!! URGENT ACTION REQUIRED!!!';

class SecurityTester {
    constructor() {
        this.results = [];
        this.testCount = 0;
        this.passCount = 0;
    }

    async runTest(testName, testFunction) {
        this.testCount++;
        console.log(`\n🧪 Test ${this.testCount}: ${testName}`);
        
        try {
            const result = await testFunction();
            if (result.passed) {
                this.passCount++;
                console.log(`✅ PASSED: ${result.message}`);
            } else {
                console.log(`❌ FAILED: ${result.message}`);
            }
            this.results.push({ testName, ...result });
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
            this.results.push({ testName, passed: false, message: error.message });
        }
    }

    async sendTestEmail(emailData, headers = {}) {
        const config = {
            method: 'post',
            url: `${EMAIL_SERVICE_URL}/send/secure`,
            data: emailData,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                ...headers
            }
        };

        try {
            const response = await axios(config);
            return { success: true, data: response.data, status: response.status };
        } catch (error) {
            return { 
                success: false, 
                data: error.response?.data, 
                status: error.response?.status,
                message: error.message
            };
        }
    }

    // Test 1: Valid email should pass
    async testValidEmail() {
        const emailData = {
            to: 'test@example.com',
            subject: 'Test Email',
            text: 'This is a test email.'
        };

        const result = await this.sendTestEmail(emailData);
        
        return {
            passed: result.success,
            message: result.success ? 
                `Valid email sent successfully (Score: ${result.data?.securityScore})` :
                `Valid email rejected: ${result.data?.error || result.message}`
        };
    }

    // Test 2: Invalid API key should be rejected
    async testInvalidAPIKey() {
        const emailData = {
            to: 'test@example.com',
            subject: 'Test Email',
            text: 'This is a test email.'
        };

        const result = await this.sendTestEmail(emailData, { 'x-api-key': 'invalid-key' });
        
        return {
            passed: !result.success && result.status === 401,
            message: !result.success && result.status === 401 ? 
                'Invalid API key correctly rejected' :
                'Invalid API key was not properly rejected'
        };
    }

    // Test 3: Missing required fields should be rejected
    async testMissingFields() {
        const emailData = {
            subject: 'Test Email'
            // Missing 'to' and content
        };

        const result = await this.sendTestEmail(emailData);
        
        return {
            passed: !result.success && result.status === 400,
            message: !result.success && result.status === 400 ? 
                'Missing fields correctly rejected' :
                'Missing fields were not properly rejected'
        };
    }

    // Test 4: Spam content should be detected
    async testSpamDetection() {
        const emailData = {
            to: 'test@example.com',
            subject: SPAM_CONTENT,
            text: SPAM_CONTENT + ' Act now to claim your prize!'
        };

        const result = await this.sendTestEmail(emailData);
        
        return {
            passed: !result.success && result.data?.details?.some(error => 
                error.includes('Suspicious pattern') || error.includes('spam')
            ),
            message: !result.success ? 
                'Spam content correctly detected and rejected' :
                'Spam content was not detected'
        };
    }

    // Test 5: Temporary email domains should be blocked
    async testTemporaryEmailBlocking() {
        const emailData = {
            to: TEMPORARY_EMAIL,
            subject: 'Test Email',
            text: 'This is a test email.'
        };

        const result = await this.sendTestEmail(emailData);
        
        return {
            passed: !result.success && result.data?.details?.some(error => 
                error.includes('Blocked domain')
            ),
            message: !result.success ? 
                'Temporary email domain correctly blocked' :
                'Temporary email domain was not blocked'
        };
    }

    // Test 6: Invalid email format should be rejected
    async testInvalidEmailFormat() {
        const emailData = {
            to: INVALID_EMAIL,
            subject: 'Test Email',
            text: 'This is a test email.'
        };

        const result = await this.sendTestEmail(emailData);
        
        return {
            passed: !result.success && result.data?.details?.some(error => 
                error.includes('Invalid recipient email')
            ),
            message: !result.success ? 
                'Invalid email format correctly rejected' :
                'Invalid email format was not rejected'
        };
    }

    // Test 7: Rate limiting should work
    async testRateLimiting() {
        console.log('   Sending multiple emails rapidly...');
        
        const emailData = {
            to: 'test@example.com',
            subject: 'Rate Limit Test',
            text: 'Testing rate limiting.'
        };

        let rateLimited = false;
        
        // Send 10 emails rapidly
        for (let i = 0; i < 10; i++) {
            const result = await this.sendTestEmail(emailData);
            if (!result.success && result.status === 429) {
                rateLimited = true;
                break;
            }
            // Small delay to avoid overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return {
            passed: rateLimited,
            message: rateLimited ? 
                'Rate limiting is working correctly' :
                'Rate limiting may not be configured properly'
        };
    }

    // Test 8: Service health check
    async testHealthCheck() {
        try {
            const response = await axios.get(`${EMAIL_SERVICE_URL}/health`);
            return {
                passed: response.status === 200 && response.data.status === 'healthy',
                message: response.status === 200 ? 
                    'Health check endpoint working' :
                    'Health check endpoint failed'
            };
        } catch (error) {
            return {
                passed: false,
                message: `Health check failed: ${error.message}`
            };
        }
    }

    // Test 9: Security status endpoint
    async testSecurityStatus() {
        try {
            const response = await axios.get(`${EMAIL_SERVICE_URL}/security/status`, {
                headers: { 'x-api-key': API_KEY }
            });
            
            const securityFeatures = response.data.securityFeatures;
            const requiredFeatures = [
                'contentFiltering', 'rateLimiting', 'duplicateDetection',
                'ipReputation', 'trustedSenders', 'apiKeyAuth'
            ];
            
            const allFeaturesEnabled = requiredFeatures.every(feature => 
                securityFeatures[feature] === true
            );
            
            return {
                passed: response.status === 200 && allFeaturesEnabled,
                message: allFeaturesEnabled ? 
                    'All security features are enabled' :
                    'Some security features are disabled'
            };
        } catch (error) {
            return {
                passed: false,
                message: `Security status check failed: ${error.message}`
            };
        }
    }

    async runAllTests() {
        console.log('🔒 Dreamex Email Security Test Suite');
        console.log('=====================================');
        
        // Check if service is running
        try {
            await axios.get(`${EMAIL_SERVICE_URL}/health`);
        } catch (error) {
            console.log('❌ Email service is not running! Please start the service first.');
            return;
        }

        if (!API_KEY) {
            console.log('❌ API_KEY not configured! Please set API_KEY in .env file.');
            return;
        }

        await this.runTest('Valid Email Sending', () => this.testValidEmail());
        await this.runTest('Invalid API Key Rejection', () => this.testInvalidAPIKey());
        await this.runTest('Missing Fields Validation', () => this.testMissingFields());
        await this.runTest('Spam Content Detection', () => this.testSpamDetection());
        await this.runTest('Temporary Email Blocking', () => this.testTemporaryEmailBlocking());
        await this.runTest('Invalid Email Format Rejection', () => this.testInvalidEmailFormat());
        await this.runTest('Rate Limiting', () => this.testRateLimiting());
        await this.runTest('Health Check Endpoint', () => this.testHealthCheck());
        await this.runTest('Security Status Endpoint', () => this.testSecurityStatus());

        // Summary
        console.log('\n📊 Test Results Summary');
        console.log('=======================');
        console.log(`Total Tests: ${this.testCount}`);
        console.log(`Passed: ${this.passCount}`);
        console.log(`Failed: ${this.testCount - this.passCount}`);
        console.log(`Success Rate: ${Math.round((this.passCount / this.testCount) * 100)}%`);

        if (this.passCount === this.testCount) {
            console.log('\n🎉 All tests passed! Your email security system is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the configuration and logs.');
        }

        console.log('\n📋 Detailed Results:');
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.testName}: ${result.message}`);
        });
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new SecurityTester();
    tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;
