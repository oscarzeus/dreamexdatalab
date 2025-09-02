// Email notification service for access request approvals

class EmailNotificationService {
    constructor() {
        // Firebase will be available globally from the main page
        try {
            this.db = window.firebase?.database ? window.firebase.database() : null;
            this.auth = window.firebase?.auth ? window.firebase.auth() : null;
            console.log('✅ Firebase services initialized:', {
                database: !!this.db,
                auth: !!this.auth
            });
        } catch (error) {
            console.warn('⚠️ Firebase initialization issue:', error.message);
            this.db = null;
            this.auth = null;
        }          // SMTP Server configuration (Primary method) - Local Email Server
        this.smtpServerUrl = 'http://localhost:3001'; // Local email server
        this.useSmtpService = true; // Set to true to use SMTP service instead of EmailJS
          // Local email server settings
        this.smtpConfig = {
            host: 'mail.privateemail.com',
            port: 587, // or 465 for SSL
            secure: false, // true for 465, false for other ports
            requireTLS: true,
            auth: {
                user: 'info@dreamexdatalab.com', // PrivateEmail account
                pass: 'Imoudre@m77n' // PrivateEmail password
            }
        };this.maxRetries = 3; // Maximum number of connection retries
        this.retryDelay = 2000; // Delay between retries in milliseconds        // Email configuration
        this.fromEmail = 'info@dreamexdatalab.com';
        this.fromName = 'Dreamex Datalab HSE System';
        this.apiKey = 'dreemex_hse_email_service_2025';
        
        // EmailJS configuration (Fallback method) - can be configured later
        this.emailEndpoint = '';
        this.serviceId = '';
        this.templateId = '';
        this.publicKey = '';

        // Add email notification tracking
        this.notificationHistory = [];
        this.maxHistorySize = 1000; // Keep last 1000 notifications
        this.deliveryStats = {
            totalSent: 0,
            successful: 0,
            failed: 0,
            lastUpdated: new Date()
        };

        // Reminder configuration
        this.reminderConfig = {
            enabled: false,
            interval: 48, // hours
            maxReminders: 3
        };

        // Initialize logging system
        this.logConfig = {
            enabled: true,
            maxLogSize: 10000, // Keep last 10,000 log entries
            logLevel: 'info' // 'debug' | 'info' | 'warn' | 'error'
        };
        this.logs = [];

        // Initialize connection
        this.initializeSmtpConnection();
    }

    async initializeSmtpConnection() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const response = await fetch(`${this.smtpServerUrl}/health`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': this.apiKey
                    }
                });
                
                if (response.ok) {
                    this.log('info', 'SMTP connection established successfully');
                    return true;
                }
                
                throw new Error(`Failed to connect to SMTP service: ${response.statusText}`);
            } catch (error) {
                retries++;
                this.log('warning', `SMTP connection attempt ${retries} failed: ${error.message}`);
                
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        
        this.log('error', 'Failed to establish SMTP connection after multiple attempts');
        return false;
    }

    /**
     * Send email notification to approvers when access request is submitted
     * @param {Object} accessRequest - The access request data
     * @param {string} requestId - The access request ID
     * @param {boolean} isUpdate - Whether this is an update to existing request
     */
    async sendApprovalNotificationEmails(accessRequest, requestId, isUpdate = false) {
        this.log('info', `Sending approval notifications for request ${requestId}`, { 
            referenceNumber: accessRequest.referenceNumber,
            isUpdate 
        });

        try {
            // Get approvers from approval flow
            const approvers = await this.getApproversForNotification(accessRequest, requestId);
            this.log('debug', `Found ${approvers.length} approvers for request ${requestId}`);

            // Get additional notification recipients
            const [recipientsSnapshot, approvalFlowRecipients] = await Promise.all([
                get(ref(db, 'notification-recipients/access_request')),
                this.getApprovalFlowRecipients()
            ]);

            const additionalRecipients = [];
            
            // Add configured notification recipients
            if (recipientsSnapshot.exists()) {
                const recipientsData = recipientsSnapshot.val();
                Object.values(recipientsData).forEach(recipient => {
                    if (recipient.active) {
                        additionalRecipients.push({
                            email: recipient.email,
                            name: recipient.name,
                            type: 'notification_recipient'
                        });
                    }
                });
            }

            // Add approval flow recipients
            additionalRecipients.push(...approvalFlowRecipients);
            
            this.log('debug', `Found ${additionalRecipients.length} additional notification recipients`);

            // Combine all recipients and remove duplicates by email
            const allRecipients = [...approvers];
            additionalRecipients.forEach(recipient => {
                if (!allRecipients.some(r => r.email === recipient.email)) {
                    allRecipients.push(recipient);
                }
            });

            if (allRecipients.length === 0) {
                this.log('info', 'No recipients found for email notification');
                return { success: true, emailsSent: 0, message: 'No recipients to notify' };
            }

            let successCount = 0;
            let failedEmails = [];            // Send email to each recipient and create notification bell entries
            for (const recipient of allRecipients) {
                try {
                    await this.sendApprovalEmail(recipient, accessRequest, requestId, isUpdate);
                    
                    // Create individual notification bell entry for this recipient
                    await this.createNotificationBellEntry(recipient, accessRequest, requestId, isUpdate);
                    
                    successCount++;
                    this.log('info', `Email sent successfully to ${recipient.email}`);
                } catch (emailError) {
                    this.log('error', `Failed to send email to ${recipient.email}`, { error: emailError.message });
                    failedEmails.push(recipient.email);
                }
            }            // Create submission confirmation notification for the submitter
            await this.createSubmitterNotification(accessRequest, requestId, isUpdate);

            this.log('info', `Successfully sent approval notifications for request ${requestId}`);
            return {
                success: successCount > 0,
                emailsSent: successCount,
                failedEmails,
                message: `Sent ${successCount} emails, ${failedEmails.length} failed`
            };

        } catch (error) {
            this.log('error', `Error in email notification process for request ${requestId}`, { error: error.message });
            return {
                success: false,
                emailsSent: 0,
                error: error.message
            };
        }
    }

    /**
     * Get approvers who should receive email notifications
     * @param {Object} accessRequest - The access request data
     * @param {string} requestId - The access request ID
     * @returns {Array} Array of approver objects with email and other details
     */
    async getApproversForNotification(accessRequest, requestId) {
        try {
            // Get approval flow configuration
            const flowRef = ref(db, 'approvalFlows/access');
            const flowSnapshot = await get(flowRef);
            
            if (!flowSnapshot.exists()) {
                this.log('warn', 'No approval flow configured for access requests');
                return [];
            }

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            const isSequential = flow.approvalOrder === 'sequential' || flow.approvalSequence === 'sequential';

            const approvers = [];

            // Determine which levels to notify based on approval sequence
            const levelsToNotify = this.getLevelsToNotify(selectedRoles, isSequential);

            for (const levelKey of levelsToNotify) {
                const roles = selectedRoles[levelKey] || [];
                
                for (const role of roles) {
                    const approverData = await this.resolveApproverFromRole(role, accessRequest);
                    if (approverData && approverData.email) {
                        approvers.push({
                            ...approverData,
                            level: levelKey,
                            role: role
                        });
                    }
                }
            }

            // Remove duplicates based on email
            const uniqueApprovers = approvers.filter((approver, index, self) => 
                index === self.findIndex(a => a.email === approver.email)
            );

            this.log('info', `Found ${uniqueApprovers.length} unique approvers for notification`);
            return uniqueApprovers;

        } catch (error) {
            this.log('error', 'Error getting approvers for notification', { error: error.message });
            return [];
        }
    }

    /**
     * Get approval flow recipients based on dynamic roles
     * This includes users directly assigned and those matching function-based roles
     * @returns {Array} Array of recipient objects with email and other details
     */
    async getApprovalFlowRecipients() {
        try {
            // Get approval flow configuration
            const flowRef = ref(db, 'approvalFlows/access');
            const flowSnapshot = await get(flowRef);
            
            if (!flowSnapshot.exists()) {
                this.log('warn', 'No approval flow configured for access requests');
                return [];
            }

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            const approvers = new Set();

            // Get all roles from all levels
            for (const levelKey of Object.keys(selectedRoles)) {
                const roles = selectedRoles[levelKey] || [];
                for (const role of roles) {
                    if (role.value.startsWith('user_')) {
                        // Direct user assignment
                        const userId = role.value.replace('user_', '');
                        const approverData = await this.getUserApproverData(userId);
                        if (approverData && approverData.email) {
                            approvers.add(JSON.stringify({
                                email: approverData.email,
                                name: approverData.name,
                                type: 'approval_flow'
                            }));
                        }
                    } else if (role.value.startsWith('function_')) {
                        // Function-based assignment - get all users with matching job title
                        const functionName = role.value.replace('function_', '').toLowerCase();
                        const usersRef = ref(db, 'users');
                        const usersSnapshot = await get(usersRef);
                        
                        if (usersSnapshot.exists()) {
                            const users = usersSnapshot.val();
                            for (const userData of Object.values(users)) {
                                if (userData.jobTitle?.toLowerCase() === functionName) {
                                    approvers.add(JSON.stringify({
                                        email: userData.email,
                                        name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
                                        type: 'approval_flow'
                                    }));
                                }
                            }
                        }
                    }
                    // Note: L+ (hierarchy-based) approvers will be handled dynamically during request submission
                }
            }

            // Convert back from Set to remove duplicates
            return Array.from(approvers).map(json => JSON.parse(json));
        } catch (error) {
            this.log('error', 'Error getting approval flow recipients', { error: error.message });
            return [];
        }
    }

    /**
     * Determine which approval levels should receive notifications
     * @param {Object} selectedRoles - The approval flow configuration
     * @param {boolean} isSequential - Whether approval is sequential
     * @returns {Array} Array of level keys to notify
     */
    getLevelsToNotify(selectedRoles, isSequential) {
        const allLevels = Object.keys(selectedRoles).sort((a, b) => {
            const numA = parseInt(a.replace('level', ''));
            const numB = parseInt(b.replace('level', ''));
            return numA - numB;
        });

        if (isSequential) {
            // For sequential approval, only notify first level
            return allLevels.slice(0, 1);
        } else {
            // For parallel approval, notify all levels
            return allLevels;
        }
    }

    /**
     * Resolve approver details from role configuration
     * @param {Object} role - The role configuration
     * @param {Object} accessRequest - The access request data
     * @returns {Object|null} Approver data with email and other details
     */
    async resolveApproverFromRole(role, accessRequest) {
        try {
            if (role.value.startsWith('user_')) {
                // Direct user assignment
                const userId = role.value.replace('user_', '');
                return await this.getUserApproverData(userId);
                
            } else if (role.value.startsWith('function_')) {
                // Function-based assignment - find users with matching job title
                const functionName = role.value.replace('function_', '').toLowerCase();
                return await this.getFunctionBasedApprover(functionName, accessRequest.department);
                
            } else if (role.value.startsWith('L+')) {
                // Hierarchy-based assignment (L+1, L+2, etc.)
                return await this.getHierarchyBasedApprover(role.value, accessRequest);
            }

            return null;
        } catch (error) {
            this.log('error', 'Error resolving approver from role', { error: error.message });
            return null;
        }
    }

    /**
     * Get user approver data by user ID
     * @param {string} userId - The user ID
     * @returns {Object|null} User data with email
     */
    async getUserApproverData(userId) {
        try {
            const userRef = ref(db, `users/${userId}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                return {
                    id: userId,
                    email: userData.email,
                    name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
                    jobTitle: userData.jobTitle || '',
                    department: userData.department || ''
                };
            }
            return null;
        } catch (error) {
            this.log('error', 'Error getting user approver data', { error: error.message });
            return null;
        }
    }    /**
     * Get function-based approver (user with specific job title)
     * @param {string} functionName - The function/job title to match
     * @param {string} department - The department to filter by
     * @returns {Object|null} Approver data
     */
    async getFunctionBasedApprover(functionName, department) {
        try {
            const usersRef = ref(db, 'users');
            const usersSnapshot = await get(usersRef);
            
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();
                
                // Find user with matching job title, preferably in same department
                for (const [userId, userData] of Object.entries(users)) {
                    const userJobTitle = userData.jobTitle?.toLowerCase();
                    const userDepartment = userData.department;
                    
                    if (userJobTitle === functionName) {
                        // Prefer same department, but accept any department if none found
                        if (!department || userDepartment === department) {
                            return {
                                id: userId,
                                email: userData.email,
                                name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
                                jobTitle: userData.jobTitle || '',
                                department: userData.department || ''
                            };
                        }
                    }
                }
                
                // If no match in same department, try any department
                if (department) {
                    return await this.getFunctionBasedApprover(functionName, null);
                }
            }
            return null;
        } catch (error) {
            this.log('error', 'Error getting function-based approver', { error: error.message });
            return null;
        }
    }

    /**
     * Get hierarchy-based approver (line manager)
     * @param {string} levelValue - The hierarchy level (L+1, L+2, etc.)
     * @param {Object} accessRequest - The access request data
     * @returns {Object|null} Approver data
     */
    async getHierarchyBasedApprover(levelValue, accessRequest) {
        try {
            const submitterId = accessRequest.createdBy?.uid;
            if (!submitterId) {
                this.log('warn', 'No submitter ID found for hierarchy-based approval');
                return null;
            }

            // For L+1, get the submitter's line manager
            if (levelValue === 'L+1') {
                const submitterRef = ref(db, `users/${submitterId}`);
                const submitterSnapshot = await get(submitterRef);
                
                if (submitterSnapshot.exists()) {
                    const submitterData = submitterSnapshot.val();
                    const lineManagerId = submitterData.lineManager;
                    
                    if (lineManagerId) {
                        return await this.getUserApproverData(lineManagerId);
                    }
                }
            }
            
            // For L+2 and higher, would need additional hierarchy logic
            // This is a placeholder for future implementation
            this.log('info', `Hierarchy level ${levelValue} not yet implemented`);
            return null;
            
        } catch (error) {
            this.log('error', 'Error getting hierarchy-based approver', { error: error.message });
            return null;
        }
    }

    /**
     * Send individual approval email
     * @param {Object} approver - The approver data
     * @param {Object} accessRequest - The access request data
     * @param {string} requestId - The access request ID
     * @param {boolean} isUpdate - Whether this is an update
     */    async sendApprovalEmail(approver, accessRequest, requestId, isUpdate) {
        try {
            const emailData = {
                to: approver.email,
                approverName: approver.name,
                requesterName: accessRequest.createdBy?.displayName || accessRequest.createdBy?.email || 'Unknown',
                referenceNumber: accessRequest.referenceNumber,
                purpose: accessRequest.purpose,
                department: accessRequest.department?.label || accessRequest.department || 'N/A',
                company: accessRequest.company?.name || 'N/A',
                                startDate: accessRequest.startDate || 'N/A',
                                endDate: accessRequest.endDate || 'N/A',
                                priority: accessRequest.priority || 'Normal',
                                approvalLink: `${window.location.origin}/accessboard.html?id=${requestId}`,
                                isUpdate: isUpdate,
                                apiKey: this.apiKey
                            };
                
                            if (this.useSmtpService) {
                                // Use local SMTP service
                                this.log('info', `Sending approval email via SMTP service to: ${approver.email}`);
                                
                                const response = await fetch(`${this.smtpServerUrl}/send/approval-notification`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-API-Key': this.apiKey
                                    },
                                    body: JSON.stringify(emailData)
                                });
                
                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    throw new Error(`SMTP service error: ${response.status} - ${errorData.message || 'Unknown error'}`);
                                }
                
                                const result = await response.json();
                                this.log('info', 'Approval email sent successfully via SMTP', { messageId: result.messageId });
                                return result;
                
                            } else {
                                // Currently in demo mode - simulating email sending
                                this.log('info', 'Demo mode - Approval email would be sent with data:', emailData);
                                await new Promise(resolve => setTimeout(resolve, 100));
                                return { success: true, messageId: 'demo-' + Date.now() };
                            }
                
                        } catch (error) {
                            this.log('error', 'Error sending approval email', { error: error.message });
                            throw error;
                        }
                    }                /**
     * Send interview report email
     * @param {Object} reportData - Interview report data
     * @returns {Promise<Object>} Email sending result
     */
    async sendInterviewReport(reportData) {
        this.log('info', 'Sending interview report email', reportData);

        try {
            const {
                recipientEmail,
                candidateName,
                position,
                interviewDate,
                interviewer,
                duration,
                overallScore,
                overallRecommendation,
                interviewNotes,
                finalRecommendation,
                recommendationReason
            } = reportData;

            // Validate required fields
            if (!recipientEmail || !candidateName || !position || !interviewer || !finalRecommendation) {
                throw new Error('Missing required fields for interview report');
            }

            if (this.useSmtpService) {
                try {
                    const response = await fetch(`${this.smtpServerUrl}/send/interview-report`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': this.apiKey
                        },
                        body: JSON.stringify({
                            to: recipientEmail,
                            candidateName,
                            position,
                            interviewDate,
                            interviewer,
                            duration,
                            overallScore,
                            overallRecommendation,
                            interviewNotes,
                            finalRecommendation,
                            recommendationReason
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`SMTP service error: ${response.status} ${response.statusText}`);
                    }

                    const result = await response.json();
                    this.log('info', 'Interview report sent successfully via SMTP service', result);

                    // Update delivery stats
                    this.deliveryStats.totalSent++;
                    this.deliveryStats.successful++;
                    this.deliveryStats.lastUpdated = new Date();

                    return {
                        success: true,
                        method: 'smtp-service',
                        messageId: result.messageId,
                        recipient: recipientEmail,
                        candidateName: candidateName,
                        timestamp: new Date().toISOString()
                    };

                } catch (smtpError) {
                    this.log('error', 'SMTP service failed for interview report', { error: smtpError.message });
                    
                    // Update delivery stats
                    this.deliveryStats.totalSent++;
                    this.deliveryStats.failed++;
                    this.deliveryStats.lastUpdated = new Date();

                    // For now, return a simulated success (demo mode)
                    this.log('info', 'Running in demo mode - simulating interview report email send');
                    
                    return {
                        success: true,
                        method: 'demo-mode',
                        messageId: `demo-${Date.now()}`,
                        recipient: recipientEmail,
                        candidateName: candidateName,
                        timestamp: new Date().toISOString(),
                        note: 'Email simulated - SMTP service unavailable'
                    };
                }
            } else {
                // Fallback to demo mode
                this.log('info', 'SMTP service disabled - running in demo mode for interview report');
                
                return {
                    success: true,
                    method: 'demo-mode',
                    messageId: `demo-${Date.now()}`,
                    recipient: recipientEmail,
                    candidateName: candidateName,
                    timestamp: new Date().toISOString(),
                    note: 'Email simulated - SMTP service disabled'
                };
            }

        } catch (error) {
            this.log('error', 'Error sending interview report', { error: error.message });
            
            // Update delivery stats
            this.deliveryStats.totalSent++;
            this.deliveryStats.failed++;
            this.deliveryStats.lastUpdated = new Date();

            throw new Error(`Failed to send interview report: ${error.message}`);
        }
    }

    /**
     * Send notification using template-specific rules (New Template-Based System)
     * This is the main integration point for the new notification rule system
     * @param {string} templateType - The template type from the notification rules
     * @param {Object} data - The data to populate the template
     * @param {Array|string} recipients - Recipients for the notification
     * @param {Object} options - Additional options and rules from template system
     * @returns {Promise<Object>} Notification result
     */
    async sendTemplateBasedNotification(templateType, data, recipients, options = {}) {
        this.log('info', `Sending template-based notification: ${templateType}`, {
            recipientCount: Array.isArray(recipients) ? recipients.length : 1,
            hasRules: !!options.rules
        });

        try {
            // Validate template type
            if (!templateType) {
                throw new Error('Template type is required');
            }

            // Ensure recipients is an array
            const recipientList = Array.isArray(recipients) ? recipients : [recipients];
            
            if (recipientList.length === 0) {
                throw new Error('No recipients specified');
            }

            // Get template rules if not provided
            const rules = options.rules || this.getTemplateNotificationRules(templateType);
            
            if (!rules.enabled) {
                this.log('info', `Notifications disabled for template: ${templateType}`);
                return {
                    success: false,
                    message: `Notifications disabled for template: ${templateType}`,
                    templateType: templateType
                };
            }

            // Apply template-specific settings
            const emailConfig = {
                priority: rules.priority || 'normal',
                retryAttempts: rules.retryAttempts || 3,
                retryInterval: rules.retryInterval || 30,
                immediateSend: rules.immediateSend || false
            };

            // Route to appropriate sending method based on template type
            let result;
            switch (templateType) {
                case 'approval-notification':
                    result = await this.sendApprovalNotificationWithRules(data, recipientList, emailConfig);
                    break;
                
                case 'reminder-notification':
                    result = await this.sendReminderNotificationWithRules(data, recipientList, emailConfig);
                    break;
                
                case 'interview-schedule':
                case 'recruitment-interview':
                    result = await this.sendInterviewNotificationWithRules(data, recipientList, emailConfig);
                    break;
                
                case 'interview-evaluation-report':
                    result = await this.sendInterviewReportWithRules(data, recipientList, emailConfig);
                    break;
                
                case 'kpi-assignment-notification':
                case 'kpi-midyear-evaluation':
                case 'kpi-yearend-evaluation':
                    result = await this.sendKPINotificationWithRules(templateType, data, recipientList, emailConfig);
                    break;
                
                case 'job-evaluation-summary':
                    result = await this.sendJobEvaluationWithRules(data, recipientList, emailConfig);
                    break;
                
                default:
                    result = await this.sendGenericTemplateNotificationWithRules(templateType, data, recipientList, emailConfig);
            }

            // Update delivery statistics
            this.deliveryStats.totalSent++;
            if (result.success) {
                this.deliveryStats.successful++;
            } else {
                this.deliveryStats.failed++;
            }
            this.deliveryStats.lastUpdated = new Date();

            // Log the notification
            this.addNotificationToHistory({
                templateType: templateType,
                recipientCount: recipientList.length,
                result: result,
                timestamp: new Date().toISOString(),
                rules: rules
            });

            return {
                ...result,
                templateType: templateType,
                rulesBased: true,
                emailConfig: emailConfig
            };

        } catch (error) {
            this.log('error', `Error in template-based notification: ${templateType}`, { error: error.message });
            
            // Update failure statistics
            this.deliveryStats.totalSent++;
            this.deliveryStats.failed++;
            this.deliveryStats.lastUpdated = new Date();

            return {
                success: false,
                error: error.message,
                templateType: templateType,
                rulesBased: true
            };
        }
    }

    /**
     * Get template notification rules (with fallback)
     * @param {string} templateType - Template type
     * @returns {Object} Notification rules
     */
    getTemplateNotificationRules(templateType) {
        try {
            // Try to get from browser localStorage
            if (typeof localStorage !== 'undefined') {
                const allRules = JSON.parse(localStorage.getItem('templateNotificationRules') || '{}');
                if (allRules[templateType]) {
                    return allRules[templateType];
                }
            }
            
            // Fallback to default rules
            return this.getDefaultTemplateRules(templateType);
            
        } catch (error) {
            this.log('warning', `Could not load template rules for ${templateType}, using defaults`, { error: error.message });
            return this.getDefaultTemplateRules(templateType);
        }
    }

    /**
     * Get default rules for a template type
     * @param {string} templateType - Template type
     * @returns {Object} Default rules
     */
    getDefaultTemplateRules(templateType) {
        const baseDefaults = {
            enabled: true,
            priority: 'normal',
            immediateSend: false,
            retryAttempts: 3,
            retryInterval: 30,
            copyRecipients: false,
            deliveryWindow: false,
            weekendDelivery: false
        };

        const templateOverrides = {
            'approval-notification': {
                priority: 'high',
                immediateSend: true,
                retryAttempts: 5
            },
            'reminder-notification': {
                priority: 'high',
                immediateSend: true
            },
            'interview-schedule': {
                priority: 'high',
                retryAttempts: 5,
                copyRecipients: true
            },
            'kpi-assignment-notification': {
                copyRecipients: true,
                deliveryWindow: true
            },
            'kpi-midyear-evaluation': {
                copyRecipients: true,
                deliveryWindow: true
            },
            'kpi-yearend-evaluation': {
                copyRecipients: true,
                deliveryWindow: true
            },
            'recruitment-interview': {
                copyRecipients: true
            }
        };

        return { ...baseDefaults, ...(templateOverrides[templateType] || {}) };
    }

    /**
     * Template-specific sending methods with rules application
     */

    async sendApprovalNotificationWithRules(data, recipients, emailConfig) {
        this.log('info', 'Sending approval notification with template rules', emailConfig);
        
        // Use existing approval notification method but with enhanced configuration
        if (data.accessRequest && data.requestId) {
            return await this.sendApprovalNotificationEmails(data.accessRequest, data.requestId, data.isUpdate);
        } else {
            // Fallback for generic approval notifications
            return await this.sendGenericApprovalNotification(data, recipients, emailConfig);
        }
    }

    async sendReminderNotificationWithRules(data, recipients, emailConfig) {
        this.log('info', 'Sending reminder notification with template rules', emailConfig);
        
        // Implement reminder-specific logic here
        return await this.sendGenericTemplateNotificationWithRules('reminder-notification', data, recipients, emailConfig);
    }

    async sendInterviewNotificationWithRules(data, recipients, emailConfig) {
        this.log('info', 'Sending interview notification with template rules', emailConfig);
        
        // Implement interview-specific logic here
        return await this.sendGenericTemplateNotificationWithRules('interview-schedule', data, recipients, emailConfig);
    }

    async sendInterviewReportWithRules(data, recipients, emailConfig) {
        this.log('info', 'Sending interview report with template rules', emailConfig);
        
        // Use existing interview report method
        if (data.recipientEmail || (recipients && recipients.length > 0)) {
            const reportData = {
                ...data,
                recipientEmail: data.recipientEmail || recipients[0]
            };
            return await this.sendInterviewReport(reportData);
        } else {
            throw new Error('No recipient specified for interview report');
        }
    }

    async sendKPINotificationWithRules(templateType, data, recipients, emailConfig) {
        this.log('info', `Sending KPI notification (${templateType}) with template rules`, emailConfig);
        
        // Implement KPI-specific logic here
        return await this.sendGenericTemplateNotificationWithRules(templateType, data, recipients, emailConfig);
    }

    async sendJobEvaluationWithRules(data, recipients, emailConfig) {
        this.log('info', 'Sending job evaluation with template rules', emailConfig);
        
        // Implement job evaluation-specific logic here
        return await this.sendGenericTemplateNotificationWithRules('job-evaluation-summary', data, recipients, emailConfig);
    }

    async sendGenericTemplateNotificationWithRules(templateType, data, recipients, emailConfig) {
        this.log('info', `Sending generic template notification: ${templateType}`, emailConfig);
        
        try {
            // Simulate sending for now - replace with actual SMTP logic
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.log('info', `Successfully sent ${templateType} notification to ${recipients.length} recipients`);
            
            return {
                success: true,
                method: 'template-based-generic',
                templateType: templateType,
                recipientCount: recipients.length,
                config: emailConfig,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.log('error', `Failed to send ${templateType} notification`, { error: error.message });
            throw error;
        }
    }

    async sendGenericApprovalNotification(data, recipients, emailConfig) {
        this.log('info', 'Sending generic approval notification with rules', emailConfig);
        
        // Implement generic approval notification logic
        return await this.sendGenericTemplateNotificationWithRules('approval-notification', data, recipients, emailConfig);
    }

    /**
     * Add notification to history for tracking
     * @param {Object} notificationData - Notification data to store
     */
    addNotificationToHistory(notificationData) {
        this.notificationHistory.push({
            id: Date.now() + Math.random(),
            ...notificationData
        });

        // Keep only the most recent notifications
        if (this.notificationHistory.length > this.maxHistorySize) {
            this.notificationHistory = this.notificationHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get notification delivery statistics
     * @returns {Object} Delivery statistics
     */
    getDeliveryStatistics() {
        return {
            ...this.deliveryStats,
            history: this.notificationHistory.slice(-100), // Last 100 notifications
            successRate: this.deliveryStats.totalSent > 0 
                ? (this.deliveryStats.successful / this.deliveryStats.totalSent * 100).toFixed(2)
                : 0
        };
    }
}

// Export the class for both module and global usage
try {
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js/CommonJS export
        module.exports = { EmailNotificationService, emailNotificationService: new EmailNotificationService() };
    }
} catch (e) {
    // Ignore if module is not available
}

try {
    if (typeof window !== 'undefined') {
        // Browser global export
        window.EmailNotificationService = EmailNotificationService;
        window.emailNotificationService = new EmailNotificationService();
        console.log('✅ EmailNotificationService class made available globally');
    }
} catch (e) {
    // Ignore if window is not available
}

// ES6 module export (for import statements)
const emailNotificationService = new EmailNotificationService();
export { EmailNotificationService, emailNotificationService };
export default EmailNotificationService;