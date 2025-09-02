import { 
    getAuth, 
    createUserWithEmailAndPassword,
    updateProfile,
    deleteUser,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    update, 
    remove,
    onValue,
    get,
    serverTimestamp,
    push,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import companyDataService from './company-data-service.js';

class UserManager {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.roles = [];
        this.companyDataService = companyDataService;
        this.initializeUserManagement();
        this.initializePermissions();
        this.initializeAuditLog();
        this.initializeDepartmentManagement();
        this.initializeJobTitleManagement();
    }

    async loadRoles() {
        const rolesRef = ref(this.db, 'roles');
        return new Promise((resolve, reject) => {
            onValue(rolesRef, (snapshot) => {
                this.roles = [];
                snapshot.forEach((childSnapshot) => {
                    this.roles.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                resolve(this.roles);
            }, (error) => {
                console.error('Error loading roles:', error);
                reject(error);
            });
        });
    }

    async initializeUserManagement() {
        // Only initialize if we're on the users page
        if (!document.getElementById('usersTableBody')) return;

        // Load roles first
        try {
            await this.loadRoles();
        } catch (error) {
            console.error('Failed to load roles:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load roles. Some features may be limited.'
            });
        }

        // Initialize user creation/editing modal
        this.initializeModal();

        // Load users
        this.loadUsers();

        // Add search functionality with debounce
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filterUsers(e.target.value);
                }, 300);
            });
        }

        // Initialize form validation
        this.initializeFormValidation();

        // Auto-run migration on first load (only once)
        if (!localStorage.getItem('lineManagerNameMigrationRun')) {
            console.log('Running one-time line manager name migration...');
            setTimeout(() => {
                this.migrateLineManagerNames().then(() => {
                    localStorage.setItem('lineManagerNameMigrationRun', 'true');
                });
            }, 2000); // Wait 2 seconds after page load
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
            let feature = button.getAttribute('data-feature') || 'user_management_view';
            
            const permissionType = action; // Each action maps directly to its permission type

            const hasPermission = window.roleManager?.hasPermission(feature, permissionType);
            if (!hasPermission) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });

        // Also check the create user button
        const createUserBtn = document.getElementById('createUserBtn');
        if (createUserBtn) {
            const hasCreatePermission = window.roleManager?.hasPermission('user_management_view', 'create');
            createUserBtn.style.display = hasCreatePermission ? '' : 'none';
        }
    }

    initializeModal() {
        const modal = document.getElementById('userModal');
        const createUserBtn = document.getElementById('createUserBtn');
        const closeBtn = document.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveUserBtn');
        const userForm = document.getElementById('userForm');

        createUserBtn.addEventListener('click', () => {
            this.showModal();
        });

        closeBtn.addEventListener('click', () => this.hideModal());
        cancelBtn.addEventListener('click', () => this.hideModal());

        saveBtn.addEventListener('click', async () => {
            if (userForm.checkValidity()) {
                // Additional password validation for both create and update
                const passwordField = userForm.querySelector('#password');
                const isEditing = !!userForm.dataset.userId;
                
                // Check password requirements
                if (passwordField.value && passwordField.value.trim() !== '') {
                    if (!this.validatePasswordStrength(passwordField.value)) {
                        window.notificationManager.addNotification({
                            type: 'Error',
                            message: 'Password does not meet security requirements. Please ensure it has 8+ characters with uppercase, lowercase, numbers, and special characters.'
                        });
                        passwordField.focus();
                        return;
                    }
                } else if (!isEditing) {
                    // Password is required for new users
                    window.notificationManager.addNotification({
                        type: 'Error',
                        message: 'Password is required for new users.'
                    });
                    passwordField.focus();
                    return;
                }
                
                const userId = userForm.dataset.userId;
                if (userId) {
                    await this.updateUser(userId);
                } else {
                    await this.createUser();
                }
            } else {
                userForm.reportValidity();
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        });
    }

    initializeFormValidation() {
        const form = document.getElementById('userForm');
        const passwordInput = form.querySelector('#password');
        
        // Add focused class for form styling
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                input.parentElement.classList.remove('focused');
                if (input.value) {
                    input.classList.add('has-value');
                } else {
                    input.classList.remove('has-value');
                }
            });
        });

        // Password strength indicator
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                this.updatePasswordStrength(e.target.value);
            });
        }
    }

    updatePasswordStrength(password) {
        const strengthBar = document.querySelector('.password-strength-bar');
        if (!strengthBar) return;

        // Remove existing classes
        strengthBar.classList.remove('weak', 'medium', 'strong');

        if (password.length === 0) {
            strengthBar.style.width = '0';
            return;
        }

        // Use the same validation logic as the password update function
        const hasLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        // Calculate strength based on requirements met
        let strength = 0;
        if (hasLength) strength++;
        if (hasUppercase) strength++;
        if (hasLowercase) strength++;
        if (hasNumbers) strength++;
        if (hasSpecialChar) strength++;

        // Apply appropriate class based on strength
        if (strength < 3) {
            strengthBar.classList.add('weak');
        } else if (strength < 5) {
            strengthBar.classList.add('medium');
        } else {
            strengthBar.classList.add('strong');
        }

        // Add validation feedback text
        const passwordField = document.getElementById('password');
        if (passwordField) {
            let existingFeedback = passwordField.parentElement.querySelector('.password-feedback');
            if (!existingFeedback) {
                existingFeedback = document.createElement('div');
                existingFeedback.className = 'password-feedback';
                existingFeedback.style.fontSize = '0.8rem';
                existingFeedback.style.marginTop = '0.25rem';
                passwordField.parentElement.appendChild(existingFeedback);
            }

            if (password.length === 0) {
                existingFeedback.textContent = '';
                existingFeedback.style.color = '';
            } else if (this.validatePasswordStrength(password)) {
                existingFeedback.textContent = '✅ Password meets all requirements';
                existingFeedback.style.color = '#2ecc71';
            } else {
                const missing = [];
                if (!hasLength) missing.push('8+ characters');
                if (!hasUppercase) missing.push('uppercase letter');
                if (!hasLowercase) missing.push('lowercase letter');
                if (!hasNumbers) missing.push('number');
                if (!hasSpecialChar) missing.push('special character');
                
                existingFeedback.textContent = `❌ Missing: ${missing.join(', ')}`;
                existingFeedback.style.color = '#e74c3c';
            }
        }
    }

    async showModal(userData = null) {
        const modal = document.getElementById('userModal');
        const form = document.getElementById('userForm');
        const modalTitle = document.getElementById('modalTitle');
        const passwordField = document.getElementById('password');
        const saveBtn = document.getElementById('saveUserBtn');
        const roleSelect = form.querySelector('#role');
        const lineManagerSelect = form.querySelector('#lineManager');
        const departmentSelect = form.querySelector('#department');

        // Load job titles when showing modal
        this.loadJobTitlesFromConfig();
        
        // Load departments from form field configuration
        await this.loadDepartmentsForSelect(departmentSelect);

        // Clear existing role options except the first one
        while (roleSelect.options.length > 1) {
            roleSelect.remove(1);
        }

        // Clear existing line manager options except the first two (Select Line Manager and N/A)
        while (lineManagerSelect.options.length > 2) {
            lineManagerSelect.remove(2);
        }

        // Add roles from Firebase
        this.roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            roleSelect.appendChild(option);
        });

        // Load and populate line managers from Firebase (only from same company)
        await this.companyDataService.initializeUserContext();
        const currentCompanyId = this.companyDataService.getCurrentCompanyId();
        
        if (currentCompanyId) {
            const usersRef = ref(this.db, 'users');
            const companyUsersQuery = query(usersRef, orderByChild('companyId'), equalTo(currentCompanyId));
            const usersSnapshot = await get(companyUsersQuery);
            
            usersSnapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                // Don't add the current user being edited as a line manager option
                if (!userData || childSnapshot.key !== userData.uid) {
                    const option = document.createElement('option');
                    option.value = childSnapshot.key;
                    option.textContent = `${user.firstName} ${user.lastName}` || user.email;
                    lineManagerSelect.appendChild(option);
                }
            });
        }

        if (userData) {
            modalTitle.textContent = 'Edit User';
            form.dataset.userId = userData.uid;
            form.firstName.value = userData.firstName || '';
            form.lastName.value = userData.lastName || '';
            form.email.value = userData.email || '';
            form.jobTitle.value = userData.jobTitle || '';

            // Split phone number into country code and number
            if (userData.phone) {
                const phoneMatch = userData.phone.match(/^(\+\d+)\s+(.+)$/);
                if (phoneMatch) {
                    form.countryCode.value = phoneMatch[1];
                    form.phone.value = phoneMatch[2];
                }
            }

            form.lineManager.value = userData.lineManager || '';
            form.role.value = userData.role || '';
            form.department.value = userData.department || '';
            form.status.value = userData.status || 'active';
            form.address.value = userData.address || '';
            
            passwordField.required = false;
            passwordField.value = '';
            passwordField.placeholder = 'Enter new password to change (leave empty to keep current)';
            const hintElement = passwordField.parentElement.querySelector('.form-hint');
            hintElement.innerHTML = `
                <strong>Password Change Policy:</strong><br>
                • Leave empty to keep current password<br>
                • New password must have 8+ characters with uppercase, lowercase, numbers, and special characters<br>
                • If you change your own password, you'll be logged out automatically for security<br>
                • If changing another user's password, they'll receive a password reset email
            `;
            hintElement.style.lineHeight = '1.4';
            saveBtn.textContent = 'Save Changes';
        } else {
            modalTitle.textContent = 'Create New User';
            form.reset();
            delete form.dataset.userId;
            passwordField.required = true;
            passwordField.placeholder = 'Enter a secure password';
            passwordField.parentElement.querySelector('.form-hint').textContent = 
                'Required. Must have 8+ characters with uppercase, lowercase, numbers, and special characters.';
            saveBtn.textContent = 'Create User';
        }

        modal.classList.add('show');
        form.firstName.focus();
    }

    hideModal() {
        const modal = document.getElementById('userModal');
        const form = document.getElementById('userForm');
        modal.classList.remove('show');
        form.reset();
        // Remove any validation styles
        form.querySelectorAll('.has-value, .error').forEach(el => {
            el.classList.remove('has-value', 'error');
        });
    }

    async createUser() {
        const form = document.getElementById('userForm');
        
        // Ensure company context is available
        await this.companyDataService.initializeUserContext();
        const currentCompanyId = this.companyDataService.getCurrentCompanyId();
        
        if (!currentCompanyId) {
            window.notificationManager.addNotification({
                type: 'Error',
                message: 'Company context not available. Please refresh and try again.'
            });
            return;
        }
        
        // Validate password strength before proceeding
        if (!this.validatePasswordStrength(form.password.value)) {
            window.notificationManager.addNotification({
                type: 'Error',
                message: 'Password does not meet security requirements. Please ensure it has 8+ characters with uppercase, lowercase, numbers, and special characters.'
            });
            form.password.focus();
            return;
        }
        
        const userData = {
            email: form.email.value,
            password: form.password.value,
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            jobTitle: form.jobTitle.value,
            phone: form.countryCode.value + ' ' + form.phone.value.trim(),
            lineManager: form.lineManager.value,
            role: form.role.value,
            department: form.department.value,
            status: form.status.value,
            address: form.address.value,
            companyId: currentCompanyId, // Associate with current company
            createdBy: window.authManager.getUser()?.uid,
            createdAt: new Date().toISOString()
        };

        // If a line manager is selected, fetch and store their full name
        if (form.lineManager.value) {
            try {
                const lineManagerRef = ref(this.db, `users/${form.lineManager.value}`);
                const lineManagerSnapshot = await get(lineManagerRef);
                
                if (lineManagerSnapshot.exists()) {
                    const lineManagerData = lineManagerSnapshot.val();
                    const lineManagerFullName = `${lineManagerData.firstName || ''} ${lineManagerData.lastName || ''}`.trim();
                    
                    // Store both the line manager ID and their full name
                    userData.lineManagerName = lineManagerFullName;
                    
                    console.log(`Setting line manager for new user ${userData.firstName} ${userData.lastName}: ${lineManagerFullName} (ID: ${form.lineManager.value})`);
                } else {
                    console.warn(`Line manager with ID ${form.lineManager.value} not found`);
                    userData.lineManagerName = '';
                }
            } catch (error) {
                console.error('Error fetching line manager data:', error);
                // Continue with creation even if line manager fetch fails
                userData.lineManagerName = '';
            }
        } else {
            userData.lineManagerName = '';
        }

        try {
            // Create the user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                this.auth,
                userData.email,
                userData.password
            );

            // Store user data ONLY in company scope - no global users entry
            // Get company ID to store user in company-scoped location
            const companyUsersRef = ref(this.db, `companies/${userData.companyId}/users/${userCredential.user.uid}`);
            await set(companyUsersRef, {
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                jobTitle: userData.jobTitle,
                phone: userData.phone,
                lineManager: userData.lineManager,
                lineManagerName: userData.lineManagerName,
                role: userData.role,
                department: userData.department,
                status: userData.status,
                address: userData.address,
                authUid: userCredential.user.uid, // Link to Firebase Auth
                createdBy: userData.createdBy,
                createdAt: userData.createdAt,
                requiresPasswordChange: true, // Force password change on first login
                isFirstLogin: true
            });
            
            console.log('✅ User stored ONLY in company scope - no global users entry created');

            // Add audit log
            await this.logAudit(
                'create',
                'user',
                userCredential.user.uid,
                `Created user ${userData.firstName} ${userData.lastName} (${userData.email})`
            );

            window.notificationManager.addNotification({
                type: 'Success',
                message: `User ${userData.firstName} ${userData.lastName} has been created successfully.`
            });

            this.hideModal();
        } catch (error) {
            console.error('Error creating user:', error);
            window.notificationManager.addNotification({
                type: 'Error',
                message: `Failed to create user: ${error.message}`
            });
        }
    }

    async updateUser(userId) {
        const form = document.getElementById('userForm');
        const updates = {
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            email: form.email.value,
            jobTitle: form.jobTitle.value,
            phone: form.countryCode.value + ' ' + form.phone.value.trim(),
            lineManager: form.lineManager.value,
            role: form.role.value,
            department: form.department.value,
            status: form.status.value,
            address: form.address.value,
            lastModifiedBy: window.authManager.getUser()?.uid,
            lastModifiedAt: new Date().toISOString()
        };

        // If a line manager is selected, fetch and store their full name
        if (form.lineManager.value) {
            try {
                // Get company ID for company-scoped lookup
                const companyId = window.authManager?.getUser()?.companyId || 
                                 window.companyData?.companyId ||
                                 localStorage.getItem('currentCompanyId');
                
                if (companyId) {
                    const lineManagerRef = ref(this.db, `companies/${companyId}/users/${form.lineManager.value}`);
                    const lineManagerSnapshot = await get(lineManagerRef);
                    
                    if (lineManagerSnapshot.exists()) {
                        const lineManagerData = lineManagerSnapshot.val();
                        const lineManagerFullName = `${lineManagerData.firstName || lineManagerData.name || ''} ${lineManagerData.lastName || ''}`.trim();
                        
                        // Store both the line manager ID and their full name
                        updates.lineManagerName = lineManagerFullName;
                        
                        console.log(`Setting line manager for user ${updates.firstName} ${updates.lastName}: ${lineManagerFullName} (ID: ${form.lineManager.value})`);
                    } else {
                        console.warn(`Line manager with ID ${form.lineManager.value} not found in company scope`);
                        updates.lineManagerName = ''; // Clear the name if manager not found
                    }
                } else {
                    console.warn('Company ID not found for line manager lookup');
                    updates.lineManagerName = '';
                }
            } catch (error) {
                console.error('Error fetching line manager data:', error);
                // Continue with update even if line manager fetch fails
                updates.lineManagerName = '';
            }
        } else {
            // Clear line manager name if no line manager is selected
            updates.lineManagerName = '';
        }

        try {
            // IMPORTANT: Update user data only in company-scoped path to prevent duplicates
            const companyId = window.authManager?.getUser()?.companyId || 
                             window.companyData?.companyId ||
                             localStorage.getItem('currentCompanyId');
            
            if (!companyId) {
                throw new Error('Company ID not found - cannot update user');
            }
            
            const userPath = `companies/${companyId}/users/${userId}`;
            console.log('🔄 Updating user at company-scoped path only:', userPath);
            console.log('✅ No global user path updates will occur');
            
            // Update user data in the company-scoped database only
            await update(ref(this.db, userPath), updates);

            console.log('✅ User updated successfully in company-scoped path only');
            console.log('✅ No duplicate user records created');

            // Handle password update if provided
            if (form.password.value && form.password.value.trim() !== '') {
                await this.updateUserPassword(userId, form.password.value, form.email.value);
            }

            // Add audit log
            await this.logAudit(
                'update',
                'user',
                userId,
                `Updated user ${updates.firstName} ${updates.lastName}${form.password.value ? ' (password changed)' : ''}`
            );

            window.notificationManager.addNotification({
                type: 'Success',
                message: `User ${updates.firstName} ${updates.lastName} has been updated successfully.${form.password.value ? ' Password has been changed.' : ''}`
            });

            this.hideModal();
        } catch (error) {
            console.error('Error updating user:', error);
            window.notificationManager.addNotification({
                type: 'Error',
                message: `Failed to update user: ${error.message}`
            });
        }
    }

    /**
     * Update a user's password with proper security handling
     * @param {string} userId - The user ID whose password to update
     * @param {string} newPassword - The new password
     * @param {string} userEmail - The user's email address
     */
    async updateUserPassword(userId, newPassword, userEmail) {
        try {
            console.log(`Attempting to update password for user: ${userId}`);
            
            // Validate password strength
            if (!this.validatePasswordStrength(newPassword)) {
                throw new Error('Password does not meet security requirements. Please use at least 8 characters with uppercase, lowercase, numbers, and special characters.');
            }

            const currentUser = this.auth.currentUser;
            
            // Check if we're updating the current user's password
            if (currentUser && currentUser.uid === userId) {
                // User is updating their own password - requires re-authentication
                console.log('User is updating their own password');
                
                // Ask for current password for re-authentication
                const currentPassword = prompt('For security reasons, please enter your current password to confirm this change:');
                if (!currentPassword) {
                    throw new Error('Current password is required to change your password');
                }
                
                // Re-authenticate the user
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
                
                // Update the password
                await updatePassword(currentUser, newPassword);
                
                console.log('✅ Password updated successfully for current user');
                
                // If current user changed their own password, they should log out for security
                if (currentUser && currentUser.uid === userId) {
                    window.notificationManager.addNotification({
                        type: 'Info',
                        message: 'Your password has been changed successfully. Please log in again with your new password.'
                    });
                    
                    // Auto-logout after password change
                    setTimeout(() => {
                        if (window.authManager && typeof window.authManager.logout === 'function') {
                            window.authManager.logout();
                        } else {
                            // Fallback: redirect to login page
                            window.location.href = 'login.html';
                        }
                    }, 2000);
                }
            } else {
                // Admin is updating another user's password
                console.log('Admin is updating another user\'s password');
                
                // For admin password updates, we'll send a password reset email
                // This is more secure than directly changing passwords
                if (!userEmail) {
                    throw new Error('User email is required for password reset');
                }
                
                // Confirm with admin
                const confirmed = confirm(
                    `This will send a password reset email to ${userEmail}. ` +
                    `The user will need to click the link in the email to set their new password. ` +
                    `Continue?`
                );
                
                if (!confirmed) {
                    throw new Error('Password update cancelled by administrator');
                }
                
                // Send password reset email
                await sendPasswordResetEmail(this.auth, userEmail);
                
                console.log('✅ Password reset email sent successfully');
                
                // Update the notification to reflect that a reset email was sent
                window.notificationManager.addNotification({
                    type: 'Info',
                    message: `Password reset email sent to ${userEmail}. The user must check their email to complete the password change.`
                });
                
                // Log this action
                await this.logAudit(
                    'password_reset_email',
                    'user',
                    userId,
                    `Password reset email sent to ${userEmail} by administrator`
                );
                
                return; // Don't proceed with direct password update
            }
            
            // Log successful password change
            await this.logAudit(
                'password_change',
                'user',
                userId,
                `Password changed successfully`
            );
            
            // Add notification for successful password change
            window.notificationManager.addNotification({
                type: 'Success',
                message: 'Password has been updated successfully. Please log in with your new password.'
            });
            
        } catch (error) {
            console.error('Error updating user password:', error);
            
            // Handle specific Firebase Auth errors
            let errorMessage = 'Failed to update password: ';
            
            switch (error.code) {
                case 'auth/wrong-password':
                    errorMessage += 'The current password you entered is incorrect.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'The new password is too weak. Please choose a stronger password.';
                    break;
                case 'auth/requires-recent-login':
                    errorMessage += 'For security reasons, please log out and log back in before changing your password.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'User account not found.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your internet connection.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            // Log the failed attempt
            await this.logAudit(
                'password_change_failed',
                'user',
                userId,
                `Password change failed: ${error.message}`
            );
            
            throw new Error(errorMessage);
        }
    }

    /**
     * Validate password strength
     * @param {string} password - The password to validate
     * @returns {boolean} - True if password meets requirements
     */
    validatePasswordStrength(password) {
        if (!password || password.length < 8) return false;
        
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            // Get company ID for company-scoped deletion
            const companyId = window.authManager?.getUser()?.companyId || 
                             window.companyData?.companyId ||
                             localStorage.getItem('currentCompanyId');
            
            if (!companyId) {
                throw new Error('Company ID not found - cannot delete user');
            }

            // Get user data before deletion for audit log
            const userPath = `companies/${companyId}/users/${userId}`;
            const userRef = ref(this.db, userPath);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();

            console.log('🗑️ Deleting user from company-scoped path only:', userPath);
            console.log('✅ No global user path deletions will occur');

            // Delete user data from company-scoped database only
            await remove(ref(this.db, userPath));

            console.log('✅ User deleted successfully from company-scoped path only');

            // Add audit log
            await this.logAudit(
                'delete',
                'user',
                userId,
                `Deleted user ${userData.name} (${userData.email})`
            );

            // TODO: Implement Firebase Auth user deletion
            // This requires additional security measures

            window.notificationManager.addNotification({
                type: 'Success',
                message: 'User has been deleted successfully.'
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            window.notificationManager.addNotification({
                type: 'Error',
                message: `Failed to delete user: ${error.message}`
            });
        }
    }

    async loadUsers() {
        // Ensure company context is loaded
        await this.companyDataService.initializeUserContext();
        
        const currentCompanyId = this.companyDataService.getCurrentCompanyId();
        if (!currentCompanyId) {
            console.error('No company context available');
            return;
        }

        // Query users by company ID
        const usersRef = ref(this.db, 'users');
        const companyUsersQuery = query(usersRef, orderByChild('companyId'), equalTo(currentCompanyId));
        
        onValue(companyUsersQuery, (snapshot) => {
            const users = [];
            snapshot.forEach((childSnapshot) => {
                users.push({
                    uid: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            this.renderUsers(users);
        });
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        // First get all departments to build a label lookup map
        const departmentRef = ref(this.db, 'fieldOptions/department');
        get(departmentRef).then(snapshot => {
            const departmentMap = {};
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const dept = child.val();
                    // Map both the department ID and value to its data
                    departmentMap[child.key] = {
                        label: dept.label,
                        headOfDepartmentName: dept.headOfDepartmentName || ''
                    };
                    if (dept.value) {
                        departmentMap[dept.value] = {
                            label: dept.label,
                            headOfDepartmentName: dept.headOfDepartmentName || ''
                        };
                    }
                });
            }

            // Create a map of users for line manager email lookup
            const userEmailMap = {};
            users.forEach(user => {
                const fullName = `${user.firstName} ${user.lastName}`.trim();
                userEmailMap[fullName] = user.email;
            });

            tbody.innerHTML = '';
            users.forEach(user => {
                const role = this.roles.find(r => r.id === user.role);
                
                // Get the job title display text from the dropdown
                const jobTitleOption = document.querySelector(`#jobTitle option[value="${user.jobTitle}"]`);
                let jobTitleDisplay = '';
                if (jobTitleOption && jobTitleOption.dataset.displayText) {
                    jobTitleDisplay = jobTitleOption.dataset.displayText;
                } else if (user.jobTitle) {
                    // Fallback: Capitalize each word if we don't have the display text
                    jobTitleDisplay = user.jobTitle
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                }
                
                // Use department data from our map, or fallback to formatted department value
                let departmentDisplay = '';
                let headOfDepartmentDisplay = '';
                if (user.department && departmentMap[user.department]) {
                    departmentDisplay = departmentMap[user.department].label;
                    headOfDepartmentDisplay = departmentMap[user.department].headOfDepartmentName;
                } else if (user.department) {
                    departmentDisplay = user.department.charAt(0).toUpperCase() + user.department.slice(1);
                }

                // Get line manager email
                let lineManagerEmail = '';
                if (user.lineManagerName && userEmailMap[user.lineManagerName]) {
                    lineManagerEmail = userEmailMap[user.lineManagerName];
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.firstName} ${user.lastName}</td>
                    <td>${user.email}</td>
                    <td>${jobTitleDisplay}</td>
                    <td>${user.phone || ''}</td>
                    <td>${user.lineManagerName || (user.lineManager ? 'Manager Assigned' : 'No Manager')}</td>
                    <td>${lineManagerEmail || (user.lineManagerName ? 'Email not found' : '')}</td>
                    <td><span class="role-badge role-${user.role}">${role?.name || 'Unknown Role'}</span></td>
                    <td>${departmentDisplay}${headOfDepartmentDisplay ? ` (Head: ${headOfDepartmentDisplay})` : ''}</td>
                    <td><span class="status-badge status-${user.status || 'active'}">${user.status || 'Active'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-edit" data-action="edit" data-feature="user_management_view" title="Edit user">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-delete" data-action="delete" data-feature="user_management_view" title="Delete user">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;

                // Add event listeners for actions
                const editBtn = tr.querySelector('button[data-action="edit"]');
                const deleteBtn = tr.querySelector('button[data-action="delete"]');

                if (!editBtn.style.display || editBtn.style.display !== 'none') {
                    editBtn.addEventListener('click', () => this.showModal(user));
                }
                if (!deleteBtn.style.display || deleteBtn.style.display !== 'none') {
                    deleteBtn.addEventListener('click', () => this.deleteUser(user.uid));
                }

                tbody.appendChild(tr);
            });

            // Update visibility after rendering
            this.updateActionButtonsVisibility();

            // Add row hover effect
            tbody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = '#f8f9fa';
                });
                row.addEventListener('mouseleave', () => {
                    row.style.backgroundColor = '';
                });
            });
        }).catch(error => {
            console.error('Error loading departments:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load departments. Department names may not display correctly.'
            });
        });
    }

    filterUsers(searchTerm) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });

        // Highlight search terms
        if (searchTerm) {
            rows.forEach(row => {
                row.querySelectorAll('td').forEach(cell => {
                    if (!cell.querySelector('.action-buttons')) {  // Skip action buttons cell
                        const text = cell.textContent;
                        const regex = new RegExp(searchTerm, 'gi');
                        cell.innerHTML = text.replace(regex, match => `<mark>${match}</mark>`);
                    }
                });
            });
        }
    }

    async logAudit(action, resourceType, resourceId, details) {
        const currentUser = window.authManager.getUser();
        const auditEntry = {
            timestamp: serverTimestamp(),
            userId: currentUser?.uid || 'system',
            userEmail: currentUser?.email || 'system',
            action,
            resourceType,
            resourceId,
            details
        };

        try {
            await set(ref(this.db, `audit_logs/${Date.now()}`), auditEntry);
        } catch (error) {
            console.error('Error logging audit entry:', error);
        }
    }

    initializeAuditLog() {
        // Only initialize if we're on the audit log page
        const auditLogTable = document.getElementById('auditLogTableBody');
        if (!auditLogTable) return;

        // Load audit logs
        const auditLogsRef = ref(this.db, 'audit_logs');
        onValue(auditLogsRef, (snapshot) => {
            const logs = [];
            snapshot.forEach((childSnapshot) => {
                logs.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            this.renderAuditLogs(logs.reverse()); // Show newest first
        });

        // Add filter functionality
        const searchInput = document.querySelector('.search-input');
        const actionFilter = document.getElementById('actionFilter');
        const dateFilter = document.getElementById('dateFilter');

        [searchInput, actionFilter, dateFilter].forEach(element => {
            if (element) {
                element.addEventListener('change', () => this.filterAuditLogs());
            }
        });
    }

    renderAuditLogs(logs) {
        const tbody = document.getElementById('auditLogTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.userEmail}</td>
                <td><span class="badge badge-${log.action}">${log.action}</span></td>
                <td>${log.resourceType}</td>
                <td>${log.details}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    initializeDepartmentManagement() {
        // Only initialize if we're on the departments page
        const departmentTable = document.getElementById('departmentsTableBody');
        if (!departmentTable) return;

        // Load departments
        this.loadDepartments();

        // Department Modal Handlers
        const departmentModal = document.getElementById('departmentModal');
        const createDepartmentBtn = document.getElementById('createDepartmentBtn');
        const closeDepartmentModal = departmentModal.querySelector('.close-modal');
        const cancelDepartmentBtn = document.getElementById('cancelDepartmentBtn');
        const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');

        createDepartmentBtn.addEventListener('click', () => this.showDepartmentModal());
        closeDepartmentModal.addEventListener('click', () => this.hideDepartmentModal());
        cancelDepartmentBtn.addEventListener('click', () => this.hideDepartmentModal());
        saveDepartmentBtn.addEventListener('click', () => this.saveDepartment());
    }

    async loadDepartments() {
        try {
            await this.companyDataService.initializeUserContext();
            const currentCompanyId = this.companyDataService.getCurrentCompanyId();
            
            if (!currentCompanyId) {
                console.error('No company context available for loading departments');
                return;
            }

            const deptCountMap = {};
            // Only count users from the current company
            const usersRef = ref(this.db, 'users');
            const companyUsersQuery = query(usersRef, orderByChild('companyId'), equalTo(currentCompanyId));
            const usersSnapshot = await get(companyUsersQuery);
            const departments = (await get(ref(this.db, 'fieldOptions/department'))).val() || {};

            // Build department count for current company only
            if (usersSnapshot.exists()) {
                usersSnapshot.forEach(userSnapshot => {
                    if (userSnapshot.val().department) {
                        const deptId = userSnapshot.val().department;
                        deptCountMap[deptId] = (deptCountMap[deptId] || 0) + 1;
                    }
                });
            }

            const tbody = document.getElementById('departmentsTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            Object.entries(departments).forEach(([deptId, dept]) => {
                if (dept.enabled !== false) {
                    const row = document.createElement('tr');
                    const employeeCount = deptCountMap[deptId] || 0;
                    
                    row.innerHTML = `
                        <td>${dept.label}</td>
                        <td>${dept.headOfDepartmentName || '-'}</td>
                        <td>${dept.description || '-'}</td>
                        <td>${employeeCount}</td>
                        <td><span class="status-badge status-${dept.enabled ? 'active' : 'inactive'}">${dept.enabled ? 'Active' : 'Inactive'}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-edit" data-dept-id="${deptId}"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-delete" data-dept-id="${deptId}"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    `;

                    // Make entire row clickable
                    row.style.cursor = 'pointer';
                    row.addEventListener('click', (e) => {
                        // Don't open modal if clicking on action buttons
                        if (!e.target.closest('.action-buttons')) {
                            this.editDepartment(deptId);
                        }
                    });

                    // Add button event listeners
                    row.querySelector('.btn-edit').addEventListener('click', () => this.editDepartment(deptId));
                    row.querySelector('.btn-delete').addEventListener('click', () => this.deleteDepartment(deptId));

                    tbody.appendChild(row);
                }
            });
        } catch (error) {
            console.error('Error loading departments:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load departments. Please try again.'
            });
        }
    }

    createDepartmentTableRow(deptId, dept) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dept.name}</td>
            <td>${dept.headOfDepartment || '-'}</td>
            <td>${dept.description || '-'}</td>
            <td>${dept.employeeCount || 0}</td>
            <td><span class="status-badge status-${dept.status}">${dept.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-edit" data-dept-id="${deptId}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-delete" data-dept-id="${deptId}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners for edit and delete buttons
        row.querySelector('.btn-edit').addEventListener('click', () => this.editDepartment(deptId));
        row.querySelector('.btn-delete').addEventListener('click', () => this.deleteDepartment(deptId));

        return row;
    }

    async editDepartment(deptId) {
        try {
            const snapshot = await get(ref(this.db, `fieldOptions/department/${deptId}`));
            const department = snapshot.val();
            if (department) {
                department.id = deptId; // Add the ID to the department object
                await this.showDepartmentModal({
                    id: deptId,
                    label: department.label,
                    description: department.description,
                    headOfDepartment: department.headOfDepartment,
                    enabled: department.enabled
                });
            }
        } catch (error) {
            console.error('Error loading department for edit:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Error loading department. Please try again.'
            });
        }
    }

    async showDepartmentModal(department = null) {
        const modal = document.getElementById('departmentModal');
        const form = document.getElementById('departmentForm');
        const title = document.getElementById('departmentModalTitle');
        const headOfDepartmentSelect = form.querySelector('#headOfDepartment');
        const departmentNameInput = form.querySelector('#departmentName');
        const employeeList = document.getElementById('departmentEmployees');

        // Clear existing options except the first two (Select Head of Department and N/A)
        while (headOfDepartmentSelect.options.length > 2) {
            headOfDepartmentSelect.remove(2);
        }
        
        // Clear the employee list
        employeeList.innerHTML = '';

        // Load users from Firebase for the Head of Department dropdown and employee list
        const usersRef = ref(this.db, 'users');
        try {
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                // Keep track of employees for the current department
                const departmentEmployees = [];

                snapshot.forEach((childSnapshot) => {
                    const user = childSnapshot.val();
                    const option = document.createElement('option');
                    option.value = childSnapshot.key;
                    option.textContent = `${user.firstName} ${user.lastName}`;
                    headOfDepartmentSelect.appendChild(option);

                    // If editing a department, collect its employees
                    if (department && user.department === department.id) {
                        departmentEmployees.push({
                            name: `${user.firstName} ${user.lastName}`,
                            title: user.jobTitle || ''
                        });
                    }
                });

                // Display department employees if editing
                if (department && departmentEmployees.length > 0) {
                    departmentEmployees.forEach(employee => {
                        const employeeItem = document.createElement('div');
                        employeeItem.className = 'employee-item';
                        employeeItem.innerHTML = `
                            <span class="employee-name">${employee.name}</span>
                            <span class="employee-title">${employee.title}</span>
                        `;
                        employeeList.appendChild(employeeItem);
                    });
                } else {
                    employeeList.innerHTML = '<div class="employee-item">No employees in this department</div>';
                }

                // If editing and there's a head of department, set the selected value
                if (department && department.headOfDepartment) {
                    headOfDepartmentSelect.value = department.headOfDepartment;
                }
            }
        } catch (error) {
            console.error('Error loading users:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load users for department.'
            });
        }

        if (department) {
            title.textContent = 'Edit Department';
            form.elements.departmentName.value = department.label || '';
            form.elements.departmentDescription.value = department.description || '';
            form.elements.departmentStatus.value = department.enabled ? 'active' : 'inactive';
            form.dataset.deptId = department.id;
            
            // Make department name read-only when editing
            departmentNameInput.readOnly = true;
            departmentNameInput.style.backgroundColor = '#f5f5f5';
        } else {
            title.textContent = 'Create New Department';
            form.reset();
            delete form.dataset.deptId;
            
            // Make department name editable when creating new
            departmentNameInput.readOnly = false;
            departmentNameInput.style.backgroundColor = '';
        }

        modal.classList.add('show');
    }

    hideDepartmentModal() {
        const modal = document.getElementById('departmentModal');
        modal.classList.remove('show');
    }

    async saveDepartment() {
        const form = document.getElementById('departmentForm');
        const departmentId = form.dataset.deptId;
        const headOfDepartmentSelect = form.elements.headOfDepartment;
        const selectedHeadOption = headOfDepartmentSelect.options[headOfDepartmentSelect.selectedIndex];
        
        const departmentData = {
            label: form.elements.departmentName.value,
            description: form.elements.departmentDescription.value || '',
            headOfDepartment: headOfDepartmentSelect.value || '',
            headOfDepartmentName: selectedHeadOption ? selectedHeadOption.textContent : '',
            enabled: form.elements.departmentStatus.value === 'active',
            value: departmentId || form.elements.departmentName.value.toLowerCase().replace(/\s+/g, '-'),
            lastModifiedBy: this.auth.currentUser?.uid,
            lastModifiedAt: new Date().toISOString()
        };

        try {
            const updates = {};
            if (departmentId) {
                // Update existing department
                updates[`fieldOptions/department/${departmentId}`] = departmentData;
                
                await update(ref(this.db), updates);
                console.log(`Department ${departmentId} updated with head: ${departmentData.headOfDepartmentName}`);
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Department updated successfully.'
                });
            } else {
                // Create new department with a new key
                departmentId = departmentData.value;
                updates[`fieldOptions/department/${departmentId}`] = {
                    ...departmentData,
                    createdBy: this.auth.currentUser?.uid,
                    createdAt: departmentData.lastModifiedAt
                };
                
                await update(ref(this.db), updates);
                console.log(`New department ${departmentId} created with head: ${departmentData.headOfDepartmentName}`);
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Department created successfully.'
                });
            }
            
            this.hideDepartmentModal();
            await this.loadDepartments();
        } catch (error) {
            console.error('Error saving department:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Error saving department. Please try again.'
            });
        }
    }

    async deleteDepartment(deptId) {
        if (confirm('Are you sure you want to delete this department?')) {
            try {
                await remove(ref(this.db, `fieldOptions/department/${deptId}`));
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Department deleted successfully.'
                });
                await this.loadDepartments();
            } catch (error) {
                console.error('Error deleting department:', error);
                window.notificationManager?.addNotification({
                    type: 'Error',
                    message: 'Error deleting department. Please try again.'
                });
            }
        }
    }

    async loadJobTitles() {
        const jobTitlesRef = ref(this.db, 'job_titles');
        try {
            const snapshot = await get(jobTitlesRef);
            const jobTitles = snapshot.val() || {};
            
            const tbody = document.getElementById('jobTitlesTableBody');
            tbody.innerHTML = '';
            
            Object.entries(jobTitles).forEach(([titleId, title]) => {
                const row = this.createJobTitleTableRow(titleId, title);
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading job titles:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load job titles. Please try again.'
            });
        }
    }

    createJobTitleTableRow(titleId, title) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${title.name}</td>
            <td>${title.department}</td>
            <td>${title.description || '-'}</td>
            <td>${title.level}</td>
            <td><span class="status-badge status-${title.status}">${title.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-edit" data-title-id="${titleId}" data-feature="jobtitle_management_view" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-delete" data-title-id="${titleId}" data-feature="jobtitle_management_view" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners for edit and delete buttons
        row.querySelector('.btn-edit').addEventListener('click', () => this.editJobTitle(titleId));
        row.querySelector('.btn-delete').addEventListener('click', () => this.deleteJobTitle(titleId));

        return row;
    }

    showJobTitleModal(jobTitle = null) {
        const modal = document.getElementById('jobTitleModal');
        const form = document.getElementById('jobTitleForm');
        const title = document.getElementById('jobTitleModalTitle');

        // Populate department dropdown
        const departmentSelect = form.elements.titleDepartment;
        this.loadDepartmentsForSelect(departmentSelect);

        if (jobTitle) {
            title.textContent = 'Edit Job Title';
            form.elements.titleName.value = jobTitle.name;
            form.elements.titleDepartment.value = jobTitle.department;
            form.elements.titleDescription.value = jobTitle.description || '';
            form.elements.titleLevel.value = jobTitle.level;
            form.elements.titleStatus.value = jobTitle.status;
            form.dataset.titleId = jobTitle.id;
        } else {
            title.textContent = 'Create New Job Title';
            form.reset();
            delete form.dataset.titleId;
        }

        modal.classList.add('show');
    }

    hideJobTitleModal() {
        const modal = document.getElementById('jobTitleModal');
        modal.classList.remove('show');
    }

    async loadDepartmentsForSelect(selectElement) {
        try {
            // Get departments from form field configuration
            const fieldOptionsRef = ref(this.db, 'fieldOptions/department');
            const snapshot = await get(fieldOptionsRef);
            const departments = snapshot.val() || {};

            // Clear existing options except the first one
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }

            // Add department options
            Object.entries(departments).forEach(([key, dept]) => {
                if (dept.enabled !== false) { // Show all departments unless explicitly disabled
                    const option = document.createElement('option');
                    option.value = key;  // Use the department ID as value
                    option.textContent = dept.label || key; // Use label for display
                    selectElement.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error loading departments for select:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Failed to load departments. Please try again.'
            });
        }
    }

    async saveJobTitle() {
        const form = document.getElementById('jobTitleForm');
        const jobTitleData = {
            name: form.elements.titleName.value,
            department: form.elements.titleDepartment.value,
            description: form.elements.titleDescription.value,
            level: form.elements.titleLevel.value,
            status: form.elements.titleStatus.value,
            lastModifiedBy: this.auth.currentUser?.uid,
            lastModifiedAt: new Date().toISOString()
        };

        try {
            const titleId = form.dataset.titleId;
            if (titleId) {
                // Update existing job title
                await update(ref(this.db, `job_titles/${titleId}`), jobTitleData);
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Job title updated successfully.'
                });
            } else {
                // Create new job title
                jobTitleData.createdBy = this.auth.currentUser?.uid;
                jobTitleData.createdAt = jobTitleData.lastModifiedAt;
                await push(ref(this.db, 'job_titles'), jobTitleData);
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Job title created successfully.'
                });
            }
            
            this.hideJobTitleModal();
            await this.loadJobTitles();
        } catch (error) {
            console.error('Error saving job title:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Error saving job title. Please try again.'
            });
        }
    }

    async editJobTitle(titleId) {
        try {
            const snapshot = await get(ref(this.db, `job_titles/${titleId}`));
            const jobTitle = snapshot.val();
            if (jobTitle) {
                jobTitle.id = titleId;
                this.showJobTitleModal(jobTitle);
            }
        } catch (error) {
            console.error('Error loading job title for edit:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: 'Error loading job title. Please try again.'
            });
        }
    }

    async deleteJobTitle(titleId) {
        if (confirm('Are you sure you want to delete this job title?')) {
            try {
                await remove(ref(this.db, `job_titles/${titleId}`));
                await this.loadJobTitles();
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Job title deleted successfully.'
                });
            } catch (error) {
                console.error('Error deleting job title:', error);
                window.notificationManager?.addNotification({
                    type: 'Error',
                    message: 'Error deleting job title. Please try again.'
                });
            }
        }
    }

    initializeJobTitleManagement() {
        // Initialize job title modal handlers
        const jobTitleModal = document.getElementById('jobTitleModal');
        const createJobTitleBtn = document.getElementById('createJobTitleBtn');
        const closeJobTitleModal = jobTitleModal?.querySelector('.close-modal');
        const cancelJobTitleBtn = document.getElementById('cancelJobTitleBtn');
        const saveJobTitleBtn = document.getElementById('saveJobTitleBtn');

        if (createJobTitleBtn) {
            createJobTitleBtn.addEventListener('click', () => this.showJobTitleModal());
        }
        if (closeJobTitleModal) {
            closeJobTitleModal.addEventListener('click', () => this.hideJobTitleModal());
        }
        if (cancelJobTitleBtn) {
            cancelJobTitleBtn.addEventListener('click', () => this.hideJobTitleModal());
        }
        if (saveJobTitleBtn) {
            saveJobTitleBtn.addEventListener('click', () => this.saveJobTitle());
        }

        // Load job titles if we're on the right page
        if (document.getElementById('jobTitlesTableBody')) {
            this.loadJobTitles();
        }
    }

    // Load job titles from User Role options in Firebase
    loadJobTitlesFromConfig() {
        const jobTitleSelect = document.getElementById('jobTitle');
        if (!jobTitleSelect) return;

        // Reference to the user roles in Firebase
        const optionsRef = ref(this.db, 'fieldOptions/user-role');
        
        onValue(optionsRef, snapshot => {
            // Clear existing options except the first default option
            while (jobTitleSelect.options.length > 1) {
                jobTitleSelect.remove(1);
            }

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const option = childSnapshot.val();
                    if (option.enabled) {
                        const optionElement = document.createElement('option');
                        optionElement.value = option.value;
                        optionElement.textContent = option.label;
                        jobTitleSelect.appendChild(optionElement);
                    }
                });
            }
        });

        // Listen for field option changes
        document.addEventListener('fieldOptionsChanged', (event) => {
            if (event.detail.fieldType === 'user-role') {
                this.loadJobTitlesFromConfig();
            }
        });
    }

    // Migration function to update existing users with line manager names (company-scoped)
    async migrateLineManagerNames() {
        console.log('Starting migration to add line manager names...');
        
        try {
            // Get company ID for company-scoped migration
            const companyId = window.authManager?.getUser()?.companyId || 
                             window.companyData?.companyId ||
                             localStorage.getItem('currentCompanyId');
            
            if (!companyId) {
                console.warn('Company ID not found - skipping migration');
                return;
            }

            const usersPath = `companies/${companyId}/users`;
            const usersRef = ref(this.db, usersPath);
            const usersSnapshot = await get(usersRef);
            
            if (!usersSnapshot.exists()) {
                console.log('No users found for migration in company scope');
                return;
            }

            console.log('🔄 Running migration on company-scoped users only:', usersPath);

            const users = {};
            usersSnapshot.forEach((childSnapshot) => {
                users[childSnapshot.key] = {
                    uid: childSnapshot.key,
                    ...childSnapshot.val()
                };
            });

            let updatedCount = 0;
            const promises = [];

            // Iterate through all users in company scope
            for (const [userId, user] of Object.entries(users)) {
                // Check if user has a line manager but no line manager name
                if (user.lineManager && !user.lineManagerName) {
                    const lineManagerData = users[user.lineManager];
                    
                    if (lineManagerData && (lineManagerData.firstName || lineManagerData.name) && lineManagerData.lastName) {
                        const lineManagerFullName = `${lineManagerData.firstName || lineManagerData.name} ${lineManagerData.lastName}`.trim();
                        
                        console.log(`Updating ${user.firstName || user.name} ${user.lastName} with line manager: ${lineManagerFullName}`);
                        
                        const updatePromise = update(ref(this.db, `${usersPath}/${userId}`), {
                            lineManagerName: lineManagerFullName
                        });
                        
                        promises.push(updatePromise);
                        updatedCount++;
                    }
                }
            }

            if (promises.length > 0) {
                await Promise.all(promises);
                console.log(`Migration completed. Updated ${updatedCount} users with line manager names.`);
                
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: `Migration completed. Updated ${updatedCount} users with line manager names.`
                });
            } else {
                console.log('No users needed line manager name updates');
            }

        } catch (error) {
            console.error('Error during line manager name migration:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: `Migration failed: ${error.message}`
            });
        }
   }

    // Get direct reports for a specific user based on line manager relationships
    async getDirectReports(managerId) {
        try {
            const usersRef = ref(this.db, 'users');
            const usersSnapshot = await get(usersRef);
            const directReports = [];

            if (usersSnapshot.exists()) {
                usersSnapshot.forEach((childSnapshot) => {
                    const user = childSnapshot.val();
                    // Check if this user's line manager is the specified manager
                    if (user.lineManager === managerId) {
                        directReports.push({
                            uid: childSnapshot.key,
                            name: `${user.firstName} ${user.lastName}`,
                            email: user.email,
                            jobTitle: user.jobTitle,
                            department: user.department,
                            ...user
                        });
                    }
                });
            }

            return directReports;
        } catch (error) {
            console.error('Error getting direct reports:', error);
            return [];
        }
    }

    // Display direct reports in user details/modal
    async showDirectReports(managerId, containerElement) {
        const directReports = await this.getDirectReports(managerId);
        
        if (!containerElement) return;

        if (directReports.length === 0) {
            containerElement.innerHTML = '<div class="no-reports">No direct reports</div>';
            return;
        }

        const reportsHtml = directReports.map(report => `
            <div class="direct-report-item">
                <div class="report-name">${report.name}</div>
                <div class="report-details">${report.jobTitle || ''} - ${report.email}</div>
            </div>
        `).join('');

        containerElement.innerHTML = `
            <div class="direct-reports-list">
                <h4>Direct Reports (${directReports.length})</h4>
                ${reportsHtml}
            </div>
        `;
    }
}

// Initialize user manager
const userManager = new UserManager();

// Export for use in other modules
window.userManager = userManager;