// Complete Company Registration & Setup System
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
    push,
    update
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

class CompleteCompanyRegistration {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.currentStep = 1;
        this.totalSteps = 5;
        this.formData = {
            company: {},
            contact: {},
            billing: {},
            admin: {},
            selectedFeatures: []
        };
        this.additionalDomains = [];
        this.selectedPlan = null;
        this.selectedFeatures = new Set(); // Track selected features for pricing
        this.subdomainCheckTimeout = null; // For debouncing subdomain availability checks
        
        // Define base prices per user/month and feature costs
        this.basePrices = {
            free: 0,        // Free trial - no cost
            enterprise: 25  // Enterprise - $25 per user/month base
        };
        
        // Cost per feature per user/month for each plan type
        this.featureCosts = {
            free: 0,        // Free trial includes all features
            enterprise: 5   // Each additional feature costs $5 per user/month
        };
        
        this.initializeEventListeners();
        this.updateProgress();
        this.updateStepIndicator();
    }

    initializeEventListeners() {
        // Navigation buttons
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        const finishBtn = document.getElementById('finishBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
        }
        if (finishBtn) {
            finishBtn.addEventListener('click', () => this.finishRegistration());
        }

        // Plan selection
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', () => this.selectPlan(card));
        });

        // User count input for Enterprise plan
        const userCountInput = document.getElementById('userCount');
        if (userCountInput) {
            userCountInput.addEventListener('input', () => {
                this.updateTotalPrice();
                // Update the user quota in form data when user count changes
                if (this.selectedPlan === 'enterprise') {
                    this.formData.userQuota = parseInt(userCountInput.value) || 1;
                    console.log('User quota updated to:', this.formData.userQuota);
                }
            });
        }

        // Feature selection
        document.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', () => {
                // Handle feature selection only
                if (card.dataset.feature) {
                    this.toggleFeature(card);
                }
            });
        });

        // Domain management
        const addDomainBtn = document.getElementById('addDomainBtn');
        if (addDomainBtn) {
            addDomainBtn.addEventListener('click', () => this.addDomain());
        }

        const additionalDomainInput = document.getElementById('additionalDomain');
        if (additionalDomainInput) {
            additionalDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addDomain();
                }
            });
        }

        // Subdomain validation and preview
        const subdomainInput = document.getElementById('subdomainName');
        if (subdomainInput) {
            subdomainInput.addEventListener('input', () => {
                this.debounceSubdomainCheck();
                this.updateSubdomainPreview();
            });
            subdomainInput.addEventListener('blur', () => {
                this.validateSubdomainField();
            });
        }

        // Form validation
        this.addFormValidation();

        // Auto-fill contact email from primary contact
        const contactEmailField = document.getElementById('contactEmail');
        if (contactEmailField) {
            contactEmailField.addEventListener('blur', () => {
                const adminEmailField = document.getElementById('adminEmail');
                if (adminEmailField && !adminEmailField.value) {
                    adminEmailField.value = contactEmailField.value;
                }
            });
        }

        // Auto-suggest subdomain from company name
        const companyNameField = document.getElementById('companyName');
        if (companyNameField) {
            companyNameField.addEventListener('blur', () => {
                const subdomainField = document.getElementById('subdomainName');
                if (subdomainField && !subdomainField.value && companyNameField.value) {
                    const suggestion = this.generateSubdomainSuggestion(companyNameField.value);
                    subdomainField.value = suggestion;
                    this.updateSubdomainPreview();
                    this.debounceSubdomainCheck();
                }
            });
        }
    }

    addFormValidation() {
        // Real-time validation for all required fields
        const inputs = document.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.validateField(input);
                }
            });
        });

        // Password confirmation validation
        const passwordField = document.getElementById('adminPassword');
        const confirmPasswordField = document.getElementById('confirmPassword');
        
        if (passwordField && confirmPasswordField) {
            const validatePasswords = () => {
                if (confirmPasswordField.value && passwordField.value !== confirmPasswordField.value) {
                    this.showFieldError(confirmPasswordField, 'Passwords do not match');
                } else {
                    this.clearFieldError(confirmPasswordField);
                }
            };

            passwordField.addEventListener('input', validatePasswords);
            confirmPasswordField.addEventListener('input', validatePasswords);
        }

        // Email validation
        const emailFields = document.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            field.addEventListener('blur', () => {
                if (field.value && !this.isValidEmail(field.value)) {
                    this.showFieldError(field, 'Please enter a valid email address');
                }
            });
        });
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Check if required field is empty
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Specific validation rules
        if (value && field.type === 'email' && !this.isValidEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }

        if (value && field.type === 'url' && !this.isValidUrl(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid URL';
        }

        if (field.id === 'adminPassword' && value) {
            const minLength = 8;
            const hasUppercase = /[A-Z]/.test(value);
            const hasLowercase = /[a-z]/.test(value);
            const hasNumbers = /\d/.test(value);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

            if (value.length < minLength) {
                isValid = false;
                errorMessage = `Password must be at least ${minLength} characters long`;
            } else if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecialChar) {
                isValid = false;
                errorMessage = 'Password must contain uppercase, lowercase, numbers, and special characters';
            }
        }

        if (isValid) {
            this.clearFieldError(field);
        } else {
            this.showFieldError(field, errorMessage);
        }

        return isValid;
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    showFieldError(field, message) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
            const errorElement = formGroup.querySelector('.form-error');
            if (errorElement) {
                errorElement.textContent = message;
            }
        }
    }

    clearFieldError(field) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
        }
    }

    selectPlan(planCard) {
        // Remove selection from all plans
        document.querySelectorAll('.plan-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select clicked plan
        planCard.classList.add('selected');
        this.selectedPlan = planCard.dataset.plan;

        // Show/hide user count section based on plan
        const userCountSection = document.getElementById('userCountSection');
        const userCountInput = document.getElementById('userCount');
        
        if (userCountSection) {
            if (this.selectedPlan === 'enterprise') {
                userCountSection.style.display = 'block';
                this.updateTotalPrice();
                // Set quota from user input for enterprise plan
                if (userCountInput) {
                    this.formData.userQuota = parseInt(userCountInput.value) || 1;
                }
            } else {
                userCountSection.style.display = 'none';
                // Set default quota for non-enterprise plans
                if (this.selectedPlan === 'free') {
                    this.formData.userQuota = 5; // Free plan default limit
                } else {
                    this.formData.userQuota = 1; // Other plans default
                }
            }
        }

        console.log('Selected plan:', this.selectedPlan, 'User quota:', this.formData.userQuota);

        // When a paid plan is selected, redirect to checkout
        // Free plan can proceed without payment
        if (this.selectedPlan === 'enterprise') {
            // Calculate a simple monthly total based on current UI
            const userCountInput = document.getElementById('userCount');
            const users = parseInt(userCountInput?.value) || 1;
            const featureCount = this.selectedFeatures.size;
            const basePrice = this.basePrices.enterprise;
            const featureCost = this.featureCosts.enterprise;
            const pricePerUser = basePrice + (featureCost * featureCount);
            const total = pricePerUser * users;

            const orderId = `SUB-${Date.now()}`;
            const nextUrl = `${location.origin}${location.pathname}`; // return to this page

            // Persist a flag to gate step 2 until payment succeeds
            sessionStorage.setItem('reg.paymentRequired', '1');
            sessionStorage.removeItem('reg.paymentOk');
            sessionStorage.setItem('reg.orderId', orderId);

            // Call backend to create checkout and redirect (supports cross-origin during dev)
            const API_BASE = window.WEBPAY_API_BASE || 'http://localhost:5020';
            fetch(`${API_BASE}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: total,
                    currency: 'GNF',
                    orderId,
                    description: 'Company subscription',
                    nextUrl
                })
            })
            .then(async r => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok || !data.ok) {
                    const details = data && data.details ? `\nDetails: ${JSON.stringify(data.details)}` : '';
                    throw new Error((data && data.error) ? `${data.error}${details}` : `Payment init failed${details}`);
                }
                return data;
            })
            .then(data => {
                window.location.href = data.redirectUrl;
            })
            .catch(err => {
                alert('Unable to start payment: ' + err.message);
                console.error('Checkout error', err);
            });
        }
    }

    toggleFeature(featureCard) {
        const featureId = featureCard.dataset.feature;
        
        if (featureCard.classList.contains('selected')) {
            featureCard.classList.remove('selected');
            this.selectedFeatures.delete(featureId);
        } else {
            featureCard.classList.add('selected');
            this.selectedFeatures.add(featureId);
        }

        this.updateSelectedFeaturesCount();
        this.updatePricingDisplay();
        this.updateTotalPrice(); // Update total price for Enterprise plan
        this.togglePricingSection();
        console.log('Selected features:', Array.from(this.selectedFeatures));
    }

    updateTotalPrice() {
        if (this.selectedPlan !== 'enterprise') return;

        const userCountInput = document.getElementById('userCount');
        const totalPriceDisplay = document.getElementById('totalPriceDisplay');
        const priceBreakdownDisplay = document.getElementById('priceBreakdownDisplay');

        if (!userCountInput || !totalPriceDisplay || !priceBreakdownDisplay) return;

        const userCount = parseInt(userCountInput.value) || 1;
        const featureCount = this.selectedFeatures.size;
        const basePrice = this.basePrices.enterprise;
        const featureCost = this.featureCosts.enterprise;
        
        const pricePerUser = basePrice + (featureCost * featureCount);
        const totalPrice = pricePerUser * userCount;

        // Update total price display
        totalPriceDisplay.textContent = `Total: $${totalPrice.toLocaleString()}/month`;

        // Update breakdown display
        let breakdown = `${userCount} user${userCount > 1 ? 's' : ''} × $${pricePerUser}/user`;
        if (featureCount > 0) {
            breakdown += ` (Base: $${basePrice} + Features: $${featureCost} × ${featureCount})`;
        }
        priceBreakdownDisplay.textContent = breakdown;
    }

    updateSelectedFeaturesCount() {
        const countElement = document.getElementById('selectedFeaturesCount');
        const listElement = document.getElementById('selectedFeaturesList');
        const summaryElement = document.getElementById('featureSelectionSummary');
        
        if (countElement) {
            countElement.textContent = this.selectedFeatures.size;
        }
        
        if (listElement && this.selectedFeatures.size > 0) {
            const featureNames = {
                'hse': 'HSE (Health, Safety & Environment)',
                'human-capital': 'Human Capital',
                'logistics': 'Logistics',
                'accommodation': 'Accommodation',
                'travel': 'Travel',
                'access': 'Access Control'
            };
            
            const selectedNames = Array.from(this.selectedFeatures).map(id => featureNames[id] || id);
            listElement.textContent = selectedNames.join(', ');
        }
        
        if (summaryElement) {
            summaryElement.style.display = this.selectedFeatures.size > 0 ? 'block' : 'none';
        }
    }

    togglePricingSection() {
        const pricingSection = document.getElementById('pricingSection');
        if (pricingSection) {
            if (this.selectedFeatures.size > 0) {
                pricingSection.style.opacity = '1';
                pricingSection.style.pointerEvents = 'auto';
                pricingSection.querySelector('p').textContent = 'Select a subscription plan that fits your needs';
            } else {
                pricingSection.style.opacity = '0.5';
                pricingSection.style.pointerEvents = 'none';
                pricingSection.querySelector('p').textContent = 'Select features above to view pricing options';
            }
        }
    }

    updatePricingDisplay() {
        const featureCount = this.selectedFeatures.size;
        
        // Update pricing displays for remaining plans
        this.updatePlanPrice('free', 'freePrice', featureCount);
        this.updatePlanPrice('enterprise', 'enterprisePrice', featureCount);
    }

    updatePlanPrice(planType, elementId, featureCount) {
        const priceElement = document.getElementById(elementId);
        if (!priceElement) return;
        
        const basePrice = this.basePrices[planType];
        const featureCost = this.featureCosts[planType];
        const totalPricePerUser = basePrice + (featureCost * featureCount);
        
        // Update the price display
        if (planType === 'free') {
            priceElement.innerHTML = `$0<span style="font-size: 1rem; font-weight: normal;">/15 days</span>`;
        } else {
            priceElement.innerHTML = `$${totalPricePerUser}<span style="font-size: 1rem; font-weight: normal;">/user/month</span>`;
        }
        
        // Add feature breakdown for non-free plans
        if (planType !== 'free' && featureCount > 0) {
            let breakdown = '';
            if (basePrice > 0) {
                breakdown += `Base: $${basePrice}/user`;
            }
            if (featureCost > 0 && featureCount > 0) {
                if (breakdown) breakdown += ' + ';
                breakdown += `Features: $${featureCost}/user × ${featureCount}`;
            }
            
            // Add or update breakdown display
            let breakdownElement = priceElement.parentNode.querySelector('.price-breakdown');
            if (!breakdownElement) {
                breakdownElement = document.createElement('div');
                breakdownElement.className = 'price-breakdown';
                breakdownElement.style.cssText = 'font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem;';
                priceElement.parentNode.insertBefore(breakdownElement, priceElement.nextSibling);
            }
            breakdownElement.textContent = `(${breakdown})`;
        } else {
            // Remove breakdown if it exists
            const breakdownElement = priceElement.parentNode.querySelector('.price-breakdown');
            if (breakdownElement) {
                breakdownElement.remove();
            }
        }
    }

    addDomain() {
        const domainInput = document.getElementById('additionalDomain');
        const domain = domainInput.value.trim();

        if (!domain) return;

        if (!this.validateDomainString(domain)) {
            alert('Please enter a valid domain (e.g., example.com)');
            return;
        }

        if (this.additionalDomains.includes(domain)) {
            alert('This domain has already been added');
            return;
        }

        this.additionalDomains.push(domain);
        this.renderDomainList();
        domainInput.value = '';
    }

    validateDomainString(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }

    removeDomain(domain) {
        this.additionalDomains = this.additionalDomains.filter(d => d !== domain);
        this.renderDomainList();
    }

    renderDomainList() {
        const domainList = document.getElementById('domainList');
        if (!domainList) return;

        domainList.innerHTML = '';
        this.additionalDomains.forEach(domain => {
            const domainItem = document.createElement('div');
            domainItem.className = 'domain-item';
            domainItem.innerHTML = `
                <span>${domain}</span>
                <button type="button" onclick="window.companyRegistration.removeDomain('${domain}')">
                    <i class="fas fa-times"></i> Remove
                </button>
            `;
            domainList.appendChild(domainItem);
        });
    }

    // Subdomain management methods
    validateSubdomain(subdomain) {
        // Basic validation: alphanumeric and hyphens only, no spaces
        const subdomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
        return subdomainRegex.test(subdomain);
    }

    async checkSubdomainAvailability(subdomain) {
        // Simulate API call to check subdomain availability
        // In a real application, this would check against your database
        try {
            // For now, simulate some reserved subdomains
            const reservedSubdomains = ['admin', 'api', 'www', 'mail', 'ftp', 'support', 'help', 'app', 'portal'];
            
            if (reservedSubdomains.includes(subdomain.toLowerCase())) {
                return { available: false, reason: 'This subdomain is reserved' };
            }

            // Simulate checking database (replace with actual API call)
            // For demo purposes, we'll say 'test' and 'demo' are taken
            const takenSubdomains = ['test', 'demo', 'sample'];
            if (takenSubdomains.includes(subdomain.toLowerCase())) {
                return { available: false, reason: 'This subdomain is already taken' };
            }

            return { available: true };
        } catch (error) {
            console.error('Error checking subdomain availability:', error);
            return { available: false, reason: 'Unable to check availability' };
        }
    }

    debounceSubdomainCheck() {
        // Clear previous timeout
        if (this.subdomainCheckTimeout) {
            clearTimeout(this.subdomainCheckTimeout);
        }

        // Set new timeout
        this.subdomainCheckTimeout = setTimeout(() => {
            this.validateSubdomainField();
        }, 500);
    }

    async validateSubdomainField() {
        const subdomainInput = document.getElementById('subdomainName');
        const availabilityDiv = document.getElementById('subdomainAvailability');
        
        if (!subdomainInput || !availabilityDiv) return;

        const subdomain = subdomainInput.value.trim();
        
        if (!subdomain) {
            availabilityDiv.style.display = 'none';
            subdomainInput.classList.remove('valid', 'invalid');
            return;
        }

        // Show checking status
        availabilityDiv.style.display = 'block';
        availabilityDiv.className = 'subdomain-checking';
        availabilityDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking availability...';

        // Validate format first
        if (!this.validateSubdomain(subdomain)) {
            availabilityDiv.className = 'subdomain-invalid';
            availabilityDiv.innerHTML = '<i class="fas fa-times"></i> Invalid format. Use letters, numbers, and hyphens only.';
            subdomainInput.classList.remove('valid');
            subdomainInput.classList.add('invalid');
            return;
        }

        // Check availability
        const result = await this.checkSubdomainAvailability(subdomain);
        
        if (result.available) {
            availabilityDiv.className = 'subdomain-valid';
            availabilityDiv.innerHTML = '<i class="fas fa-check"></i> Available! Your URL will be https://' + subdomain + '.dreamexdatalab.com';
            subdomainInput.classList.remove('invalid');
            subdomainInput.classList.add('valid');
        } else {
            availabilityDiv.className = 'subdomain-invalid';
            availabilityDiv.innerHTML = '<i class="fas fa-times"></i> ' + result.reason;
            subdomainInput.classList.remove('valid');
            subdomainInput.classList.add('invalid');
        }
    }

    updateSubdomainPreview() {
        const subdomainInput = document.getElementById('subdomainName');
        const urlPreview = document.getElementById('urlPreview');
        
        if (!subdomainInput || !urlPreview) return;

        const subdomain = subdomainInput.value.trim();
        if (subdomain) {
            urlPreview.textContent = `https://${subdomain}.dreamexdatalab.com`;
        } else {
            urlPreview.textContent = 'https://your-company.dreamexdatalab.com';
        }
    }

    validateCurrentStep() {
        const stepElement = document.getElementById(`step${this.currentStep}`);
        if (!stepElement) return true;

        const requiredFields = stepElement.querySelectorAll('input[required], select[required]');
        let isValid = true;

        // Special validation for step 1 (feature selection)
        if (this.currentStep === 1) {
            if (this.selectedFeatures.size === 0) {
                alert('Please select at least one platform feature to continue.');
                return false;
            }
        }

        // Special validation for step 3 (subdomain uniqueness)
        if (this.currentStep === 3) {
            const subdomainInput = document.getElementById('subdomainName');
            if (subdomainInput && subdomainInput.value.trim()) {
                const subdomain = subdomainInput.value.trim();
                if (!this.validateSubdomain(subdomain)) {
                    this.showFieldError(subdomainInput, 'Please choose a valid subdomain name');
                    isValid = false;
                } else {
                    // Check if subdomain is marked as valid (from async check)
                    if (subdomainInput.classList.contains('invalid')) {
                        this.showFieldError(subdomainInput, 'Please choose an available subdomain name');
                        isValid = false;
                    }
                }
            }
        }

        // Special validation for step 4 (admin role selection)
        if (this.currentStep === 4) {
            const roleSelect = document.getElementById('adminRole');
            if (roleSelect && !roleSelect.value) {
                this.showFieldError(roleSelect, 'Please select a role for the administrator');
                isValid = false;
            }
            console.log('Step 4 validation - Role selected:', roleSelect ? roleSelect.value : 'Role field not found');
        }

        // Validate all required fields
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Special validation for terms checkbox
        const termsCheckbox = document.getElementById('termsAccepted');
        if (termsCheckbox && stepElement.contains(termsCheckbox) && !termsCheckbox.checked) {
            const formGroup = termsCheckbox.closest('.form-group');
            if (formGroup) {
                this.showFieldError(termsCheckbox, 'You must accept the terms and conditions');
                isValid = false;
            }
        }

        return isValid;
    }

    collectStepData() {
        switch (this.currentStep) {
            case 1:
                // Welcome & Features - track selected features, selected plan, and user quota
                this.formData.selectedFeatures = Array.from(this.selectedFeatures);
                this.formData.selectedPlan = this.selectedPlan;
                
                // Capture user quota from the Enterprise plan user count input
                const userCountInput = document.getElementById('userCount');
                if (this.selectedPlan === 'enterprise' && userCountInput) {
                    this.formData.userQuota = parseInt(userCountInput.value) || 1;
                } else if (this.selectedPlan === 'free') {
                    // Free plan gets a default quota (could be limited)
                    this.formData.userQuota = 5; // Default limit for free plan
                } else {
                    // Default quota for other plans
                    this.formData.userQuota = 1;
                }
                console.log('User quota set to:', this.formData.userQuota);
                break;
                
            case 2:
                // Company Information
                const companyForm = document.getElementById('companyInfoForm');
                if (companyForm) {
                    const formData = new FormData(companyForm);
                    this.formData.company = Object.fromEntries(formData.entries());
                    console.log('Company form data collected:', this.formData.company);
                    console.log('Company registration field:', this.formData.company.companyRegistration);
                } else {
                    console.error('Company form not found!');
                }
                break;
                
            case 3:
                // Contact & Billing Information
                const contactForm = document.getElementById('contactBillingForm');
                if (contactForm) {
                    const formData = new FormData(contactForm);
                    this.formData.contact = Object.fromEntries(formData.entries());
                    this.formData.contact.additionalDomains = this.additionalDomains;
                    
                    // Add subdomain data
                    const subdomainInput = document.getElementById('subdomainName');
                    if (subdomainInput && subdomainInput.value.trim()) {
                        this.formData.contact.subdomain = subdomainInput.value.trim().toLowerCase();
                        this.formData.contact.companyUrl = `https://${this.formData.contact.subdomain}.dreamexdatalab.com`;
                    }
                    
                    console.log('Contact form data collected:', this.formData.contact);
                } else {
                    console.error('Contact form not found!');
                }
                break;
                
            case 4:
                // Admin Account
                const adminForm = document.getElementById('adminAccountForm');
                if (adminForm) {
                    const formData = new FormData(adminForm);
                    const adminData = Object.fromEntries(formData.entries());
                    // Don't store password in formData for security
                    delete adminData.adminPassword;
                    delete adminData.confirmPassword;
                    this.formData.admin = adminData;
                    console.log('Admin form data collected:', this.formData.admin);
                } else {
                    console.error('Admin form not found!');
                }
                break;
        }

        console.log('Form data collected for step', this.currentStep, this.formData);
    }

    nextStep() {
        if (!this.validateCurrentStep()) {
            return;
        }

        this.collectStepData();
        
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicator();
            this.updateNavigationButtons();
        }
    }

    prevStep() {
        if (!this.validateCurrentStep()) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicator();
            // Gate moving from Step 1 (plan) to Step 2 (company info) until payment success
            if (this.currentStep === 1) {
                const needsPayment = sessionStorage.getItem('reg.paymentRequired') === '1';
                const paymentOk = sessionStorage.getItem('reg.paymentOk') === '1';
                if (needsPayment && !paymentOk && this.selectedPlan === 'enterprise') {
                    alert('Please complete the payment before proceeding to Company Info.');
                    return;
                }
            }
            this.updateNavigationButtons();
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        const currentStep = document.getElementById(`step${stepNumber}`);
        if (currentStep) {
            currentStep.classList.add('active');
        }

        // Handle step-specific initialization
        if (stepNumber === 4) {
            this.initializeRoleDropdown();
        }

        // Handle completion step special display
        if (stepNumber === 5) {
            this.showCompletionInfo();
        }
    }

    initializeRoleDropdown() {
        const roleSelect = document.getElementById('adminRole');
        if (!roleSelect) return;

        // Clear existing options except the first one (placeholder)
        const firstOption = roleSelect.children[0];
        roleSelect.innerHTML = '';
        if (firstOption) {
            roleSelect.appendChild(firstOption);
        }

        // Add default Administrator role
        const adminOption = document.createElement('option');
        adminOption.value = 'administrator';
        adminOption.textContent = '👑 Administrator';
        adminOption.selected = true; // Auto-select Administrator role
        adminOption.style.fontWeight = 'bold';
        adminOption.style.color = '#ffd700';
        roleSelect.appendChild(adminOption);

        console.log('✅ Role dropdown initialized with Administrator role');
    }

    showCompletionInfo() {
        const subdomainInfo = document.getElementById('subdomainInfo');
        const finalSubdomainUrl = document.getElementById('finalSubdomainUrl');
        
        if (this.formData.contact && this.formData.contact.subdomain) {
            if (subdomainInfo) {
                subdomainInfo.style.display = 'block';
            }
            if (finalSubdomainUrl) {
                finalSubdomainUrl.textContent = this.formData.contact.companyUrl;
            }
        }
    }

    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            const progressPercentage = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
            progressFill.style.width = `${progressPercentage}%`;
        }
    }

    updateStepIndicator() {
        const stepItems = document.querySelectorAll('.step-item');
        const stepConnectors = document.querySelectorAll('.step-connector');

        stepItems.forEach((item, index) => {
            const stepNumber = index + 1;
            const circle = item.querySelector('.step-circle');
            const title = item.querySelector('.step-title');

            // Remove all classes
            item.classList.remove('active', 'completed');
            circle.classList.remove('active', 'completed');

            if (stepNumber < this.currentStep) {
                // Completed step
                item.classList.add('completed');
                circle.classList.add('completed');
                circle.innerHTML = '<i class="fas fa-check"></i>';
            } else if (stepNumber === this.currentStep) {
                // Current step
                item.classList.add('active');
                circle.classList.add('active');
                circle.textContent = stepNumber;
            } else {
                // Future step
                circle.textContent = stepNumber;
            }
        });

        // Update connectors
        stepConnectors.forEach((connector, index) => {
            if (index + 1 < this.currentStep) {
                connector.classList.add('completed');
            } else {
                connector.classList.remove('completed');
            }
        });
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
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

    async finishRegistration() {
        if (!this.validateCurrentStep()) {
            return;
        }

        this.collectStepData();

        const finishBtn = document.getElementById('finishBtn');
        const loadingElement = finishBtn.querySelector('.loading');
        const normalText = finishBtn.querySelector('.normal-text');

        try {
            // Show loading state
            finishBtn.disabled = true;
            loadingElement.style.display = 'inline-flex';
            normalText.style.display = 'none';

            // Get admin password for account creation
            const adminPasswordElement = document.getElementById('adminPassword');
            const adminPassword = adminPasswordElement?.value;
            const adminEmail = this.formData.admin?.adminEmail || this.formData.contact?.contactEmail;

            // Validation before Firebase call
            if (!adminEmail) {
                throw new Error('Admin email is required. Please ensure you filled out the contact form.');
            }

            if (!adminPassword) {
                throw new Error('Admin password is required. Please enter a password.');
            }

            if (adminPassword.length < 6) {
                throw new Error('Password must be at least 6 characters long.');
            }

            console.log('Starting registration with email:', adminEmail);
            console.log('Form data:', this.formData);

            // Create Firebase user account
            const userCredential = await createUserWithEmailAndPassword(
                this.auth, 
                adminEmail, 
                adminPassword
            );

            const user = userCredential.user;

            // Prepare company data for database
            const companyData = {
                // Company information
                companyName: this.formData.company.companyName,
                companyRegistration: this.formData.company.companyRegistration,
                industry: this.formData.company.industry,
                companySize: this.formData.company.companySize,
                country: this.formData.company.country,
                address: this.formData.company.address,
                website: this.formData.company.website,
                
                // Contact and billing
                contactName: this.formData.contact.contactName,
                contactEmail: this.formData.contact.contactEmail,
                contactPhone: this.formData.contact.contactPhone,
                billingAddress: this.formData.contact.billingAddress,
                additionalDomains: this.formData.contact.additionalDomains || [],
                
                // Admin information
                admin: {
                    adminName: this.formData.admin.adminName,
                    adminEmail: this.formData.admin.adminEmail || this.formData.contact.contactEmail,
                    adminPhone: this.formData.admin.adminPhone
                },
                
                // Plan and quota information
                selectedPlan: this.formData.selectedPlan,
                selectedFeatures: this.formData.selectedFeatures || [],
                userQuota: this.formData.userQuota || 1, // Store the user quota limit
                
                // System fields
                createdAt: new Date().toISOString(),
                userId: user.uid,
                status: 'active'
            };

            // Save to Firebase Database
            const companiesRef = ref(this.db, 'companies');
            const newCompanyRef = push(companiesRef);
            await set(newCompanyRef, companyData);

            // Create default Administrator role for the company
            const defaultAdminRole = {
                id: 'administrator',
                name: 'Administrator',
                description: 'Default administrator role with full system access. This role cannot be modified or deleted.',
                isDefault: true,
                isSystemRole: true,
                permissions: {
                    // Core system permissions
                    home_view: { view: true },
                    
                    // Health module permissions
                    health_view: { view: true, create: true, edit: true, delete: true },
                    health_assessment_view: { view: true, create: true, edit: true, delete: true },
                    health_consultation_view: { view: true, create: true, edit: true, delete: true },
                    medical_folder_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Safety module permissions
                    safety_view: { view: true, create: true, edit: true, delete: true },
                    training_view: { view: true, create: true, edit: true, delete: true },
                    risk_view: { view: true, create: true, edit: true, delete: true },
                    jsa_view: { view: true, create: true, edit: true, delete: true },
                    ptw_view: { view: true, create: true, edit: true, delete: true },
                    incident_view: { view: true, create: true, edit: true, delete: true },
                    inspection_view: { view: true, create: true, edit: true, delete: true },
                    audit_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Environment module permissions
                    environment_view: { view: true, create: true, edit: true, delete: true },
                    water_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Security module permissions
                    security_view: { view: true, create: true, edit: true, delete: true },
                    access_view: { view: true, create: true, edit: true, delete: true },
                    removal_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Logistics module permissions
                    logistics_view: { view: true, create: true, edit: true, delete: true },
                    fleet_view: { view: true, create: true, edit: true, delete: true },
                    
                    // HR module permissions
                    hr_view: { view: true, create: true, edit: true, delete: true },
                    human_hr_view: { view: true, create: true, edit: true, delete: true },
                    staff_management_view: { view: true, create: true, edit: true, delete: true, export: true, import: true },
                    authority_to_recruit_view: { view: true, create: true, edit: true, delete: true },
                    job_advertising_view: { view: true, create: true, edit: true, delete: true },
                    screening_view: { view: true, create: true, edit: true, delete: true },
                    interview_view: { view: true, create: true, edit: true, delete: true },
                    offer_view: { view: true, create: true, edit: true, delete: true },
                    contract_view: { view: true, create: true, edit: true, delete: true },
                    onboarding_view: { view: true, create: true, edit: true, delete: true },
                    kpi_dashboard_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Communication permissions
                    communication_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Settings and administration permissions
                    settings_view: { view: true, create: true, edit: true, delete: true },
                    account_settings_view: { view: true, create: true, edit: true, delete: true },
                    company_management_view: { view: true, create: true, edit: true, delete: true },
                    approval_settings_view: { view: true, create: true, edit: true, delete: true },
                    field_setup_view: { view: true, create: true, edit: true, delete: true },
                    preferences_view: { view: true, create: true, edit: true, delete: true },
                    notification_settings_view: { view: true, create: true, edit: true, delete: true },
                    audit_log_view: { view: true, create: true, edit: true, delete: true },
                    user_management_view: { view: true, create: true, edit: true, delete: true },
                    role_permissions_view: { view: true, create: true, edit: true, delete: true },
                    
                    // Legacy permissions for compatibility with existing code
                    company_management: { view: true, create: true, edit: true, delete: true },
                    user_management: { view: true, create: true, edit: true, delete: true },
                    staff_management: { view: true, create: true, edit: true, delete: true, export: true, import: true },
                    health_management: { view: true, create: true, edit: true, delete: true },
                    environment_management: { view: true, create: true, edit: true, delete: true },
                    security_management: { view: true, create: true, edit: true, delete: true },
                    logistics_management: { view: true, create: true, edit: true, delete: true },
                    role_management: { view: true, create: true, edit: true, delete: true },
                    reports: { view: true, create: true, edit: true, delete: true, export: true },
                    settings: { view: true, create: true, edit: true, delete: true },
                    
                    // Dashboard and general permissions
                    dashboard: { view: true, edit: true, delete: true, create: true },
                    users: { view: true, edit: true, delete: true, create: true },
                    roles: { view: true, edit: true, delete: true, create: true },
                    company: { view: true, edit: true, delete: true, create: true }
                },
                createdAt: new Date().toISOString(),
                createdBy: user.uid
            };
            
            const defaultRoleRef = ref(this.db, `companies/${newCompanyRef.key}/roles/administrator`);
            await set(defaultRoleRef, defaultAdminRole);

            // Create admin profile ONLY in company scope (NOT in global users)
            const adminRef = ref(this.db, `companies/${newCompanyRef.key}/admin`);
            await set(adminRef, {
                userId: user.uid,
                adminName: this.formData.admin.adminName,
                name: this.formData.admin.adminName, // Keep both for compatibility
                email: adminEmail,
                phone: this.formData.admin.adminPhone || '',
                role: this.formData.admin.adminRole || 'administrator', // Use selected role from form
                department: 'Administration',
                jobTitle: 'Administrator',
                status: 'active',
                authUid: user.uid, // Link to Firebase Auth user
                isCompanyAdmin: true,
                requiresPasswordChange: false, // Admin doesn't need to change password
                isFirstLogin: false, // Admin has already set their password
                createdAt: new Date().toISOString(),
                assignedAt: new Date().toISOString(),
                assignedBy: user.uid // Self-assigned during registration
            });

            // Store admin as company user as well (company-scoped only)
            const companyUserRef = ref(this.db, `companies/${newCompanyRef.key}/users/${user.uid}`);
            await set(companyUserRef, {
                userId: user.uid,
                name: this.formData.admin.adminName,
                email: adminEmail,
                phone: this.formData.admin.adminPhone || '',
                role: this.formData.admin.adminRole || 'administrator', // Use selected role from form
                department: 'Administration',
                jobTitle: 'Administrator',
                status: 'active',
                authUid: user.uid,
                isCompanyAdmin: true,
                requiresPasswordChange: false,
                isFirstLogin: false,
                createdAt: new Date().toISOString()
            });
            
            // Also add admin to global users collection for consistency with companymanagement system
            const globalUserRef = ref(this.db, `users/${user.uid}`);
            await set(globalUserRef, {
                uid: user.uid,
                authUid: user.uid,
                name: this.formData.admin.adminName,
                fullName: this.formData.admin.adminName,
                email: adminEmail,
                phone: this.formData.admin.adminPhone || '',
                role: this.formData.admin.adminRole || 'administrator', // Use selected role from form
                department: 'Administration',
                jobTitle: 'Administrator',
                status: 'active',
                isCompanyAdmin: true,
                companyId: newCompanyRef.key, // Link to company
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
            
            console.log('✅ Admin account stored in both company scope and global users collection with role:', this.formData.admin.adminRole || 'administrator');

            console.log('Registration completed successfully');
            
            // Move to completion step
            this.currentStep = this.totalSteps;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicator();
            this.updateNavigationButtons();

        } catch (error) {
            console.error('Registration error:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            // Debug form data
            console.log('Form data at time of error:', this.formData);
            console.log('Admin email:', this.formData.admin?.adminEmail || this.formData.contact?.contactEmail);
            console.log('Admin password exists:', !!document.getElementById('adminPassword')?.value);
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            } else if (error.code === 'auth/missing-email') {
                errorMessage = 'Email address is required.';
            } else if (error.code === 'auth/missing-password') {
                errorMessage = 'Password is required.';
            } else {
                // Include the actual error message for debugging
                errorMessage = `Registration failed: ${error.message}`;
            }

            alert(errorMessage);

        } finally {
            // Reset button state
            finishBtn.disabled = false;
            loadingElement.style.display = 'none';
            normalText.style.display = 'inline-flex';
        }
    }

    generateSubdomainSuggestion(companyName) {
        // Convert company name to a valid subdomain format
        return companyName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .substring(0, 50); // Limit length
    }
}

// Initialize the registration system
document.addEventListener('DOMContentLoaded', () => {
    window.companyRegistration = new CompleteCompanyRegistration();
});

export default CompleteCompanyRegistration;
