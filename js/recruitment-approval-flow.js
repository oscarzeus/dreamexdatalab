// Note: This module uses the global Firebase v8 SDK that's already loaded in the main page
// No need to import Firebase - we'll use the global firebase object

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    const firebaseConfig = {
        apiKey: "AIzaSyCUTmTn0rRBb0M-UkQJxnUMrWqXYU_BgIc",
        authDomain: "users-8be65.firebaseapp.com",
        databaseURL: "https://users-8be65-default-rtdb.firebaseio.com",
        projectId: "users-8be65",
        storageBucket: "users-8be65.firebasestorage.app",
        messagingSenderId: "829083030831",
        appId: "1:829083030831:web:36a370e62691e560bc3dda"
    };
    firebase.initializeApp(firebaseConfig);
}

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

// Make the function available globally for the main page to use
window.fetchRecruitmentApprovalFlow = async function fetchRecruitmentApprovalFlow(recruitmentRequestId) {
    console.log(`🚀 fetchRecruitmentApprovalFlow called with ID: ${recruitmentRequestId}`);
    console.log(`🔥 Firebase object available:`, !!window.firebase);
    console.log(`📱 Firebase database available:`, !!window.firebase?.database);
    try {
        // Get current company ID for company-scoped approval flows
        const getCurrentCompanyId = () => {
            console.log(`🔍 Checking for company ID...`);
            console.log(`📦 window.companyDataService:`, window.companyDataService);
            
            if (window.companyDataService && typeof window.companyDataService.getCurrentCompanyId === 'function') {
                const companyId = window.companyDataService.getCurrentCompanyId();
                console.log(`✅ Got company ID from service: ${companyId}`);
                return companyId;
            }
            
            // Fallback: try to get from localStorage or other sources
            const localStorageId = localStorage.getItem('currentCompanyId');
            const sessionStorageId = sessionStorage.getItem('currentCompanyId');
            
            console.log(`📁 localStorage company ID: ${localStorageId}`);
            console.log(`📁 sessionStorage company ID: ${sessionStorageId}`);
            
            const fallbackId = localStorageId || sessionStorageId;
            console.log(`🔄 Using fallback company ID: ${fallbackId}`);
            
            return fallbackId;
        };

        const companyId = getCurrentCompanyId() || '-OUuYJ2TBZebiL0ciPq-'; // Fallback to specific company ID
        console.log(`🏢 Final company ID being used: ${companyId}`);
        
        if (!companyId) {
            console.error('❌ No company ID available for approval flow');
            return { type: 'No Company Context', levels: [] };
        }

        console.log(`📡 Fetching approval flow from: companies/${companyId}/approvalFlows/recruitment`);

        // First get the approval flow configuration for recruitment from company scope
        const flowRef = firebase.database().ref(`companies/${companyId}/approvalFlows/recruitment`);
        let flowSnapshot;
        
        try {
            flowSnapshot = await flowRef.once('value');
            console.log(`✅ Firebase query successful. Data exists: ${flowSnapshot.exists()}`);
            if (flowSnapshot.exists()) {
                console.log(`📊 Flow data:`, flowSnapshot.val());
            }
        } catch (error) {
            console.error('❌ Firebase query failed:', error);
            throw error;
        }
        
        let globalFlowSnapshot = null;
        if (!flowSnapshot.exists()) {
            console.log('⚠️ No company-specific approval flow found, checking global fallback');
            // Fallback to global approval flow if company-specific doesn't exist
            const globalFlowRef = firebase.database().ref('approvalFlows/recruitment');
            try {
                globalFlowSnapshot = await globalFlowRef.once('value');
                console.log(`📡 Global fallback query result: ${globalFlowSnapshot.exists()}`);
                if (globalFlowSnapshot.exists()) {
                    console.log(`📊 Global flow data:`, globalFlowSnapshot.val());
                }
            } catch (error) {
                console.error('❌ Global fallback query failed:', error);
            }
            
            if (!globalFlowSnapshot.exists()) {
                console.error('❌ No approval flow configured (neither company-specific nor global)');
                
                // Create a mock approval flow for testing
                console.log('🧪 Creating mock approval flow for testing');
                return {
                    type: 'Mock Sequential Approval (Company Scope)',
                    approvalOrder: 'sequential',
                    companyId: companyId,
                    levels: [
                        {
                            name: 'Level 1',
                            status: 'pending',
                            totalApprovers: 1,
                            approvedCount: 0,
                            rejectedCount: 0,
                            approvers: [
                                {
                                    name: 'Test Manager',
                                    title: 'Department Manager',
                                    department: 'Human Resources',
                                    status: 'pending',
                                    date: null,
                                    role: 'Manager Approval',
                                    value: 'user_test123'
                                }
                            ],
                            comments: ''
                        }
                    ]
                };
            } else {
                console.log('✅ Using global approval flow as fallback');
            }
        } else {
            console.log('✅ Using company-specific approval flow');
        }
        
        const flow = (flowSnapshot.exists() ? flowSnapshot : globalFlowSnapshot).val();
        console.log(`📋 Retrieved approval flow:`, flow);
        
        const selectedRoles = flow.selectedRoles || {};
        console.log(`👥 Selected roles:`, selectedRoles);
        
        const isSequential = flow.approvalOrder === 'sequential' || flow.approvalSequence === 'sequential';
        console.log(`🔄 Flow type: ${isSequential ? 'Sequential' : 'Parallel'}`);

        // Then get the current approval status for this recruitment request
        const statusRef = firebase.database().ref(`recruit/${recruitmentRequestId}/approvals`);
        const statusSnapshot = await statusRef.once('value');
        const approvalStatus = statusSnapshot.exists() ? statusSnapshot.val() : {};

        // Build the levels array with approver details from company context
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
                console.log(`🔍 Processing role:`, role);
                
                let approverInfo = {
                    name: 'Not assigned',
                    title: '',
                    department: '',
                    status: 'pending',
                    date: null,
                    role: '',
                    value: role.value
                };

                if (role.value.startsWith('user_')) {
                    // User-based approver logic - now checking within company scope
                    const userId = role.value.replace('user_', '');
                    
                    // First try to get user from company users
                    let userRef = firebase.database().ref(`companies/${companyId}/users/${userId}`);
                    let userSnapshot = await userRef.once('value');
                    let userSource = `companies/${companyId}/users/${userId}`;
                    
                    // If not found in company users, check global users
                    if (!userSnapshot.exists()) {
                        userRef = firebase.database().ref(`users/${userId}`);
                        userSnapshot = await userRef.once('value');
                        userSource = `users/${userId}`;
                    }
                    
                    console.log(`🔍 Looking for user ${userId} in ${userSource}, found: ${userSnapshot.exists()}`);
                    
                    if (userSnapshot.exists()) {
                        const user = userSnapshot.val();
                        let fullName = null;
                        
                        // Try multiple name field combinations
                        if (user.displayName && user.displayName.trim()) {
                            fullName = user.displayName.trim();
                        } else if (user.name && user.name.trim()) {
                            fullName = user.name.trim();
                        } else if (user.fullName && user.fullName.trim()) {
                            fullName = user.fullName.trim();
                        } else if (user.firstName || user.lastName) {
                            const firstName = (user.firstName || '').trim();
                            const lastName = (user.lastName || '').trim();
                            fullName = `${firstName} ${lastName}`.trim();
                        } else if (user.username && user.username.trim()) {
                            fullName = user.username.trim();
                        }
                        
                        // If still no name and we have email, extract name from email
                        if (!fullName && user.email) {
                            const emailParts = user.email.split('@')[0];
                            // Convert email prefix to readable name (e.g., john.doe -> John Doe)
                            fullName = emailParts
                                .replace(/[._-]/g, ' ')
                                .split(' ')
                                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                                .join(' ');
                        }
                        
                        // Final fallback
                        if (!fullName || fullName.trim() === '') {
                            fullName = 'Not assigned';
                        }
                        
                        console.log(`👤 User name resolution: ${userId} -> "${fullName}" (from: displayName="${user.displayName}", name="${user.name}", firstName="${user.firstName}", lastName="${user.lastName}", email="${user.email}")`);
                        
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
                            role: role.text || role.label || 'Direct Approver',
                            value: role.value,
                            userId: userId, // Add user ID for authorization checks
                            approverId: userId // Also add as approverId for consistency
                        };
                        
                        console.log(`👤 User Approver: ${fullName} (${userId}) - Status: ${approverInfo.status}`);                } else {
                    console.log(`❌ User not found: ${userId} in company ${companyId} or global users`);
                    // Enhanced fallback name resolution when user is not found
                    let fallbackName = 'Not assigned';
                    
                    if (role.text && role.text.trim()) {
                        fallbackName = role.text.trim();
                    } else if (role.label && role.label.trim()) {
                        fallbackName = role.label.trim();
                    } else if (userId && userId.trim()) {
                        // Try to make a readable name from user ID
                        fallbackName = userId
                            .replace(/[._-]/g, ' ')
                            .split(' ')
                            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                            .join(' ');
                    }
                    
                    approverInfo.name = fallbackName;
                    approverInfo.role = 'User (Not Found)';
                    approverInfo.department = 'Unknown';
                    approverInfo.userId = userId; // Add user ID even for missing users
                    approverInfo.approverId = userId; // Also add as approverId for consistency
                    
                    console.log(`🔄 Using fallback name for missing user ${userId}: "${fallbackName}"`);
                }
                } else if (role.value.startsWith('function_')) {
                    // Function-based approver - check within company context first
                    const approverAction = levelApprovals.find(a => a.approverRole === role.value);
                    
                    // Try to resolve function to actual users within company
                    const functionName = role.value.replace('function_', '');
                    let resolvedName = role.text || functionName;
                    
                    // Check if there are any company-specific function mappings
                    const functionRef = firebase.database().ref(`companies/${companyId}/functions/${functionName}`);
                    const functionSnapshot = await functionRef.once('value');
                    
                    if (functionSnapshot.exists()) {
                        const functionData = functionSnapshot.val();
                        resolvedName = functionData.displayName || functionData.name || resolvedName;
                    }
                    
                    approverInfo = {
                        name: resolvedName,
                        title: 'Function',
                        department: 'Company Scope',
                        status: await getApprovalStatus(approverAction || {}, levelNumber, isSequential, previousLevel),
                        date: approverAction?.approvedDateTime || 
                             (approverAction?.approvedAt ? new Date(approverAction.approvedAt).toLocaleString() : null),
                        comments: approverAction?.comments || '',
                        role: 'Function-based Approver',
                        value: role.value
                    };
                    
                    console.log(`🔧 Function Approver: ${resolvedName} - Status: ${approverInfo.status}`);
                } else if (role.value.startsWith('L+')) {
                    // Level-based approver - within company hierarchy
                    const levelNum = role.value.replace('L+', '');
                    const approverAction = levelApprovals.find(a => a.approverRole === role.value);
                    
                    approverInfo = {
                        name: `Level +${levelNum} Approver`,
                        title: 'Hierarchical Approval',
                        department: 'Company Hierarchy',
                        status: await getApprovalStatus(approverAction || {}, levelNumber, isSequential, previousLevel),
                        date: approverAction?.approvedDateTime || 
                             (approverAction?.approvedAt ? new Date(approverAction.approvedAt).toLocaleString() : null),
                        comments: approverAction?.comments || '',
                        role: `L+${levelNum} Approver`,
                        value: role.value
                    };
                    
                    console.log(`🏢 Level Approver: Level +${levelNum} - Status: ${approverInfo.status}`);
                } else {
                    // Handle any other types of approvers
                    console.log(`❓ Unknown approver type: ${role.value}`);
                    approverInfo = {
                        name: role.text || role.label || role.value || 'Unknown Approver',
                        title: 'Other',
                        department: 'Company Scope',
                        status: 'pending',
                        date: null,
                        role: 'Other Approver',
                        value: role.value
                    };
                }

                console.log(`✅ Final approver info:`, approverInfo);
                return approverInfo;
            }));

            console.log(`📋 Level ${levelNumber} approvers:`, approvers.map(a => `${a.name} (${a.status})`));

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
        
        console.log(`✅ Using company-scoped approval flow for company: ${companyId}`);
        console.log(`📋 Approval flow type: ${isSequential ? 'Sequential' : 'Parallel'}`);
        console.log(`👥 Total approval levels: ${levels.length}`);
        
        return {
            type: isSequential ? 'Sequential Approval (Company Scope)' : 'Parallel Approval (Company Scope)',
            approvalOrder: isSequential ? 'sequential' : 'parallel',
            companyId: companyId,
            levels: levels
        };
    } catch (error) {
        console.error('❌ Error fetching recruitment approval flow:', error);
        return { type: 'Error', levels: [] };
    }
}