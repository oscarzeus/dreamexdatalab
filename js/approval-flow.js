import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from './firebase-config.js';

async function getApprovalStatus(level, levelNumber, isSequential, previousLevelStatus) {
    // Base statuses
    if (level.status === 'rejected') {
        return 'rejected';
    }
    if (level.isCompleted || level.status === 'completed' || level.status === 'approved') {
        return 'approved';
    }
    if (level.status === 'pending') {
        return 'pending';
    }
    // Sequential flow specific logic
    if (isSequential && levelNumber > 1 && !previousLevelStatus?.isCompleted) {
        return 'locked';
    }
    return 'waiting';
}

export async function fetchApprovalFlow(accessRequestId) {
    try {
        // First get the approval flow configuration
        const flowRef = ref(db, 'approvalFlows/access');
        const flowSnapshot = await get(flowRef);
        
        if (!flowSnapshot.exists()) {
            return { type: 'Not Configured', levels: [] };
        }
        
        const flow = flowSnapshot.val();
        const selectedRoles = flow.selectedRoles || {};
        const isSequential = flow.approvalOrder === 'sequential' || flow.approvalSequence === 'sequential';

        // Then get the current approval status for this request
        const statusRef = ref(db, `access/${accessRequestId}/approvals`);
        const statusSnapshot = await get(statusRef);
        const approvalStatus = statusSnapshot.exists() ? statusSnapshot.val() : {};

        // Build the levels array with approver details
        const levels = [];
        for (const [levelKey, roles] of Object.entries(selectedRoles)) {
            const levelNumber = parseInt(levelKey.replace('level', ''));
            const currentLevel = approvalStatus[levelKey] || {};
            const previousLevel = levelNumber > 1 ? approvalStatus[`level${levelNumber - 1}`] : null;

            // Enhanced approval tracking
            const levelApprovals = currentLevel.approvals || [];
            const totalApproversInLevel = roles.length;
            const approvedCount = levelApprovals.filter(a => a.status === 'approved').length;
            const rejectedCount = levelApprovals.filter(a => a.status === 'rejected').length;
            
            const approvers = await Promise.all(roles.map(async (role) => {
                let approverInfo = {
                    name: 'Not assigned',
                    title: '',
                    department: '',
                    status: 'pending',
                    date: null,
                    role: ''
                };

                if (role.value.startsWith('user_')) {
                    // User-based approver logic
                    const userId = role.value.replace('user_', '');
                    const userRef = ref(db, `users/${userId}`);
                    const userSnapshot = await get(userRef);
                    
                    if (userSnapshot.exists()) {
                        const user = userSnapshot.val();
                        let fullName = user.displayName;
                        
                        if (!fullName && (user.firstName || user.lastName)) {
                            fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                        }
                        
                        if (!fullName && user.email) {
                            fullName = user.email;
                        }
                        
                        if (!fullName) {
                            fullName = 'Not assigned';
                        }
                        
                        // Find this approver's specific approval status
                        const approverAction = levelApprovals.find(a => 
                            (role.type === 'user' && a.approverId === userId) ||
                            (role.type === 'function' && a.approverRole === role.value)
                        );
                        
                        approverInfo = {
                            name: fullName,
                            title: user.jobTitle || '',
                            department: user.department || '',
                            status: await getApprovalStatus(approverAction || {}, levelNumber, isSequential, previousLevel),
                            date: approverAction?.approvedDateTime || 
                                 (approverAction?.approvedAt ? new Date(approverAction.approvedAt).toLocaleString() : null),
                            comments: approverAction?.comments || '',
                            role: role.text || 'Direct Approver'
                        };
                    }
                } else if (role.value.startsWith('function_')) {
                    const approverAction = levelApprovals.find(a => a.approverRole === role.value);
                    approverInfo = {
                        name: role.text,
                        title: 'Function',
                        department: '',
                        status: await getApprovalStatus(approverAction || {}, levelNumber, isSequential, previousLevel),
                        date: approverAction?.approvedDateTime || 
                             (approverAction?.approvedAt ? new Date(approverAction.approvedAt).toLocaleString() : null),
                        comments: approverAction?.comments || '',
                        role: 'Function-based Approver'
                    };
                } else if (role.value.startsWith('L+')) {
                    const levelNum = role.value.replace('L+', '');
                    const approverAction = levelApprovals.find(a => a.approverRole === role.value);
                    approverInfo = {
                        name: `Level +${levelNum} Approver`,
                        title: 'Hierarchical Approval',
                        department: '',
                        status: await getApprovalStatus(approverAction || {}, levelNumber, isSequential, previousLevel),
                        date: approverAction?.approvedDateTime || 
                             (approverAction?.approvedAt ? new Date(approverAction.approvedAt).toLocaleString() : null),
                        comments: approverAction?.comments || '',
                        role: `L+${levelNum} Approver`
                    };
                }

                return approverInfo;
            }));

            // Determine overall level status
            let levelStatus;
            if (currentLevel.isCompleted) {
                levelStatus = 'approved';
            } else if (rejectedCount > 0) {
                levelStatus = 'rejected';
            } else if (isSequential && levelNumber > 1 && !approvalStatus[`level${levelNumber - 1}`]?.isCompleted) {
                levelStatus = 'locked';
            } else if (approvedCount > 0 && approvedCount < totalApproversInLevel) {
                levelStatus = 'partially-approved';
            } else {
                levelStatus = 'pending';
            }

            levels.push({
                name: `Level ${levelNumber}`,
                status: levelStatus,
                totalApprovers: totalApproversInLevel,
                approvedCount: approvedCount,
                rejectedCount: rejectedCount,
                approvers: approvers,
                comments: currentLevel.comments || ''
            });
        }
        
        return {
            type: isSequential ? 'Sequential Approval' : 'Parallel Approval',
            approvalOrder: isSequential ? 'sequential' : 'parallel',
            levels: levels
        };
    } catch (error) {
        console.error('Error fetching approval flow:', error);
        return { type: 'Error', levels: [] };
    }
}
