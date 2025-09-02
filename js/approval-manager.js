import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class ApprovalManager {
    constructor() {
        this.db = getDatabase();
        this.auth = getAuth();
    }

    // Check if user is an approver for a specific process
    async isUserApprover(processType, itemData) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return false;

        try {
            // Get the approval flow configuration
            const flowRef = ref(this.db, `approvalFlows/${processType}`);
            const flowSnapshot = await get(flowRef);
            
            if (!flowSnapshot.exists()) return false;

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            const isSequential = flow.approvalSequence === 'sequential';

            // Get user's job title and team info
            const userRef = ref(this.db, `users/${currentUser.uid}`);
            const userSnapshot = await get(userRef);
            if (!userSnapshot.exists()) return false;
            
            const userData = userSnapshot.val();
            const userJobTitle = userData.jobTitle?.toLowerCase();
            const userDepartment = userData.department;
            const userPosition = userData.position || '';
            let userLevel = null;

            // Find user's level in approval flow
            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                for (const role of roles) {
                    if (role.value.startsWith('user_')) {
                        // Direct user assignment
                        if (role.value === `user_${currentUser.uid}`) {
                            userLevel = levelKey;
                            break;
                        }
                    } else if (role.value.startsWith('function_')) {
                        // Function/job title based assignment
                        const functionId = role.value.replace('function_', '');
                        if (userJobTitle === functionId.toLowerCase()) {
                            userLevel = levelKey;
                            break;
                        }
                    } else if (role.value.startsWith('L+')) {
                        // Level-based assignment
                        // Get the creator/owner of the item
                        const creatorId = itemData.createdBy || itemData.requesterId || itemData.ownerId;
                        if (!creatorId) continue;

                        // Get creator's data to check their position
                        const creatorRef = ref(this.db, `users/${creatorId}`);
                        const creatorSnapshot = await get(creatorRef);
                        if (!creatorSnapshot.exists()) continue;

                        const creatorData = creatorSnapshot.val();
                        // Skip if creator and approver are in different departments
                        if (creatorData.department !== userDepartment) continue;

                        // Calculate the required level difference
                        const levelDiff = parseInt(role.value.replace('L+', ''));
                        
                        // Get the organizational structure
                        const orgStructureRef = ref(this.db, 'organizationStructure');
                        const orgStructureSnapshot = await get(orgStructureRef);
                        if (!orgStructureSnapshot.exists()) continue;

                        const orgStructure = orgStructureSnapshot.val();
                        const positions = orgStructure.positions || {};
                        
                        // Get position levels
                        const creatorPositionLevel = positions[creatorData.position]?.level || 0;
                        const userPositionLevel = positions[userPosition]?.level || 0;

                        // Check if user is at the required level above the creator
                        if (userPositionLevel - creatorPositionLevel === levelDiff) {
                            userLevel = levelKey;
                            break;
                        }
                    }
                }
                if (userLevel) break;
            }

            if (!userLevel) return false;

            // For sequential approval, check if previous levels are completed
            if (isSequential) {
                const levelNumber = parseInt(userLevel.replace('level', ''));
                if (levelNumber > 1) {
                    // Check if previous levels are approved
                    for (let i = 1; i < levelNumber; i++) {
                        const previousLevel = `level${i}`;
                        if (!itemData.approvals?.[previousLevel]?.isCompleted) {
                            return false;
                        }
                    }
                }
            }

            // Check if this level is already approved
            if (itemData.approvals?.[userLevel]?.isCompleted) {
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error checking if user is approver:', error);
            return false;
        }
    }

    // Update modal buttons visibility
    async updateModalButtons(modal, processType, itemData) {
        if (!modal) return;

        const isApprover = await this.isUserApprover(processType, itemData);
        
        // Get all action buttons in the modal
        const actionButtons = modal.querySelectorAll('[data-action]');
        const standardActions = ['edit', 'approve', 'decline', 'export'];
        
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            if (action === 'close') return; // Skip close button

            // Show standard actions only to approvers, regardless of role permissions
            if (standardActions.includes(action)) {
                if (isApprover && itemData.status !== 'approved' && itemData.status !== 'declined') {
                    button.style.display = '';
                } else {
                    button.style.display = 'none';
                }
            }
        });

        // If sequential approval, check if previous levels are completed
        if (isApprover) {
            await this.checkSequentialApprovalStatus(modal, processType, itemData);
        }
    }

    // Check if approval flow is sequential and handle button states
    async checkSequentialApprovalStatus(modal, processType, itemData) {
        try {
            const flowRef = ref(this.db, `approvalFlows/${processType}`);
            const flowSnapshot = await get(flowRef);
            
            if (!flowSnapshot.exists()) return;

            const flow = flowSnapshot.val();
            const isSequential = flow.approvalOrder === 'sequential';
            
            if (isSequential) {
                const currentUser = this.auth.currentUser;
                if (!currentUser) return;

                // Get user's level in approval flow
                const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
                const userJobTitle = userSnapshot.exists() ? userSnapshot.val().jobTitle?.toLowerCase() : null;
                let userLevel = null;

                const selectedRoles = flow.selectedRoles || {};
                for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                    for (const role of roles) {
                        if (role.value === `user_${currentUser.uid}` || 
                            (role.value.startsWith('function_') && 
                             role.value.replace('function_', '').toLowerCase() === userJobTitle)) {
                            userLevel = levelKey;
                            break;
                        }
                    }
                    if (userLevel) break;
                }

                if (userLevel) {
                    const levelNumber = parseInt(userLevel.replace('level', ''));
                    if (levelNumber > 1) {
                        // Check if previous levels are approved
                        let previousLevelApproved = true;
                        for (let i = 1; i < levelNumber; i++) {
                            const previousLevel = `level${i}`;
                            if (!itemData.approvals?.[previousLevel]?.isCompleted) {
                                previousLevelApproved = false;
                                break;
                            }
                        }
                        
                        // If previous levels are not fully approved, disable the approve button
                        if (!previousLevelApproved) {
                            const approveBtn = modal.querySelector('[data-action="approve"]');
                            if (approveBtn) {
                                approveBtn.disabled = true;
                                approveBtn.classList.add('btn-disabled');
                                approveBtn.title = 'Previous approval levels must be completed first';
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking sequential approval status:', error);
        }
    }
}

// Create global instance
window.approvalManager = new ApprovalManager();

export default ApprovalManager;