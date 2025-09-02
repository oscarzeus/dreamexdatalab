const https = require('https');

async function fetchApprovalFlow() {
    return new Promise((resolve, reject) => {
        const url = 'https://users-8be65-default-rtdb.firebaseio.com/approvalFlows/staff/selectedRoles.json';
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const approvalFlow = JSON.parse(data);
                    resolve(approvalFlow);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function fetchUserData() {
    return new Promise((resolve, reject) => {
        const url = 'https://users-8be65-default-rtdb.firebaseio.com/users.json';
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const users = JSON.parse(data);
                    resolve(users);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    try {
        console.log('🔍 Fetching current approval flow configuration...');
        const approvalFlow = await fetchApprovalFlow();
        
        console.log('\n📋 Current Approval Flow Configuration:');
        console.log(JSON.stringify(approvalFlow, null, 2));
        
        if (!approvalFlow) {
            console.log('❌ No approval flow found!');
            return;
        }
        
        console.log('\n👥 Fetching user data to resolve approvers...');
        const users = await fetchUserData();
        
        console.log('\n🎯 EXPECTED RECEIVERS:');
        console.log('='.repeat(50));
        
        // Process each level in the approval flow
        for (const [level, config] of Object.entries(approvalFlow)) {
            console.log(`\n📍 Level: ${level}`);
            console.log(`   Type: ${config.type}`);
            console.log(`   Value: ${config.value}`);
            
            let expectedEmails = [];
            
            if (config.type === 'user' && config.value) {
                // Find the specific user
                const user = users[config.value];
                if (user && user.email) {
                    expectedEmails.push({
                        name: user.name || user.firstName + ' ' + user.lastName,
                        email: user.email,
                        source: `User ID: ${config.value}`
                    });
                } else {
                    console.log(`   ⚠️  User ${config.value} not found or has no email`);
                }
            } else if (config.type === 'function' && config.value) {
                // Find users with matching job title/function
                for (const [userId, user] of Object.entries(users)) {
                    if (user.jobTitle === config.value && user.email) {
                        expectedEmails.push({
                            name: user.name || user.firstName + ' ' + user.lastName,
                            email: user.email,
                            source: `Function: ${config.value}`
                        });
                    }
                }
            } else if (config.type === 'level') {
                // Level-based approver (L+1, L+2, etc.)
                expectedEmails.push({
                    name: 'Fallback Approver',
                    email: 'info@dreamexdatalab.com',
                    source: `Level: ${config.value}`
                });
            }
            
            if (expectedEmails.length > 0) {
                expectedEmails.forEach(approver => {
                    console.log(`   ✅ ${approver.name} (${approver.email}) - ${approver.source}`);
                });
            } else {
                console.log(`   ❌ No valid approvers found for this level`);
            }
        }
        
        console.log('\n🔧 DEBUGGING SUGGESTIONS:');
        console.log('='.repeat(50));
        console.log('1. Check if the email service is running');
        console.log('2. Open staff.html and run debugApprovalFlow() in console');
        console.log('3. Run testPositionCreationNotification() to test email delivery');
        console.log('4. Check browser console for error messages');
        console.log('5. Verify the approvers have valid email addresses');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();
