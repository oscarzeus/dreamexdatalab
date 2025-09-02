import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
const db = getDatabase();

// Check if user is an approver
export async function isUserApprover(currentUser) {
    if (!currentUser) return false;

    try {
        const flowRef = ref(db, 'approvalFlows/company_creation');
        const snapshot = await get(flowRef);
        if (!snapshot.exists()) return false;

        const flow = snapshot.val();
        const selectedRoles = flow.selectedRoles || {};

        // Get the current user's job title
        const userRef = ref(db, `users/${currentUser.uid}`);
        const userSnapshot = await get(userRef);
        if (!userSnapshot.exists()) return false;
        
        const userData = userSnapshot.val();
        const userJobTitle = userData.jobTitle?.toLowerCase();

        // Check each level for the current user
        for (const roles of Object.values(selectedRoles)) {
            for (const role of roles) {
                // Direct user assignment
                if (role.value === `user_${currentUser.uid}`) {
                    return true;
                }

                // Function/role-based assignment
                if (role.value.startsWith('function_')) {
                    const functionId = role.value.replace('function_', '').toLowerCase();
                    if (userJobTitle === functionId) {
                        return true;
                    }
                }
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking approver status:', error);
        return false;
    }
}

// Check if user can view a company
export async function canViewCompany(company, currentUser) {
    if (!currentUser) return false;
    
    // Allow view if user is the submitter
    if (company.submittedBy === currentUser.uid) return true;
    
    // Allow view if user is an approver
    return await isUserApprover(currentUser);
}

// Check if user can edit a company
export function canEditCompany(company, currentUser) {
    if (!currentUser) return false;

    // Allow edit if user is the submitter and company is not yet approved/declined
    return company.submittedBy === currentUser.uid && 
           company.status !== 'approved' && 
           company.status !== 'declined';
}

// Check if user can approve/decline a company
export async function canApproveCompany(company, currentUser) {
    if (!currentUser) return false;

    // Only allow approval/decline for non-approved companies
    if (company.status === 'approved' || company.status === 'declined') {
        return false;
    }

    return await isUserApprover(currentUser);
}
