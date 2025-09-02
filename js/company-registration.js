// Company Registration System
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get,
    push 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

class CompanyRegistration {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.currentStep = 1;
        this.totalSteps = 4;
        this.formData = {};
        this.additionalDomains = [];
        
        this.initializeEventListeners();
        this.validateStep();
    }

    initializeEventListeners() {
        // Navigation buttons
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevStep());
        document.getElementById('registrationForm').addEventListener('submit', (e) => this.handleSubmit(e));

        // Plan selection
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', () => this.selectPlan(card));
        });

        // Domain management
        document.getElementById('addDomainBtn').addEventListener('click', () => this.addDomain());
        document.getElementById('additionalDomain').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addDomain();
            }
        });

        // Form validation on input
        this.addRealTimeValidation();
    }

    addRealTimeValidation() {
        const inputs = document.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });

        // Password confirmation validation
        document.getElementById('confirmPassword').addEventListener('input', () => {
            this.validatePasswordConfirmation();
        });

        // Domain validation
        document.getElementById('primaryDomain').addEventListener('blur', () => {
            this.validateDomain(document.getElementById('primaryDomain'));
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }

        // Phone validation
        if (field.type === 'tel' && value) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(value.replace(/\s/g, ''))) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }

        // Password validation
        if (field.type === 'password' && field.id === 'adminPassword' && value) {
            if (!this.validatePassword(value)) {
                isValid = false;
                errorMessage = 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters';
            }
        }

        this.setFieldValidation(field, isValid, errorMessage);
        return isValid;
    }

    validatePassword(password) {
        const minLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
    }

    validatePasswordConfirmation() {
        const password = document.getElementById('adminPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        const confirmField = document.getElementById('confirmPassword');

        if (confirm && password !== confirm) {
            this.setFieldValidation(confirmField, false, 'Passwords do not match');
            return false;
        } else if (confirm) {
            this.setFieldValidation(confirmField, true, '');
            return true;
        }
        return true;
    }

    validateDomain(field) {
        const domain = field.value.trim();
        if (!domain) return false;

        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        const isValid = domainRegex.test(domain);

        if (!isValid) {
            this.setFieldValidation(field, false, 'Please enter a valid domain (e.g., example.com)');
        } else {
            this.setFieldValidation(field, true, '');
        }

        return isValid;
    }

    setFieldValidation(field, isValid, message) {
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        if (isValid) {
            field.style.borderColor = '#28a745';
        } else {
            field.style.borderColor = '#dc3545';
            if (message) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.style.cssText = 'color: #dc3545; font-size: 0.8rem; margin-top: 0.25rem;';
                errorDiv.textContent = message;
                field.parentElement.appendChild(errorDiv);
            }
        }
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    nextStep() {
        if (this.validateStep()) {
            this.saveStepData();
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateStepIndicator();
        }
    }

    prevStep() {
        this.currentStep--;
        this.showStep(this.currentStep);
        this.updateStepIndicator();
    }

    showStep(step) {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(stepEl => {
            stepEl.classList.remove('active');
        });

        // Show current step
        document.getElementById(`step${step}Content`).classList.add('active');

        // Update navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        nextBtn.style.display = step < this.totalSteps ? 'inline-flex' : 'none';
        submitBtn.style.display = step === this.totalSteps ? 'inline-flex' : 'none';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateStepIndicator() {
        for (let i = 1; i <= this.totalSteps; i++) {
            const step = document.getElementById(`step${i}`);
            const connector = document.getElementById(`connector${i}`);

            if (i < this.currentStep) {
                step.classList.add('completed');
                step.classList.remove('active');
                if (connector) connector.classList.add('completed');
            } else if (i === this.currentStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
                if (connector) connector.classList.remove('completed');
            }
        }
    }

    validateStep() {
        const currentStepElement = document.getElementById(`step${this.currentStep}Content`);
        const requiredFields = currentStepElement.querySelectorAll('input[required], select[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Additional step-specific validations
        if (this.currentStep === 3) {
            const selectedPlan = document.querySelector('.plan-card.selected');
            if (!selectedPlan) {
                this.showError('Please select a subscription plan');
                isValid = false;
            }
        }

        if (this.currentStep === 4) {
            if (!this.validatePasswordConfirmation()) {
                isValid = false;
            }

            const termsAgreement = document.getElementById('termsAgreement');
            if (!termsAgreement.checked) {
                this.showError('You must agree to the Terms of Service and Privacy Policy');
                isValid = false;
            }
        }

        return isValid;
    }

    saveStepData() {
        const currentStepElement = document.getElementById(`step${this.currentStep}Content`);
        const inputs = currentStepElement.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                this.formData[input.name] = input.checked;
            } else if (input.name) {
                this.formData[input.name] = input.value;
            }
        });

        // Save selected plan
        const selectedPlan = document.querySelector('.plan-card.selected');
        if (selectedPlan) {
            this.formData.selectedPlan = selectedPlan.dataset.plan;
        }

        // Save additional domains
        this.formData.additionalDomains = this.additionalDomains;
    }

    selectPlan(card) {
        // Remove selection from all cards
        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
        
        // Select clicked card
        card.classList.add('selected');
        
        // Update hidden field
        document.getElementById('selectedPlan').value = card.dataset.plan;
        
        this.hideError();
    }

    addDomain() {
        const domainInput = document.getElementById('additionalDomain');
        const domain = domainInput.value.trim();

        if (!domain) return;

        if (!this.validateDomain(domainInput)) return;

        // Check for duplicates
        if (this.additionalDomains.includes(domain)) {
            this.showError('This domain has already been added');
            return;
        }

        // Check against primary domain
        const primaryDomain = document.getElementById('primaryDomain').value.trim();
        if (domain === primaryDomain) {
            this.showError('Additional domain cannot be the same as primary domain');
            return;
        }

        this.additionalDomains.push(domain);
        this.updateDomainList();
        domainInput.value = '';
        this.hideError();
    }

    updateDomainList() {
        const domainList = document.getElementById('domainList');
        
        if (this.additionalDomains.length === 0) {
            domainList.style.display = 'none';
            return;
        }

        domainList.style.display = 'block';
        domainList.innerHTML = this.additionalDomains.map((domain, index) => `
            <div class="domain-item">
                <span>${domain}</span>
                <button type="button" class="btn-remove-domain" onclick="companyRegistration.removeDomain(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    removeDomain(index) {
        this.additionalDomains.splice(index, 1);
        this.updateDomainList();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateStep()) {
            return;
        }

        this.saveStepData();
        this.showLoading(true);
        this.hideError();

        try {
            // Generate company ID
            const companyId = this.generateCompanyId();
            
            // Create admin user account
            const userCredential = await createUserWithEmailAndPassword(
                this.auth,
                this.formData.contactEmail,
                this.formData.adminPassword
            );

            const adminUserId = userCredential.user.uid;

            // Create company data structure
            const companyData = {
                id: companyId,
                companyName: this.formData.companyName,
                registrationNumber: this.formData.registrationNumber,
                industry: this.formData.industry,
                employeeCount: this.formData.employeeCount,
                website: this.formData.website || '',
                address: this.formData.address,
                primaryDomain: this.formData.primaryDomain,
                additionalDomains: this.additionalDomains,
                subscriptionPlan: this.formData.selectedPlan,
                status: 'active',
                createdAt: new Date().toISOString(),
                createdBy: adminUserId,
                adminUserId: adminUserId
            };

            // Create admin user data
            const adminUserData = {
                firstName: this.formData.contactFirstName,
                lastName: this.formData.contactLastName,
                email: this.formData.contactEmail,
                jobTitle: this.formData.contactTitle,
                phone: this.formData.contactPhone,
                role: 'company-admin',
                companyId: companyId,
                status: 'active',
                createdAt: new Date().toISOString(),
                isCompanyAdmin: true
            };

            // Save to database
            await Promise.all([
                set(ref(this.db, `companies/${companyId}`), companyData),
                set(ref(this.db, `users/${adminUserId}`), adminUserData),
                set(ref(this.db, `companyUsers/${companyId}/${adminUserId}`), {
                    role: 'company-admin',
                    joinedAt: new Date().toISOString()
                })
            ]);

            // Create default company settings
            await this.createDefaultCompanySettings(companyId);

            this.showLoading(false);
            this.showSuccess('Account created successfully! Redirecting to login...');

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html?newCompany=true';
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showLoading(false);
            
            let errorMessage = 'An error occurred during registration. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email address already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address format.';
            }
            
            this.showError(errorMessage);
        }
    }

    generateCompanyId() {
        // Create a unique company ID based on company name and timestamp
        const cleanName = this.formData.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 10);
        const timestamp = Date.now().toString().slice(-6);
        return `${cleanName}_${timestamp}`;
    }

    async createDefaultCompanySettings(companyId) {
        const defaultSettings = {
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

        await set(ref(this.db, `companySettings/${companyId}`), defaultSettings);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Scroll to top to show error
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        // Scroll to top to show success
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.companyRegistration = new CompanyRegistration();
});

export default CompanyRegistration;
