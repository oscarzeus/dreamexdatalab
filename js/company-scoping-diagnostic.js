// Firebase Company Scoping Diagnostic Tool
// Run this script in browser console on staff.html page to test company scoping

function runCompanyScopingDiagnostic() {
    console.log('🔍 ===== COMPANY SCOPING DIAGNOSTIC =====');
    console.log('Time:', new Date().toISOString());
    console.log('');
    
    // 1. Check Firebase availability
    console.log('📡 1. FIREBASE AVAILABILITY CHECK:');
    console.log('Firebase available:', typeof firebase !== 'undefined');
    console.log('Firebase database available:', typeof firebase !== 'undefined' && !!firebase.database);
    console.log('Firebase auth available:', typeof firebase !== 'undefined' && !!firebase.auth);
    console.log('');
    
    // 2. Check company data service
    console.log('🏢 2. COMPANY DATA SERVICE CHECK:');
    console.log('Service available:', typeof window.companyDataService !== 'undefined');
    
    if (window.companyDataService) {
        console.log('Service initialized:', window.companyDataService.isUserInitialized());
        console.log('Current company ID:', window.companyDataService.getCurrentCompanyId());
        console.log('Current company name:', window.companyDataService.getCurrentCompanyName());
        console.log('Current company object:', window.companyDataService.getCurrentCompany());
        
        // Test validation
        try {
            const isValid = window.companyDataService.validateCompanyContext();
            console.log('Context validation result:', isValid);
        } catch (error) {
            console.error('Context validation error:', error);
        }
        
        // Test path generation
        try {
            const staffRef = window.companyDataService.getCompanyRef('staff');
            console.log('Staff path reference created successfully');
        } catch (error) {
            console.error('Staff path generation error:', error);
        }
    }
    console.log('');
    
    // 3. Check local validation function
    console.log('🔍 3. LOCAL VALIDATION FUNCTION CHECK:');
    if (typeof validateCompanyContext === 'function') {
        try {
            const companyId = validateCompanyContext();
            console.log('validateCompanyContext() result:', companyId);
        } catch (error) {
            console.error('validateCompanyContext() error:', error);
        }
    } else {
        console.error('validateCompanyContext function not available');
    }
    console.log('');
    
    // 4. Check localStorage
    console.log('💾 4. LOCALSTORAGE CHECK:');
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            console.log('Stored user data:', userData);
            console.log('Stored company ID:', userData.companyId);
        } catch (error) {
            console.error('Error parsing stored user data:', error);
        }
    } else {
        console.log('No stored user data found');
    }
    console.log('');
    
    // 5. Check Firebase auth
    console.log('🔐 5. FIREBASE AUTH CHECK:');
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        const user = firebase.auth().currentUser;
        console.log('Firebase user:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        });
        
        // Extract company from email
        if (user.email) {
            const emailDomain = user.email.split('@')[1];
            const potentialCompanyId = emailDomain ? emailDomain.split('.')[0] : null;
            console.log('Potential company ID from email:', potentialCompanyId);
        }
    } else {
        console.log('No Firebase user authenticated');
    }
    console.log('');
    
    // 6. Test Firebase path construction
    console.log('📡 6. FIREBASE PATH CONSTRUCTION TEST:');
    try {
        let testCompanyId;
        
        // Try to get company ID using various methods
        if (window.companyDataService && window.companyDataService.getCurrentCompanyId()) {
            testCompanyId = window.companyDataService.getCurrentCompanyId();
            console.log('Using company ID from service:', testCompanyId);
        } else if (typeof validateCompanyContext === 'function') {
            testCompanyId = validateCompanyContext();
            console.log('Using company ID from validation function:', testCompanyId);
        } else {
            testCompanyId = 'test-company';
            console.log('Using fallback company ID:', testCompanyId);
        }
        
        // Test path construction
        const staffPath = `companies/${testCompanyId}/staff`;
        const approvedStaffPath = `companies/${testCompanyId}/approvedStaff`;
        
        console.log('Staff path:', staffPath);
        console.log('Approved staff path:', approvedStaffPath);
        
        // Test Firebase reference creation
        if (typeof firebase !== 'undefined' && firebase.database) {
            try {
                const staffRef = firebase.database().ref(staffPath);
                console.log('✅ Firebase reference created successfully');
                
                // Test writing a small piece of data
                const testData = {
                    test: true,
                    timestamp: new Date().toISOString(),
                    source: 'diagnostic'
                };
                
                console.log('🔬 Testing write operation...');
                staffRef.child('diagnostic-test').set(testData).then(() => {
                    console.log('✅ Test write successful');
                    
                    // Clean up test data
                    return staffRef.child('diagnostic-test').remove();
                }).then(() => {
                    console.log('✅ Test data cleaned up');
                }).catch(error => {
                    console.error('❌ Test write failed:', error);
                });
                
            } catch (error) {
                console.error('❌ Firebase reference creation failed:', error);
            }
        }
    } catch (error) {
        console.error('❌ Path construction test failed:', error);
    }
    console.log('');
    
    // 7. Summary
    console.log('📋 7. DIAGNOSTIC SUMMARY:');
    console.log('================================');
    
    const issues = [];
    const successes = [];
    
    // Check each component
    if (typeof firebase === 'undefined') {
        issues.push('Firebase not loaded');
    } else {
        successes.push('Firebase loaded');
    }
    
    if (typeof window.companyDataService === 'undefined') {
        issues.push('Company Data Service not available');
    } else {
        successes.push('Company Data Service available');
        
        if (!window.companyDataService.getCurrentCompanyId()) {
            issues.push('No company ID from service');
        } else {
            successes.push('Company ID retrieved from service');
        }
    }
    
    if (typeof validateCompanyContext !== 'function') {
        issues.push('validateCompanyContext function not available');
    } else {
        successes.push('validateCompanyContext function available');
    }
    
    console.log('✅ Successes:');
    successes.forEach(success => console.log(`  - ${success}`));
    
    console.log('❌ Issues:');
    if (issues.length === 0) {
        console.log('  - No issues detected!');
    } else {
        issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('');
    console.log('🔍 Run this diagnostic again after making changes');
    console.log('================================');
}

// Test function for creating a sample staff position
function testStaffPositionSave() {
    console.log('🧪 Testing staff position save...');
    
    const testStaffItem = {
        id: 'test-' + Date.now(),
        jobTitle: 'Test Position - Diagnostic',
        department: 'Testing',
        location: 'Test Location',
        description: 'This is a test position created by the diagnostic tool',
        requiredSkills: ['Testing', 'Diagnostics'],
        experience: 'Entry Level',
        jobType: 'Full-time',
        salary: 50000,
        currency: 'USD',
        status: 'Open',
        startDate: new Date().toISOString().split('T')[0],
        postingDate: new Date().toISOString(),
        name: 'Test Position',
        email: 'test@company.com',
        phoneNumber: '123-456-7890',
        address: 'Test Address'
    };
    
    console.log('Test staff item:', testStaffItem);
    
    // Try to save using the saveToFirebase function if available
    if (typeof saveToFirebase === 'function') {
        console.log('📤 Attempting to save test position...');
        saveToFirebase(testStaffItem).then(() => {
            console.log('✅ Test position save completed');
        }).catch(error => {
            console.error('❌ Test position save failed:', error);
        });
    } else {
        console.error('❌ saveToFirebase function not available');
    }
}

// Export functions for console use
window.runCompanyScopingDiagnostic = runCompanyScopingDiagnostic;
window.testStaffPositionSave = testStaffPositionSave;

console.log('🔧 Company scoping diagnostic tools loaded!');
console.log('Run runCompanyScopingDiagnostic() to check configuration');
console.log('Run testStaffPositionSave() to test saving a position');
