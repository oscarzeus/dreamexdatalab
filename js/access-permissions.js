// Access control utilities for access requests
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db, auth } from './firebase-config.js';

/**
 * Check if the current user can view a specific access request
 * Users can view requests if they are:
 * 1. The submitter/creator of the request
 * 2. An approver in the approval flow
 * 3. Have admin permissions (future enhancement)
 */
export async function canUserViewAccessRequest(accessRequest) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            return false;
        }

        const currentUserId = currentUser.uid;

        // Check if user is the submitter
        if (accessRequest.createdBy?.uid === currentUserId) {
            return true;
        }

        // Check if user is an approver in the approval flow
        const isApprover = await isUserApprover(accessRequest.id || accessRequest.key, currentUserId);
        if (isApprover) {
            return true;
        }

        // TODO: Add admin role check here if needed
        // if (window.roleManager?.hasRole('admin')) {
        //     return true;
        // }

        return false;
    } catch (error) {
        console.error('Error checking user access permissions:', error);
        return false; // Deny access on error for security
    }
}

/**
 * Check if a user is an approver for a specific access request
 */
export async function isUserApprover(accessRequestId, userId) {
    try {
        // Get the approval flow configuration
        const flowRef = ref(db, 'approvalFlows/access');
        const flowSnapshot = await get(flowRef);
        
        if (!flowSnapshot.exists()) {
            return false;
        }

        const flow = flowSnapshot.val();
        const selectedRoles = flow.selectedRoles || {};

        // Check each level for user assignment
        for (const [levelKey, roles] of Object.entries(selectedRoles)) {
            for (const role of roles) {
                if (role.value.startsWith('user_')) {
                    // Direct user assignment
                    const approverUserId = role.value.replace('user_', '');
                    if (approverUserId === userId) {
                        return true;
                    }
                } else if (role.value.startsWith('function_')) {
                    // Function-based assignment - would need to check user's function/role
                    // This would require additional logic to map user roles to functions
                    const isUserInFunction = await checkUserInFunction(userId, role.value);
                    if (isUserInFunction) {
                        return true;
                    }
                } else if (role.value.startsWith('L+')) {
                    // Level-based assignment - would need to check organizational hierarchy
                    // This would require additional logic to check manager relationships
                    const isUserInHierarchy = await checkUserInHierarchy(userId, accessRequestId, role.value);
                    if (isUserInHierarchy) {
                        return true;
                    }
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking if user is approver:', error);
        return false;
    }
}

/**
 * Check if user has a specific function/role (placeholder for future implementation)
 */
async function checkUserInFunction(userId, functionValue) {
    try {
        // Get user data
        const userRef = ref(db, `users/${userId}`);
        const userSnapshot = await get(userRef);
        
        if (!userSnapshot.exists()) {
            return false;
        }

        const user = userSnapshot.val();
        const functionName = functionValue.replace('function_', '');
        
        // Check if user's role/function matches
        // This logic would depend on how functions are stored in user data
        return user.role === functionName || user.function === functionName || user.jobTitle === functionName;
    } catch (error) {
        console.error('Error checking user function:', error);
        return false;
    }
}

/**
 * Check if user is in organizational hierarchy for L+ approval (placeholder for future implementation)
 */
async function checkUserInHierarchy(userId, accessRequestId, levelValue) {
    try {
        // Get the access request to find the submitter
        const requestRef = ref(db, `access/${accessRequestId}`);
        const requestSnapshot = await get(requestRef);
        
        if (!requestSnapshot.exists()) {
            return false;
        }

        const request = requestSnapshot.val();
        const submitterId = request.createdBy?.uid;
        
        if (!submitterId) {
            return false;
        }

        // Get submitter's data to find their manager
        const submitterRef = ref(db, `users/${submitterId}`);
        const submitterSnapshot = await get(submitterRef);
        
        if (!submitterSnapshot.exists()) {
            return false;
        }

        const submitter = submitterSnapshot.val();
        const levelNumber = parseInt(levelValue.replace('L+', ''));
        
        // This would need proper organizational hierarchy logic
        // For now, check if user is the direct manager (L+1)
        if (levelNumber === 1 && submitter.managerId === userId) {
            return true;
        }

        // For higher levels, would need to traverse the hierarchy
        // This is a placeholder for future implementation
        return false;
    } catch (error) {
        console.error('Error checking user hierarchy:', error);
        return false;
    }
}

/**
 * Filter access requests based on user permissions
 */
export async function filterAccessRequestsByPermissions(accessRequests) {
    const filteredRequests = [];
    
    for (const request of accessRequests) {
        const canView = await canUserViewAccessRequest(request);
        if (canView) {
            filteredRequests.push(request);
        }
    }
    
    return filteredRequests;
}
