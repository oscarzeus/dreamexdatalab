import { loginWithEmail, logoutUser, resetPassword, getDatabase, ref, onValue, get, update, set } from './firebase-config-v8.js';
import companyDataService from './company-data-service.js';

class AuthManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.db = getDatabase();
        this.currentCompany = null;
        this.initializeAuth();
    }

    initializeAuth() {
        // Check if we're on the login page
        if (window.location.pathname.includes('login.html')) {
            this.initializeLoginPage();
        } else if (window.location.pathname.includes('company-complete-registration.html')) {
            // Skip authentication check for registration page
            return;
        } else if (window.location.pathname.includes('approval-settings.html')) {
            // Skip authentication check for approval-settings page - allow access to all users
            console.log('Skipping authentication check for approval-settings.html');
            // Still load user data if available, but don't require authentication
            if (this.currentUser) {
                this.loadUserRole(this.currentUser);
                this.loadUserCompany();
            }
            this.updateUIForAuthenticatedUser();
            return;
        } else {
            // Check if user is logged in
            if (!this.currentUser) {
                window.location.href = 'login.html';
                return;
            }
            
            // Check page access permissions
            this.checkPageAccess().then(hasAccess => {
                if (!hasAccess) {
                    console.warn('Page access denied, redirecting to unauthorized.html');
                    window.location.href = 'unauthorized.html';
                    return;
                }
                
                this.loadUserRole(this.currentUser);
                this.loadUserCompany();
                this.updateUIForAuthenticatedUser();
            }).catch(error => {
                console.error('Error checking page access:', error);
                window.location.href = 'unauthorized.html';
            });

            // Add event listeners for user profile dropdown
            const userProfileBtn = document.getElementById('userProfileBtn');
            const profileDropdown = document.querySelector('.profile-dropdown');
            
            if (userProfileBtn && profileDropdown) {
                userProfileBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    profileDropdown.classList.toggle('show');
                });

                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!userProfileBtn.contains(e.target)) {
                        profileDropdown.classList.remove('show');
                    }
                });
            }
        }

        // Handle logout
        const logoutBtn = document.querySelector('.profile-dropdown a[href="#"]');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    async loadUserCompany() {
        if (!this.currentUser) return;

        try {
            // Get user's company information from company data service
            if (window.companyDataService) {
                await window.companyDataService.initializeUserContext();
                const companyId = window.companyDataService.getCurrentCompanyId();
                
                if (companyId) {
                    // Load company data
                    const companyRef = ref(this.db, `companies/${companyId}`);
                    const companySnapshot = await get(companyRef);
                    
                    if (companySnapshot.exists()) {
                        this.currentCompany = companySnapshot.val();
                        this.updateCompanyBranding();
                    }
                } else {
                    console.warn('No company context found for user');
                }
            } else {
                console.warn('Company data service not available');
            }
        } catch (error) {
            console.error('Error loading user company:', error);
        }
    }

    updateCompanyBranding() {
        if (!this.currentCompany) return;

        // Update company logo in header
        const headerLogo = document.getElementById('headerCompanyLogo');
        if (headerLogo && this.currentCompany.logoUrl) {
            headerLogo.src = this.currentCompany.logoUrl;
        }

        // Update page title if needed
        const title = document.title;
        if (title.includes('Dreamex Datalab HSE')) {
            document.title = title.replace('Dreamex Datalab HSE', `${this.currentCompany.companyName} HSE`);
        }

        // Apply company branding colors if available
        if (this.currentCompany.branding) {
            const root = document.documentElement;
            if (this.currentCompany.branding.primaryColor) {
                root.style.setProperty('--primary-color', this.currentCompany.branding.primaryColor);
            }
            if (this.currentCompany.branding.secondaryColor) {
                root.style.setProperty('--secondary-color', this.currentCompany.branding.secondaryColor);
            }
        }
    }

    async checkPageAccess() {
        const currentPath = window.location.pathname;
        const userRole = this.currentUser?.role;

        // Public pages accessible to all authenticated users
        const publicPages = ['/index.html', '/account.html', '/profile.html', '/unauthorized.html', '/company-complete-registration.html'];
        if (publicPages.some(page => currentPath.includes(page))) {
            return true;
        }

        // Check if user has company access by checking Firebase directly
        const hasCompanyAccess = await this.checkUserCompanyAccess();
        if (!hasCompanyAccess) {
            console.warn('User does not have company access - no valid company association found');
            return false;
        }

        // Company management pages accessible to all company users
        const companyPages = ['/dashboard.html', '/companyboard.html', '/tasks.html', '/companymanagement.html', '/settings.html', '/staff.html', '/roles.html', '/recruitboard.html', '/jobdetails.html', '/jobpost.html', '/jobscreen.html', '/interview.html', '/matrixhr.html'];
        if (companyPages.some(page => currentPath.includes(page))) {
            console.log('Granting access to company page:', currentPath);
            return true;
        }

        // User Management page - requires specific permission
        if (currentPath.includes('/users.html')) {
            console.log('Checking user management access for user role:', userRole);
            return await this.checkSpecificPermission('user_management_view');
        }

        // Admin-only pages - restricted to admin and super user roles
        const adminPages = ['/approval-settings.html'];
        if (adminPages.some(page => currentPath.includes(page))) {
            const allowedRoles = ['admin', 'super user'];
            const hasAdminAccess = allowedRoles.includes(userRole);
            console.log('Admin page access check for', currentPath, '- User role:', userRole, '- Access granted:', hasAdminAccess);
            return hasAdminAccess;
        }

        // Check role-specific permissions from Firebase for other pages
        const roleRef = ref(this.db, `roles/${userRole}/permissions`);
        return new Promise((resolve) => {
            onValue(roleRef, (snapshot) => {
                const permissions = snapshot.val() || {};
                const allowedPages = permissions.pages || [];
                
                // Check if current page is in allowed pages
                const isAllowed = allowedPages.some(page => 
                    currentPath.includes(page.toLowerCase())
                );
                
                console.log('Role-based access check for', currentPath, ':', isAllowed);
                resolve(isAllowed);
            }, {
                onlyOnce: true
            });
        });
    }

    async checkUserCompanyAccess() {
        if (!this.currentUser) return false;

        try {
            // Wait for company data service to be available (with timeout)
            let retries = 0;
            const maxRetries = 20; // 10 seconds total
            while (!window.companyDataService && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            
            // Get user's company information from company data service
            if (window.companyDataService) {
                await window.companyDataService.initializeUserContext();
                const companyId = window.companyDataService.getCurrentCompanyId();
                
                if (!companyId) {
                    console.warn('User not associated with any company');
                    return false;
                }

                // Verify company exists and is active
                const companyRef = ref(this.db, `companies/${companyId}`);
                const companySnapshot = await get(companyRef);
                
                if (!companySnapshot.exists()) {
                    console.warn('Associated company not found');
                    return false;
                }

                const companyData = companySnapshot.val();
                
                if (companyData.status !== 'active') {
                    console.warn('Company is not active');
                    return false;
                }

                return true;
            } else {
                console.warn('Company data service not available after waiting');
                return false;
            }
        } catch (error) {
            console.error('Error checking company access:', error);
            return false;
        }
    }

    async checkSpecificPermission(permissionName) {
        if (!this.currentUser) {
            console.warn('No current user found for permission check');
            return false;
        }

        const userRole = this.currentUser.role;
        if (!userRole) {
            console.warn('No role found for current user');
            return false;
        }

        try {
            // Check if user has the specific permission through their role
            const roleRef = ref(this.db, `roles/${userRole}/permissions`);
            const roleSnapshot = await get(roleRef);
            
            if (!roleSnapshot.exists()) {
                console.warn(`Role ${userRole} permissions not found`);
                return false;
            }

            const permissions = roleSnapshot.val();
            const hasPermission = permissions && permissions[permissionName] === true;
            
            console.log(`Permission check for ${permissionName}:`, hasPermission, 'for role:', userRole);
            console.log('Available permissions for role:', userRole, Object.keys(permissions || {}));
            
            return hasPermission;
        } catch (error) {
            console.error('Error checking specific permission:', error);
            return false;
        }
    }

    initializeLoginPage() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = loginForm.email.value;
                const password = loginForm.password.value;
                const errorDiv = document.getElementById('loginError');
                errorDiv.style.display = 'none';

                try {
                    const userData = await loginWithEmail(email, password);
                    
                    // Search for user ONLY in company structures (no global users lookup)
                    console.log('Searching for user in company structures...');
                    
                    // Get all companies and search for user by authUid
                    const companiesRef = ref(this.db, 'companies');
                    const companiesSnapshot = await get(companiesRef);
                    
                    let userInfo = null;
                    let companyData = null;
                    
                    if (companiesSnapshot.exists()) {
                        const companies = companiesSnapshot.val();
                        let foundUser = null;
                        let foundCompanyId = null;
                        
                        // Search through all companies for a user with matching authUid
                        for (const [companyId, company] of Object.entries(companies)) {
                            // Check company status first
                            if (company.status !== 'active') {
                                continue; // Skip inactive companies
                            }
                            
                            // Check in company users
                            if (company.users) {
                                for (const [userId, user] of Object.entries(company.users)) {
                                    if (user.authUid === userData.uid || userId === userData.uid) {
                                        foundUser = user;
                                        foundCompanyId = companyId;
                                        companyData = company;
                                        break;
                                    }
                                }
                            }
                            
                            // Also check in admin section for company admins
                            if (!foundUser && company.admin && (company.admin.authUid === userData.uid || company.admin.userId === userData.uid)) {
                                foundUser = company.admin;
                                foundCompanyId = companyId;
                                companyData = company;
                            }
                            
                            if (foundUser) break;
                        }
                        
                        if (foundUser) {
                            // Create userInfo from company user data
                            userInfo = {
                                uid: userData.uid,
                                email: foundUser.email,
                                name: foundUser.name || foundUser.adminName,
                                role: foundUser.role,
                                department: foundUser.department,
                                companyId: foundCompanyId,
                                requiresPasswordChange: foundUser.requiresPasswordChange,
                                isFirstLogin: foundUser.isFirstLogin,
                                isCompanyAdmin: foundUser.isCompanyAdmin
                            };
                            companyData = companies[foundCompanyId];
                            console.log('✅ User found in company scope:', foundCompanyId);
                        } else {
                            errorDiv.textContent = 'Your account is not associated with any company. Please contact your administrator.';
                            errorDiv.style.display = 'block';
                            return;
                        }
                    } else {
                        errorDiv.textContent = 'No companies found. Please contact support.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Verify company is active  
                    if (companyData.status !== 'active') {
                        errorDiv.textContent = 'Your company account is inactive. Please contact support.';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    
                    // Check if this is the user's first login and requires password change
                    if (userInfo.requiresPasswordChange || userInfo.isFirstLogin) {
                        // Store additional company information for the modal
                        userInfo.companyName = companyData.companyName;
                        // Show password change modal instead of redirecting
                        this.showFirstLoginPasswordModal(userData, password, userInfo);
                        return;
                    }
                    
                    // Update user data with company info
                    userData.companyId = userInfo.companyId;
                    userData.companyName = companyData.companyName;
                    userData.role = userInfo.role;
                    userData.department = userInfo.department;
                    userData.name = userInfo.name;
                    
                    await this.loadUserRole(userData);
                    this.setCurrentUser(userData);
                    
                    // Check for new company parameter
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('newCompany') === 'true') {
                        // Redirect to setup wizard for new companies
                        window.location.href = 'company-setup.html';
                    } else {
                        // Redirect to dashboard page for all logged-in users
                        window.location.href = 'dashboard.html';
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    errorDiv.textContent = this.getErrorMessage(error.code);
                    errorDiv.style.display = 'block';
                }
            });
        }

        // Add company registration link if it doesn't exist
        this.addRegistrationLink();
        
        // Initialize password reset functionality
        this.initializePasswordReset();
    }

    addRegistrationLink() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        // Check if registration link already exists
        if (document.getElementById('companyRegistrationLink')) return;

        const registrationDiv = document.createElement('div');
        registrationDiv.style.cssText = 'text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e9ecef;';
        registrationDiv.innerHTML = `
            <p style="margin: 0; color: #6c757d;">
                Don't have a company account? 
                <a href="company-complete-registration.html" id="companyRegistrationLink" style="color: #667eea; text-decoration: none; font-weight: 600;">
                    Register your company
                </a>
            </p>
        `;

        loginForm.appendChild(registrationDiv);
    }

    async loadUserRole(userData) {
        if (!userData || !userData.role) return;

        try {
            let roleData = null;
            
            // First try to load from company-scoped roles if company ID is available
            if (userData.companyId || this.currentUser?.companyId) {
                const companyId = userData.companyId || this.currentUser?.companyId;
                const companyRoleRef = ref(this.db, `companies/${companyId}/roles/${userData.role}`);
                const companyRoleSnapshot = await get(companyRoleRef);
                
                if (companyRoleSnapshot.exists()) {
                    roleData = companyRoleSnapshot.val();
                    console.log('✅ Loaded company-scoped role:', roleData.name || userData.role);
                }
            }
            
            // Fallback to global roles if company role not found
            if (!roleData) {
                const globalRoleRef = ref(this.db, `roles/${userData.role}`);
                const globalRoleSnapshot = await get(globalRoleRef);
                
                if (globalRoleSnapshot.exists()) {
                    roleData = globalRoleSnapshot.val();
                    console.log('✅ Loaded global role:', roleData.name || userData.role);
                }
            }
            
            // Set the role in role manager if available
            if (roleData && window.roleManager?.setRole) {
                window.roleManager.setRole(roleData);
            }
            
            return roleData;
            
        } catch (error) {
            console.error('❌ Error loading user role:', error);
            
            // Fallback to original method for backwards compatibility
            const roleRef = ref(this.db, `roles/${userData.role}`);
            return new Promise((resolve, reject) => {
                onValue(roleRef, (snapshot) => {
                    const roleData = snapshot.val();
                    if (roleData) {
                        window.roleManager?.setRole(roleData);
                    }
                    resolve(roleData);
                }, {
                    onlyOnce: true
                });
            });
        }
    }

    getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/user-not-found':
                return 'No account found with this email';
            case 'auth/wrong-password':
                return 'Incorrect password';
            default:
                return 'An error occurred during login';
        }
    }

    getCurrentUser() {
        // First check for 'currentUser' key (used by main login system)
        let user = localStorage.getItem('currentUser');
        if (user) {
            return JSON.parse(user);
        }
        
        // If not found, check for 'user' key (used by index.html modal login)
        user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            // Migrate the user data to the standard 'currentUser' key for consistency
            localStorage.setItem('currentUser', JSON.stringify(userData));
            return userData;
        }
        
        return null;
    }

    setCurrentUser(userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('user', JSON.stringify(userData)); // For consistency with index.html
        this.currentUser = userData;
    }

    async logout() {
        const success = await logoutUser();
        if (success) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('user'); // Clear both keys
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('user');
            this.currentUser = null;
            window.roleManager?.setRole(null);
            window.location.href = 'login.html';
        }
    }

    async updateUIForAuthenticatedUser() {
        const profileBtn = document.querySelector('.profile-btn');
        const profileDropdown = document.querySelector('.profile-dropdown ul');
        
        if (profileBtn && profileDropdown) {
            if (this.currentUser) {
                // Use centralized display methods
                const initials = this.getUserInitials();
                const displayName = this.getUserDisplayName();
                const email = this.getUserEmail();

                // Try to get custom avatar
                try {
                    const avatarUrl = await this.getUserAvatarUrl();
                    if (avatarUrl) {
                        profileBtn.innerHTML = `
                            <img src="${avatarUrl}" alt="Profile Picture" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        `;
                    } else {
                        profileBtn.innerHTML = `
                            <div class="avatar-initials">${initials}</div>
                        `;
                    }
                } catch (error) {
                    profileBtn.innerHTML = `
                        <div class="avatar-initials">${initials}</div>
                    `;
                }

                // Update dropdown content with user info (without role and company)
                profileDropdown.innerHTML = `
                    <li class="user-info">
                        <div class="user-details">
                            <div class="user-name">${displayName}</div>
                            <div class="user-email">${email}</div>
                        </div>
                    </li>
                    <li class="divider"></li>
                    <li><a href="profile.html"><i class="fas fa-user-circle"></i> View Profile</a></li>
                    <li><a href="account.html"><i class="fas fa-user"></i> Account Settings</a></li>
                    <li data-feature="session_management_view"><a href="session.html"><i class="fas fa-key"></i> Session Management</a></li>
                    <li><a href="#"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
                `;

                // Re-attach logout event listener
                const logoutBtn = profileDropdown.querySelector('a[href="#"]');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.logout();
                    });
                }
            } else {
                // For non-authenticated users, show a guest profile or login option
                profileBtn.innerHTML = `
                    <div class="avatar-initials">G</div>
                `;

                profileDropdown.innerHTML = `
                    <li class="user-info">
                        <div class="user-details">
                            <div class="user-name">Guest User</div>
                            <div class="user-email">Not logged in</div>
                        </div>
                    </li>
                    <li class="divider"></li>
                    <li><a href="login.html"><i class="fas fa-sign-in-alt"></i> Login</a></li>
                `;
            }
        }
        
        // Update other user display elements on the page
        this.updateUserProfileDisplay();
    }

    initializePasswordReset() {
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const passwordResetModal = document.getElementById('passwordResetModal');
        const closePasswordResetModal = document.getElementById('closePasswordResetModal');
        const cancelPasswordReset = document.getElementById('cancelPasswordReset');
        const passwordResetForm = document.getElementById('passwordResetForm');

        if (!forgotPasswordLink || !passwordResetModal || !passwordResetForm) return;

        // Show password reset modal
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            passwordResetModal.style.display = 'flex';
            document.getElementById('resetEmail').focus();
        });

        // Close modal events
        const closeModal = () => {
            passwordResetModal.style.display = 'none';
            this.clearPasswordResetForm();
        };

        closePasswordResetModal.addEventListener('click', closeModal);
        cancelPasswordReset.addEventListener('click', closeModal);

        // Close modal when clicking outside
        passwordResetModal.addEventListener('click', (e) => {
            if (e.target === passwordResetModal) {
                closeModal();
            }
        });

        // Handle password reset form submission
        passwordResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handlePasswordReset();
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && passwordResetModal.style.display === 'flex') {
                closeModal();
            }
        });
    }

    async handlePasswordReset() {
        const resetEmail = document.getElementById('resetEmail').value.trim();
        const errorDiv = document.getElementById('passwordResetError');
        const successDiv = document.getElementById('passwordResetSuccess');
        const submitBtn = document.querySelector('#passwordResetForm button[type="submit"]');

        // Clear previous messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        if (!resetEmail) {
            errorDiv.textContent = 'Please enter your email address.';
            errorDiv.style.display = 'block';
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(resetEmail)) {
            errorDiv.textContent = 'Please enter a valid email address.';
            errorDiv.style.display = 'block';
            return;
        }

        // Disable submit button during processing
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
            const result = await resetPassword(resetEmail);
            
            if (result.success) {
                successDiv.textContent = 'Password reset email sent! Please check your inbox and follow the instructions to reset your password.';
                successDiv.style.display = 'block';
                
                // Clear the form
                document.getElementById('resetEmail').value = '';
                
                // Auto close modal after 3 seconds
                setTimeout(() => {
                    document.getElementById('passwordResetModal').style.display = 'none';
                    this.clearPasswordResetForm();
                }, 3000);
            } else {
                errorDiv.textContent = this.getPasswordResetErrorMessage(result.error);
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Password reset error:', error);
            errorDiv.textContent = 'An unexpected error occurred. Please try again.';
            errorDiv.style.display = 'block';
        } finally {
            // Re-enable submit button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    getPasswordResetErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/too-many-requests':
                return 'Too many password reset attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection and try again.';
            default:
                return 'Failed to send password reset email. Please try again.';
        }
    }

    clearPasswordResetForm() {
        document.getElementById('resetEmail').value = '';
        document.getElementById('passwordResetError').style.display = 'none';
        document.getElementById('passwordResetSuccess').style.display = 'none';
    }

    showFirstLoginPasswordModal(userData, currentPassword, userInfo) {
        const modal = document.getElementById('firstLoginPasswordModal');
        if (!modal) {
            console.error('First login password modal not found');
            return;
        }

        // Show the modal
        modal.style.display = 'flex';
        
        // Set the current password field (readonly)
        document.getElementById('currentPasswordFirst').value = currentPassword;
        
        // Store user data for later use
        this.tempUserData = userData;
        this.tempUserInfo = userInfo;
        
        // Initialize the form handler
        this.initializeFirstLoginPasswordForm();
        
        // Focus on new password field
        setTimeout(() => {
            document.getElementById('newPasswordFirst').focus();
        }, 100);
    }

    initializeFirstLoginPasswordForm() {
        const form = document.getElementById('firstLoginPasswordForm');
        if (!form) return;

        // Remove any existing event listeners to avoid duplicates
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        // Add form submission handler
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFirstLoginPasswordChange();
        });

        // Add password confirmation validation
        const newPassword = document.getElementById('newPasswordFirst');
        const confirmPassword = document.getElementById('confirmPasswordFirst');

        const validatePasswordMatch = () => {
            if (newPassword.value && confirmPassword.value) {
                if (newPassword.value !== confirmPassword.value) {
                    confirmPassword.setCustomValidity('Passwords do not match');
                } else {
                    confirmPassword.setCustomValidity('');
                }
            }
        };

        newPassword.addEventListener('input', validatePasswordMatch);
        confirmPassword.addEventListener('input', validatePasswordMatch);
    }

    async handleFirstLoginPasswordChange() {
        const newPassword = document.getElementById('newPasswordFirst').value;
        const confirmPassword = document.getElementById('confirmPasswordFirst').value;
        const errorDiv = document.getElementById('firstLoginPasswordError');
        const successDiv = document.getElementById('firstLoginPasswordSuccess');
        const submitBtn = document.querySelector('#firstLoginPasswordForm button[type="submit"]');
        const loadingSpan = submitBtn.querySelector('.loading');
        const normalSpan = submitBtn.querySelector('.normal-text');

        // Clear previous messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        // Validate passwords
        if (newPassword.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters long.';
            errorDiv.style.display = 'block';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match.';
            errorDiv.style.display = 'block';
            return;
        }

        // Show loading state
        loadingSpan.style.display = 'flex';
        normalSpan.style.display = 'none';
        submitBtn.disabled = true;

        try {
            // First, update Firebase Auth password using v8 syntax
            const firebase = window.firebase;
            const auth = firebase.auth();
            const currentUser = auth.currentUser;
            
            if (currentUser) {
                // Re-authenticate user with current credentials if needed
                const currentPassword = document.getElementById('currentPasswordFirst').value;
                const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
                await currentUser.reauthenticateWithCredential(credential);
                
                // Update password in Firebase Auth
                await currentUser.updatePassword(newPassword);
                console.log('Firebase Auth password updated successfully');
            }
            
            // Update user password and flags in database
            const userId = this.tempUserData.uid;
            const companyId = this.tempUserInfo.companyId;
            
            // Update only the user record in the company's users collection (no global users)
            const userRef = ref(this.db, `companies/${companyId}/users`);
            const usersSnapshot = await get(userRef);
            
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();
                let userKey = null;
                
                // Find the user by authUid (most reliable) or email
                Object.entries(users).forEach(([key, userData]) => {
                    if (userData.authUid === userId || userData.email === this.tempUserData.email) {
                        userKey = key;
                    }
                });

                if (userKey) {
                    // Update user data in company directory
                    const updateData = {
                        requiresPasswordChange: false,
                        isFirstLogin: false,
                        status: 'active', // Activate the account
                        passwordChangedAt: new Date().toISOString()
                    };

                    const userUpdateRef = ref(this.db, `companies/${companyId}/users/${userKey}`);
                    await update(userUpdateRef, updateData);

                    // Show success message
                    successDiv.textContent = 'Account activated successfully! Redirecting...';
                    successDiv.style.display = 'block';

                    // Update stored user data
                    this.tempUserData.companyId = companyId;
                    this.tempUserData.companyName = this.tempUserInfo.companyName || 'Unknown Company';

                    // Wait a moment then complete the login process
                    setTimeout(() => {
                        this.completeLogin(this.tempUserData);
                    }, 2000);

                } else {
                    console.error('User not found in company users collection:', {
                        searchId: userId,
                        searchEmail: this.tempUserData.email,
                        availableUsers: Object.keys(users),
                        companyId: companyId
                    });
                    throw new Error('User account not found in company directory. Please contact your administrator.');
                }
            } else {
                throw new Error('Company user directory not found. Please contact your administrator.');
            }

        } catch (error) {
            console.error('Error updating password:', error);
            let errorMessage = 'Failed to update password. Please try again.';
            
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Current password is incorrect.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'New password is too weak. Please use at least 6 characters.';
            } else if (error.message && error.message.includes('contact your administrator')) {
                errorMessage = error.message;
            }
            
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            
            // Reset loading state
            loadingSpan.style.display = 'none';
            normalSpan.style.display = 'flex';
            submitBtn.disabled = false;
        }
    }

    async completeLogin(userData) {
        try {
            await this.loadUserRole(userData);
            this.setCurrentUser(userData);
            
            // Hide the modal
            document.getElementById('firstLoginPasswordModal').style.display = 'none';
            
            // Clear temporary data
            this.tempUserData = null;
            this.tempUserInfo = null;
            
            // Check for new company parameter
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('newCompany') === 'true') {
                // Redirect to setup wizard for new companies
                window.location.href = 'company-setup.html';
            } else {
                // Redirect to dashboard page for all logged-in users
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error('Error completing login:', error);
            const errorDiv = document.getElementById('firstLoginPasswordError');
            errorDiv.textContent = 'Login completed but there was an error redirecting. Please refresh the page.';
            errorDiv.style.display = 'block';
        }
    }

    // Get user display name with consistent fallback logic
    getUserDisplayName() {
        if (!this.currentUser) return 'User';
        
        // Helper function to clean and validate name
        const cleanName = (name) => {
            if (!name || typeof name !== 'string') return null;
            
            // Remove unwanted patterns (system-generated usernames, IDs, etc.)
            const unwantedPatterns = [
                /^standard_[a-z0-9]+$/i,        // standard_mcz5jhe4
                /^[a-z0-9]{8,}$/i,              // random strings of 8+ chars
                /^user_[a-z0-9]+$/i,            // user_something
                /^[0-9]+$/,                     // pure numbers
                /dreamex/i,                     // company name fragments
                /^[a-z]{2,3}_[a-z0-9]+$/i      // prefix_random patterns
            ];
            
            const cleanedName = name.trim();
            
            // Check if name matches any unwanted pattern
            if (unwantedPatterns.some(pattern => pattern.test(cleanedName))) {
                return null;
            }
            
            // Must be at least 2 characters and contain at least one letter
            if (cleanedName.length < 2 || !/[a-zA-Z]/.test(cleanedName)) {
                return null;
            }
            
            return cleanedName;
        };
        
        // Try each potential name source in order of preference
        const potentialNames = [
            this.currentUser.name,
            this.currentUser.displayName,
            this.currentUser.firstName && this.currentUser.lastName ? 
                this.currentUser.firstName + ' ' + this.currentUser.lastName : null,
            this.currentUser.firstName,
            this.currentUser.lastName
        ];
        
        for (const name of potentialNames) {
            const cleaned = cleanName(name);
            if (cleaned) return cleaned;
        }
        
        // Final fallback to email username (but clean it too)
        if (this.currentUser.email) {
            const emailUsername = this.currentUser.email.split('@')[0];
            const cleaned = cleanName(emailUsername);
            if (cleaned) return cleaned;
        }
        
        return 'User';
    }

    // Get user initials for avatar display
    getUserInitials() {
        const displayName = this.getUserDisplayName();
        
        if (!displayName || displayName === 'User') return 'U';
        
        const words = displayName.split(' ').filter(word => word.length > 0);
        if (words.length === 1) {
            return words[0].substring(0, 2).toUpperCase();
        } else {
            return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
        }
    }

    // Get user email
    getUserEmail() {
        return this.currentUser?.email || '';
    }

    // Get user role
    getUserRole() {
        return this.currentUser?.role || 'User';
    }

    // Get user department
    getUserDepartment() {
        return this.currentUser?.department || '';
    }

    // Get user company information
    getUserCompany() {
        return {
            id: this.currentUser?.companyId,
            name: this.currentUser?.companyName
        };
    }

    // Get user avatar URL or initials
    async getUserAvatarUrl() {
        if (!this.currentUser) return null;
        
        try {
            const firebase = window.firebase;
            const storage = firebase.storage();
            const avatarPath = `avatars/${this.currentUser.uid}/profile.jpg`;
            const avatarRef = storage.ref(avatarPath);
            
            return await avatarRef.getDownloadURL();
        } catch (error) {
            // No custom avatar found
            return null;
        }
    }

    // Update user avatar display with custom image or initials
    async updateUserAvatarDisplay(elementId = 'userAvatarInitials') {
        const avatarElement = document.getElementById(elementId);
        if (avatarElement) {
            try {
                const avatarUrl = await this.getUserAvatarUrl();
                if (avatarUrl) {
                    // Show custom avatar
                    avatarElement.innerHTML = `<img src="${avatarUrl}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                } else {
                    // Show initials
                    avatarElement.textContent = this.getUserInitials();
                }
            } catch (error) {
                // Fallback to initials
                avatarElement.textContent = this.getUserInitials();
            }
        }
    }

    // Update user avatar initials on page
    updateUserAvatarInitials(elementId = 'userAvatarInitials') {
        const avatarElement = document.getElementById(elementId);
        if (avatarElement) {
            avatarElement.textContent = this.getUserInitials();
        }
    }

    // Update user profile display elements
    async updateUserProfileDisplay() {
        // Update avatar displays with custom images or initials
        await this.updateUserAvatarDisplay();
        await this.updateUserAvatarDisplay('userInitials'); // Alternative ID used in some pages
        
        // Update user name displays
        const userNameElements = document.querySelectorAll('#userName, #userDisplayName, .user-name-display');
        userNameElements.forEach(element => {
            element.textContent = this.getUserDisplayName();
        });
        
        // Update user email displays
        const userEmailElements = document.querySelectorAll('#userEmail, #userDisplayEmail, .user-email-display');
        userEmailElements.forEach(element => {
            element.textContent = this.getUserEmail();
        });
        
        // Update user role displays
        const userRoleElements = document.querySelectorAll('#userRole, .user-role-display');
        userRoleElements.forEach(element => {
            element.textContent = this.getUserRole();
        });
    }
}

// Initialize authentication manager
const authManager = new AuthManager();

// Export for use in other modules
window.authManager = authManager;