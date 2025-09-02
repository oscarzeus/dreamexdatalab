import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class CompanyManager {    constructor() {
        this.companyForm = document.getElementById('companyForm');
        this.addDomainBtn = document.getElementById('addDomainBtn');
        this.additionalDomainsContainer = document.getElementById('additionalDomains');
        this.requestorSelect = document.getElementById('requestor');        this.logoInput = document.getElementById('companyLogo');
        this.logoPreview = document.getElementById('companyLogoPreview');
        this.removeLogoBtn = document.getElementById('removeLogoBtn');
        this.headerLogo = document.getElementById('headerCompanyLogo');
        this.domainCount = 0;
        this.db = getDatabase();
        this.auth = getAuth();        this.companyId = new URLSearchParams(window.location.search).get('id');        // Set default logo initially
        if (this.headerLogo) {
            this.headerLogo.src = 'assets/default-company-logo.png';
        }

        this.initializeEventListeners();
        this.loadUsers();
        
        // Hide logo section if this is a new company form and main company exists
        if (!this.companyId) {
            this.checkAndHideLogoSection();
        }
        
        this.disableMainOptionIfExists();
        if (this.companyId) {
            this.loadExistingCompany();
        }
        this.initializeLogoHandlers();
        
        // Update header with main company logo immediately
        this.updateHeaderLogo();
    }

    initializeEventListeners() {
        this.companyForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.addDomainBtn.addEventListener('click', () => this.addDomainField());        const companyTypeSelect = document.getElementById('companyType');
        companyTypeSelect.addEventListener('change', async (e) => {
            const logoSection = document.querySelector('.logo-upload-container').closest('.form-section');
            
            if (e.target.value === 'main') {
                const hasMainCompany = await this.checkMainCompanyExists();
                if (hasMainCompany) {
                    alert('A main company already exists. Only one main company is allowed.');
                    e.target.value = '';
                }
                logoSection.style.display = 'block';
            } else if (e.target.value === 'contractors' || e.target.value === 'subcontractors') {
                logoSection.style.display = 'none';
                // Reset logo when switching to contractors/subcontractors
                this.logoInput.value = '';
                this.logoPreview.src = 'assets/default-company-logo.png';
                this.logoPreview.parentElement.classList.remove('has-image');
            } else {
                logoSection.style.display = 'block';
            }
        });
    }

    async loadExistingCompany() {
        try {
            const companyRef = ref(this.db, `companies/${this.companyId}`);
            onValue(companyRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.populateFormData(data);
                } else {
                    alert('Company not found');
                    window.location.href = 'users.html';
                }
            }, {
                onlyOnce: true
            });
        } catch (error) {
            console.error('Error loading company data:', error);
            alert('Error loading company data');
        }
    }    populateFormData(data) {
        // Populate form fields with company data
        for (const [key, value] of Object.entries(data)) {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'date') {
                    element.value = value;
                } else if (element.type === 'number') {
                    element.value = value || '';
                } else if (element.type === 'url' || element.type === 'text' || element.type === 'email' || element.type === 'tel') {
                    element.value = value || '';
                } else if (element.tagName === 'SELECT') {
                    element.value = value || '';
                } else if (element.tagName === 'TEXTAREA') {
                    element.value = value || '';
                }
            }
        }

        // Handle additional domains
        if (data.additionalDomains) {
            data.additionalDomains.forEach(domain => {
                this.addDomainField(domain);
            });
        }

        // Handle logo - only show logo for main company type
        if (data.logoUrl && data.companyType === 'main') {
            this.logoPreview.src = data.logoUrl;
            this.logoPreview.parentElement.classList.add('has-image');
        } else {
            this.logoPreview.src = 'assets/default-company-logo.png';
            this.logoPreview.parentElement.classList.remove('has-image');
        }

        // Hide logo upload section for non-main companies
        const logoSection = document.querySelector('.logo-upload-container').closest('.form-section');
        if (data.companyType === 'contractors' || data.companyType === 'subcontractors') {
            logoSection.style.display = 'none';
        } else {
            logoSection.style.display = 'block';
        }
    }

    addDomainField(value = '') {
        this.domainCount++;
        const domainGroup = document.createElement('div');
        domainGroup.className = 'form-group domain-group';
        domainGroup.innerHTML = `
            <div class="domain-input-group">
                <input type="text" 
                       name="additionalDomain${this.domainCount}" 
                       class="additional-domain" 
                       placeholder="Enter additional domain"
                       value="${value}">
                <button type="button" class="btn btn-delete remove-domain">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        this.additionalDomainsContainer.appendChild(domainGroup);

        // Add remove event listener
        domainGroup.querySelector('.remove-domain').addEventListener('click', () => {
            domainGroup.remove();
        });
    }

    async loadUsers() {
        try {
            const usersRef = ref(this.db, 'users');
            onValue(usersRef, (snapshot) => {
                const users = snapshot.val();
                // Clear existing options except the default one
                while (this.requestorSelect.options.length > 1) {
                    this.requestorSelect.remove(1);
                }
                
                // Add users to dropdown
                if (users) {
                    Object.entries(users)
                        .sort((a, b) => {
                            const nameA = `${a[1].firstName} ${a[1].lastName}`;
                            const nameB = `${b[1].firstName} ${b[1].lastName}`;
                            return nameA.localeCompare(nameB);
                        })
                        .forEach(([uid, userData]) => {
                            const option = document.createElement('option');
                            option.value = uid;
                            option.textContent = `${userData.firstName} ${userData.lastName}`;
                            this.requestorSelect.appendChild(option);
                        });
                }
            });
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.companyForm);
        const companyType = formData.get('companyType');

        // Check if trying to create a main company when one already exists
        if (companyType === 'main') {
            const mainExists = await this.checkMainCompanyExists();
            if (mainExists) {
                alert('A main company already exists. Only one main company is allowed.');
                return;
            }
        }

        // Don't save logo for contractors/subcontractors
        if (companyType === 'contractors' || companyType === 'subcontractors') {
            this.logoInput.value = '';
            this.logoPreview.src = 'assets/default-company-logo.png';
        }

        const companyData = {
            id: this.companyId || Date.now().toString(),
            companyName: formData.get('companyName'),
            companyType: companyType,
            companyRegistration: formData.get('companyRegistration'),
            industry: formData.get('industry'),
            website: formData.get('website'),
            country: formData.get('country'),
            city: formData.get('city'),
            address: formData.get('address'),
            postalCode: formData.get('postalCode'),
            subscriptionStartDate: formData.get('subscriptionStartDate'),
            subscriptionEndDate: formData.get('subscriptionEndDate'),
            subscriptionPlan: formData.get('subscriptionPlan'),
            maxUsers: parseInt(formData.get('maxUsers')),
            primaryDomain: formData.get('primaryDomain'),
            contactName: formData.get('contactName'),
            contactEmail: formData.get('contactEmail'),
            contactPhone: formData.get('contactPhone'),
            billingAddress: formData.get('billingAddress'),
            billingEmail: formData.get('billingEmail'),
            additionalDomains: Array.from(document.querySelectorAll('.additional-domain'))
                .map(input => input.value)
                .filter(value => value.trim() !== ''),
            requestor: formData.get('requestor'),
            status: 'pending',
            requestedBy: this.auth.currentUser?.uid,
            updatedAt: new Date().toISOString()
        };

        // Only set createdAt for new companies
        if (!this.companyId) {
            companyData.createdAt = new Date().toISOString();
        }

        try {
            // Handle logo
            const logoFile = this.logoInput.files[0];
            if (logoFile) {
                companyData.logoUrl = await this.getBase64FromFile(logoFile);
            } else if (this.logoPreview.src !== 'assets/default-company-logo.png') {
                // Keep the existing logo if one exists and no new logo was uploaded
                companyData.logoUrl = this.logoPreview.src;
            }

            // Save to database
            await set(ref(this.db, `companies/${companyData.id}`), companyData);

            // Update header logo if this is the main company
            if (companyType === 'main') {
                await this.updateHeaderLogo();
            }

            alert('Company information saved successfully!');
            window.location.href = 'users.html';
        } catch (error) {
            console.error('Error saving company:', error);
            alert('Error saving company information. Please try again.');
        }
    }    // Get the main company's logo for headers and PDF reports
    async getMainCompanyLogo() {
        try {
            const companiesRef = ref(this.db, 'companies');
            return new Promise((resolve) => {
                onValue(companiesRef, (snapshot) => {
                    const companies = snapshot.val();
                    if (companies) {
                        // Find the main company
                        const mainCompany = Object.values(companies).find(company => 
                            company.companyType === 'main'
                        );
                        
                        if (mainCompany && mainCompany.logoUrl) {
                            resolve(mainCompany.logoUrl);
                        } else {
                            // Fallback to localStorage logo or default
                            const savedLogo = localStorage.getItem('companyLogo');
                            resolve(savedLogo || 'assets/default-company-logo.png');
                        }
                    } else {
                        // Fallback to localStorage logo or default
                        const savedLogo = localStorage.getItem('companyLogo');
                        resolve(savedLogo || 'assets/default-company-logo.png');
                    }
                }, { onlyOnce: true });
            });
        } catch (error) {
            console.error('Error getting main company logo:', error);
            // Fallback to localStorage logo or default
            const savedLogo = localStorage.getItem('companyLogo');
            return savedLogo || 'assets/default-company-logo.png';
        }
    }

    // Get the main company's name for headers and PDF reports
    async getMainCompanyName() {
        try {
            const companiesRef = ref(this.db, 'companies');
            return new Promise((resolve) => {
                onValue(companiesRef, (snapshot) => {
                    const companies = snapshot.val();
                    if (companies) {
                        // Find the main company
                        const mainCompany = Object.values(companies).find(company => 
                            company.companyType === 'main'
                        );
                        
                        if (mainCompany && mainCompany.companyName) {
                            resolve(mainCompany.companyName);
                        } else {
                            // Fallback to localStorage company data or default
                            const companyData = localStorage.getItem('companyData');
                            if (companyData) {
                                try {
                                    const parsed = JSON.parse(companyData);
                                    resolve(parsed.companyName || 'Company Name');
                                } catch {
                                    resolve('Company Name');
                                }
                            } else {
                                resolve('Company Name');
                            }
                        }
                    } else {
                        // Fallback to localStorage company data or default
                        const companyData = localStorage.getItem('companyData');
                        if (companyData) {
                            try {
                                const parsed = JSON.parse(companyData);
                                resolve(parsed.companyName || 'Company Name');
                            } catch {
                                resolve('Company Name');
                            }
                        } else {
                            resolve('Company Name');
                        }
                    }
                }, { onlyOnce: true });
            });
        } catch (error) {
            console.error('Error getting main company name:', error);
            // Fallback to localStorage company data or default
            const companyData = localStorage.getItem('companyData');
            if (companyData) {
                try {
                    const parsed = JSON.parse(companyData);
                    return parsed.companyName || 'Company Name';
                } catch {
                    return 'Company Name';
                }
            }
            return 'Company Name';
        }
    }

    // Load countries into the dropdown
    loadCountries() {
        const countries = [
            'Afghanistan', 'Albania', 'Algeria', /* ...add all countries... */
            'Zimbabwe'
        ];
        
        const countrySelect = document.getElementById('country');
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }

    async checkMainCompanyExists() {
        try {
            const companiesRef = ref(this.db, 'companies');
            const snapshot = await get(companiesRef);
            
            if (snapshot.exists()) {
                // Look for any company with type 'main'
                const companies = snapshot.val();
                return Object.values(companies).some(company => 
                    company.companyType === 'main' && company.id !== this.companyId // Exclude current company when editing
                );
            }
            return false;
        } catch (error) {
            console.error('Error checking main company:', error);
            return false;
        }
    }

    async disableMainOptionIfExists() {
        const hasMainCompany = await this.checkMainCompanyExists();
        const companyTypeSelect = document.getElementById('companyType');
        const mainOption = Array.from(companyTypeSelect.options).find(option => option.value === 'main');
        
        if (mainOption && hasMainCompany) {
            mainOption.disabled = true;
            mainOption.text = 'Main (Already Exists)';
        }
    }    initializeLogoHandlers() {
        this.logoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    alert('Please upload an image file (JPG, PNG, or GIF)');
                    this.logoInput.value = '';
                    return;
                }

                // Validate file size (2MB max)
                const maxSize = 2 * 1024 * 1024; // 2MB in bytes
                if (file.size > maxSize) {
                    alert('Logo file size must be less than 2MB');
                    this.logoInput.value = '';
                    return;
                }

                try {
                    const logoUrl = await this.getBase64FromFile(file);
                    this.logoPreview.src = logoUrl;
                    this.logoPreview.parentElement.classList.add('has-image');
                } catch (error) {
                    console.error('Error reading logo file:', error);
                    alert('Error reading logo file. Please try again.');
                    this.logoInput.value = '';
                }
            }
        });

        this.removeLogoBtn.addEventListener('click', () => {
            this.logoInput.value = '';
            this.logoPreview.src = 'assets/default-company-logo.png';
            this.logoPreview.parentElement.classList.remove('has-image');
            
            // If this is a main company and we're editing, update header logo
            if (document.getElementById('companyType').value === 'main') {
                this.updateHeaderLogo();
            }
        });
    }    async updateHeaderLogo() {
        try {
            if (!this.headerLogo) return;

            // Get the main company's logo to display in the header
            const companiesRef = ref(this.db, 'companies');
            const snapshot = await get(companiesRef);
            
            if (snapshot.exists()) {
                const companies = snapshot.val();
                const mainCompany = Object.values(companies).find(company => 
                    company.companyType === 'main'
                );
                
                if (mainCompany?.logoUrl && mainCompany.companyType === 'main') {
                    // Create a new Image to preload
                    const img = new Image();
                    img.onload = () => {
                        this.headerLogo.src = mainCompany.logoUrl;
                    };
                    img.onerror = () => {
                        this.headerLogo.src = 'assets/default-company-logo.png';
                    };
                    img.src = mainCompany.logoUrl;
                } else {
                    this.headerLogo.src = 'assets/default-company-logo.png';
                }
            } else {
                this.headerLogo.src = 'assets/default-company-logo.png';
            }
        } catch (error) {
            console.error('Error updating header logo:', error);
            if (this.headerLogo) {
                this.headerLogo.src = 'assets/default-company-logo.png';
            }
        }
    }

    async getBase64FromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    async checkAndHideLogoSection() {
        try {
            // Check if main company exists
            const hasMainCompany = await this.checkMainCompanyExists();
            
            // Hide logo section if main company exists
            const logoSection = document.querySelector('.logo-upload-container').closest('.form-section');
            if (hasMainCompany && logoSection) {
                logoSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking main company for logo section:', error);
        }
    }

    // Initialize the company manager when the DOM is loaded
}

// Initialize the company manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CompanyManager();
});