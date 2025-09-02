const fetch = require('node-fetch');

async function checkApprovalFlowData() {
    console.log('🔍 Checking approval flow data from Firebase...');
    
    try {
        // Fetch the approval flow data from the Firebase URL
        const response = await fetch('https://users-8be65-default-rtdb.firebaseio.com/approvalFlows/staff.json');
        const data = await response.json();
        
        console.log('📋 Full approval flow config:', JSON.stringify(data, null, 2));
        
        if (!data) {
            console.log('❌ No approval flow data found');
            return;
        }
        
        if (!data.enabled) {
            console.log('❌ Approval flow is disabled');
            return;
        }
        
        console.log('✅ Approval flow is enabled');
        
        if (data.selectedRoles) {
            console.log('📊 Selected roles configuration:');
            const levels = Object.keys(data.selectedRoles);
            console.log('📈 Levels found:', levels);
            
            for (const level of levels) {
                console.log(`\n🔍 Level: ${level}`);
                const roles = data.selectedRoles[level];
                console.log(`👥 Roles in ${level}:`, roles);
                
                if (Array.isArray(roles)) {
                    roles.forEach((role, index) => {
                        console.log(`  ${index + 1}. ${role.text} (${role.value})`);
                    });
                }
            }
        } else {
            console.log('❌ No selectedRoles found in configuration');
        }
        
        // Now let's check users data to see if we can match the roles
        console.log('\n🔍 Checking users data...');
        const usersResponse = await fetch('https://users-8be65-default-rtdb.firebaseio.com/users.json');
        const usersData = await usersResponse.json();
        
        if (usersData) {
            console.log('👥 Users found in database:');
            Object.keys(usersData).forEach(userId => {
                const user = usersData[userId];
                console.log(`  - ${user.firstName || ''} ${user.lastName || ''} (${user.email || 'no email'}) - ${user.jobTitle || user.role || 'no role'}`);
            });
        } else {
            console.log('❌ No users data found');
        }
        
    } catch (error) {
        console.error('❌ Error fetching approval flow data:', error);
    }
}

// Run the check
checkApprovalFlowData();
