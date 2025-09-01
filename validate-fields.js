// Field validation script for company management page
// This script checks if all required HTML elements exist for the JavaScript functionality

console.log('=== Company Management Page Field Validation ===');

// List of all IDs that the JavaScript tries to access
const requiredFields = [
    // Loading and display elements
    'loadingOverlay',
    'companyNameDisplay',
    
    // Company Profile Form
    'companyProfileForm',
    'companyName',
    'companyRegistration', 
    'industry',
    'companySize',
    'website',
    'country',
    'address',
    
    // Contact & Billing Form
    'contactBillingForm',
    'contactName',
    'contactEmail',
    'contactPhone',
    'contactTitle',
    'billingAddress',
    'billingEmail',
    'billingPhone',
    'primaryDomain',
    'additionalDomain',
    'domainList',
    
    // User Management
    'addUserForm',
    'usersTableBody',
    'currentUsers',
    'maxUsers',
    'availableSlots',
    'quotaProgressBar',
    
    // Subscription Management
    'quotaManagementForm',
    'userQuotaInput',
    'subscriptionPlan',
    'userQuota',
    'newMonthlyFee',
    'priceBreakdownText',
    'monthlyFee',
    'nextBilling',
    
    // Billing History
    'billingHistoryBody',
    
    // Features
    'featuresTotalCost',
    'featuresBreakdown',
    
    // Modals
    'addUserModal'
];

console.log('Checking for required fields...');
let missingFields = [];
let existingFields = [];

requiredFields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
        existingFields.push(fieldId);
        console.log(`✓ Found: ${fieldId}`);
    } else {
        missingFields.push(fieldId);
        console.error(`✗ Missing: ${fieldId}`);
    }
});

console.log('\n=== SUMMARY ===');
console.log(`Total fields checked: ${requiredFields.length}`);
console.log(`Existing fields: ${existingFields.length}`);
console.log(`Missing fields: ${missingFields.length}`);

if (missingFields.length > 0) {
    console.error('\nMissing fields that need to be added:');
    missingFields.forEach(field => console.error(`- ${field}`));
} else {
    console.log('\n🎉 All required fields are present!');
}

// Check for feature cards with data-feature attributes
console.log('\n=== Feature Cards Validation ===');
const featureCards = document.querySelectorAll('.feature-card[data-feature]');
console.log(`Found ${featureCards.length} feature cards with data-feature attributes:`);
featureCards.forEach(card => {
    console.log(`- Feature: ${card.dataset.feature}`);
});

// Check for tab structure
console.log('\n=== Tab Structure Validation ===');
const tabs = ['profileTab', 'usersTab', 'subscriptionTab', 'featuresTab'];
tabs.forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) {
        console.log(`✓ Tab found: ${tabId}`);
    } else {
        console.error(`✗ Tab missing: ${tabId}`);
    }
});
