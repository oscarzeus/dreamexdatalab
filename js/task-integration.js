// Task Management System - Enhanced with Firebase Integration
import { ref, push, set, get, onValue, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db } from './firebase-config.js';

class TaskIntegrationManager {
    constructor() {
        this.db = db;
        this.auth = getAuth();
        this.pendingTasks = [];
        this.firebaseListeners = new Map();
        this.monitoredPaths = [
            { path: 'trainingRequests', type: 'training' },
            { path: 'access', type: 'access' },
            { path: 'incidents', type: 'incident' },
            { path: 'inspections', type: 'inspection' },
            { path: 'removal', type: 'removal' },
            { path: 'riskAssessments', type: 'risk' },
            { path: 'ptw', type: 'permit' },
            { path: 'events', type: 'event' }
        ];
        
        this.initializeTaskIntegration();
        this.loadExistingTasks();
        this.setupFirebaseMonitoring();
    }    loadPendingTasks() {
        // Always return empty array - we only use Firebase tasks now
        return [];
    }

    savePendingTasks() {
        // No longer save to localStorage - Firebase handles persistence
        // This method kept for compatibility but does nothing
    }    // Legacy method - now redirects to enhanced Firebase-based task creation
    async addPendingTask(formType, formData) {
        console.warn('addPendingTask is deprecated. Tasks are now created automatically via Firebase monitoring.');
        
        // Try to create task using the enhanced method
        if (formData.id) {
            return await this.createTaskFromSubmission(formData, formType, formData.id, formType);
        }
        
        // Fallback for old implementations
        return null;
    }    // Legacy methods - replaced by enhanced Firebase-based task creation
    generateTaskTitle(formType, formData) {
        console.warn('generateTaskTitle is deprecated. Use generateEnhancedTaskTitle instead.');
        return `${formType} Request: ${formData.title || 'General Request'}`;
    }

    determinePriority(formType, formData) {
        console.warn('determinePriority is deprecated. Use determinePriorityFromSubmission instead.');
        return formData.priority || 'medium';
    }

    calculateDueDate(formType) {
        console.warn('calculateDueDate is deprecated. Use calculateDueDateFromFlow instead.');
        const now = new Date();
        now.setDate(now.getDate() + 3); // Default 3 days
        return now.toISOString();
    }

    getDepartmentForType(formType) {
        console.warn('getDepartmentForType is deprecated. Department is now extracted from submission data.');
        return 'General';
    }

    getAssigneeForType(formType) {
        console.warn('getAssigneeForType is deprecated. Assignee is now determined by approval flows.');
        return 'Department Manager';
    }

    notifyTaskCreation(task) {
        console.warn('notifyTaskCreation is deprecated. Use createEnhancedNotification instead.');
        if (window.notificationManager) {
            window.notificationManager.addNotification({
                type: 'Task Created',
                message: `New ${task.type} task created: ${task.title}`,
                link: `tasks.html?id=${task.id}`
            });
        }
    }

    // Update task status (approve, reject, etc.)
    updateTaskStatus(taskId, newStatus, comment = '') {
        const task = this.pendingTasks.find(t => t.id === taskId);
        if (task) {
            const oldStatus = task.status;
            task.status = newStatus;
            task.lastUpdated = new Date().toISOString();
            if (comment) {
                task.comment = comment;
            }

            this.savePendingTasks();
            this.notifyStatusChange(task, oldStatus, newStatus);
            
            return task;
        }
        return null;
    }

    notifyStatusChange(task, oldStatus, newStatus) {
        if (window.notificationManager) {
            let message = `Task ${task.id} status changed from ${oldStatus} to ${newStatus}`;
            if (task.comment) {
                message += `. Comment: ${task.comment}`;
            }

            window.notificationManager.addNotification({
                type: 'Status Update',
                message: message,
                link: `tasks.html?id=${task.id}`
            });
        }
    }

    // Get pending task count for notifications
    getPendingTaskCount() {
        return this.pendingTasks.filter(task => task.status === 'pending').length;
    }

    // Get high priority task count
    getHighPriorityTaskCount() {
        return this.pendingTasks.filter(task => 
            task.status === 'pending' && task.priority === 'high'
        ).length;
    }

    // Get overdue task count
    getOverdueTaskCount() {
        const now = new Date();
        return this.pendingTasks.filter(task => 
            task.status === 'pending' && new Date(task.dueDate) < now
        ).length;
    }

    // Integration with form submissions
    onFormSubmit(formType, formData) {
        return this.addPendingTask(formType, formData);
    }

    // Integration with approval workflows
    onApprovalAction(taskId, action, comment = '') {
        const statusMap = {
            approve: 'approved',
            reject: 'rejected',
            review: 'review'
        };
        
        return this.updateTaskStatus(taskId, statusMap[action] || action, comment);
    }

    // Get tasks for dashboard display
    getDashboardTasks(limit = 5) {
        return this.pendingTasks
            .filter(task => task.status === 'pending')
            .sort((a, b) => {
                // Sort by priority and due date
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                return new Date(a.dueDate) - new Date(b.dueDate);
            })
            .slice(0, limit);
    }

    // Initialize task integration across the system
    initializeTaskIntegration() {
        // Listen for form submissions
        document.addEventListener('formSubmitted', (event) => {
            const { formType, formData } = event.detail;
            this.onFormSubmit(formType, formData);
        });

        // Listen for approval actions
        document.addEventListener('approvalAction', (event) => {
            const { taskId, action, comment } = event.detail;
            this.onApprovalAction(taskId, action, comment);
        });

        // Update task counts periodically
        this.updateTaskCounts();
        setInterval(() => this.updateTaskCounts(), 30000); // Every 30 seconds
    }

    updateTaskCounts() {
        // Update any task count displays on the current page
        const pendingCount = this.getPendingTaskCount();
        const highPriorityCount = this.getHighPriorityTaskCount();
        const overdueCount = this.getOverdueTaskCount();

        // Update dashboard if it exists
        const dashboardPendingElement = document.querySelector('.dashboard-pending-tasks');
        if (dashboardPendingElement) {
            dashboardPendingElement.textContent = pendingCount;
        }

        // Update navigation badge if it exists
        const taskBadge = document.querySelector('.task-badge');
        if (taskBadge) {
            taskBadge.textContent = pendingCount;
            taskBadge.style.display = pendingCount > 0 ? '' : 'none';
        }

        // Emit event for other components
        document.dispatchEvent(new CustomEvent('taskCountsUpdated', {
            detail: { pendingCount, highPriorityCount, overdueCount }
        }));
    }

    // Export task data for reporting
    exportTasks(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.pendingTasks, null, 2);
        }
        
        if (format === 'csv') {
            const headers = ['ID', 'Type', 'Title', 'Submitter', 'Priority', 'Status', 'Due Date', 'Created Date'];
            const rows = this.pendingTasks.map(task => [
                task.id,
                task.type,
                task.title,
                task.submitter,
                task.priority,
                task.status,
                task.dueDate,
                task.createdDate
            ]);
            
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        
        return this.pendingTasks;
    }

    // Enhanced Firebase integration for real-time task creation
    async setupFirebaseMonitoring() {
        if (!this.auth.currentUser) {
            // Wait for authentication
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.setupFirebaseMonitoring();
                }
            });
            return;
        }

        // Monitor each submission path for new entries that need tasks
        this.monitoredPaths.forEach(({ path, type }) => {
            const pathRef = ref(this.db, path);
            
            const listener = onValue(pathRef, async (snapshot) => {
                if (snapshot.exists()) {
                    await this.processSubmissionData(snapshot.val(), type, path);
                }
            });
            
            this.firebaseListeners.set(path, listener);
        });
    }

    async processSubmissionData(data, submissionType, path) {
        for (const [id, item] of Object.entries(data)) {
            // Check if this submission needs a task and doesn't already have one
            if (await this.shouldCreateTask(item, submissionType, id)) {
                await this.createTaskFromSubmission(item, submissionType, id, path);
            }
        }
    }

    async shouldCreateTask(item, submissionType, submissionId) {
        // Don't create tasks for completed submissions
        if (this.isCompletedStatus(item.status)) {
            return false;
        }

        // Check if task already exists for this submission
        const existingTask = this.pendingTasks.find(task => 
            task.sourceId === submissionId && task.sourcePath === submissionType
        );
        
        if (existingTask) {
            return false;
        }

        // Check if current user should see this as a task (is approver)
        return await this.isCurrentUserApprover(item, submissionType);
    }

    async isCurrentUserApprover(item, submissionType) {
        try {
            const currentUser = this.auth.currentUser;
            if (!currentUser) return false;

            // Get approval flow for this submission type
            const flowSnapshot = await get(ref(this.db, `approvalFlows/${submissionType}`));
            if (!flowSnapshot.exists()) return false;

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            const isSequential = flow.approvalOrder === 'sequential';

            // Get current user data
            const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
            if (!userSnapshot.exists()) return false;

            const userData = userSnapshot.val();
            const userJobTitle = userData.jobTitle?.toLowerCase();

            // Check each approval level
            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                const levelNumber = parseInt(levelKey.replace('level', ''));
                
                // For sequential approval, check if it's this user's turn
                if (isSequential && levelNumber > 1) {
                    // Check if previous levels are completed
                    const previousLevelCompleted = item.approvals?.[`level${levelNumber - 1}`]?.isCompleted;
                    if (!previousLevelCompleted) {
                        continue; // Skip this level if previous not completed
                    }
                }

                // Check if current level is already completed
                if (item.approvals?.[levelKey]?.isCompleted) {
                    continue; // Skip completed levels
                }

                // Check if user is assigned to this level
                for (const role of roles) {
                    if (role.value === `user_${currentUser.uid}`) {
                        return true;
                    }
                    
                    if (role.value.startsWith('function_') && userJobTitle) {
                        const functionId = role.value.replace('function_', '').toLowerCase();
                        if (userJobTitle === functionId) {
                            return true;
                        }
                    }
                    
                    if (role.value.startsWith('L+')) {
                        // Check hierarchy (simplified for now)
                        const isInHierarchy = await this.checkUserInHierarchy(item, role.value, userData);
                        if (isInHierarchy) {
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

    async checkUserInHierarchy(item, levelValue, userData) {
        try {
            // Get the creator/submitter of the item
            const creatorId = item.createdBy || item.submittedBy || item.requesterId;
            if (!creatorId) return false;

            const creatorSnapshot = await get(ref(this.db, `users/${creatorId}`));
            if (!creatorSnapshot.exists()) return false;

            const creatorData = creatorSnapshot.val();
            
            // Check department match
            if (creatorData.department !== userData.department) {
                return false;
            }

            // For L+1, check if current user is the creator's line manager
            if (levelValue === 'L+1') {
                return creatorData.lineManager === this.auth.currentUser.uid;
            }

            // For other levels, implement organizational structure check
            // This would need organizational hierarchy data
            return false;
        } catch (error) {
            console.error('Error checking user hierarchy:', error);
            return false;
        }
    }

    async createTaskFromSubmission(item, submissionType, submissionId, sourcePath) {
        const task = {
            id: `TSK-${submissionType.toUpperCase()}-${Date.now()}`,
            type: submissionType,
            title: this.generateEnhancedTaskTitle(submissionType, item),
            submitter: await this.getSubmitterName(item),
            priority: this.determinePriorityFromSubmission(submissionType, item),
            status: 'pending',
            dueDate: this.calculateDueDateFromFlow(submissionType),
            createdDate: new Date().toISOString(),
            description: this.generateTaskDescription(submissionType, item),
            department: item.department?.label || item.department || this.getDepartmentForType(submissionType),
            assignedTo: await this.getCurrentUserName(),
            sourceId: submissionId,
            sourcePath: submissionType,
            originalSubmission: item,
            referenceNumber: item.referenceNumber || submissionId,
            urgency: this.calculateUrgency(submissionType, item),
            estimatedTime: this.getEstimatedApprovalTime(submissionType),
            tags: this.generateTaskTags(submissionType, item)
        };

        // Add to local storage and Firebase
        this.pendingTasks.unshift(task);
        this.savePendingTasks();
        
        // Save to Firebase tasks collection
        await this.saveTaskToFirebase(task);

        // Create enhanced notification
        this.createEnhancedNotification(task);
        
        return task;
    }    generateEnhancedTaskTitle(submissionType, item) {
        const titleMappings = {
            training: `Training Approval: ${item.trainingTitle || item.trainingType || 'Training Request'}`,
            access: `${item.purpose || 'Access Request'}`,
            incident: `Incident Review: ${item.incidentType || 'Safety Incident'} - ${item.location || 'Workplace'}`,
            inspection: `Inspection Approval: ${item.inspectionType || 'Safety Inspection'} - ${item.area || 'Facility'}`,
            removal: `Property Removal: ${item.itemDescription || 'Company Property'} - ${item.removalReason || 'Request'}`,
            risk: `Risk Assessment: ${item.assessmentTitle || item.riskType || 'Risk Assessment'}`,
            permit: `Work Permit: ${item.workType || 'Work Authorization'} - ${item.location || 'Site'}`,
            event: `Event Approval: ${item.eventTitle || item.eventType || 'Company Event'}`
        };

        return titleMappings[submissionType] || `${submissionType.charAt(0).toUpperCase() + submissionType.slice(1)} Approval Required`;
    }

    generateTaskDescription(submissionType, item) {
        const descriptions = {
            training: `Training request for ${item.requestorName || 'team member'} requires approval. Training: ${item.trainingTitle || item.trainingType}`,
            access: `Access request from ${item.requesterName || 'user'} for ${item.accessType || 'system access'}. Purpose: ${item.purpose || 'Business requirement'}`,
            incident: `Incident report requires review and approval. Type: ${item.incidentType || 'Safety incident'}, Location: ${item.location || 'Workplace'}`,
            inspection: `Inspection request requires approval. Type: ${item.inspectionType || 'Safety inspection'}, Area: ${item.area || 'Facility'}`,
            removal: `Property removal request for approval. Item: ${item.itemDescription || 'Company property'}, Reason: ${item.removalReason || 'Business requirement'}`,
            risk: `Risk assessment requires review and approval. Assessment: ${item.assessmentTitle || item.riskType || 'Risk assessment'}`,
            permit: `Work permit requires approval. Work type: ${item.workType || 'General work'}, Location: ${item.location || 'Site'}`,
            event: `Event approval required. Event: ${item.eventTitle || item.eventType || 'Company event'}, Date: ${item.eventDate || 'TBD'}`
        };

        return descriptions[submissionType] || `${submissionType} submission requires your approval and action.`;
    }    async getSubmitterName(item) {
        // For access requests, prioritize employee name if available
        if (item.employeeId) {
            try {
                const userSnapshot = await get(ref(this.db, `users/${item.employeeId}`));
                if (userSnapshot.exists()) {
                    const user = userSnapshot.val();
                    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
                }
            } catch (error) {
                console.error('Error getting employee name:', error);
            }
        }
        
        // For createdBy object structure (common in access requests)
        if (item.createdBy && typeof item.createdBy === 'object') {
            if (item.createdBy.displayName) return item.createdBy.displayName;
            if (item.createdBy.email) return item.createdBy.email;
        }
        
        // Standard user ID lookup
        const submitterId = item.createdBy?.uid || item.submittedBy || item.requesterId;
        if (submitterId) {
            try {
                const userSnapshot = await get(ref(this.db, `users/${submitterId}`));
                if (userSnapshot.exists()) {
                    const user = userSnapshot.val();
                    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
                }
            } catch (error) {
                console.error('Error getting submitter name:', error);
            }
        }

        // Fallbacks
        return item.requestorName || item.requesterName || item.submitter || 'Unknown User';
    }

    async getCurrentUserName() {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return 'Current User';

        try {
            const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
            if (userSnapshot.exists()) {
                const user = userSnapshot.val();
                return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Current User';
            }
        } catch (error) {
            console.error('Error getting current user name:', error);
        }

        return currentUser.email || 'Current User';
    }

    determinePriorityFromSubmission(submissionType, item) {
        // High priority types
        const highPriorityTypes = ['incident', 'permit'];
        
        // Check for urgent keywords in various fields
        const urgentKeywords = ['emergency', 'urgent', 'critical', 'immediate', 'asap', 'high priority'];
        const textFields = [
            item.description, 
            item.purpose, 
            item.comments, 
            item.notes,
            item.incidentType,
            item.riskLevel
        ].filter(Boolean).join(' ').toLowerCase();

        if (highPriorityTypes.includes(submissionType.toLowerCase())) {
            return 'high';
        }

        if (urgentKeywords.some(keyword => textFields.includes(keyword))) {
            return 'high';
        }

        // Check specific priority fields
        if (item.priority && ['high', 'urgent', 'critical'].includes(item.priority.toLowerCase())) {
            return 'high';
        }

        if (item.riskLevel && ['high', 'critical'].includes(item.riskLevel.toLowerCase())) {
            return 'high';
        }

        // Medium priority for certain types
        const mediumPriorityTypes = ['training', 'inspection', 'access'];
        if (mediumPriorityTypes.includes(submissionType.toLowerCase())) {
            return 'medium';
        }

        return 'low';
    }

    async calculateDueDateFromFlow(submissionType) {
        try {
            // Try to get due date from approval flow configuration
            const flowSnapshot = await get(ref(this.db, `approvalFlows/${submissionType}`));
            if (flowSnapshot.exists()) {
                const flow = flowSnapshot.val();
                if (flow.dueDays) {
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + flow.dueDays);
                    return dueDate.toISOString();
                }
            }
        } catch (error) {
            console.error('Error getting due date from flow:', error);
        }

        // Fallback to default calculation
        return this.calculateDueDate(submissionType);
    }

    calculateUrgency(submissionType, item) {
        const now = new Date();
        const dueDate = new Date(this.calculateDueDateFromFlow(submissionType));
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

        if (hoursUntilDue <= 24) return 'critical';
        if (hoursUntilDue <= 48) return 'high';
        if (hoursUntilDue <= 168) return 'medium'; // 1 week
        return 'low';
    }

    getEstimatedApprovalTime(submissionType) {
        const estimatedTimes = {
            training: '15 minutes',
            access: '10 minutes', 
            incident: '30 minutes',
            inspection: '20 minutes',
            removal: '10 minutes',
            risk: '45 minutes',
            permit: '25 minutes',
            event: '15 minutes'
        };

        return estimatedTimes[submissionType] || '15 minutes';
    }

    generateTaskTags(submissionType, item) {
        const tags = [submissionType];

        if (item.department) {
            tags.push(typeof item.department === 'object' ? item.department.label : item.department);
        }

        if (item.priority) {
            tags.push(item.priority);
        }

        if (item.location) {
            tags.push(item.location);
        }

        return tags;
    }

    async saveTaskToFirebase(task) {
        try {
            const tasksRef = ref(this.db, 'tasks');
            await push(tasksRef, task);
        } catch (error) {
            console.error('Error saving task to Firebase:', error);
        }
    }

    createEnhancedNotification(task) {
        if (window.notificationManager) {
            window.notificationManager.addNotification({
                type: 'Task Assignment',
                title: 'New Task Assigned',
                message: `${task.title} - Priority: ${task.priority.toUpperCase()}`,
                metadata: {
                    taskId: task.id,
                    taskType: task.type,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    estimatedTime: task.estimatedTime
                },
                link: `tasks.html?id=${task.id}`
            });
        }

        // Also add to submission notifications if available
        if (window.submissionNotificationManager) {
            window.submissionNotificationManager.refreshSubmissions();
        }
    }

    isCompletedStatus(status) {
        const completedStatuses = ['approved', 'completed', 'rejected', 'closed', 'cancelled'];
        return completedStatuses.includes(status?.toLowerCase());
    }    async loadExistingTasks() {
        try {
            // Load tasks from Firebase for current user only
            const tasksSnapshot = await get(ref(this.db, 'tasks'));
            if (tasksSnapshot.exists()) {
                const currentUserName = await this.getCurrentUserName();
                const firebaseTasks = Object.entries(tasksSnapshot.val())
                    .map(([firebaseId, task]) => ({ ...task, firebaseId }))
                    .filter(task => task.assignedTo === currentUserName);
                
                this.pendingTasks = firebaseTasks;
                this.deduplicateTasks();
            } else {
                this.pendingTasks = [];
            }
        } catch (error) {
            console.error('Error loading existing tasks:', error);
            this.pendingTasks = [];
        }
    }

    deduplicateTasks() {
        const seen = new Set();
        this.pendingTasks = this.pendingTasks.filter(task => {
            const key = `${task.sourceId}-${task.sourcePath}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Enhanced task status update with Firebase sync
    async updateTaskStatus(taskId, newStatus, comment = '') {
        const task = this.pendingTasks.find(t => t.id === taskId);
        if (task) {
            const oldStatus = task.status;
            task.status = newStatus;
            task.lastUpdated = new Date().toISOString();
            task.completedBy = await this.getCurrentUserName();
            
            if (comment) {
                task.comment = comment;
                task.approvalComment = comment;
            }

            // Update Firebase if task has Firebase ID
            if (task.firebaseId) {
                try {
                    await set(ref(this.db, `tasks/${task.firebaseId}`), task);
                } catch (error) {
                    console.error('Error updating task in Firebase:', error);
                }
            }

            this.savePendingTasks();
            this.notifyStatusChange(task, oldStatus, newStatus);
            
            // Update the original submission if applicable
            if (task.sourceId && task.sourcePath) {
                await this.updateOriginalSubmission(task, newStatus, comment);
            }
            
            return task;
        }
        return null;
    }    async updateOriginalSubmission(task, newStatus, comment) {
        try {
            const submissionRef = ref(this.db, `${task.sourcePath}/${task.sourceId}`);
            const updates = {};

            if (newStatus === 'approved') {
                // Find the current user's approval level and mark it as completed
                const flowSnapshot = await get(ref(this.db, `approvalFlows/${task.sourcePath}`));
                if (flowSnapshot.exists()) {
                    const flow = flowSnapshot.val();
                    const userLevel = await this.getUserApprovalLevel(task.originalSubmission, flow);
                    
                    if (userLevel) {
                        const levelNumber = parseInt(userLevel.replace('level', ''));
                        
                        // Update the specific approval level
                        updates[`approvals/${userLevel}/isCompleted`] = true;
                        updates[`approvals/${userLevel}/status`] = 'approved';
                        updates[`approvals/${userLevel}/approvedBy`] = this.auth.currentUser.uid;
                        updates[`approvals/${userLevel}/approvedAt`] = new Date().toISOString();
                        updates[`approvals/${userLevel}/approverName`] = this.auth.currentUser.displayName || this.auth.currentUser.email;
                        updates[`approvals/${userLevel}/comments`] = comment || '';
                        
                        // Update last modified information
                        updates.lastModified = new Date().toISOString();
                        updates.lastModifiedBy = this.auth.currentUser.uid;

                        // Check if all approval levels are now completed
                        const selectedRoles = flow.selectedRoles || {};
                        const totalLevels = Object.keys(selectedRoles).length;
                        let allLevelsApproved = true;

                        // Get current submission data to check other levels
                        const submissionSnapshot = await get(submissionRef);
                        const currentSubmission = submissionSnapshot.val();
                        
                        for (let i = 1; i <= totalLevels; i++) {
                            const levelKey = `level${i}`;
                            let levelApproval = i === levelNumber ? 
                                { isCompleted: true } :  // Current level being approved
                                currentSubmission.approvals?.[levelKey];
                            
                            if (!levelApproval?.isCompleted) {
                                allLevelsApproved = false;
                                break;
                            }
                        }

                        // If all levels are approved, mark the entire request as approved
                        if (allLevelsApproved) {
                            updates.status = 'approved';
                            updates.approvedAt = new Date().toISOString();
                            updates.fullyApprovedBy = this.auth.currentUser.uid;
                            
                            console.log(`Request ${task.sourceId} fully approved - all levels completed`);
                        } else {
                            console.log(`Request ${task.sourceId} partially approved - level ${levelNumber} completed`);
                        }
                    }
                }
            } else if (newStatus === 'rejected') {
                // Find the current user's approval level for rejection
                const flowSnapshot = await get(ref(this.db, `approvalFlows/${task.sourcePath}`));
                if (flowSnapshot.exists()) {
                    const flow = flowSnapshot.val();
                    const userLevel = await this.getUserApprovalLevel(task.originalSubmission, flow);
                    
                    if (userLevel) {
                        updates[`approvals/${userLevel}/isCompleted`] = true;
                        updates[`approvals/${userLevel}/status`] = 'rejected';
                        updates[`approvals/${userLevel}/rejectedBy`] = this.auth.currentUser.uid;
                        updates[`approvals/${userLevel}/rejectedAt`] = new Date().toISOString();
                        updates[`approvals/${userLevel}/comments`] = comment || '';
                    }
                }
                
                updates.status = 'rejected';
                updates.rejectedBy = this.auth.currentUser.uid;
                updates.rejectedAt = new Date().toISOString();
                updates.rejectionReason = comment || '';
                updates.lastModified = new Date().toISOString();
                updates.lastModifiedBy = this.auth.currentUser.uid;
            }

            if (Object.keys(updates).length > 0) {
                // Use update instead of set to preserve existing data
                const { update } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
                await update(submissionRef, updates);
                
                // Trigger UI refresh for access board if it's open
                if (task.sourcePath === 'access') {
                    this.notifyAccessBoardUpdate(task.sourceId);
                }
                
                console.log(`Original submission updated for task ${task.id}:`, updates);
            }
        } catch (error) {
            console.error('Error updating original submission:', error);
        }
    }

    async getUserApprovalLevel(submission, flow) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return null;

        const selectedRoles = flow.selectedRoles || {};
        const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
        const userData = userSnapshot.exists() ? userSnapshot.val() : {};
        const userJobTitle = userData.jobTitle?.toLowerCase();

        for (const [levelKey, roles] of Object.entries(selectedRoles)) {
            for (const role of roles) {
                if (role.value === `user_${currentUser.uid}` ||
                    (role.value.startsWith('function_') && userJobTitle === role.value.replace('function_', '').toLowerCase())) {
                    return levelKey;
                }
            }
        }

        return null;
    }

    // Enhanced notification with more details
    notifyStatusChange(task, oldStatus, newStatus) {
        if (window.notificationManager) {
            let message = `Task ${task.referenceNumber || task.id} ${newStatus}`;
            let notificationType = 'Task Update';

            if (newStatus === 'approved') {
                message = `${task.title} has been approved successfully`;
                notificationType = 'Approval Completed';
            } else if (newStatus === 'rejected') {
                message = `${task.title} has been rejected`;
                notificationType = 'Approval Rejected';
            }

            if (task.comment) {
                message += `. Comment: ${task.comment}`;
            }

            window.notificationManager.addNotification({
                type: notificationType,
                title: `Task ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
                message: message,
                metadata: {
                    taskId: task.id,
                    oldStatus,
                    newStatus,
                    taskType: task.type,
                    priority: task.priority
                },
                link: `tasks.html?id=${task.id}`
            });
        }
    }

    // Notify access board of updates for real-time synchronization
    notifyAccessBoardUpdate(requestId) {
        try {
            // Check if access board is loaded and listening
            if (window.accessBoard && typeof window.accessBoard.refreshModalIfOpen === 'function') {
                window.accessBoard.refreshModalIfOpen(requestId);
            }
            
            // Also trigger a custom event for the access board to listen to
            window.dispatchEvent(new CustomEvent('accessRequestUpdated', {
                detail: { requestId: requestId }
            }));
            
            console.log(`Notified access board of update for request ${requestId}`);
        } catch (error) {
            console.error('Error notifying access board:', error);
        }
    }

    // Enhanced dashboard integration
    getDashboardTasks(limit = 5) {
        return this.pendingTasks
            .filter(task => task.status === 'pending')
            .sort((a, b) => {
                // Sort by urgency, then priority, then due date
                const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                
                const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
                if (urgencyDiff !== 0) return urgencyDiff;
                
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                return new Date(a.dueDate) - new Date(b.dueDate);
            })
            .slice(0, limit);
    }

    // Enhanced task count methods
    getPendingTaskCount() {
        return this.pendingTasks.filter(task => task.status === 'pending').length;
    }

    getHighPriorityTaskCount() {
        return this.pendingTasks.filter(task => 
            task.status === 'pending' && (task.priority === 'high' || task.urgency === 'critical')
        ).length;
    }

    getOverdueTaskCount() {
        const now = new Date();
        return this.pendingTasks.filter(task => 
            task.status === 'pending' && new Date(task.dueDate) < now
        ).length;
    }

    getCriticalTaskCount() {
        return this.pendingTasks.filter(task => 
            task.status === 'pending' && task.urgency === 'critical'
        ).length;
    }

    // Cleanup method for Firebase listeners
    cleanup() {
        this.firebaseListeners.forEach((listener, path) => {
            off(ref(this.db, path), 'value', listener);
        });
        this.firebaseListeners.clear();
    }}

// Initialize task integration manager
const taskIntegrationManager = new TaskIntegrationManager();

// Export for use in other modules
window.taskIntegrationManager = taskIntegrationManager;

// Helper functions for easy integration
window.submitTaskForm = function(formType, formData) {
    return taskIntegrationManager.onFormSubmit(formType, formData);
};

window.approveTask = function(taskId, comment = '') {
    return taskIntegrationManager.onApprovalAction(taskId, 'approve', comment);
};

window.rejectTask = function(taskId, comment = '') {
    return taskIntegrationManager.onApprovalAction(taskId, 'reject', comment);
};

export { TaskIntegrationManager, taskIntegrationManager };
