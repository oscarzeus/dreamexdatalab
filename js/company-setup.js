import { getDatabase, ref, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class CompanySetup {
    constructor() {
        this.db = getDatabase();
        this.auth = getAuth();
        this.currentStep = 1;
        this.totalSteps = 5;
        this.companyId = null;
        this.userId = null;
        
        // Initialize basic UI first (even without auth)
        this.initializeBasicUI();
        
        // Then handle authentication
        this.initializeSetup();
    }

    initializeBasicUI() {
        // Set up basic UI elements and event listeners that don't require authentication
        console.log('Initializing basic UI...');
        
        // Ensure progress bar and step display work
        this.updateProgress();
        this.showStep(1);
        
        // Add basic event listeners with error handling
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const finishBtn = document.getElementById('finishBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log('Next button clicked (basic listener)');
                this.nextStep();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('Previous button clicked (basic listener)');
                this.prevStep();
            });
        }

        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                console.log('Finish button clicked (basic listener)');
                this.finishSetup();
            });
        }

        // Add module selection listeners
        const moduleCards = document.querySelectorAll('[data-module]');
        moduleCards.forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('selected');
                this.saveModuleSelection();
            });
        });

        console.log('Basic UI initialized');
    }

    async initializeSetup() {
        console.log('Initializing company setup...');
        
        // Add a timeout for authentication check
        const authTimeout = setTimeout(() => {
            console.warn('Authentication check taking too long, proceeding with fallback');
            this.handleAuthTimeout();
        }, 10000); // 10 second timeout
        
        // Wait for authentication
        this.auth.onAuthStateChanged(async (user) => {
            clearTimeout(authTimeout); // Clear timeout since auth state changed
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            
            if (user) {
                this.userId = user.uid;
                console.log('User ID:', this.userId);
                
                await this.loadUserCompany();
                this.initializeEventListeners();
                this.updateProgress();
                this.showStep(1);
                
                console.log('Setup initialization complete');
            } else {
                // Redirect to login if not authenticated
                console.log('No user authenticated, redirecting to login');
                window.location.href = 'login.html';
            }
        });
    }

    handleAuthTimeout() {
        console.error('Authentication timeout - Firebase may not be properly configured');
        const setupContainer = document.querySelector('.setup-container');
        if (setupContainer) {
            setupContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <h2 style="color: #ffc107;">Connection Issue</h2>
                    <p>Unable to connect to authentication services. This might be due to:</p>
                    <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <li>Network connectivity issues</li>
                        <li>Firebase configuration problems</li>
                        <li>Browser security settings</li>
                    </ul>
                    <div style="margin-top: 2rem;">
                        <a href="login.html" class="btn btn-primary" style="margin-right: 1rem;">Back to Login</a>
                        <button onclick="window.location.reload()" class="btn btn-secondary">Retry</button>
                    </div>
                </div>
            `;
        }
    }

    async loadUserCompany() {
        console.log('Loading user company data...');
        try {
            const userRef = ref(this.db, `users/${this.userId}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                this.companyId = userData.companyId;
                console.log('Company ID:', this.companyId);
                
                if (!this.companyId) {
                    console.error('User not associated with a company');
                    window.location.href = 'company-registration.html';
                    return;
                }
            } else {
                console.error('User data not found');
                window.location.href = 'login.html';
                return;
            }
        } catch (error) {
            console.error('Error loading user company:', error);
        }
    }

    initializeEventListeners() {
        console.log('Initializing additional event listeners (after auth)...');

        // Add notification preferences listeners - checkboxes
        const notificationCheckboxes = document.querySelectorAll('#step4 input[type="checkbox"]');
        notificationCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.saveNotificationPreferences());
        });

        console.log('Additional event listeners initialized');
    }



    nextStep() {
        console.log('Next button clicked, current step:', this.currentStep);
        if (this.currentStep < this.totalSteps) {
            // Validate current step before proceeding
            if (this.validateCurrentStep()) {
                console.log('Validation passed, proceeding to next step');
                this.currentStep++;
                this.showStep(this.currentStep);
                this.updateProgress();
                this.updateButtons();
            } else {
                console.log('Validation failed, staying on current step');
            }
        } else {
            console.log('Already at final step');
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateButtons();
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        const steps = document.querySelectorAll('.setup-step');
        steps.forEach(step => step.classList.remove('active'));

        // Show current step
        const currentStep = document.getElementById(`step${stepNumber}`);
        if (currentStep) {
            currentStep.classList.add('active');
        }
    }

    updateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const percentage = (this.currentStep / this.totalSteps) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    updateButtons() {
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const finishBtn = document.getElementById('finishBtn');

        // Show/hide previous button
        if (prevBtn) {
            prevBtn.style.display = this.currentStep > 1 ? 'inline-flex' : 'none';
        }

        // Show/hide next vs finish button
        if (this.currentStep === this.totalSteps) {
            if (nextBtn) nextBtn.style.display = 'none';
            if (finishBtn) finishBtn.style.display = 'inline-flex';
        } else {
            if (nextBtn) nextBtn.style.display = 'inline-flex';
            if (finishBtn) finishBtn.style.display = 'none';
        }
    }

    validateCurrentStep() {
        console.log('Validating step:', this.currentStep);
        switch (this.currentStep) {
            case 1:
                return true; // Welcome step, no validation needed
            case 2:
                return this.validateModuleSelection();
            case 3:
                return this.validateRoleSelection();
            case 4:
                return this.validateNotificationPreferences();
            case 5:
                return true; // Final step, no validation needed
            default:
                return true;
        }
    }

    validateModuleSelection() {
        try {
            const selectedModules = document.querySelectorAll('[data-module].selected');
            if (selectedModules.length === 0) {
                this.showNotification('Please select at least one module to continue.', 'warning');
                return false;
            }
            console.log('Module validation passed:', selectedModules.length, 'modules selected');
            return true;
        } catch (error) {
            console.error('Error validating module selection:', error);
            // If there's an error in validation, allow progression
            return true;
        }
    }

    validateRoleSelection() {
        // Roles step is informational only, so always return true
        return true;
    }

    validateNotificationPreferences() {
        // Notification preferences are optional, so always return true
        return true;
    }

    async saveModuleSelection() {
        const selectedModules = Array.from(document.querySelectorAll('[data-module].selected'))
            .map(card => card.getAttribute('data-module'));

        try {
            if (this.companyId && this.companyId !== 'debug-company') {
                await update(ref(this.db, `companies/${this.companyId}/setup`), {
                    selectedModules: selectedModules,
                    lastUpdated: new Date().toISOString()
                });
            }
            console.log('Module selection saved:', selectedModules);
        } catch (error) {
            console.error('Error saving module selection:', error);
            // Don't block the user flow if database save fails
        }
    }

    async saveRoleSelection() {
        const selectedRoles = Array.from(document.querySelectorAll('input[name="roles"]:checked'))
            .map(checkbox => checkbox.value);

        try {
            await update(ref(this.db, `companies/${this.companyId}/setup`), {
                selectedRoles: selectedRoles,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error saving role selection:', error);
        }
    }

    async saveNotificationPreferences() {
        const notificationPreferences = {};
        
        // Get email notification preferences
        notificationPreferences.emailIncidents = document.getElementById('emailIncidents')?.checked || false;
        notificationPreferences.emailTraining = document.getElementById('emailTraining')?.checked || false;
        notificationPreferences.emailInspections = document.getElementById('emailInspections')?.checked || false;
        notificationPreferences.emailReports = document.getElementById('emailReports')?.checked || false;
        
        // Get alert preferences
        notificationPreferences.alertCritical = document.getElementById('alertCritical')?.checked || false;
        notificationPreferences.alertOverdue = document.getElementById('alertOverdue')?.checked || false;
        notificationPreferences.alertApprovals = document.getElementById('alertApprovals')?.checked || false;

        try {
            if (this.companyId && this.companyId !== 'debug-company') {
                await update(ref(this.db, `companies/${this.companyId}/setup`), {
                    notificationPreferences: notificationPreferences,
                    lastUpdated: new Date().toISOString()
                });
            }
            console.log('Notification preferences saved:', notificationPreferences);
        } catch (error) {
            console.error('Error saving notification preferences:', error);
            // Don't block the user flow if database save fails
        }
    }

    async finishSetup() {
        try {
            // Mark setup as completed
            if (this.companyId && this.companyId !== 'debug-company') {
                await update(ref(this.db, `companies/${this.companyId}`), {
                    setupCompleted: true,
                    setupCompletedAt: new Date().toISOString(),
                    setupCompletedBy: this.userId
                });

                // Save final setup completion status
                await update(ref(this.db, `companies/${this.companyId}/setup`), {
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completedBy: this.userId
                });
            }

            this.showNotification('Company setup completed successfully!', 'success');
            
            // Redirect to users page after a short delay
            setTimeout(() => {
                window.location.href = 'users.html';
            }, 2000);

        } catch (error) {
            console.error('Error completing setup:', error);
            this.showNotification('Error completing setup. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = '#28a745';
                break;
            case 'error':
                notification.style.background = '#dc3545';
                break;
            case 'warning':
                notification.style.background = '#ffc107';
                notification.style.color = '#212529';
                break;
            default:
                notification.style.background = '#17a2b8';
        }

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 4000);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success':
                return 'fa-check-circle';
            case 'error':
                return 'fa-exclamation-circle';
            case 'warning':
                return 'fa-exclamation-triangle';
            default:
                return 'fa-info-circle';
        }
    }
}

// Initialize the company setup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, initializing CompanySetup...');
    try {
        new CompanySetup();
    } catch (error) {
        console.error('Error initializing CompanySetup:', error);
        // Fallback: show error message to user
        const setupContainer = document.querySelector('.setup-container');
        if (setupContainer) {
            setupContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <h2 style="color: #dc3545;">Setup Error</h2>
                    <p>There was an error initializing the company setup. Please try refreshing the page.</p>
                    <p style="font-size: 0.9rem; color: #6c757d;">Error: ${error.message}</p>
                    <a href="login.html" class="btn btn-primary" style="margin-top: 1rem;">Back to Login</a>
                </div>
            `;
        }
    }
});

// Also handle the case where DOM is already loaded
if (document.readyState !== 'loading') {
    console.log('DOM already loaded, initializing CompanySetup immediately...');
    try {
        new CompanySetup();
    } catch (error) {
        console.error('Error initializing CompanySetup (immediate):', error);
    }
}
