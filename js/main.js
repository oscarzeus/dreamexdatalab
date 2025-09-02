// Import Firebase functions
import { saveTrainingRequest, updateTrainingRequest, deleteTrainingRequest, subscribeToTrainingRequests } from './firebase-config.js';
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

class PreferencesLoader {
    constructor() {
        this.initializePreferences();
        this.listenForPreferenceChanges();
    }

    initializePreferences() {
        const cachedPrefs = localStorage.getItem('userPreferences');
        if (cachedPrefs) {
            try {
                const preferences = JSON.parse(cachedPrefs);
                this.applyPreferences(preferences);
            } catch (error) {
                console.error('Error applying cached preferences:', error);
            }
        }
    }

    listenForPreferenceChanges() {
        window.addEventListener('preferencesUpdated', (event) => {
            this.applyPreferences(event.detail);
        });
    }

    applyPreferences(preferences) {
        // Set date/time formats
        this.setGlobalDateTimeFormats(preferences);
        
        // Set data display settings
        this.setGlobalDataSettings(preferences);
        
        // Re-render any data grids or tables
        this.refreshDataDisplays();
    }

    setGlobalDateTimeFormats(preferences) {
        window.globalDateFormat = preferences.dateFormat;
        window.globalTimeFormat = preferences.timeFormat;
        window.globalTimezone = preferences.timezone;
    }

    setGlobalDataSettings(preferences) {
        window.globalPageSize = parseInt(preferences.defaultPageSize);
        window.globalRefreshRate = parseInt(preferences.dataRefreshRate);
        window.globalDefaultSort = preferences.defaultSort;
    }

    refreshDataDisplays() {
        // Refresh any visible data grids
        if (window.trainingManager?.renderTrainingRequests) {
            window.trainingManager.renderTrainingRequests();
        }
        if (window.medicalFolderManager?.loadMedicalRecords) {
            window.medicalFolderManager.loadMedicalRecords();
        }
        // Add other manager refreshes as needed
    }

    static formatDate(date, format = window.globalDateFormat) {
        if (!date) return '';
        return new Intl.DateTimeFormat(document.documentElement.lang, {
            timeZone: window.globalTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(date));
    }

    static formatTime(date, use24Hour = window.globalTimeFormat === '24') {
        if (!date) return '';
        return new Intl.DateTimeFormat(document.documentElement.lang, {
            timeZone: window.globalTimezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: !use24Hour
        }).format(new Date(date));
    }

    static formatDateTime(date) {
        if (!date) return '';
        const dateStr = this.formatDate(date);
        const timeStr = this.formatTime(date);
        return `${dateStr} ${timeStr}`;
    }
}

class TrainingManager {
    constructor() {
        this.initializeTrainingSystem();
        this.initializePermissions();
    }

    initializeTrainingSystem() {
        // Initialize training form if on training form page
        const trainingForm = document.getElementById('trainingRequestForm');
        if (trainingForm) {
            trainingForm.addEventListener('submit', (e) => this.handleTrainingSubmission(e));
        }

        // Initialize training board if on training board page
        const trainingTable = document.getElementById('trainingTableBody');
        if (trainingTable) {
            this.initializeTrainingBoard();
            this.initializeTrainingModal();
        }
    }

    initializePermissions() {
        // Initial check for all action buttons
        this.updateActionButtonsVisibility();

        // Re-check permissions when role changes
        window.addEventListener('roleChanged', () => {
            this.updateActionButtonsVisibility();
        });
    }

    updateActionButtonsVisibility() {
        // Hide/show action buttons based on permissions
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            let feature = button.getAttribute('data-feature') || 'training_view';
            
            // Map actions to permission types
            const permissionType = {
                'edit': 'edit',
                'approve': 'approve',
                'decline': 'decline',
                'delete': 'delete',
                'create': 'create',
                'export': 'export'
            }[action] || 'view';

            const hasPermission = window.roleManager?.hasPermission(feature, permissionType);
            if (!hasPermission) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });
    }

    initializeTrainingBoard() {
        // Subscribe to real-time updates
        subscribeToTrainingRequests((trainingRequests) => {
            this.renderTrainingRequests(trainingRequests);
        });
    }

    async handleTrainingSubmission(e) {
        e.preventDefault();
        const form = e.target;
        
        const trainingRequest = {
            id: Date.now(),
            title: form.trainingTitle.value,
            department: form.department.value,
            trainingType: form.trainingType.value,
            participants: parseInt(form.participants.value),
            startDate: form.startDate.value,
            duration: parseInt(form.duration.value),
            justification: form.justification.value,
            objectives: form.objectives.value,
            status: 'Pending',
            submittedBy: window.authManager.getUser()?.username || 'Unknown',
            submittedOn: new Date().toISOString()
        };

        // Save to Firebase
        const success = await saveTrainingRequest(trainingRequest);
        
        if (success) {
            // Create notifications
            window.notificationManager.notifyFormSubmission('Training', trainingRequest.id);
            // Redirect to training board
            window.location.href = 'trainingboard.html';
        } else {
            alert('Failed to submit training request. Please try again.');
        }
    }

    renderTrainingRequests(trainingRequests) {
        const tbody = document.getElementById('trainingTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        trainingRequests.forEach(request => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${request.id}</td>
                <td>${request.title}</td>
                <td>${request.submittedBy}</td>
                <td>${request.department}</td>
                <td><span class="status-badge status-${request.status.toLowerCase()}">${request.status}</span></td>
                <td>${new Date(request.submittedOn).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" data-action="edit" data-id="${request.id}" 
                            data-feature="training_view">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-approve" data-action="approve" data-id="${request.id}"
                            data-feature="training_view">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-decline" data-action="decline" data-id="${request.id}"
                            data-feature="training_view">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-delete" data-action="delete" data-id="${request.id}"
                            data-feature="training_view">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tr.querySelectorAll('button[data-action]').forEach(button => {
                button.addEventListener('click', () => {
                    const action = button.getAttribute('data-action');
                    const id = parseInt(button.getAttribute('data-id'));
                    this.handleTrainingAction(action, id);
                });
            });

            tbody.appendChild(tr);
        });

        // Update action buttons visibility after rendering
        this.updateActionButtonsVisibility();
    }

    initializeTrainingModal() {
        const modal = document.getElementById('trainingModal');
        if (!modal) return;

        // Close modal when clicking close button or outside
        document.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async handleTrainingAction(action, id) {
        switch (action) {
            case 'edit':
                this.showTrainingEditModal(id);
                break;
            case 'approve':
                await this.updateTrainingStatus(id, 'Approved');
                break;
            case 'decline':
                await this.updateTrainingStatus(id, 'Declined');
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this training request?')) {
                    await this.deleteTrainingRequest(id);
                }
                break;
        }
    }

    async showTrainingEditModal(id) {
        const modal = document.getElementById('trainingModal');
        const modalBody = modal.querySelector('.modal-body');

        // Get the current training request data from Firebase
        subscribeToTrainingRequests((trainingRequests) => {
            const request = trainingRequests.find(r => r.id === id);
            if (!request) return;

            modalBody.innerHTML = `
                <form id="editTrainingForm">
                    <div class="form-group">
                        <label for="editTitle">Training Title</label>
                        <input type="text" id="editTitle" name="title" value="${request.title}" required>
                    </div>
                    <div class="form-group">
                        <label for="editDepartment">Department</label>
                        <input type="text" id="editDepartment" name="department" value="${request.department}" required>
                    </div>
                    <div class="form-group">
                        <label for="editObjectives">Training Objectives</label>
                        <textarea id="editObjectives" name="objectives" required>${request.objectives}</textarea>
                    </div>
                </form>
            `;

            modal.style.display = 'block';

            // Handle save
            document.getElementById('editTraining').addEventListener('click', async () => {
                const form = document.getElementById('editTrainingForm');
                const updates = {
                    title: form.title.value,
                    department: form.department.value,
                    objectives: form.objectives.value,
                    lastModifiedBy: window.authManager.getUser()?.username,
                    lastModifiedOn: new Date().toISOString()
                };
                
                const success = await updateTrainingRequest(id, updates);
                if (success) {
                    modal.style.display = 'none';
                } else {
                    alert('Failed to update training request. Please try again.');
                }
            });
        });
    }

    async updateTrainingStatus(id, newStatus) {
        const updates = {
            status: newStatus,
            actionBy: window.authManager.getUser()?.username,
            actionDate: new Date().toISOString()
        };

        const success = await updateTrainingRequest(id, updates);
        if (success) {
            // Create notification
            window.notificationManager.notifyStatusChange('Training', id, newStatus);
        } else {
            alert('Failed to update training status. Please try again.');
        }
    }

    async deleteTrainingRequest(id) {
        const success = await deleteTrainingRequest(id);
        if (!success) {
            alert('Failed to delete training request. Please try again.');
        }
    }
}

class ApprovalManager {
    constructor() {
        this.initializeApprovalSettings();
        this.initializePermissions();
    }

    initializePermissions() {
        // Initial check for all action buttons
        this.updateActionButtonsVisibility();

        // Re-check permissions when role changes
        window.addEventListener('roleChanged', () => {
            this.updateActionButtonsVisibility();
        });
    }

    updateActionButtonsVisibility() {
        // Hide/show action buttons based on permissions
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            let feature = button.getAttribute('data-feature') || 'approval_settings_view';
            
            const permissionType = {
                'edit': 'edit',
                'delete': 'delete',
                'create': 'create'
            }[action] || 'view';

            const hasPermission = window.roleManager?.hasPermission(feature, permissionType);
            if (!hasPermission) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });

        // Check add approval level button
        const addLevelBtn = document.getElementById('addApprovalLevel');
        if (addLevelBtn) {
            const hasEditPermission = window.roleManager?.hasPermission('approval_settings_view', 'edit');
            addLevelBtn.style.display = hasEditPermission ? '' : 'none';
        }

        // Check save changes button
        const saveBtn = document.getElementById('saveApprovalFlow');
        if (saveBtn) {
            const hasEditPermission = window.roleManager?.hasPermission('approval_settings_view', 'edit');
            saveBtn.style.display = hasEditPermission ? '' : 'none';
        }
    }

    initializeApprovalSettings() {
        // Only initialize if we're on the approval settings page
        if (!document.getElementById('approvalLevels')) return;

        const addLevelBtn = document.getElementById('addApprovalLevel');
        const saveBtn = document.getElementById('saveApprovalFlow');
        const processTypeSelect = document.getElementById('processType');

        if (addLevelBtn) {
            addLevelBtn.addEventListener('click', () => {
                if (window.roleManager?.hasPermission('approval_settings_view', 'edit')) {
                    this.addApprovalLevel();
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (window.roleManager?.hasPermission('approval_settings_view', 'edit')) {
                    this.saveApprovalFlow();
                }
            });
        }

        if (processTypeSelect) {
            processTypeSelect.addEventListener('change', () => {
                this.loadApprovalFlow(processTypeSelect.value);
            });
        }

        // Load initial approval flow
        this.loadApprovalFlow(processTypeSelect?.value || 'training');
    }

    // ... rest of the ApprovalManager class implementation ...
}

class SettingsManager {
    constructor() {
        this.initializeSettings();
    }

    initializeSettings() {
        // Only initialize if we're on the settings page
        if (!document.querySelector('.settings-navigation')) return;

        this.updateSettingsVisibility();

        // Re-check permissions when role changes
        window.addEventListener('roleChanged', () => {
            this.updateSettingsVisibility();
        });
    }

    updateSettingsVisibility() {
        // Hide/show settings navigation items based on permissions
        const settingsItems = document.querySelectorAll('.settings-nav-item');
        settingsItems.forEach(item => {
            const feature = item.getAttribute('data-feature');
            if (feature) {
                const hasPermission = window.roleManager?.hasPermission(feature, 'view');
                item.style.display = hasPermission ? '' : 'none';
            }
        });
    }
}

class MedicalFolderManager {
    constructor() {
        this.initializeMedicalFolder();
        this.initializePermissions();
    }

    initializeMedicalFolder() {
        // Initialize medical folder if on medical folder page
        if (document.querySelector('.medical-folder-container')) {
            this.loadMedicalRecords();
        }
    }

    initializePermissions() {
        // Initial check for all action buttons
        this.updateActionButtonsVisibility();

        // Re-check permissions when role changes
        window.addEventListener('roleChanged', () => {
            this.updateActionButtonsVisibility();
        });
    }

    updateActionButtonsVisibility() {
        // Hide/show action buttons based on permissions
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            let feature = button.getAttribute('data-feature') || 'medical_folder_view';
            
            // Map actions to permission types
            const permissionType = {
                'edit': 'edit',
                'delete': 'delete',
                'create': 'create',
                'approve': 'approve',
                'export': 'export'
            }[action] || 'view';

            const hasPermission = window.roleManager?.hasPermission(feature, permissionType);
            if (!hasPermission) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });

        // Check add record button
        const addRecordBtn = document.getElementById('addMedicalRecordBtn');
        if (addRecordBtn) {
            const hasCreatePermission = window.roleManager?.hasPermission('medical_folder_view', 'create');
            addRecordBtn.style.display = hasCreatePermission ? '' : 'none';
        }
    }

    loadMedicalRecords() {
        // Check view permission before loading records
        const hasViewPermission = window.roleManager?.hasPermission('medical_folder_view', 'view');
        if (!hasViewPermission) {
            const container = document.querySelector('.medical-folder-container');
            if (container) {
                container.innerHTML = '<div class="permission-denied">You do not have permission to view medical records.</div>';
            }
            return;
        }

        // Load medical records implementation here
        // This will be connected to your data source
    }
}

// Initialize managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize preferences loader first
    window.preferencesLoader = new PreferencesLoader();

    // Initialize training manager if we're on a training-related page
    if (document.getElementById('trainingRequestForm') || document.getElementById('trainingTableBody')) {
        window.trainingManager = new TrainingManager();
    }

    // Initialize approval manager if we're on the approval settings page
    if (document.getElementById('approvalLevels')) {
        window.approvalManager = new ApprovalManager();
    }

    // Initialize settings manager if we're on the settings page
    if (document.querySelector('.settings-navigation')) {
        window.settingsManager = new SettingsManager();
    }

    // Initialize medical folder manager if we're on the medical folder page
    if (document.querySelector('.medical-folder-container')) {
        window.medicalFolderManager = new MedicalFolderManager();
    }

    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }

        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 20px;
            width: 70%;
            max-width: 700px;
            border-radius: 5px;
            position: relative;
        }

        .close-modal {
            position: absolute;
            right: 20px;
            top: 10px;
            font-size: 24px;
            cursor: pointer;
            background: none;
            border: none;
        }

        .status-badge {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.9rem;
        }

        .status-pending {
            background-color: #f1c40f;
            color: white;
        }

        .status-approved {
            background-color: #27ae60;
            color: white;
        }

        .status-declined {
            background-color: #e74c3c;
            color: white;
        }
    `;
    document.head.appendChild(style);
});

// Initialize KPI Charts
document.addEventListener('DOMContentLoaded', () => {
    // Enhanced chart configuration
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: false,
                bodyFont: {
                    size: 12
                },
                titleFont: {
                    size: 13,
                    weight: 'bold'
                }
            }
        },
        animation: {
            duration: 1500,
            easing: 'easeInOutQuart'
        },
        scales: {
            x: {
                display: false,
                grid: {
                    display: false
                }
            },
            y: {
                display: false,
                grid: {
                    display: false
                }
            }
        }
    };

    // Incident Rate Chart
    const incidentCtx = document.getElementById('incidentChart').getContext('2d');
    const incidentChart = new Chart(incidentCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Incident Rate',
                data: [0.8, 0.7, 0.6, 0.55, 0.5, 0.5],
                borderColor: '#f093fb',
                backgroundColor: 'rgba(240, 147, 251, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#f5576c',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#f5576c',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            return `Incident Rate: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });

    // Training Compliance Chart
    const trainingCtx = document.getElementById('trainingChart').getContext('2d');
    const trainingChart = new Chart(trainingCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Compliance Rate',
                data: [85, 87, 88, 90, 91, 92],
                borderColor: '#4facfe',
                backgroundColor: 'rgba(79, 172, 254, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#00f2fe',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#00f2fe',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            return `Compliance: ${context.parsed.y}%`;
                        }
                    }
                }
            }
        }
    });

    // Risk Assessment Chart
    const riskCtx = document.getElementById('riskChart').getContext('2d');
    const riskChart = new Chart(riskCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Risk Assessments',
                data: [35, 38, 40, 42, 44, 45],
                backgroundColor: ['#43e97b', '#44ea7c', '#45eb7d', '#46ec7e', '#47ed7f', '#48ee80'],
                borderColor: '#38f9d7',
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false,
                hoverBackgroundColor: '#38f9d7',
                hoverBorderColor: '#43e97b',
                hoverBorderWidth: 3
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            return `Assessments: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });

    // Environmental Performance Chart
    const envCtx = document.getElementById('environmentalChart').getContext('2d');
    const environmentalChart = new Chart(envCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Water Usage (kL)',
                data: [1200, 1150, 1100, 1050, 1000, 980],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#0891b2',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }, {
                label: 'Energy Usage (kWh)',
                data: [5000, 4800, 4600, 4500, 4400, 4300],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#d97706',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        color: '#374151',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            const unit = context.datasetIndex === 0 ? 'kL' : 'kWh';
                            return `${context.dataset.label}: ${context.parsed.y}${unit}`;
                        }
                    }
                }
            }
        }
    });

    // Safety Observations Chart
    const safetyCtx = document.getElementById('safetyObservationsChart').getContext('2d');
    const safetyChart = new Chart(safetyCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Safe Acts',
                data: [120, 125, 130, 135, 140, 145],
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false
            }, {
                label: 'Unsafe Acts',
                data: [15, 13, 12, 10, 8, 7],
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        color: '#374151',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                ...chartDefaults.scales,
                x: {
                    ...chartDefaults.scales.x,
                    stacked: true
                },
                y: {
                    ...chartDefaults.scales.y,
                    stacked: true
                }
            }
        }
    });

    // Add loading animation removal
    setTimeout(() => {
        document.querySelectorAll('.kpi-card canvas').forEach(canvas => {
            canvas.classList.remove('chart-loading');
        });
    }, 1500);
});

// Function to update charts with new data (can be called when new data is available)
function updateKPICharts(newData) {
    // Implementation for updating charts with new data
    // This would be connected to your data source/backend
}