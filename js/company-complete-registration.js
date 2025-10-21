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
        this.totalSteps = 7;
        this.formData = {
            company: {},
            contact: {},
            billing: {},
            subscription: {},
            admin: {},
            modules: []
        };
        this.additionalDomains = [];
        this.selectedPlan = null;
        this.selectedModules = new Set();
        this.selectedFeatures = new Set(); // Track selected features for pricing
        
        // Define base prices and feature costs
        this.basePrices = {
            free: 0,
            basic: 29,
            professional: 79,
            enterprise: 0
        };
        
        // Cost per feature for each plan type
        this.featureCosts = {
            free: 0,    // Free trial includes all features
            basic: 15,   // Each additional feature costs $15/month
            professional: 25, // Each additional feature costs $25/month  
            enterprise: 0   // Enterprise: feature costs handled inline; default $0 here
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

        // Module selection (includes feature selection)
        document.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', () => {
                // Handle both module and feature selection
                if (card.dataset.feature) {
                    this.toggleFeature(card);
                } else if (card.dataset.module) {
                    this.toggleModule(card);
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

        console.log('Selected plan:', this.selectedPlan);

        // If enterprise plan selected, reveal and update Payment Summary
        if (this.selectedPlan === 'enterprise') {
            try {
                const section = document.getElementById('paymentSummarySection');
                const userCountSection = document.getElementById('userCountSection');
                if (userCountSection) userCountSection.style.display = 'block';
                if (section) {
                    section.style.display = 'block';
                    this.updatePaymentSummary();
                }
            } catch {}
        } else {
            // Hide summary for non-enterprise plans
            const section = document.getElementById('paymentSummarySection');
            if (section) section.style.display = 'none';
        }
    }

    updatePaymentSummary() {
        try {
            const planEl = document.getElementById('summaryPlan');
            const usersEl = document.getElementById('summaryUsers');
            const ppuEl = document.getElementById('summaryPricePerUser');
            const totalEl = document.getElementById('summaryMonthlyTotal');
            const userCountInput = document.getElementById('userCount');
            const enterprisePriceEl = document.getElementById('enterprisePrice');

            if (!planEl || !usersEl || !ppuEl || !totalEl || !userCountInput || !enterprisePriceEl) return;

            // Plan name
            planEl.textContent = 'Enterprise';

            // Users
            const users = Math.max(1, parseInt(userCountInput.value || '1', 10) || 1);
            usersEl.textContent = String(users);

            // Per-user price from the visible enterprise price label (e.g., "$25.00/..")
            const priceMatch = (enterprisePriceEl.textContent || '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
            const pricePerUser = priceMatch ? parseFloat(priceMatch[1]) : 0;
            ppuEl.textContent = `$${pricePerUser.toFixed(2)}`;

            // Monthly total
            const monthlyTotal = pricePerUser * users;
            totalEl.textContent = `$${monthlyTotal.toFixed(2)}`;
        } catch (e) {
            console.warn('Failed to update payment summary', e);
        }
    }

    // Try to obtain the Orange Money phone number (9 digits) from the page or prompt
    getPaymentPhone() {
        // Common candidate inputs
        const candidates = [
            '#paymentPhone',
            '#orangeMoneyPhone',
            '#omPhone',
            '#phone',
            '#contactPhone',
            'input[type="tel"]'
        ];

        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && el.value) {
                const raw = (el.value || '').replace(/\D/g, '');
                if (/^[0-9]{9}$/.test(raw)) return raw;
            }
        }

        // As a fallback, prompt the user
        const entered = (window.prompt('Enter Orange Money phone (9 digits, e.g., 624123456):') || '').trim();
        const digits = entered.replace(/\D/g, '');
        if (/^[0-9]{9}$/.test(digits)) return digits;
        return null;
    }

    async startEnterpriseCheckout() {
        try {
            // Use exact GNF amount from the Payment Summary input
            const amountInput = document.getElementById('chargeAmountGNF');
            const errorEl = document.getElementById('paymentError');
            if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

            let amount = 0;
            if (amountInput) {
                amount = parseInt((amountInput.value || '').trim(), 10);
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                const msg = 'Please enter a valid charge amount in GNF.';
                if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
                else { alert(msg); }
                return;
            }

            const orderId = `SUB-${Date.now()}`;

            // Collect Orange Money phone
            const phone = this.getPaymentPhone();
            if (!phone) {
                const msg = 'Please provide a valid Orange Money phone number (9 digits).';
                if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
                else { alert(msg); }
                return;
            }

            // Set gating flags for later steps
            try {
                sessionStorage.setItem('reg.paymentRequired', '1');
                sessionStorage.removeItem('reg.paymentOk');
                sessionStorage.setItem('reg.orderId', orderId);
            } catch {}

            // Redirect the user to the dedicated Orange Money index page which will initiate the payment
            const apiBase = (window.WEBPAY_API_BASE && typeof window.WEBPAY_API_BASE === 'string') ? window.WEBPAY_API_BASE : window.location.origin;
            const params = new URLSearchParams({
                amount: String(amount),
                phone,
                order_id: orderId,
                description: 'Company subscription',
                autostart: '1'
            });
            // Build final URL on the API base (the backend serves the index UI at '/')
            const indexUrlBase = (typeof window.WEBPAY_INDEX_URL === 'string' && window.WEBPAY_INDEX_URL)
                ? window.WEBPAY_INDEX_URL
                : (apiBase.replace(/\/$/, '') + '/');
            const finalUrl = indexUrlBase + (indexUrlBase.includes('?') ? '&' : '?') + params.toString();
            window.location.href = finalUrl;
            return;

        } catch (err) {
            console.error('Enterprise checkout error', err);
            const errorEl = document.getElementById('paymentError');
            let msg = 'Unable to start payment: ' + (err && err.message ? err.message : String(err));
            
            // Add deployment guidance for common errors
            if (err && err.message && err.message.includes('405')) {
                msg += '\n\nTip: Your production server may not be running the Orange WebPay backend. Please deploy the orange-webpay application to your server.';
            } else if (err && err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('Unable to connect'))) {
                msg += '\n\nTip: Start your local server with "npm run dev" in the orange-webpay folder.';
            }
            
            if (errorEl) { 
                errorEl.innerHTML = msg.replace(/\n/g, '<br>'); 
                errorEl.style.display = 'block'; 
            } else { 
                alert(msg); 
            }
        }
    }

    async attemptPayment(apiBase, amount, orderId, phone) {
        let res;
        try {
            res = await fetch(`${apiBase}/api/payments/initiate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, phone, order_id: orderId, description: 'Company subscription' })
            });
        } catch (networkErr) {
            const hints = [];
            if (window.location.protocol === 'https:' && apiBase.startsWith('http://')) {
                hints.push('Browsers block requests from HTTPS pages to HTTP APIs. Use an HTTPS tunnel (ngrok) or the production domain.');
            }
            if (apiBase.includes('dreamexdatalab.com')) {
                hints.push('Ensure the Orange Money backend is deployed and accessible at this domain, and CORS is enabled.');
            } else {
                hints.push('Start the backend locally (port 8080) or set ?apiBase= to the correct HTTPS API domain.');
            }
            const tip = hints.join(' ');
            const friendlyError = new Error(`Failed to reach ${apiBase}/api/payments/initiate. ${tip}`.trim());
            friendlyError.cause = networkErr;
            return { success: false, error: friendlyError };
        }

        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch {}

        // Accept both our backend shape and legacy shapes
        const success = data.success === true || data.ok === true;
        if (!res.ok || !success) {
            const details = data && (data.details || data.message) ? `\nDetails: ${JSON.stringify(data.details || data.message)}` : '';
            const statusInfo = ` (HTTP ${res.status})`;
            const errorMsg = (data && (data.error || data.message)) ? `${data.error || data.message}${statusInfo}${details}` : `Payment init failed${statusInfo}${details}`;
            return { success: false, error: new Error(errorMsg) };
        }

        const redirectUrl = data.payment_url || data.redirectUrl || data.url;
        if (redirectUrl) {
            window.location.href = redirectUrl;
            return { success: true };
        } else {
            return { success: false, error: new Error('No redirect URL returned by gateway') };
        }
    }

    toggleModule(moduleCard) {
        const moduleId = moduleCard.dataset.module;
        
        if (moduleCard.classList.contains('selected')) {
            moduleCard.classList.remove('selected');
            this.selectedModules.delete(moduleId);
        } else {
            moduleCard.classList.add('selected');
            this.selectedModules.add(moduleId);
        }

        this.updateSelectedModulesCount();
        console.log('Selected modules:', Array.from(this.selectedModules));
    }

    updateSelectedModulesCount() {
        const countElement = document.getElementById('selectedModulesCount');
        if (countElement) {
            countElement.textContent = this.selectedModules.size;
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
        this.togglePricingSection();
        console.log('Selected features:', Array.from(this.selectedFeatures));
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

        // Update step 4 features display
        const step4FeaturesList = document.getElementById('step4FeaturesList');
        if (step4FeaturesList && this.selectedFeatures.size > 0) {
            const featureNames = {
                'hse': 'HSE (Health, Safety & Environment)',
                'human-capital': 'Human Capital',
                'logistics': 'Logistics',
                'accommodation': 'Accommodation',
                'travel': 'Travel',
                'access': 'Access Control'
            };
            
            const selectedNames = Array.from(this.selectedFeatures).map(id => featureNames[id] || id);
            step4FeaturesList.textContent = selectedNames.join(', ');
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
        
        // Update all pricing displays
        this.updatePlanPrice('basic', 'basicPrice', featureCount);
        this.updatePlanPrice('professional', 'professionalPrice', featureCount);
        this.updatePlanPrice('enterprise', 'enterprisePrice', featureCount);
        
        // Update step 4 pricing displays (subscription step)
        this.updatePlanPrice('basic', 'step4BasicPrice', featureCount);
        this.updatePlanPrice('professional', 'step4ProfessionalPrice', featureCount);
        this.updatePlanPrice('enterprise', 'step4EnterprisePrice', featureCount);
    }

    updatePlanPrice(planType, elementId, featureCount) {
        const priceElement = document.getElementById(elementId);
        if (!priceElement) return;
        
        const basePrice = this.basePrices[planType];
        const featureCost = this.featureCosts[planType];
        const totalPrice = basePrice + (featureCost * featureCount);
        
        // Update the price display
    // Enterprise displays per-user pricing on the wizard card
    const suffix = planType === 'free' ? '/15 days' : (planType === 'enterprise' ? '/user/month' : '/month');
        priceElement.innerHTML = `$${totalPrice}<span style="font-size: 1rem; font-weight: normal;">${suffix}</span>`;
        
        // Add feature breakdown for non-free plans
        if (planType !== 'free' && featureCount > 0) {
            let breakdown = '';
            if (basePrice > 0) {
                breakdown += `Base: $${basePrice}`;
            }
            if (featureCost > 0 && featureCount > 0) {
                if (breakdown) breakdown += ' + ';
                breakdown += `Features: $${featureCost} × ${featureCount}`;
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
                // Welcome & Features - no form data to collect, just track selected features
                this.formData.selectedFeatures = Array.from(this.selectedFeatures);
                break;
                
            case 2:
                // Company Information
                const companyForm = document.getElementById('companyInfoForm');
                if (companyForm) {
                    const formData = new FormData(companyForm);
                    this.formData.company = Object.fromEntries(formData.entries());
                }
                break;
                
            case 3:
                // Contact & Billing Information
                const contactForm = document.getElementById('contactBillingForm');
                if (contactForm) {
                    const formData = new FormData(contactForm);
                    this.formData.contact = Object.fromEntries(formData.entries());
                    this.formData.contact.additionalDomains = this.additionalDomains;
                }
                break;
                
            case 4:
                // Subscription Plan
                this.formData.subscription = {
                    plan: this.selectedPlan,
                    selectedFeatures: Array.from(this.selectedFeatures),
                    maxUsers: document.getElementById('maxUsers')?.value || '10'
                };
                break;
                
            case 5:
                // Admin Account
                const adminForm = document.getElementById('adminAccountForm');
                if (adminForm) {
                    const formData = new FormData(adminForm);
                    const adminData = Object.fromEntries(formData.entries());
                    // Don't store password in formData for security
                    delete adminData.adminPassword;
                    delete adminData.confirmPassword;
                    this.formData.admin = adminData;
                }
                break;
                
            case 6:
                // System Setup & Modules
                this.formData.modules = Array.from(this.selectedModules);
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
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicator();
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

        // Update step 4 features display when showing subscription step
        if (stepNumber === 4) {
            this.updateSelectedFeaturesCount();
            this.updatePricingDisplay();
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
            const adminPassword = document.getElementById('adminPassword').value;
            const adminEmail = this.formData.admin.adminEmail || this.formData.contact.contactEmail;

            // Create Firebase user account
            const userCredential = await createUserWithEmailAndPassword(
                this.auth, 
                adminEmail, 
                adminPassword
            );

            const user = userCredential.user;

            // Prepare company data for database
            const companyData = {
                ...this.formData,
                createdAt: new Date().toISOString(),
                userId: user.uid,
                status: 'active'
            };

            // Save to Firebase Database
            const companiesRef = ref(this.db, 'companies');
            const newCompanyRef = push(companiesRef);
            await set(newCompanyRef, companyData);

            // Update user profile with company reference
            const userRef = ref(this.db, `users/${user.uid}`);
            await set(userRef, {
                email: adminEmail,
                name: this.formData.admin.adminName,
                role: 'admin',
                companyId: newCompanyRef.key,
                createdAt: new Date().toISOString()
            });

            console.log('Registration completed successfully');
            
            // Move to completion step
            this.currentStep = this.totalSteps;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicator();
            this.updateNavigationButtons();

        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            }

            alert(errorMessage);

        } finally {
            // Reset button state
            finishBtn.disabled = false;
            loadingElement.style.display = 'none';
            normalText.style.display = 'inline-flex';
        }
    }
}

// Initialize the registration system
document.addEventListener('DOMContentLoaded', () => {
    window.companyRegistration = new CompleteCompanyRegistration();

    // If redirected back from payment pages, capture success flag
    try {
        const params = new URLSearchParams(location.search);
        const payment = params.get('payment');
        if (payment === 'success') {
            sessionStorage.setItem('reg.paymentOk', '1');
        }
    } catch {}
});

export default CompleteCompanyRegistration;
