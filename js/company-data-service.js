// Company Data Isolation Service
// Ensures multi-tenant data security and isolation

import { 
    getDatabase, 
    ref, 
    query, 
    orderByChild, 
    equalTo,
    get,
    onValue 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class CompanyDataService {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.currentUser = null;
        this.currentCompany = null;
        this.userCompanyId = null;
        
        this.initializeUserContext();
    }

    async initializeUserContext() {
        return new Promise((resolve) => {
            // Check for stored user data first
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.currentUser = { uid: userData.uid };
                this.loadUserCompanyContext().then(resolve);
            } else {
                // Fallback to Firebase auth state
                this.auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        this.currentUser = user;
                        await this.loadUserCompanyContext();
                    }
                    resolve();
                });
            }
        });
    }

    async loadUserCompanyContext() {
        if (!this.currentUser) return;

        try {
            // Search for user in company structures (no global users lookup)
            const companiesRef = ref(this.db, 'companies');
            const companiesSnapshot = await get(companiesRef);
            
            if (companiesSnapshot.exists()) {
                const companies = companiesSnapshot.val();
                
                // Search through all companies for a user with matching authUid
                for (const [companyId, company] of Object.entries(companies)) {
                    if (company.status === 'active') {
                        // Check in company users
                        if (company.users && company.users[this.currentUser.uid]) {
                            const user = company.users[this.currentUser.uid];
                            if (user.authUid === this.currentUser.uid) {
                                this.userCompanyId = companyId;
                                this.currentCompany = company;
                                console.log('Company context loaded from company users:', company.companyName);
                                return;
                            }
                        }
                        
                        // Check in admin section
                        if (company.admin && (company.admin.authUid === this.currentUser.uid || company.admin.userId === this.currentUser.uid)) {
                            this.userCompanyId = companyId;
                            this.currentCompany = company;
                            console.log('Company context loaded from admin:', company.companyName);
                            return;
                        }
                    }
                }
                
                console.warn('User not found in any company structure');
            }
        } catch (error) {
            console.error('Error loading user company context:', error);
        }
    }

    // Get current user's company ID
    getCurrentCompanyId() {
        return this.userCompanyId;
    }

    // Get current company data
    getCurrentCompany() {
        return this.currentCompany;
    }

    // Check if user belongs to a company
    async hasCompanyAccess() {
        // If context is not loaded yet, try to load it
        if (!this.userCompanyId && this.currentUser) {
            await this.loadUserCompanyContext();
        }
        
        return !!this.userCompanyId;
    }

    // Check if user is company admin
    isCompanyAdmin() {
        if (!this.currentUser) return false;
        
        return new Promise(async (resolve) => {
            try {
                const userRef = ref(this.db, `users/${this.currentUser.uid}`);
                const snapshot = await get(userRef);
                
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    resolve(userData.role === 'company-admin' || userData.isCompanyAdmin === true);
                } else {
                    resolve(false);
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                resolve(false);
            }
        });
    }

    // Get company-filtered database reference
    getCompanyRef(path) {
        if (!this.userCompanyId) {
            throw new Error('User not associated with any company');
        }
        
        return ref(this.db, `companies/${this.userCompanyId}/${path}`);
    }

    // Get company-specific data
    async getCompanyData(dataType, callback = null) {
        if (!this.userCompanyId) {
            throw new Error('User not associated with any company');
        }

        const dataRef = ref(this.db, `companies/${this.userCompanyId}/${dataType}`);
        
        if (callback) {
            // Real-time listener
            return onValue(dataRef, callback);
        } else {
            // One-time read
            const snapshot = await get(dataRef);
            return snapshot.exists() ? snapshot.val() : null;
        }
    }

    // Get all users within the company
    async getCompanyUsers(callback = null) {
        if (!this.userCompanyId) {
            throw new Error('User not associated with any company');
        }

        // Query users by companyId
        const usersRef = ref(this.db, 'users');
        const companyUsersQuery = query(usersRef, orderByChild('companyId'), equalTo(this.userCompanyId));
        
        if (callback) {
            return onValue(companyUsersQuery, callback);
        } else {
            const snapshot = await get(companyUsersQuery);
            return snapshot.exists() ? snapshot.val() : {};
        }
    }

    // Get company departments
    async getCompanyDepartments(callback = null) {
        return this.getCompanyData('departments', callback);
    }

    // Get company training requests
    async getCompanyTrainingRequests(callback = null) {
        return this.getCompanyData('trainingRequests', callback);
    }

    // Get company risk assessments
    async getCompanyRiskAssessments(callback = null) {
        return this.getCompanyData('riskAssessments', callback);
    }

    // Get company access requests
    async getCompanyAccessRequests(callback = null) {
        return this.getCompanyData('accessRequests', callback);
    }

    // Get company events
    async getCompanyEvents(callback = null) {
        return this.getCompanyData('events', callback);
    }

    // Get company KPIs
    async getCompanyKPIs(callback = null) {
        return this.getCompanyData('kpis', callback);
    }

    // Get company incidents
    async getCompanyIncidents(callback = null) {
        return this.getCompanyData('incidents', callback);
    }

    // Get company audit logs (admin only)
    async getCompanyAuditLogs(callback = null) {
        const isAdmin = await this.isCompanyAdmin();
        if (!isAdmin) {
            throw new Error('Access denied: Admin privileges required');
        }
        
        return this.getCompanyData('auditLogs', callback);
    }

    // Filter data by company (for use with existing Firebase queries)
    filterByCompany(data) {
        if (!data || !this.userCompanyId) return {};
        
        const filtered = {};
        Object.keys(data).forEach(key => {
            const item = data[key];
            if (item && item.companyId === this.userCompanyId) {
                filtered[key] = item;
            }
        });
        
        return filtered;
    }

    // Add company ID to data before saving
    addCompanyContext(data) {
        if (!this.userCompanyId) {
            throw new Error('User not associated with any company');
        }
        
        return {
            ...data,
            companyId: this.userCompanyId,
            submittedBy: this.currentUser?.uid,
            submittedAt: new Date().toISOString()
        };
    }

    // Validate that data belongs to user's company
    validateCompanyAccess(data) {
        if (!data || !data.companyId) {
            throw new Error('Data does not have company association');
        }
        
        if (data.companyId !== this.userCompanyId) {
            throw new Error('Access denied: Data belongs to different company');
        }
        
        return true;
    }

    // Get company domain list for email validation
    getCompanyDomains() {
        if (!this.currentCompany) return [];
        
        const domains = [this.currentCompany.primaryDomain];
        if (this.currentCompany.additionalDomains) {
            domains.push(...this.currentCompany.additionalDomains);
        }
        
        return domains;
    }

    // Check if email domain belongs to company
    isCompanyEmail(email) {
        const domains = this.getCompanyDomains();
        const emailDomain = email.split('@')[1];
        return domains.includes(emailDomain);
    }

    // Get company settings
    async getCompanySettings(callback = null) {
        if (!this.userCompanyId) {
            throw new Error('User not associated with any company');
        }

        const settingsRef = ref(this.db, `companySettings/${this.userCompanyId}`);
        
        if (callback) {
            return onValue(settingsRef, callback);
        } else {
            const snapshot = await get(settingsRef);
            return snapshot.exists() ? snapshot.val() : this.getDefaultSettings();
        }
    }

    // Get default company settings
    getDefaultSettings() {
        return {
            notifications: {
                emailNotifications: true,
                smsNotifications: false,
                systemAlerts: true
            },
            security: {
                passwordPolicy: {
                    minLength: 8,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumbers: true,
                    requireSpecialChars: true,
                    expirationDays: 90
                },
                sessionTimeout: 30,
                twoFactorRequired: false
            },
            branding: {
                primaryColor: '#667eea',
                secondaryColor: '#764ba2',
                logoUrl: ''
            }
        };
    }

    // Company-aware notification system
    async sendCompanyNotification(notification) {
        const companyNotification = this.addCompanyContext(notification);
        
        // Send to all company users or specific recipients
        const recipients = notification.recipients || await this.getCompanyUsers();
        
        // Implementation would depend on your notification system
        console.log('Sending company notification:', companyNotification);
        
        return companyNotification;
    }

    // Generate company-specific reports
    async generateCompanyReport(reportType, dateRange = null) {
        const reportData = {
            companyId: this.userCompanyId,
            companyName: this.currentCompany?.companyName,
            reportType,
            dateRange,
            generatedAt: new Date().toISOString(),
            generatedBy: this.currentUser?.uid
        };

        // Collect relevant data based on report type
        switch (reportType) {
            case 'training':
                reportData.data = await this.getCompanyTrainingRequests();
                break;
            case 'incidents':
                reportData.data = await this.getCompanyIncidents();
                break;
            case 'risk-assessments':
                reportData.data = await this.getCompanyRiskAssessments();
                break;
            case 'users':
                reportData.data = await this.getCompanyUsers();
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        return reportData;
    }

    // Company data migration helper (for transitioning existing data)
    async migrateDataToCompanyStructure() {
        console.log('Starting company data migration...');
        
        // This would be used to migrate existing data to the new company-based structure
        // Implementation depends on your current data structure
        
        console.log('Company data migration completed');
    }

    // Force reinitialize the service (useful for troubleshooting)
    async reinitialize() {
        console.log('Reinitializing CompanyDataService...');
        
        // Clear current state
        this.currentUser = null;
        this.currentCompany = null;
        this.userCompanyId = null;
        
        // Check for stored user data
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            this.currentUser = { uid: userData.uid };
            await this.loadUserCompanyContext();
            console.log('CompanyDataService reinitialized with stored user data');
        } else {
            console.log('No stored user data found during reinitialize');
        }
        
        return this.hasCompanyAccess();
    }
}

// Export singleton instance
const companyDataService = new CompanyDataService();
export default companyDataService;

// Make it globally available
window.companyDataService = companyDataService;
