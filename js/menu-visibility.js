import { auth } from './firebase-config.js';
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Reset all menu items to hidden
function resetMenuVisibility() {
    document.querySelectorAll('[data-feature]').forEach(item => {
        item.classList.remove('menu-visible');
    });
    document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
        dropdown.classList.remove('menu-visible');
    });
}

// Emergency fallback - no menu items shown
function showBasicMenu() {
    console.log('🔧 Emergency fallback: No menu items will be shown');
    resetMenuVisibility();
    // No basic items will be shown - user must have proper permissions
}

// Company-aware menu visibility system
async function updateMenuVisibilityForRoles() {
    console.log('🔧 Starting menu visibility update for roles page...');
    try {
        if (!auth.currentUser) {
            console.log('❌ No authenticated user found');
            resetMenuVisibility();
            return;
        }
        
        const db = getDatabase();
        
        // First try to get user's company ID from their profile
        const userRef = ref(db, `users/${auth.currentUser.uid}`);
        const userSnapshot = await get(userRef);
        
        let companyId = null;
        let userRole = null;
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            companyId = userData.companyId;
            console.log(`👤 User profile: companyId=${companyId}`);
        }
        
        if (!companyId) {
            console.log('❌ No company ID found in user profile');
            resetMenuVisibility();
            return;
        }
        
        // Get user's role within the company
        const companyUserRef = ref(db, `companies/${companyId}/users/${auth.currentUser.uid}`);
        const companyUserSnapshot = await get(companyUserRef);
        
        if (!companyUserSnapshot.exists()) {
            console.log('❌ User not found in company user list');
            resetMenuVisibility();
            return;
        }
        
        const companyUserData = companyUserSnapshot.val();
        userRole = companyUserData.role;
        
        console.log(`👤 Company user data: role=${userRole}, companyId=${companyId}`);
        
        if (!userRole) {
            console.log('⚠️ Missing user role in company');
            resetMenuVisibility();
            return;
        }
        
        // Get company role permissions
        const permissionsRef = ref(db, `companies/${companyId}/roles/${userRole}/permissions`);
        console.log(`🔍 Checking permissions at: companies/${companyId}/roles/${userRole}/permissions`);
        
        const permissionsSnapshot = await get(permissionsRef);
        
        if (!permissionsSnapshot.exists()) {
            console.log(`❌ No permissions found for role ${userRole} in company ${companyId}`);
            console.log(`🔍 Trying alternative role formats...`);
            
            // Try to get all roles to see what's available
            const allRolesRef = ref(db, `companies/${companyId}/roles`);
            const allRolesSnapshot = await get(allRolesRef);
            
            if (allRolesSnapshot.exists()) {
                const allRoles = allRolesSnapshot.val();
                console.log('🔍 Available roles in company:', Object.keys(allRoles));
                console.log('🔍 Full roles data:', allRoles);
                
                // Check if the role exists with different casing or format
                const roleKeys = Object.keys(allRoles);
                const matchingRole = roleKeys.find(key => 
                    key.toLowerCase() === userRole.toLowerCase() ||
                    key.replace(/\s+/g, '').toLowerCase() === userRole.replace(/\s+/g, '').toLowerCase()
                );
                
                if (matchingRole && allRoles[matchingRole].permissions) {
                    console.log(`✅ Found matching role: ${matchingRole}`);
                    console.log('🔍 Role permissions:', allRoles[matchingRole].permissions);
                    const permissions = allRoles[matchingRole].permissions;
                    updateMenuWithPermissions(permissions);
                    return;
                } else {
                    console.log('❌ No matching role found or role has no permissions');
                    // Try each role to see their structure
                    roleKeys.forEach(role => {
                        console.log(`🔍 Role "${role}":`, allRoles[role]);
                    });
                }
            } else {
                console.log('❌ No roles found in company');
            }
            
            console.log('❌ No valid permissions found - hiding all menu items');
            resetMenuVisibility();
            return;
        }
        
        const permissions = permissionsSnapshot.val();
        console.log('✅ Loaded permissions directly:', permissions);
        console.log('✅ Permission keys:', Object.keys(permissions || {}));
        updateMenuWithPermissions(permissions);
        
    } catch (error) {
        console.error('❌ Error updating menu visibility:', error);
        resetMenuVisibility();
    }
}

// Separate function to update menu with permissions
function updateMenuWithPermissions(permissions) {
    console.log('🎯 Updating menu with permissions...');
    console.log('🎯 Permissions object:', permissions);
    console.log('🎯 Available permission keys:', Object.keys(permissions || {}));
    
    // Reset menu visibility first
    resetMenuVisibility();
    
    if (!permissions) {
        console.log('⚠️ No permissions object provided');
        resetMenuVisibility();
        return;
    }
    
    // Update menu visibility based on permissions
    const menuItems = document.querySelectorAll('[data-feature]');
    console.log(`🎯 Found ${menuItems.length} menu items to check`);
    let visibleCount = 0;
    
    menuItems.forEach(item => {
        const feature = item.getAttribute('data-feature');
        const requiresPermission = item.getAttribute('data-requires-permission');
        
        console.log(`🔍 Checking menu item: ${feature} (requires: ${requiresPermission})`);
        
        // If item doesn't require permission, show it
        if (!requiresPermission) {
            item.classList.add('menu-visible');
            visibleCount++;
            console.log(`✅ Showing menu item (no permission required): ${feature}`);
            return;
        }
        
        // If item requires permission, check if user has it
        if (feature && permissions[feature]) {
            console.log(`🔍 Found permission for ${feature}:`, permissions[feature]);
            
            // Check if the permission has a 'view' property or if it's a boolean true
            const hasViewPermission = permissions[feature].view === true || permissions[feature] === true;
            
            if (hasViewPermission) {
                item.classList.add('menu-visible');
                visibleCount++;
                console.log(`✅ Showing menu item: ${feature}`);
            } else {
                console.log(`❌ No view permission for: ${feature}`, permissions[feature]);
            }
        } else {
            console.log(`⚪ Feature not found in permissions: ${feature}`);
        }
    });
    
    // Handle parent dropdowns - show if they have visible children
    document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
        const visibleSubmenuItems = dropdown.querySelectorAll('.submenu li.menu-visible');
        if (visibleSubmenuItems.length > 0) {
            dropdown.classList.add('menu-visible');
            console.log(`✅ Showing parent dropdown (has visible children)`);
        }
    });
    
    console.log(`🎯 Menu visibility update completed - ${visibleCount} items visible`);
    
    // If no items are visible, don't show any fallback menu
    if (visibleCount === 0) {
        console.log('⚠️ No menu items visible - user needs proper permissions');
    }
}

// Initialize on auth state change
auth.onAuthStateChanged((user) => {
    if (user) {
        updateMenuVisibilityForRoles();
    } else {
        resetMenuVisibility();
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (auth.currentUser) updateMenuVisibilityForRoles();
    });
} else {
    if (auth.currentUser) updateMenuVisibilityForRoles();
}

// Debug function
window.debugRolesMenu = updateMenuVisibilityForRoles;

// Debug function to inspect menu state
window.debugMenuState = function() {
    console.log('🔧 Debug Menu State:');
    const menuItems = document.querySelectorAll('[data-feature]');
    console.log(`Total menu items: ${menuItems.length}`);
    
    menuItems.forEach(item => {
        const feature = item.getAttribute('data-feature');
        const requiresPermission = item.getAttribute('data-requires-permission');
        const isVisible = item.classList.contains('menu-visible');
        console.log(`- ${feature}: requires=${requiresPermission}, visible=${isVisible}`);
    });
    
    const visibleItems = document.querySelectorAll('[data-feature].menu-visible');
    console.log(`Visible items: ${visibleItems.length}`);
};

// Debug function to manually check permissions
window.debugCheckPermissions = async function() {
    if (!auth.currentUser) {
        console.log('❌ No authenticated user');
        return;
    }
    
    const db = getDatabase();
    const userRef = ref(db, `users/${auth.currentUser.uid}`);
    const userSnapshot = await get(userRef);
    
    if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        console.log('User data:', userData);
        
        if (userData.companyId) {
            const companyUserRef = ref(db, `companies/${userData.companyId}/users/${auth.currentUser.uid}`);
            const companyUserSnapshot = await get(companyUserRef);
            
            if (companyUserSnapshot.exists()) {
                const companyUserData = companyUserSnapshot.val();
                console.log('Company user data:', companyUserData);
                
                if (companyUserData.role) {
                    const rolesRef = ref(db, `companies/${userData.companyId}/roles`);
                    const rolesSnapshot = await get(rolesRef);
                    
                    if (rolesSnapshot.exists()) {
                        const roles = rolesSnapshot.val();
                        console.log('All company roles:', roles);
                        
                        if (roles[companyUserData.role]) {
                            console.log(`Role ${companyUserData.role} permissions:`, roles[companyUserData.role].permissions);
                        }
                    }
                }
            }
        }
    }
};

// Listen for role changes
window.addEventListener('userRoleChanged', () => {
    updateMenuVisibilityForRoles();
});

export { updateMenuVisibilityForRoles, updateMenuWithPermissions, resetMenuVisibility };
