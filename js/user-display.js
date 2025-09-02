// User Display Helper Functions
// This file provides common user display functions that can be used across all pages
// It works with the centralized authentication system in auth.js

// Get current user data with fallback support
function getCurrentUserData() {
    // Try centralized auth manager first
    if (window.authManager && window.authManager.getCurrentUser()) {
        return window.authManager.getCurrentUser();
    }
    
    // Fallback to localStorage/sessionStorage
    let userData = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    
    // Last resort - try sessionStorage
    userData = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing session user data:', e);
        }
    }
    
    return null;
}

// Get user display name
function getUserDisplayName() {
    if (window.authManager && window.authManager.getUserDisplayName) {
        return window.authManager.getUserDisplayName();
    }
    
    const userData = getCurrentUserData();
    if (!userData) return 'User';
    
    // Helper function to clean and validate name
    const cleanName = (name) => {
        if (!name || typeof name !== 'string') return null;
        
        // Remove unwanted patterns (system-generated usernames, IDs, etc.)
        const unwantedPatterns = [
            /^standard_[a-z0-9]+$/i,        // standard_mcz5jhe4
            /^[a-z0-9]{8,}$/i,              // random strings of 8+ chars
            /^user_[a-z0-9]+$/i,            // user_something
            /^[0-9]+$/,                     // pure numbers
            /dreamex/i,                     // company name fragments
            /^[a-z]{2,3}_[a-z0-9]+$/i      // prefix_random patterns
        ];
        
        const cleanedName = name.trim();
        
        // Check if name matches any unwanted pattern
        if (unwantedPatterns.some(pattern => pattern.test(cleanedName))) {
            return null;
        }
        
        // Must be at least 2 characters and contain at least one letter
        if (cleanedName.length < 2 || !/[a-zA-Z]/.test(cleanedName)) {
            return null;
        }
        
        return cleanedName;
    };
    
    // Try each potential name source in order of preference
    const potentialNames = [
        userData.name,
        userData.displayName,
        userData.firstName && userData.lastName ? 
            userData.firstName + ' ' + userData.lastName : null,
        userData.firstName,
        userData.lastName
    ];
    
    for (const name of potentialNames) {
        const cleaned = cleanName(name);
        if (cleaned) return cleaned;
    }
    
    // Final fallback to email username (but clean it too)
    if (userData.email) {
        const emailUsername = userData.email.split('@')[0];
        const cleaned = cleanName(emailUsername);
        if (cleaned) return cleaned;
    }
    
    return 'User';
}

// Get user initials for avatar
function getUserInitials() {
    if (window.authManager && window.authManager.getUserInitials) {
        return window.authManager.getUserInitials();
    }
    
    const displayName = getUserDisplayName();
    
    if (!displayName || displayName === 'User') return 'U';
    
    const words = displayName.split(' ').filter(word => word.length > 0);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    } else {
        return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
    }
}

// Get user email
function getUserEmail() {
    if (window.authManager && window.authManager.getUserEmail) {
        return window.authManager.getUserEmail();
    }
    
    const userData = getCurrentUserData();
    return userData?.email || '';
}

// Get user role
function getUserRole() {
    if (window.authManager && window.authManager.getUserRole) {
        return window.authManager.getUserRole();
    }
    
    const userData = getCurrentUserData();
    return userData?.role || 'User';
}

// Get user department
function getUserDepartment() {
    if (window.authManager && window.authManager.getUserDepartment) {
        return window.authManager.getUserDepartment();
    }
    
    const userData = getCurrentUserData();
    return userData?.department || '';
}

// Get user company information
function getUserCompany() {
    if (window.authManager && window.authManager.getUserCompany) {
        return window.authManager.getUserCompany();
    }
    
    const userData = getCurrentUserData();
    return {
        id: userData?.companyId,
        name: userData?.companyName
    };
}

// Update user avatar initials on any page
function updateUserAvatarInitials(elementId = 'userAvatarInitials') {
    const avatarElement = document.getElementById(elementId);
    if (avatarElement) {
        avatarElement.textContent = getUserInitials();
    }
}

// Comprehensive function to update all user display elements on a page
function updateAllUserDisplayElements() {
    // Update avatar initials with common element IDs
    updateUserAvatarInitials('userAvatarInitials');
    updateUserAvatarInitials('userInitials');
    
    // Update user name displays
    const userNameElements = document.querySelectorAll('#userName, #userDisplayName, .user-name-display');
    userNameElements.forEach(element => {
        element.textContent = getUserDisplayName();
    });
    
    // Update user email displays
    const userEmailElements = document.querySelectorAll('#userEmail, #userDisplayEmail, .user-email-display');
    userEmailElements.forEach(element => {
        element.textContent = getUserEmail();
    });
    
    // Update user role displays
    const userRoleElements = document.querySelectorAll('#userRole, .user-role-display');
    userRoleElements.forEach(element => {
        element.textContent = getUserRole();
    });
}

// Enhanced loadUserInitials function that can replace existing ones
function loadUserInitials() {
    // Try multiple common avatar element IDs
    const avatarIds = ['userAvatarInitials', 'userInitials'];
    const initials = getUserInitials();
    
    avatarIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = initials;
        }
    });
}

// Enhanced updateUserProfile function that can replace existing ones
function updateUserProfile(firebaseUser = null) {
    // If called with Firebase user data, we can extract info but prefer our stored data
    updateAllUserDisplayElements();
}

// Initialize user display when page loads
function initializeUserDisplay() {
    // Update all user display elements
    updateAllUserDisplayElements();
    
    // Set up periodic updates to catch user data changes
    setInterval(updateAllUserDisplayElements, 5000); // Update every 5 seconds
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUserDisplay);
} else {
    initializeUserDisplay();
}

// Force immediate refresh to clean up any cached bad data
function forceUserDisplayRefresh() {
    // Clear any cached display data that might be wrong
    const currentUser = getCurrentUserData();
    if (currentUser) {
        // Check if the current display name contains unwanted patterns
        const currentDisplayName = getUserDisplayName();
        
        // If we detect bad data, try to clean the localStorage
        if (/standard_[a-z0-9]+|dreamex/i.test(currentDisplayName)) {
            console.log('Detected corrupted user display data, attempting cleanup...');
            
            // Try to clean up the stored user data
            const cleanUser = {...currentUser};
            
            // Remove problematic name fields
            if (cleanUser.name && /standard_[a-z0-9]+|dreamex/i.test(cleanUser.name)) {
                delete cleanUser.name;
            }
            if (cleanUser.displayName && /standard_[a-z0-9]+|dreamex/i.test(cleanUser.displayName)) {
                delete cleanUser.displayName;
            }
            if (cleanUser.firstName && /standard_[a-z0-9]+|dreamex/i.test(cleanUser.firstName)) {
                delete cleanUser.firstName;
            }
            
            // Update localStorage with cleaned data
            localStorage.setItem('currentUser', JSON.stringify(cleanUser));
            localStorage.setItem('user', JSON.stringify(cleanUser));
        }
    }
    
    // Force update all display elements
    updateAllUserDisplayElements();
}

// Run the forced refresh
forceUserDisplayRefresh();

// Make functions globally available
window.getUserDisplayName = getUserDisplayName;
window.getUserInitials = getUserInitials;
window.getUserEmail = getUserEmail;
window.getUserRole = getUserRole;
window.getUserDepartment = getUserDepartment;
window.getUserCompany = getUserCompany;
window.updateUserAvatarInitials = updateUserAvatarInitials;
window.updateAllUserDisplayElements = updateAllUserDisplayElements;
window.loadUserInitials = loadUserInitials;
window.updateUserProfile = updateUserProfile;
