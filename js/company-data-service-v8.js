// Company Data Isolation Service - Firebase v8 Compatible
// Ensures multi-tenant data security and isolation

class CompanyDataService {
    constructor() {
        this.currentUser = null;
        this.currentCompany = null;
        this.userCompanyId = null;
        this.isInitialized = false;
        
        console.log('🏢 CompanyDataService v8 initialized');
        
        // Initialize immediately if Firebase is available
        if (typeof firebase !== 'undefined' && firebase.auth) {
            this.initializeUserContext();
        } else {
            console.warn('⚠️ Firebase not available yet, will initialize when ready');
        }
    }

    async initializeUserContext() {
        console.log('🔄 Initializing company user context...');
        
        return new Promise((resolve) => {
            // Check for stored user data first
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    console.log('📋 Found stored user data:', { uid: userData.uid, companyId: userData.companyId });
                    
                    this.currentUser = { uid: userData.uid };
                    this.userCompanyId = userData.companyId;
                    
                    if (userData.companyId) {
                        this.loadCompanyDetails(userData.companyId).then(() => {
                            this.isInitialized = true;
                            console.log('✅ Company context initialized from localStorage');
                            resolve();
                        });
                    } else {
                        this.loadUserCompanyContext().then(() => {
                            this.isInitialized = true;
                            resolve();
                        });
                    }
                } catch (error) {
                    console.error('Error parsing stored user data:', error);
                    this.fallbackToFirebaseAuth().then(resolve);
                }
            } else {
                console.log('📋 No stored user data, checking Firebase auth...');
                this.fallbackToFirebaseAuth().then(resolve);
            }
        });
    }

    async fallbackToFirebaseAuth() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.warn('⚠️ Firebase auth not available');
            return;
        }

        return new Promise((resolve) => {
            // Fallback to Firebase auth state
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('🔐 Firebase user authenticated:', user.uid);
                    this.currentUser = user;
                    await this.loadUserCompanyContext();
                } else {
                    console.log('❌ No Firebase user authenticated');
                }
                this.isInitialized = true;
                resolve();
            });
        });
    }

    async loadUserCompanyContext() {
        if (!this.currentUser) {
            console.warn('⚠️ No current user for company context loading');
            return;
        }

        try {
            console.log(`🔍 Loading company context for user: ${this.currentUser.uid}`);
            
            // Try to get user company data from Firebase
            if (typeof firebase !== 'undefined' && firebase.database) {
                const userRef = firebase.database().ref(`users/${this.currentUser.uid}`);
                const snapshot = await userRef.once('value');
                const userData = snapshot.val();
                
                if (userData && userData.companyId) {
                    console.log(`🏢 Found user company ID: ${userData.companyId}`);
                    this.userCompanyId = userData.companyId;
                    
                    // Load company details
                    await this.loadCompanyDetails(userData.companyId);
                    
                    // Update localStorage with company info
                    const currentStoredUser = localStorage.getItem('currentUser');
                    if (currentStoredUser) {
                        const storedUserData = JSON.parse(currentStoredUser);
                        storedUserData.companyId = userData.companyId;
                        localStorage.setItem('currentUser', JSON.stringify(storedUserData));
                        console.log('💾 Updated localStorage with company ID');
                    }
                } else {
                    console.warn('⚠️ User data not found or missing company ID');
                    // Create a fallback company ID based on user email domain
                    if (this.currentUser.email) {
                        const emailDomain = this.currentUser.email.split('@')[1];
                        if (emailDomain && emailDomain !== 'gmail.com' && emailDomain !== 'yahoo.com') {
                            this.userCompanyId = emailDomain.split('.')[0];
                            console.log(`🏢 Created fallback company ID from email: ${this.userCompanyId}`);
                        } else {
                            // Ultimate fallback
                            this.userCompanyId = 'default-company';
                            console.log(`🏢 Using default company ID: ${this.userCompanyId}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error loading user company context:', error);
            // Create fallback company ID
            this.userCompanyId = 'error-fallback-company';
            console.log(`🏢 Error fallback company ID: ${this.userCompanyId}`);
        }
    }

    async loadCompanyDetails(companyId) {
        if (!companyId) return;

        try {
            console.log(`🏢 Loading company details for: ${companyId}`);
            
            if (typeof firebase !== 'undefined' && firebase.database) {
                const companyRef = firebase.database().ref(`companies/${companyId}`);
                const snapshot = await companyRef.once('value');
                const companyData = snapshot.val();
                
                if (companyData) {
                    this.currentCompany = {
                        id: companyId,
                        name: companyData.name || companyId,
                        ...companyData
                    };
                    console.log(`✅ Company details loaded: ${this.currentCompany.name}`);
                } else {
                    console.warn(`⚠️ Company data not found for: ${companyId}`);
                    // Create a basic company object
                    this.currentCompany = {
                        id: companyId,
                        name: companyId
                    };
                }
            }
        } catch (error) {
            console.error('❌ Error loading company details:', error);
            // Create fallback company object
            this.currentCompany = {
                id: companyId,
                name: companyId
            };
        }
    }

    getCurrentCompanyId() {
        const companyId = this.userCompanyId || (this.currentCompany && this.currentCompany.id);
        console.log(`🏢 getCurrentCompanyId returning: ${companyId}`);
        return companyId;
    }

    getCurrentCompanyName() {
        const companyName = (this.currentCompany && this.currentCompany.name) || this.userCompanyId;
        console.log(`🏢 getCurrentCompanyName returning: ${companyName}`);
        return companyName;
    }

    getCurrentCompany() {
        console.log(`🏢 getCurrentCompany returning:`, this.currentCompany);
        return this.currentCompany;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isUserInitialized() {
        return this.isInitialized;
    }

    // Helper method to get company-scoped Firebase reference
    getCompanyRef(path = '') {
        const companyId = this.getCurrentCompanyId();
        if (!companyId) {
            throw new Error('No company context available');
        }
        
        const fullPath = path ? `companies/${companyId}/${path}` : `companies/${companyId}`;
        console.log(`📡 Creating Firebase ref for path: ${fullPath}`);
        
        if (typeof firebase !== 'undefined' && firebase.database) {
            return firebase.database().ref(fullPath);
        } else {
            throw new Error('Firebase database not available');
        }
    }

    // Helper method to validate company context
    validateCompanyContext() {
        const companyId = this.getCurrentCompanyId();
        if (!companyId) {
            console.error('❌ No company context available');
            return false;
        }
        console.log(`✅ Company context validated: ${companyId}`);
        return companyId;
    }

    // Method to force refresh company context
    async refreshCompanyContext() {
        console.log('🔄 Refreshing company context...');
        this.isInitialized = false;
        await this.initializeUserContext();
        return this.getCurrentCompanyId();
    }

    // Method to set company context manually (for testing/development)
    setCompanyContext(companyId, companyName = null) {
        console.log(`🏢 Manually setting company context: ${companyId}`);
        this.userCompanyId = companyId;
        this.currentCompany = {
            id: companyId,
            name: companyName || companyId
        };
        this.isInitialized = true;
        
        // Update localStorage if current user exists
        const currentStoredUser = localStorage.getItem('currentUser');
        if (currentStoredUser) {
            try {
                const storedUserData = JSON.parse(currentStoredUser);
                storedUserData.companyId = companyId;
                localStorage.setItem('currentUser', JSON.stringify(storedUserData));
                console.log('💾 Updated localStorage with manual company ID');
            } catch (error) {
                console.error('Error updating localStorage with manual company ID:', error);
            }
        }
    }

    // Debug method
    debug() {
        console.log('🔍 CompanyDataService Debug Info:');
        console.log('================================');
        console.log('Initialized:', this.isInitialized);
        console.log('Current User:', this.currentUser);
        console.log('User Company ID:', this.userCompanyId);
        console.log('Current Company:', this.currentCompany);
        console.log('Company ID from getCurrentCompanyId():', this.getCurrentCompanyId());
        console.log('Company Name from getCurrentCompanyName():', this.getCurrentCompanyName());
        
        // Check localStorage
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('Stored User Data:', userData);
            } catch (error) {
                console.log('Error parsing stored user data:', error);
            }
        } else {
            console.log('No stored user data found');
        }
        console.log('================================');
    }
}

// Create global instance
console.log('🏢 Creating global CompanyDataService instance...');
const companyDataService = new CompanyDataService();

// Make it globally available
window.companyDataService = companyDataService;

console.log('✅ CompanyDataService v8 ready and globally available');
