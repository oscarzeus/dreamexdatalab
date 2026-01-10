// auth-manager.js - Centralized Authentication Manager for Dreamex DataLab
// Handles Firebase authentication, user management, and company branding

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentCompany = null;
        this.db = null;
        this.auth = null;
        this.storage = null;
        this.authChecked = false;
        this.initializeFirebase();
        this.initializeAuth();
    }

    initializeFirebase() {
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyC7Tz9K9CFB9QwGf8f5j8QzKsQK8zQK8zQ",
            authDomain: "dreamexdatalab.firebaseapp.com",
            databaseURL: "https://dreamexdatalab-default-rtdb.firebaseio.com",
            projectId: "dreamexdatalab",
            storageBucket: "dreamexdatalab.appspot.com",
            messagingSenderId: "123456789012",
            appId: "1:123456789012:web:abcdef123456"
        };

        // Initialize Firebase v9 compat
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.db = firebase.database();
        this.auth = firebase.auth();
        this.storage = firebase.storage();
    }

    initializeAuth() {
        // Check for stored user first (prevents flash redirect)
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                this.currentUser = JSON.parse(storedUser);
                this.updateUIForAuthenticatedUser();
            } catch (e) {
                console.warn('Could not parse stored user:', e);
            }
        }

        // Check authentication state
        this.auth.onAuthStateChanged(async (user) => {
            this.authChecked = true;
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                // Store user data for persistence check
                localStorage.setItem('currentUser', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                }));
                this.updateUIForAuthenticatedUser();
            } else {
                // Only redirect if no stored user AND auth has been checked
                const hasStoredUser = localStorage.getItem('currentUser');
                if (!hasStoredUser) {
                    this.handleUnauthenticatedUser();
                } else {
                    // Keep the stored user active, don't redirect
                    // This handles cases where Firebase takes time to restore session
                    console.log('Using stored user while Firebase reconnects...');
                }
            }
        });
    }

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            // Load user profile data
            const userRef = this.db.ref(`users/${this.currentUser.uid}`);
            const userSnapshot = await userRef.once('value');

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                this.currentUser = { ...this.currentUser, ...userData };

                // Load company data
                if (userData.companyId) {
                    await this.loadCompanyData(userData.companyId);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadCompanyData(companyId) {
        try {
            const companyRef = this.db.ref(`companies/${companyId}`);
            const companySnapshot = await companyRef.once('value');

            if (companySnapshot.exists()) {
                this.currentCompany = companySnapshot.val();
                this.currentCompany.id = companyId;
                this.updateCompanyBranding();
            }
        } catch (error) {
            console.error('Error loading company data:', error);
        }
    }

    updateCompanyBranding() {
        if (!this.currentCompany) return;

        const logoEl = document.getElementById('headerCompanyLogo');
        const nameEl = document.getElementById('headerCompanyName');

        if (logoEl) {
            logoEl.style.display = 'inline-block';
            if (this.currentCompany.logo) {
                logoEl.src = this.currentCompany.logo;
            }
        }

        if (nameEl) {
            nameEl.textContent = this.currentCompany.companyName || 'Dreamex DataLab';
        }
    }

    updateUIForAuthenticatedUser() {
        // Update user profile button
        const userProfileBtn = document.getElementById('userProfileBtn');
        if (userProfileBtn) {
            const img = userProfileBtn.querySelector('img');
            if (img && this.currentUser.photoURL) {
                img.src = this.currentUser.photoURL;
            }
        }

        // Update profile dropdown
        this.updateProfileDropdown();

        // Show authenticated content
        document.body.classList.add('authenticated');
        document.body.classList.remove('unauthenticated');
    }

    updateProfileDropdown() {
        const profileDropdown = document.querySelector('.profile-dropdown ul');
        if (!profileDropdown) return;

        const userName = this.currentUser.displayName ||
                        (this.currentUser.firstName && this.currentUser.lastName ?
                         `${this.currentUser.firstName} ${this.currentUser.lastName}` :
                         this.currentUser.email);

        profileDropdown.innerHTML = `
            <li><a href="profile.html"><i class="fas fa-user"></i> ${userName}</a></li>
            <li><a href="preferences.html"><i class="fas fa-cog"></i> Preferences</a></li>
            <li><a href="#" onclick="authManager.logout()"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
        `;
    }

    handleUnauthenticatedUser() {
        this.currentUser = null;
        this.currentCompany = null;

        // Hide authenticated content
        document.body.classList.add('unauthenticated');
        document.body.classList.remove('authenticated');

        // Clear stored user
        localStorage.removeItem('currentUser');

        // Redirect to login if not on login page or public pages
        const currentPath = window.location.pathname.toLowerCase();
        const publicPages = ['login.html', 'index.html', '404.html', 'company-complete-registration.html'];
        const isPublicPage = publicPages.some(page => currentPath.includes(page)) || currentPath === '/' || currentPath.endsWith('/');
        
        if (!isPublicPage) {
            window.location.href = 'login.html';
        }
    }

    async login(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            localStorage.removeItem('currentUser');
            await this.auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if signOut fails
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    }

    async resetPassword(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if user has permission for a specific feature
    hasPermission(feature) {
        if (!this.currentUser || !this.currentUser.role) return false;

        const userRole = this.currentUser.role;
        const rolePermissions = this.getRolePermissions(userRole);

        return rolePermissions.includes(feature);
    }

    // Get permissions for a role
    getRolePermissions(role) {
        const rolePermissions = {
            'super-admin': ['*'], // All permissions
            'admin': [
                'user_management', 'company_management', 'settings_view',
                'health_view', 'safety_view', 'hr_view', 'project_management',
                'inventory_view', 'requests_view', 'communication_view'
            ],
            'manager': [
                'health_view', 'safety_view', 'hr_view', 'project_management',
                'inventory_view', 'requests_view', 'communication_view'
            ],
            'user': [
                'health_assessment_view', 'training_view', 'incident_view',
                'requests_view', 'communication_view'
            ]
        };

        return rolePermissions[role] || [];
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Get current company
    getCurrentCompany() {
        return this.currentCompany;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Initialize global auth manager instance
const authManager = new AuthManager();
window.authManager = authManager;

// Export for module usage
export default authManager;
