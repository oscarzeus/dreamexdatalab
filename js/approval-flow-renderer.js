import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from './firebase-config.js';

export async function renderApprovalFlow(item, processType) {
    try {
        const flowRef = ref(db, `approvalFlows/${processType}`);
        const flowSnapshot = await get(flowRef);
        
        if (!flowSnapshot.exists()) {
            return '';  // No approval flow configured
        }

        const flow = flowSnapshot.val();
        const selectedRoles = flow.selectedRoles || {};
        const isSequential = flow.approvalSequence === 'sequential';

        let flowHTML = `            <div class="detail-section">
                <div class="approval-flow-container">                    <div class="approval-type">
                        ${isSequential ? 'Sequential' : 'Parallel'} Approval Flow
                    </div>
                    <table class="approval-flow-table">
                        <thead>
                            <tr>
                                <th>Approver</th>
                                <th>Title & Department</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Comments</th>
                            </tr>
                        </thead>
                        <tbody>`;

        // For each level in the approval flow
        for (const [levelKey, roles] of Object.entries(selectedRoles)) {
            const levelNumber = parseInt(levelKey.replace('level', ''));
            const currentLevel = item.approvals?.[levelKey];
            const status = currentLevel?.isCompleted ? 'approved' : 'waiting';

            // Get the assignment types for this level
            const assignmentTypes = roles.map(role => {
                if (role.value.startsWith('user_')) return 'Name';
                if (role.value.startsWith('function_')) return 'Function';
                if (role.value.startsWith('L+')) return `Level+${role.value.replace('L+', '')}`;
                return 'Unknown';
            }).filter((type, index, self) => self.indexOf(type) === index); // Remove duplicates

            // Add level divider with assignment types
            flowHTML += `
                <tr class="level-divider">
                    <td colspan="5">Level ${levelNumber} (${assignmentTypes.join(' | ')})</td>
                </tr>`;
            
            // Get approver details
            for (const role of roles) {
                let approverInfo = { 
                    name: 'Not assigned', 
                    title: '', 
                    department: '',
                    status: 'pending',
                    date: '',
                    comments: ''
                };
                
                if (role.value.startsWith('user_')) {
                    const userId = role.value.replace('user_', '');
                    const approverSnapshot = await get(ref(db, `users/${userId}`));
                    if (approverSnapshot.exists()) {
                        const approver = approverSnapshot.val();
                        approverInfo = {
                            name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || approver.email,
                            title: approver.jobTitle || '',
                            department: approver.department || '',
                            status: 'pending',
                            date: '',
                            comments: ''
                        };
                    }
                } else if (role.value.startsWith('function_')) {
                    approverInfo = {
                        name: role.text,
                        title: 'Function',
                        department: role.department || '',
                        status: 'pending',
                        date: '',
                        comments: ''
                    };
                } else if (role.value.startsWith('L+')) {
                    const requestorId = item.createdBy || item.requesterId || item.ownerId || item.submittedBy;
                    if (requestorId) {
                        const requestorSnapshot = await get(ref(db, `users/${requestorId}`));
                        if (requestorSnapshot.exists()) {
                            const requestor = requestorSnapshot.val();
                            if (requestor.lineManager) {
                                const lineManagerSnapshot = await get(ref(db, `users/${requestor.lineManager}`));
                                if (lineManagerSnapshot.exists()) {
                                    const lineManager = lineManagerSnapshot.val();
                                    approverInfo = {
                                        name: `${lineManager.firstName || ''} ${lineManager.lastName || ''}`.trim() || lineManager.email,
                                        title: lineManager.jobTitle || 'Line Manager',
                                        department: lineManager.department || '',
                                        status: 'pending',
                                        date: '',
                                        comments: ''
                                    };
                                }
                            }
                        }
                    }
                }
                
                // Get approval details if available
                if (currentLevel?.isCompleted && currentLevel.approvedBy) {
                    const approverSnapshot = await get(ref(db, `users/${currentLevel.approvedBy}`));
                    if (approverSnapshot.exists()) {
                        const actualApprover = approverSnapshot.val();
                        approverInfo.actualApprover = `${actualApprover.firstName || ''} ${actualApprover.lastName || ''}`.trim() || actualApprover.email;
                        approverInfo.date = new Date(currentLevel.approvedAt).toLocaleString();
                        approverInfo.status = 'approved';
                        approverInfo.comments = currentLevel.comments || '';
                    }
                }

                // Determine if this row should be clickable
                const isClickable = status !== 'approved' && 
                                  approverInfo.status === 'pending' && 
                                  (!isSequential || levelNumber === 1 || item.approvals?.[`level${levelNumber - 1}`]?.isCompleted);

                flowHTML += `
                    <tr class="${isClickable ? 'clickable' : ''}"
                        ${isClickable ? `
                            data-level-index="${levelNumber}"
                            data-approver-index="${roles.indexOf(role)}"
                            data-${processType}-id="${item.id}"
                        ` : ''}>
                        <td>
                            <div class="name-cell">
                                <div class="avatar">
                                    ${approverInfo.name !== 'Not assigned' ? 
                                        approverInfo.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                                </div>
                                ${approverInfo.name}
                            </div>
                        </td>
                        <td>
                            <span class="title-department">
                                ${approverInfo.title}${approverInfo.department ? ` - ${approverInfo.department}` : ''}
                            </span>
                        </td>
                        <td>
                            <span class="approval-status status-${approverInfo.status}">
                                <i class="fas fa-${approverInfo.status === 'approved' ? 'check' : 
                                                 approverInfo.status === 'rejected' ? 'times' :
                                                 status === 'locked' ? 'lock' : 'clock'}"></i>
                                ${approverInfo.status.charAt(0).toUpperCase() + approverInfo.status.slice(1)}
                            </span>
                        </td>
                        <td>
                            ${approverInfo.date ? `
                                <span class="approval-date">
                                    ${approverInfo.date}
                                </span>
                            ` : ''}
                        </td>
                        <td>
                            ${approverInfo.comments ? `
                                <div class="comments" title="${approverInfo.comments}">
                                    ${approverInfo.comments}
                                </div>
                            ` : ''}
                        </td>
                    </tr>`;
            }
        }

        flowHTML += `
                        </tbody>
                    </table>
                </div>
            </div>`;

        return flowHTML;
    } catch (error) {
        console.error('Error rendering approval flow:', error);
        return '';
    }
}