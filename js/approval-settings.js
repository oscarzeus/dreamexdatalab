import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class ApprovalSettings {
    constructor() {
        this.db = getDatabase();
        this.auth = getAuth();
        this.users = [];
        this.jobTitles = [];
        this.selectedRoles = {};
        this.currentUser = null;
        this.companyId = null;
        this.currentProcessType = null;
        
        // Real-time listeners for cleanup
        this.approvalFlowListener = null;
        this.usersListener = null;
        this.jobTitlesListener = null;
        
        // Get DOM elements
        this.processTypeSelect = document.getElementById('processType');
        this.approvalLevelsContainer = document.getElementById('approvalLevels'); // Changed to the correct container
        this.addApprovalLevelBtn = document.getElementById('addApprovalLevel');
        this.saveApprovalFlowBtn = document.getElementById('saveApprovalFlow');
        
        // Debug: Check if elements are found
        console.log('DOM Elements Found:', {
            processTypeSelect: !!this.processTypeSelect,
            approvalLevelsContainer: !!this.approvalLevelsContainer,
            addApprovalLevelBtn: !!this.addApprovalLevelBtn,
            saveApprovalFlowBtn: !!this.saveApprovalFlowBtn
        });
        
        // Initialize
        this.initializeUserAndCompany();
    }
    
    async initializeUserAndCompany() {
        // Get current user from localStorage or auth manager
        this.currentUser = this.getCurrentUser();
        
        if (!this.currentUser || !this.currentUser.companyId) {
            console.error('No authenticated user or company found');
            return;
        }
        
        this.companyId = this.currentUser.companyId;
        console.log('Initializing approval settings for company:', this.companyId);
        
        // Now load the rest of the data
        this.loadCompanyUsers();
        this.loadJobTitlesFromConfig();
        this.initEventListeners();
        this.loadApprovalFlow();
    }
    
    getCurrentUser() {
        // First try to get from window.authManager
        if (window.authManager && window.authManager.currentUser) {
            return window.authManager.currentUser;
        }
        
        // Fallback to localStorage
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
    
    loadCompanyUsers() {
        // Remove any existing listener
        if (this.usersListener) {
            this.usersListener();
        }
        
        // Load users from the company's user collection
        const companyUsersRef = ref(this.db, `companies/${this.companyId}/users`);
        this.usersListener = onValue(companyUsersRef, (snapshot) => {
            this.users = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const user = childSnapshot.val();
                    if (user.email && user.status === 'active') {
                        this.users.push({
                            id: childSnapshot.key,
                            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                            email: user.email,
                            jobTitle: user.jobTitle || '',
                            department: user.department || '',
                            designation: user.designation || '',
                            role: user.role || 'employee'
                        });
                    }
                });
            }
            
            // Sort users by name
            this.users.sort((a, b) => a.name.localeCompare(b.name));
            
            // Refresh dropdowns if already initialized
            this.refreshApproverDropdowns();
            
            console.log(`Loaded ${this.users.length} active users for company ${this.companyId}`);
        });
    }
    
    refreshApproverDropdowns() {
        // Refresh all existing approver dropdowns with updated user data
        const approvalLevels = this.approvalLevelsContainer.querySelectorAll('.approval-level');
        approvalLevels.forEach(level => {
            this.updateApproverRoleDropdown(level);
        });
    }
    
    loadJobTitlesFromConfig() {
        // Clean up existing listener
        if (this.jobTitlesListener) {
            this.jobTitlesListener();
        }
        
        // Load job titles from company configuration with real-time listener
        const jobTitlesRef = ref(this.db, `companies/${this.companyId}/configuration/jobTitles`);
        this.jobTitlesListener = onValue(jobTitlesRef, (snapshot) => {
            this.jobTitles = [];
            if (snapshot.exists()) {
                const titles = snapshot.val();
                Object.entries(titles).forEach(([key, title]) => {
                    if (title.enabled !== false) {
                        this.jobTitles.push({
                            id: key,
                            name: title.label || title.value || key,
                            value: title.value || key
                        });
                    }
                });
            } else {
                // Create default job titles for the company if none exist
                this.createDefaultJobTitles();
            }
            
            // Sort job titles alphabetically
            this.jobTitles.sort((a, b) => a.name.localeCompare(b.name));
            
            // Refresh dropdowns if already initialized
            this.refreshApproverDropdowns();
            
            console.log(`🔄 Real-time update: Loaded ${this.jobTitles.length} job titles for company ${this.companyId}`);
        });
    }
    
    async createDefaultJobTitles() {
        const defaultTitles = {
            supervisor: {
                label: "Supervisor",
                value: "supervisor",
                enabled: true
            },
            manager: {
                label: "Manager", 
                value: "manager",
                enabled: true
            },
            admin: {
                label: "Administrator",
                value: "admin",
                enabled: true
            },
            hr_manager: {
                label: "HR Manager",
                value: "hr_manager", 
                enabled: true
            }
        };
        
        try {
            const jobTitlesRef = ref(this.db, `companies/${this.companyId}/configuration/jobTitles`);
            await set(jobTitlesRef, defaultTitles);
            console.log('Default job titles created for company:', this.companyId);
        } catch (error) {
            console.error('Error creating default job titles:', error);
        }
    }
    
    initEventListeners() {
        console.log('Initializing event listeners...');
        
        // Process type change
        if (this.processTypeSelect) {
            this.processTypeSelect.addEventListener('change', () => {
                console.log('Process type changed');
                this.loadApprovalFlow();
            });
        }
        
        // Add approval level
        if (this.addApprovalLevelBtn) {
            console.log('Adding click listener to Add Approval Level button');
            this.addApprovalLevelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Add Approval Level button clicked!');
                const levelCount = this.approvalLevelsContainer.querySelectorAll('.approval-level').length;
                console.log('Current level count:', levelCount);
                this.addApprovalLevel(levelCount + 1);
            });
        } else {
            console.error('Add Approval Level button not found!');
        }
        
        // Save approval flow
        if (this.saveApprovalFlowBtn) {
            this.saveApprovalFlowBtn.addEventListener('click', () => {
                console.log('Save button clicked');
                this.saveApprovalFlow();
            });
        }
        
        // Listen for field option changes from settings page
        document.addEventListener('fieldOptionsChanged', (event) => {
            if (event.detail.fieldType === 'user-role') {
                this.loadJobTitlesFromConfig();
            }
        });
        
        // Clean up listeners when page unloads
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Clean up listeners when navigating away
        window.addEventListener('pagehide', () => {
            this.cleanup();
        });
        
        // Global event delegation for dynamic elements
        document.addEventListener('click', (e) => {
            // Remove role
            if (e.target.closest('.remove-approver')) {
                const approvalLevel = e.target.closest('.approval-level');
                const levelNumber = Array.from(this.approvalLevelsContainer.children).indexOf(approvalLevel) + 1;
                const levelKey = `level${levelNumber}`;
                
                // Clear the selected roles for this level
                this.selectedRoles[levelKey] = [];
                
                // Reset the dropdown
                const roleDropdown = approvalLevel.querySelector('.role-dropdown');
                if (roleDropdown) {
                    roleDropdown.value = '';
                }
                
                // Remove the approver badge
                const selectedApproverDiv = approvalLevel.querySelector('.selected-approver');
                if (selectedApproverDiv) {
                    selectedApproverDiv.innerHTML = '';
                }
            }
            
            // Delete approval level
            if (e.target.closest('.delete-level-btn')) {
                const approvalLevel = e.target.closest('.approval-level');
                if (approvalLevel) {
                    approvalLevel.remove();
                    this.updateLevelNumbers();
                }
            }
        });
        
        // Handle function/name dropdown changes using event delegation
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('approver-type-select')) {
                const approvalLevel = e.target.closest('.approval-level');
                this.updateApproverRoleDropdown(approvalLevel);
            }
            
            // Handle role dropdown changes
            if (e.target.classList.contains('role-dropdown')) {
                const selectedValue = e.target.value;
                const selectedText = e.target.options[e.target.selectedIndex].text;
                const approvalLevel = e.target.closest('.approval-level');
                const levelNumber = Array.from(this.approvalLevelsContainer.children).indexOf(approvalLevel) + 1;
                
                if (selectedValue) {
                    this.addRole(levelNumber, selectedValue, selectedText);
                }
            }
        });
    }
    
    updateApproverRoleDropdown(approvalLevel) {
        const typeSelect = approvalLevel.querySelector('.approver-type-select');
        const roleDropdown = approvalLevel.querySelector('.role-dropdown');
        const selectedType = typeSelect.value;
        
        // Clear existing options
        roleDropdown.innerHTML = '<option value="">Select an option</option>';
        
        if (selectedType === 'function') {
            // Add job titles to the dropdown
            this.jobTitles.forEach(jobTitle => {
                const option = document.createElement('option');
                option.value = `function_${jobTitle.id}`;
                option.textContent = jobTitle.name;
                roleDropdown.appendChild(option);
            });
        } else if (selectedType === 'name') {
            // Add users to the dropdown
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = `user_${user.id}`;
                let displayText = user.name;
                if (user.jobTitle || user.department) {
                    displayText += ' (';
                    if (user.jobTitle) displayText += user.jobTitle;
                    if (user.jobTitle && user.department) displayText += ' - ';
                    if (user.department) displayText += user.department;
                    displayText += ')';
                }
                option.textContent = displayText;
                roleDropdown.appendChild(option);
            });
        } else if (selectedType === 'level') {
            // Add level-based options to the dropdown
            roleDropdown.innerHTML = `
                <option value="">Select a level</option>
                <option value="L+1">L+1 (One level up)</option>
                <option value="L+2">L+2 (Two levels up)</option>
                <option value="L+3">L+3 (Three levels up)</option>
                <option value="L+4">L+4 (Four levels up)</option>
            `;
        }

        // Maintain current selection if it exists
        const levelNumber = Array.from(this.approvalLevelsContainer.children).indexOf(approvalLevel) + 1;
        const levelKey = `level${levelNumber}`;
        if (this.selectedRoles[levelKey]?.[0]) {
            roleDropdown.value = this.selectedRoles[levelKey][0].value;
        }
    }
    
    loadApprovalFlow() {
        const processType = this.processTypeSelect.value;
        if (!this.companyId) {
            console.error('No company ID available for loading approval flow');
            return;
        }
        
        // Clean up existing listener if switching process types
        if (this.approvalFlowListener && this.currentProcessType !== processType) {
            console.log(`🔄 Switching from ${this.currentProcessType} to ${processType}, cleaning up listener`);
            this.approvalFlowListener();
            this.approvalFlowListener = null;
        }
        
        this.currentProcessType = processType;
        
        if (!processType) {
            console.log('No process type selected, showing empty state');
            this.clearApprovalLevels();
            this.showEmptyApprovalState();
            this.displayCurrentApprovers(null);
            return;
        }
        
        console.log(`🔄 Setting up real-time listener for process: ${processType}, company: ${this.companyId}`);
        
        // Show loading state
        this.showLoadingState();
        
        // Set up real-time listener for approval flow
        const approvalFlowRef = ref(this.db, `companies/${this.companyId}/approvalFlows/${processType}`);
        this.approvalFlowListener = onValue(approvalFlowRef, (snapshot) => {
            console.log(`📊 Real-time update for ${processType}:`, snapshot.exists());
            
            this.clearApprovalLevels();
            
            if (snapshot.exists()) {
                const flow = snapshot.val();
                console.log(`✅ Real-time approval flow data:`, flow);
                
                // Check if this update was from another user
                const isFromOtherUser = flow.metadata?.lastModifiedBy && 
                                      flow.metadata.lastModifiedBy !== (this.auth.currentUser?.uid || this.currentUser.uid);
                
                if (isFromOtherUser) {
                    console.log('🔄 Update from another user detected');
                    this.showCollaborativeUpdate(flow.metadata);
                }
                
                // Restore selected roles from saved data
                this.selectedRoles = flow.selectedRoles || {};
                
                if (flow.levels && flow.levels.length > 0) {
                    // Clear and reset the container structure first
                    this.clearApprovalLevels();
                    
                    // Clean selectedRoles to only include levels that exist in the flow
                    const cleanSelectedRoles = {};
                    flow.levels.forEach((level, index) => {
                        const levelKey = `level${level.level}`;
                        if (this.selectedRoles[levelKey]) {
                            cleanSelectedRoles[levelKey] = this.selectedRoles[levelKey];
                        }
                    });
                    this.selectedRoles = cleanSelectedRoles;
                    
                    // Create approval levels based on saved data
                    flow.levels.forEach((level, index) => {
                        this.addApprovalLevel(level.level, level);
                    });
                    
                    // After all levels are created, restore the selected approvers
                    setTimeout(() => {
                        this.restoreSelectedApprovers();
                    }, 100);
                    
                    // Set approval order
                    const approvalOrderSelect = document.getElementById('approvalOrder');
                    if (approvalOrderSelect) {
                        approvalOrderSelect.value = flow.approvalOrder || flow.approvalSequence || 'sequential';
                    }
                    
                    // Show success message
                    console.log(`✅ Loaded ${flow.levels.length} approval levels for ${processType}`);
                    
                    // Update approval flow summary
                    setTimeout(() => {
                        if (window.updateApprovalFlowSummary) {
                            window.updateApprovalFlowSummary();
                        }
                    }, 200);
                    
                    // Display current approvers
                    this.displayCurrentApprovers(flow);
                    
                } else {
                    console.log('⚠️ Flow exists but no levels found, adding initial level');
                    this.clearApprovalLevels(); // Reset structure
                    this.addApprovalLevel(1);
                    
                    // Update approval flow summary
                    setTimeout(() => {
                        if (window.updateApprovalFlowSummary) {
                            window.updateApprovalFlowSummary();
                        }
                    }, 200);
                    
                    // Display current approvers (empty)
                    this.displayCurrentApprovers(null);
                }
            } else {
                console.log(`📝 No existing flow found for ${processType}, creating new`);
                // If no existing flow, add initial level
                this.clearApprovalLevels(); // Reset structure
                this.addApprovalLevel(1);
                
                // Update approval flow summary
                setTimeout(() => {
                    if (window.updateApprovalFlowSummary) {
                        window.updateApprovalFlowSummary();
                    }
                }, 200);
                
                // Display current approvers (empty)
                this.displayCurrentApprovers(null);
            }
        }, (error) => {
            console.error('❌ Error in real-time approval flow listener:', error);
            // Add initial level in case of error
            this.clearApprovalLevels();
            this.addApprovalLevel(1);
        });
    }
    
    showCollaborativeUpdate(metadata) {
        // Show notification about update from another user
        const userName = metadata.lastModifiedBy || 'Another user';
        const timeAgo = this.getTimeAgo(metadata.lastModifiedAt);
        
        const message = `Configuration updated by another user ${timeAgo}`;
        
        // Show brief collaborative indicator
        this.showCollaborativeIndicator();
        
        console.log(`🤝 Collaborative update detected from ${userName} at ${metadata.lastModifiedAt}`);
    }
    
    showCollaborativeIndicator() {
        // Remove existing indicator
        const existingIndicator = document.querySelector('.collaborative-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create collaborative indicator
        const indicator = document.createElement('div');
        indicator.className = 'collaborative-indicator';
        indicator.innerHTML = `
            <i class="fas fa-users"></i>
            <span>Live collaboration active</span>
        `;
        
        // Add to settings section
        const settingsSection = document.querySelector('.settings-section');
        if (settingsSection) {
            settingsSection.appendChild(indicator);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 3000);
        }
    }
    
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffSecs < 30) return 'just now';
        if (diffSecs < 60) return `${diffSecs} seconds ago`;
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        return 'earlier today';
    }
    
    showLoadingState() {
        const approvalLevelsContainer = document.getElementById('approvalLevelsContainer');
        if (approvalLevelsContainer) {
            approvalLevelsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading approval flow configuration...</p>
                </div>
            `;
        }
    }
    
    showEmptyApprovalState() {
        const approvalLevelsContainer = document.getElementById('approvalLevelsContainer');
        if (approvalLevelsContainer) {
            approvalLevelsContainer.innerHTML = `
                <div class="empty-approval-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <h3>Select a Process Type</h3>
                    <p>Choose a process type above to configure its approval flow</p>
                </div>
            `;
        }
    }
    
    showProcessTypeStatus(message, type = 'info') {
        // Remove existing status message
        const existingStatus = document.querySelector('.process-type-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Create new status message
        const statusDiv = document.createElement('div');
        statusDiv.className = `process-type-status status-${type}`;
        
        // Add appropriate icon based on type
        let iconClass = 'info-circle';
        if (type === 'success') iconClass = 'check-circle';
        else if (type === 'error') iconClass = 'exclamation-circle';
        else if (type === 'collaborative') iconClass = 'users';
        
        statusDiv.innerHTML = `
            <i class="fas fa-${iconClass}"></i>
            <span>${message}</span>
        `;
        
        // Insert after process type select
        const processTypeContainer = this.processTypeSelect.closest('.form-group');
        if (processTypeContainer) {
            processTypeContainer.insertAdjacentElement('afterend', statusDiv);
            
            // Auto-remove after 5 seconds (longer for collaborative updates)
            const timeout = type === 'collaborative' ? 8000 : 5000;
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.remove();
                }
            }, timeout);
        }
    }    
    
    restoreSelectedApprovers() {
        // Restore selected approvers for all levels after loading from Firebase
        Object.keys(this.selectedRoles).forEach(levelKey => {
            const levelNumber = parseInt(levelKey.replace('level', ''));
            const selectedRole = this.selectedRoles[levelKey][0];
            
            if (selectedRole) {
                // Find the corresponding level element
                const levels = this.approvalLevelsContainer.querySelectorAll('.approval-level');
                const levelElement = levels[levelNumber - 1];
                
                if (levelElement) {
                    // Set the dropdown value
                    const roleDropdown = levelElement.querySelector('.role-dropdown');
                    if (roleDropdown) {
                        // First ensure the dropdown has the correct options
                        this.updateApproverRoleDropdown(levelElement);
                        // Then set the value
                        setTimeout(() => {
                            roleDropdown.value = selectedRole.value;
                        }, 50);
                    }
                    
                    // Display the selected approver
                    this.displaySelectedApprover(levelNumber, selectedRole.value, selectedRole.text);
                }
            }
        });
    }    
    
    clearApprovalLevels() {
        // Clear the levels content
        if (this.approvalLevelsContainer) {
            this.approvalLevelsContainer.innerHTML = '';
        }
        
        // Reset the main container to show the proper tab structure
        const mainContainer = document.getElementById('approvalLevelsContainer');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="approval-levels-tabs" id="approvalLevelsTabs">
                    <!-- Tabs will be dynamically generated here -->
                    <button class="add-level-tab" onclick="addApprovalLevelFromButton()">
                        <i class="fas fa-plus"></i>
                        Add Level
                    </button>
                </div>
                <div class="approval-levels-content">
                    <div class="approval-levels-empty" id="approvalLevelsEmpty">
                        <i class="fas fa-layer-group"></i>
                        <h3>No Approval Levels</h3>
                        <p>Click "Add Level" to create your first approval level</p>
                    </div>
                    <div class="approval-levels" id="approvalLevels">
                        <!-- Approval levels will be dynamically loaded from Firebase -->
                    </div>
                </div>
            `;
            
            // Update the reference to the correct container
            this.approvalLevelsContainer = document.getElementById('approvalLevels');
        }
    }    
    
    addApprovalLevel(levelNumber, levelData = null) {
        console.log('addApprovalLevel called with levelNumber:', levelNumber);
        
        if (!this.approvalLevelsContainer) {
            console.error('approvalLevelsContainer not found!');
            // Try to get the correct reference
            this.approvalLevelsContainer = document.getElementById('approvalLevels');
            if (!this.approvalLevelsContainer) {
                console.error('Still cannot find approvalLevels container!');
                return;
            }
        }
        
        // Hide empty state
        const emptyState = document.getElementById('approvalLevelsEmpty');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Create the tab
        this.createApprovalTab(levelNumber);
        
        // Create the level content
        const level = document.createElement('div');
        level.className = 'approval-level';
        level.id = `approvalLevel${levelNumber}`;
        
        const approverTypeValue = levelData ? levelData.approverType || 'function' : 'function';
        
        console.log('Creating approval level HTML...');
        
        level.innerHTML = `
            <div class="level-content">
                <div class="level-section">
                    <h4><i class="fas fa-user-tag"></i> Approver Configuration</h4>
                    <div class="approver-config-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label><i class="fas fa-user-tag"></i> Approver Type</label>
                            <select class="approver-type-select">
                                <option value="function" ${approverTypeValue === 'function' ? 'selected' : ''}>Function (Job Title)</option>
                                <option value="name" ${approverTypeValue === 'name' ? 'selected' : ''}>Name (User)</option>
                                <option value="level" ${approverTypeValue === 'level' ? 'selected' : ''}>Level</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label><i class="fas fa-users"></i> Select Approver</label>
                            <div class="approver-selection">
                                <select class="role-dropdown approver-dropdown">
                                    <option value="">Choose an approver...</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="selected-approver" id="selectedApprover${levelNumber}"></div>
                    ${levelNumber > 1 ? `
                        <div class="level-actions" style="margin-top: 16px;">
                            <button class="btn btn-secondary delete-level-btn" onclick="removeApprovalLevel(${levelNumber})">
                                <i class="fas fa-trash"></i> Remove Level
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        console.log('Appending level to container...');
        this.approvalLevelsContainer.appendChild(level);
        
        // Switch to this level's tab
        this.switchToLevel(levelNumber);
        
        console.log('Level added successfully');
        
        // Initialize the approver role dropdown based on the type
        this.updateApproverRoleDropdown(level);
        
        // Restore selected approver if loading from Firebase
        if (levelData && this.selectedRoles[`level${levelNumber}`]) {
            const selectedRole = this.selectedRoles[`level${levelNumber}`][0];
            if (selectedRole) {
                // Set the dropdown value
                const roleDropdown = level.querySelector('.role-dropdown');
                if (roleDropdown) {
                    setTimeout(() => {
                        roleDropdown.value = selectedRole.value;
                    }, 100);
                }
                
                // Display the selected approver
                this.displaySelectedApprover(levelNumber, selectedRole.value, selectedRole.text);
            }
        }
        
        // Add event listener for approver type change
        const typeSelect = level.querySelector('.approver-type-select');
        typeSelect.addEventListener('change', () => {
            this.updateApproverRoleDropdown(level);
        });
    }
    
    createApprovalTab(levelNumber) {
        const tabsContainer = document.getElementById('approvalLevelsTabs');
        if (!tabsContainer) {
            console.error('Tabs container not found');
            return;
        }
        
        // Check if tab already exists
        const existingTab = document.getElementById(`tab-level-${levelNumber}`);
        if (existingTab) {
            return;
        }
        
        // Create the tab
        const tab = document.createElement('button');
        tab.className = 'approval-tab';
        tab.id = `tab-level-${levelNumber}`;
        tab.onclick = () => this.switchToLevel(levelNumber);
        
        tab.innerHTML = `
            <div class="level-indicator">${levelNumber}</div>
            <div class="tab-label">
                <div class="tab-title">Level ${levelNumber}</div>
                <div class="tab-subtitle">Approval Stage</div>
            </div>
            ${levelNumber > 1 ? `
                <button class="remove-level" onclick="event.stopPropagation(); removeApprovalLevel(${levelNumber})">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;
        
        // Insert before the "Add Level" button
        const addButton = tabsContainer.querySelector('.add-level-tab');
        if (addButton) {
            tabsContainer.insertBefore(tab, addButton);
        } else {
            tabsContainer.appendChild(tab);
        }
    }
    
    switchToLevel(levelNumber) {
        // Remove active class from all tabs
        const allTabs = document.querySelectorAll('.approval-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to selected tab
        const selectedTab = document.getElementById(`tab-level-${levelNumber}`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Hide all levels
        const allLevels = document.querySelectorAll('.approval-level');
        allLevels.forEach(level => {
            level.classList.remove('active');
            level.style.display = 'none';
        });
        
        // Show selected level
        const selectedLevel = document.getElementById(`approvalLevel${levelNumber}`);
        if (selectedLevel) {
            selectedLevel.style.display = 'block';
            selectedLevel.classList.add('active');
        }
    }
    
    removeLevel(levelNumber) {
        console.log('Removing level:', levelNumber);
        
        // Remove the tab
        const tab = document.getElementById(`tab-level-${levelNumber}`);
        if (tab) {
            tab.remove();
        }
        
        // Remove the level content
        const level = document.getElementById(`approvalLevel${levelNumber}`);
        if (level) {
            level.remove();
        }
        
        // Remove from selectedRoles
        delete this.selectedRoles[`level${levelNumber}`];
        
        // Renumber remaining levels and tabs
        this.renumberLevels();
        
        // If no levels remain, show empty state
        const remainingLevels = document.querySelectorAll('.approval-level');
        if (remainingLevels.length === 0) {
            const emptyState = document.getElementById('approvalLevelsEmpty');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        } else {
            // Switch to the first available level
            this.switchToLevel(1);
        }
    }
    
    renumberLevels() {
        const tabs = document.querySelectorAll('.approval-tab');
        const levels = document.querySelectorAll('.approval-level');
        
        // Update tabs
        tabs.forEach((tab, index) => {
            const newLevelNumber = index + 1;
            tab.id = `tab-level-${newLevelNumber}`;
            tab.onclick = () => this.switchToLevel(newLevelNumber);
            
            const levelIndicator = tab.querySelector('.level-indicator');
            if (levelIndicator) {
                levelIndicator.textContent = newLevelNumber;
            }
            
            const tabTitle = tab.querySelector('.tab-title');
            if (tabTitle) {
                tabTitle.textContent = `Level ${newLevelNumber}`;
            }
            
            const removeButton = tab.querySelector('.remove-level');
            if (removeButton) {
                if (newLevelNumber === 1) {
                    removeButton.style.display = 'none';
                } else {
                    removeButton.style.display = 'flex';
                    removeButton.onclick = (e) => {
                        e.stopPropagation();
                        window.removeApprovalLevel(newLevelNumber);
                    };
                }
            }
        });
        
        // Update levels
        levels.forEach((level, index) => {
            const newLevelNumber = index + 1;
            level.id = `approvalLevel${newLevelNumber}`;
            
            const selectedApprover = level.querySelector('.selected-approver');
            if (selectedApprover) {
                selectedApprover.id = `selectedApprover${newLevelNumber}`;
            }
            
            const deleteButton = level.querySelector('.delete-level-btn');
            if (deleteButton) {
                if (newLevelNumber === 1) {
                    deleteButton.style.display = 'none';
                } else {
                    deleteButton.style.display = 'inline-flex';
                    deleteButton.onclick = () => window.removeApprovalLevel(newLevelNumber);
                }
            }
            
        });
        
        // Update selectedRoles object
        const newSelectedRoles = {};
        Object.keys(this.selectedRoles).forEach((oldKey, index) => {
            const newKey = `level${index + 1}`;
            newSelectedRoles[newKey] = this.selectedRoles[oldKey];
        });
        this.selectedRoles = newSelectedRoles;
    }
    
    displaySelectedApprover(levelNumber, roleValue, roleText) {
        const selectedApproverDiv = document.getElementById(`selectedApprover${levelNumber}`);
        if (selectedApproverDiv) {
            const icon = roleValue.startsWith('user_') ? 'user' : 
                        roleValue.startsWith('function_') ? 'briefcase' : 'layer-group';
            
            // Clean the roleText to remove any IDs or unwanted characters
            let cleanText = roleText;
            
            console.log('Original roleText:', roleText, 'roleValue:', roleValue);
            
            // For user-based approvers, ensure we show a clean format
            if (roleValue.startsWith('user_')) {
                const userId = roleValue.replace('user_', '');
                const user = this.users.find(u => u.id === userId);
                if (user) {
                    cleanText = user.name;
                    if (user.jobTitle) {
                        cleanText += ` (${user.jobTitle})`;
                    }
                    console.log('Clean user text:', cleanText);
                }
            }
            // For function-based approvers, use the job title name directly
            else if (roleValue.startsWith('function_')) {
                const functionId = roleValue.replace('function_', '');
                const jobTitle = this.jobTitles.find(jt => jt.id === functionId);
                if (jobTitle) {
                    cleanText = jobTitle.name;
                    console.log('Clean function text:', cleanText);
                }
            }
            // For level-based approvers, keep the original text (L+1, L+2, etc.)
            else {
                // Remove any trailing IDs that might look like Firebase keys
                cleanText = roleText.replace(/\s+[a-zA-Z0-9_-]{15,}$/, '');
                console.log('Clean level text:', cleanText);
            }
            
            selectedApproverDiv.innerHTML = `
                <div class="selected-approver-badge">
                    <i class="fas fa-${icon}"></i>
                    <span>${cleanText}</span>
                    <button class="remove-approver">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
    }

    updateLevelNumbers() {
        const levels = this.approvalLevelsContainer.querySelectorAll('.approval-level');
        levels.forEach((level, index) => {
            const levelNumber = index + 1;
            
            // Always hide delete button on first level
            const deleteBtn = level.querySelector('.delete-level-btn');
            if (deleteBtn) {
                deleteBtn.style.display = levelNumber === 1 ? 'none' : '';
            }
            
            // Update IDs and attributes as needed
            const selectedApproverDiv = level.querySelector('.selected-approver');
            if (selectedApproverDiv) {
                selectedApproverDiv.id = `selectedApprover${levelNumber}`;
            }
        });
    }    
    
    addRole(levelNumber, roleValue, roleText) {
        const levelKey = `level${levelNumber}`;
        
        // Set new role
        const newRole = {
            value: roleValue,
            text: roleText,
            updatedAt: Date.now()
        };

        this.selectedRoles[levelKey] = [newRole];
        
        // Update UI using the helper method
        this.displaySelectedApprover(levelNumber, roleValue, roleText);
    }
    
    removeRole(levelNumber) {
        const levelKey = `level${levelNumber}`;
        delete this.selectedRoles[levelKey];
        
        // Clear UI only
        const selectedApproverDiv = document.getElementById(`selectedApprover${levelNumber}`);
        if (selectedApproverDiv) {
            selectedApproverDiv.innerHTML = '';
        }
    }
    
    async saveApprovalFlow() {
        try {
            const processType = this.processTypeSelect.value;
            const approvalOrder = document.getElementById('approvalOrder').value;
            
            if (!processType) {
                throw new Error('Please select a process type before saving.');
            }
            
            if (!this.companyId) {
                throw new Error('No company ID available for saving approval flow');
            }
            
            // Get all approval levels
            const levels = Array.from(this.approvalLevelsContainer.querySelectorAll('.approval-level'));
            
            // Validate that all levels have selected approvers
            const validLevels = levels.filter((level, index) => {
                const levelNumber = index + 1;
                const selectedOption = level.querySelector('.role-dropdown').value;
                return selectedOption && selectedOption.trim() !== '';
            });
            
            if (validLevels.length === 0) {
                throw new Error('Please configure at least one approval level with a selected approver.');
            }
            
            // Build clean selectedRoles object from current UI state
            const cleanSelectedRoles = {};
            validLevels.forEach((level, index) => {
                const levelNumber = index + 1;
                const approverType = level.querySelector('.approver-type-select').value;
                const selectedOption = level.querySelector('.role-dropdown').value;
                const selectedText = level.querySelector('.role-dropdown').selectedOptions[0]?.text || '';
                
                if (selectedOption) {
                    let cleanText = selectedText;
                    
                    // Get clean display text based on approver type
                    if (approverType === 'function') {
                        const title = this.jobTitles.find(t => `function_${t.id}` === selectedOption);
                        cleanText = title ? title.name : selectedText;
                    } else if (approverType === 'name') {
                        const user = this.users.find(u => `user_${u.id}` === selectedOption);
                        cleanText = user ? user.name : selectedText;
                    } else if (approverType === 'level') {
                        cleanText = selectedOption; // L+1, L+2, etc.
                    }
                    
                    cleanSelectedRoles[`level${levelNumber}`] = [{
                        value: selectedOption,
                        text: cleanText,
                        approverType: approverType,
                        updatedAt: Date.now()
                    }];
                }
            });
            
            // Create comprehensive flow data
            const flowData = {
                processType: processType,
                enabled: true,
                approvalOrder: approvalOrder || 'sequential',
                selectedRoles: cleanSelectedRoles,
                levels: validLevels.map((level, index) => {
                    const levelNumber = index + 1;
                    const approverType = level.querySelector('.approver-type-select').value;
                    const selectedOption = level.querySelector('.role-dropdown').value;
                    
                    return {
                        level: levelNumber,
                        approverType: approverType,
                        value: selectedOption,
                        isActive: true
                    };
                }),
                metadata: {
                    companyId: this.companyId,
                    companyName: this.currentUser.companyName || 'Unknown Company',
                    totalLevels: validLevels.length,
                    lastModifiedBy: this.auth.currentUser?.uid || this.currentUser.uid || 'system',
                    lastModifiedAt: new Date().toISOString(),
                    version: '1.0'
                }
            };
            
            // Save to company-specific Firebase path
            const flowPath = `companies/${this.companyId}/approvalFlows/${processType}`;
            await set(ref(this.db, flowPath), flowData);
            
            // Update local selectedRoles to match what was saved
            this.selectedRoles = cleanSelectedRoles;
            
            console.log(`✅ Approval flow saved successfully:`, {
                path: flowPath,
                processType: processType,
                levels: validLevels.length,
                company: this.companyId
            });
            
            // Update approval flow summary
            setTimeout(() => {
                if (window.updateApprovalFlowSummary) {
                    window.updateApprovalFlowSummary();
                }
                // Update current approvers display
                this.displayCurrentApprovers(flowData);
            }, 100);
            
            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.addNotification({
                    type: 'Success',
                    message: `Approval flow for "${this.getProcessTypeDisplayName(processType)}" saved successfully!`
                });
            } else {
                alert(`Approval flow for "${this.getProcessTypeDisplayName(processType)}" saved successfully!`);
            }
            
        } catch (error) {
            console.error('❌ Error saving approval flow:', error);
            
            // Show error notification
            if (window.notificationManager) {
                window.notificationManager.addNotification({
                    type: 'Error',
                    message: error.message || 'Failed to save approval flow configuration.'
                });
            } else {
                alert(error.message || 'Failed to save approval flow configuration.');
            }
        }
    }
    
    getProcessTypeDisplayName(processType) {
        const processTypeObj = processTypes.find(pt => pt.value === processType);
        return processTypeObj ? processTypeObj.text : processType;
    }
    
    displayCurrentApprovers(flow = null) {
        const currentApproversSection = document.getElementById('currentApproversSection');
        const approversStatusBadge = document.getElementById('approversStatusBadge');
        const currentApproversContent = document.getElementById('currentApproversContent');
        const noApproversMessage = document.getElementById('noApproversMessage');
        const approversList = document.getElementById('approversList');
        
        if (!currentApproversSection) {
            console.log('Current approvers section not found');
            return;
        }
        
        const processType = this.processTypeSelect.value;
        
        if (!processType) {
            // Hide the section when no process type is selected
            currentApproversSection.style.display = 'none';
            return;
        }
        
        // Show the section
        currentApproversSection.style.display = 'block';
        
        if (!flow || !flow.levels || flow.levels.length === 0) {
            // No approvers configured
            approversStatusBadge.textContent = 'Not Configured';
            approversStatusBadge.className = 'status-badge not-configured';
            
            noApproversMessage.style.display = 'flex';
            approversList.style.display = 'none';
            return;
        }
        
        // Approvers are configured
        approversStatusBadge.textContent = 'Configured';
        approversStatusBadge.className = 'status-badge configured';
        
        noApproversMessage.style.display = 'none';
        approversList.style.display = 'flex';
        
        // Build the approvers list
        approversList.innerHTML = '';
        
        flow.levels.forEach((level, index) => {
            // Get the role information from selectedRoles
            const levelKey = `level${level.level}`;
            const selectedRole = flow.selectedRoles?.[levelKey]?.[0];
            
            if (!selectedRole) {
                return;
            }
            
            const approverItem = document.createElement('div');
            approverItem.className = 'approver-item';
            
            let approverName = 'Unknown';
            let approverType = 'Unknown';
            let typeBadgeClass = 'function';
            
            if (selectedRole.approverType === 'function' || level.approverType === 'function') {
                approverName = selectedRole.text || level.value || 'Unknown Function';
                approverType = 'By Job Title';
                typeBadgeClass = 'function';
            } else if (selectedRole.approverType === 'name' || level.approverType === 'name') {
                approverName = selectedRole.text || level.value || 'Unknown User';
                approverType = 'By Name';
                typeBadgeClass = 'user';
            } else if (selectedRole.approverType === 'level' || level.approverType === 'level') {
                approverName = selectedRole.value || level.value || 'Unknown Level';
                approverType = 'By Level';
                typeBadgeClass = 'level';
            }
            
            approverItem.innerHTML = `
                <div class="approver-info">
                    <div class="approver-level">${level.level}</div>
                    <div class="approver-details">
                        <div class="approver-name">${approverName}</div>
                        <div class="approver-type">
                            <span class="approver-type-badge ${typeBadgeClass}">${approverType}</span>
                        </div>
                    </div>
                </div>
            `;
            
            approversList.appendChild(approverItem);
        });
    }
    
    cleanup() {
        console.log('🧹 Cleaning up ApprovalSettings listeners...');
        
        if (this.usersListener) {
            this.usersListener();
            this.usersListener = null;
            console.log('✅ Users listener removed');
        }
        
        if (this.jobTitlesListener) {
            this.jobTitlesListener();
            this.jobTitlesListener = null;
            console.log('✅ Job titles listener removed');
        }
        
        if (this.approvalFlowListener) {
            this.approvalFlowListener();
            this.approvalFlowListener = null;
            console.log('✅ Approval flow listener removed');
        }
        
        console.log('🧹 ApprovalSettings cleanup complete');
    }
}

// Global function to handle add level button clicks
window.addApprovalLevelFromButton = function() {
    console.log('Add level button clicked from global function');
    if (window.approvalSettings) {
        const currentLevels = document.querySelectorAll('.approval-level').length;
        const newLevelNumber = currentLevels + 1;
        console.log('Adding level number:', newLevelNumber);
        window.approvalSettings.addApprovalLevel(newLevelNumber);
    } else {
        console.error('Approval settings not initialized');
    }
};

// Global function to handle remove level button clicks
window.removeApprovalLevel = function(levelNumber) {
    console.log('Remove level button clicked for level:', levelNumber);
    if (window.approvalSettings) {
        window.approvalSettings.removeLevel(levelNumber);
    } else {
        console.error('Approval settings not initialized');
    }
};

// Initialize the class
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, waiting a moment for all scripts to initialize...');
    
    // Add a small delay to ensure all other scripts have loaded
    setTimeout(() => {
        console.log('Initializing ApprovalSettings...');
        window.approvalSettings = new ApprovalSettings();
    }, 500);
});

const processTypes = [    { value: 'ptw', text: 'Permit to Work' },
    { value: 'access', text: 'Access Control' },
    { value: 'water', text: 'Water Quality' },
    { value: 'jsa', text: 'Job Safety Analysis' },
    { value: 'fleet', text: 'Fleet Management' },
    { value: 'audit', text: 'Audit' },
    { value: 'risk', text: 'Risk Assessment' },
    { value: 'event', text: 'Event Report' },
    { value: 'inspection', text: 'Safety Inspection' },
    { value: 'removal', text: 'Property Removal' },
    { value: 'contract_approval', text: 'Contract Approval' }
];