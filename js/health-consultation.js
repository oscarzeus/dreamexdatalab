class ConsultationManager {
    constructor() {
        this.initializeConsultation();
        this.initializePermissions();
    }

    initializeConsultation() {
        // Initialize consultation if on consultation page
        if (document.querySelector('.consultation-container')) {
            this.loadConsultations();
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
            let feature = button.getAttribute('data-feature') || 'health_consultation_view';
            
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

        // Check create consultation button
        const createBtn = document.getElementById('createConsultationBtn');
        if (createBtn) {
            const hasCreatePermission = window.roleManager?.hasPermission('health_consultation_view', 'create');
            createBtn.style.display = hasCreatePermission ? '' : 'none';
        }
    }
}

// Initialize consultation manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.consultationManager = new ConsultationManager();
});