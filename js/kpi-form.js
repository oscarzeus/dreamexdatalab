// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUTmTn0rRBb0M-UkQJxnUMrWqXYU_BgIc",
    authDomain: "users-8be65.firebaseapp.com",
    databaseURL: "https://users-8be65-default-rtdb.firebaseio.com",
    projectId: "users-8be65",
    storageBucket: "users-8be65.firebasestorage.app",
    messagingSenderId: "829083030831",
    appId: "1:829083030831:web:36a370e62691e560bc3dda"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global variables
let currentUser = null;
let isDraftSaving = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
    loadUserSession();
    enableAutoSave();
    checkForEditMode();
    loadKPISchedule(); // Load schedule settings
    
    // Set up initial global employee listener
    setTimeout(() => {
        const globalEmployee = document.getElementById('globalEmployee');
        if (globalEmployee && !globalEmployee.hasAttribute('data-listener-added')) {
            globalEmployee.addEventListener('change', () => {
                if (typeof window.handleGlobalEmployeeChange === 'function') {
                    window.handleGlobalEmployeeChange();
                }
            });
            globalEmployee.setAttribute('data-listener-added', 'true');
            console.log('Added initial global employee listener');
        }
    }, 100);
});

// Initialize form
function initializeForm() {
    // Form initialization - no default values needed for current fields
    loadEmployees();
    console.log('KPI form initialized');
}

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('kpiForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Setup event listeners for the initial KPI section
    setupKPIEventListeners(0);
}

// Setup event listeners for a specific KPI section
function setupKPIEventListeners(index) {
    const requiredFields = ['kpiName', 'category', 'metricType', 'frequency', 'target'];
    requiredFields.forEach(fieldName => {
        const fieldId = index === 0 ? `${fieldName}_${index}` : `${fieldName}_${index}`;
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', () => validateField(fieldId));
            field.addEventListener('input', () => clearError(fieldId));
        }
    });
    
    // Add global employee validation and change listener if this is the first setup
    if (index === 0) {
        const globalEmployee = document.getElementById('globalEmployee');
        if (globalEmployee) {
            globalEmployee.addEventListener('blur', () => validateField('globalEmployee'));
            globalEmployee.addEventListener('input', () => clearError('globalEmployee'));
            
            // Add change listener for evaluation tab updates
            if (!globalEmployee.hasAttribute('data-listener-added')) {
                globalEmployee.addEventListener('change', () => {
                    // Trigger evaluation tab update if needed
                    if (typeof window.handleGlobalEmployeeChange === 'function') {
                        window.handleGlobalEmployeeChange();
                    }
                });
                globalEmployee.setAttribute('data-listener-added', 'true');
                console.log('Added global employee change listener from kpi-form.js');
            }
        }
    }
}

// Load user session
function loadUserSession() {
    console.log('🔍 Loading user session...');
    
    // First try to get user from localStorage
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        try {
            currentUser = JSON.parse(userData);
            console.log('✅ User session loaded from localStorage:', {
                name: currentUser.name || currentUser.displayName,
                email: currentUser.email,
                id: currentUser.id || currentUser.uid
            });
            return;
        } catch (error) {
            console.error('❌ Error parsing user data from localStorage:', error);
        }
    }
    
    // If no localStorage data, try to get from global auth manager
    if (window.authManager && window.authManager.isAuthenticated()) {
        currentUser = window.authManager.getUser();
        console.log('✅ User session loaded from auth manager:', {
            name: currentUser.name || currentUser.displayName,
            email: currentUser.email,
            id: currentUser.id || currentUser.uid
        });
        return;
    }
    
    // If still no user, try to construct from session storage or any available data
    if (sessionStorage.getItem('currentUserSession')) {
        try {
            currentUser = JSON.parse(sessionStorage.getItem('currentUserSession'));
            console.log('✅ User session loaded from sessionStorage:', currentUser);
            return;
        } catch (error) {
            console.error('❌ Error parsing user data from sessionStorage:', error);
        }
    }
    
    console.warn('⚠️ No user session found - user may need to log in again');
    console.log('🔍 Available auth sources checked:');
    console.log('  - localStorage currentUser:', !!localStorage.getItem('currentUser'));
    console.log('  - window.authManager:', !!window.authManager);
    console.log('  - sessionStorage currentUserSession:', !!sessionStorage.getItem('currentUserSession'));
}

// Check for edit mode and pre-populate form
function checkForEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const employeeId = urlParams.get('employee');
    
    console.log('Checking for edit mode:', { mode, employeeId });
    console.log('Current URL:', window.location.href);
    
    if (mode === 'edit' && employeeId) {
        console.log('Edit mode detected for employee:', employeeId);
        
        // Get edit data from sessionStorage
        const editDataString = sessionStorage.getItem('kpiEditData');
        console.log('Raw edit data from sessionStorage:', editDataString);
        
        if (editDataString) {
            try {
                const editData = JSON.parse(editDataString);
                console.log('Parsed edit data:', editData);
                console.log('Employee info:', { 
                    id: editData.employeeId, 
                    name: editData.employeeName 
                });
                console.log('Number of KPIs to load:', editData.kpis ? editData.kpis.length : 0);
                
                // Validate edit data structure
                if (!editData.kpis || !Array.isArray(editData.kpis) || editData.kpis.length === 0) {
                    console.error('Invalid or empty KPIs in edit data:', editData);
                    showErrorModal('No KPI data found for editing');
                    return;
                }
                
                // Ensure we have employee name
                if (!editData.employeeName || editData.employeeName === 'Unknown Employee') {
                    console.warn('Employee name is missing or unknown, using employee ID as fallback');
                    editData.employeeName = employeeId;
                }
                
                // Pre-populate the form
                setTimeout(() => {
                    console.log('Starting form population with data:', editData);
                    populateFormForEdit(editData);
                }, 100); // Reduced timeout since we now have proper loading detection
                
                // Clear the session storage after use
                sessionStorage.removeItem('kpiEditData');
            } catch (error) {
                console.error('Error parsing edit data:', error);
                showErrorModal('Error loading KPI data for editing');
            }
        } else {
            console.warn('No edit data found in sessionStorage');
            showErrorModal('No KPI data found for editing');
        }
    } else {
        console.log('Not in edit mode or missing employee ID');
    }
}

// Populate form with existing KPI data for editing
function populateFormForEdit(editData) {
    console.log('Populating form for edit:', editData);
    
    // Validate edit data
    if (!editData || !editData.employeeId || !editData.kpis || !Array.isArray(editData.kpis)) {
        console.error('Invalid edit data structure:', editData);
        showErrorModal('Invalid KPI data for editing');
        return;
    }
    
    // Set the global employee - try a few times with delays
    const setEmployeeAndContinue = (attempts = 0) => {
        const globalEmployeeSelect = document.getElementById('globalEmployee');
        
        if (globalEmployeeSelect && globalEmployeeSelect.options.length > 1) {
            console.log('Setting employee to:', editData.employeeId);
            
            // Check if the employee option exists in the dropdown
            let optionExists = false;
            for (let i = 0; i < globalEmployeeSelect.options.length; i++) {
                if (globalEmployeeSelect.options[i].value === editData.employeeId) {
                    optionExists = true;
                    break;
                }
            }
            
            // If the employee option doesn't exist, add it manually
            if (!optionExists && editData.employeeName) {
                console.log('Employee not found in dropdown, adding manually:', editData.employeeName);
                const option = document.createElement('option');
                option.value = editData.employeeId;
                option.textContent = editData.employeeName;
                option.setAttribute('data-full-name', editData.employeeName);
                // Insert after the first "Select Team Member" option
                globalEmployeeSelect.insertBefore(option, globalEmployeeSelect.options[1] || null);
            }
            
            // Set the value
            globalEmployeeSelect.value = editData.employeeId;
            
            // Verify the selection worked
            if (globalEmployeeSelect.value === editData.employeeId) {
                console.log('Employee successfully selected:', editData.employeeName);
            } else {
                console.warn('Failed to select employee in dropdown');
            }
            
            // Lock the dropdown in edit mode
            globalEmployeeSelect.disabled = true;
            globalEmployeeSelect.style.backgroundColor = '#f8f9fa';
            globalEmployeeSelect.style.cursor = 'not-allowed';
            globalEmployeeSelect.title = 'Team member cannot be changed in edit mode';
            
            // Add a visual indicator that this field is locked
            const lockIcon = document.createElement('span');
            lockIcon.innerHTML = '<i class="fas fa-lock" style="margin-left: 8px; color: #6c757d;"></i>';
            lockIcon.className = 'edit-mode-lock-indicator';
            
            // Add lock icon after the dropdown (if not already added)
            const existingLockIcon = globalEmployeeSelect.parentNode.querySelector('.edit-mode-lock-indicator');
            if (!existingLockIcon) {
                globalEmployeeSelect.parentNode.appendChild(lockIcon);
            }
            
            // Trigger change event to enable the form
            const changeEvent = new Event('change', { bubbles: true });
            globalEmployeeSelect.dispatchEvent(changeEvent);
            
            // Continue with form population immediately
            setTimeout(() => {
                continueFormPopulation(editData);
            }, 100);
            
        } else if (attempts < 50) { // Try for up to 5 seconds
            console.log(`Employee dropdown not ready, attempt ${attempts + 1}/50`);
            setTimeout(() => setEmployeeAndContinue(attempts + 1), 100);
        } else {
            console.error('Employee dropdown failed to load after 5 seconds');
            // As a last resort, manually add the employee option if we have the name
            if (editData.employeeName) {
                const globalEmployeeSelect = document.getElementById('globalEmployee');
                if (globalEmployeeSelect) {
                    console.log('Adding employee option as fallback:', editData.employeeName);
                    globalEmployeeSelect.innerHTML = `
                        <option value="">Select Team Member</option>
                        <option value="${editData.employeeId}" selected>${editData.employeeName}</option>
                    `;
                    
                    // Lock the dropdown in edit mode (fallback)
                    globalEmployeeSelect.disabled = true;
                    globalEmployeeSelect.style.backgroundColor = '#f8f9fa';
                    globalEmployeeSelect.style.cursor = 'not-allowed';
                    globalEmployeeSelect.title = 'Team member cannot be changed in edit mode';
                    
                    // Add lock icon (fallback)
                    const lockIcon = document.createElement('span');
                    lockIcon.innerHTML = '<i class="fas fa-lock" style="margin-left: 8px; color: #6c757d;"></i>';
                    lockIcon.className = 'edit-mode-lock-indicator';
                    
                    const existingLockIcon = globalEmployeeSelect.parentNode.querySelector('.edit-mode-lock-indicator');
                    if (!existingLockIcon) {
                        globalEmployeeSelect.parentNode.appendChild(lockIcon);
                    }
                    
                    // Trigger change event
                    const changeEvent = new Event('change', { bubbles: true });
                    globalEmployeeSelect.dispatchEvent(changeEvent);
                }
            }
            
            // Continue anyway
            continueFormPopulation(editData);
        }
    };
    
    setEmployeeAndContinue();
}

// Continue form population after employee is set
function continueFormPopulation(editData) {
    console.log('=== Starting continueFormPopulation ===');
    console.log('Edit data received:', editData);
    console.log('Number of KPIs to populate:', editData.kpis.length);
    
    // Show the KPI form if it's hidden
    const gettingStartedSection = document.getElementById('gettingStarted');
    const kpiSectionsContainer = document.getElementById('kpiSectionsContainer');
    
    console.log('Getting started section found:', !!gettingStartedSection);
    console.log('KPI sections container found:', !!kpiSectionsContainer);
    
    if (gettingStartedSection) {
        gettingStartedSection.style.display = 'none';
        console.log('Hid getting started section');
    }
    
    if (kpiSectionsContainer) {
        kpiSectionsContainer.style.display = 'block';
        console.log('Made KPI sections container visible');
    }
    
    // Show the Add KPI button and form actions
    const addKPIButton = document.getElementById('addKPIBtn');
    const kpiForm = document.getElementById('kpiForm');
    const formActions = document.getElementById('formActions');
    const loadDraftBtn = document.getElementById('loadDraftBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    console.log('Add KPI button found:', !!addKPIButton);
    console.log('KPI form found:', !!kpiForm);
    console.log('Form actions found:', !!formActions);
    
    if (addKPIButton) {
        addKPIButton.style.display = 'block';
        // Update button text for edit mode
        addKPIButton.innerHTML = '<i class="fas fa-plus"></i> Add Another KPI';
        
        // If editing self, disable the add button
        if (window.isEditingSelfKPIs) {
            addKPIButton.disabled = true;
            addKPIButton.style.opacity = '0.5';
            addKPIButton.title = 'Cannot add KPIs to your own evaluation';
            addKPIButton.innerHTML = '<i class="fas fa-plus"></i> Add Another KPI (Disabled)';
        }
    }
    
    if (kpiForm) {
        kpiForm.style.display = 'block';
    }
    
    if (formActions) {
        formActions.style.display = 'flex';
        console.log('Made form actions visible');
    }
    
    if (loadDraftBtn) {
        loadDraftBtn.style.display = 'inline-flex';
    }
    
    if (resetBtn) {
        resetBtn.style.display = 'inline-flex';
    }
    
    // Clear existing KPI sections (except the template)
    console.log('Clearing existing KPI sections...');
    clearExistingKPISections();
    
    // Populate each KPI
    if (editData.kpis && editData.kpis.length > 0) {
        console.log('Starting to populate KPIs...');
        editData.kpis.forEach((kpi, index) => {
            console.log(`Processing KPI ${index}:`, kpi);
            
            if (index === 0) {
                // Use the first KPI section that already exists
                console.log('Populating first KPI section');
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    populateKPISection(kpi, 0);
                }, 20);
            } else {
                // Add new sections for additional KPIs
                console.log('Adding new section for KPI', index);
                if (typeof window.addKPISection === 'function') {
                    window.addKPISection();
                    // Wait a bit for the section to be created
                    setTimeout(() => {
                        populateKPISection(kpi, index);
                    }, 50);
                } else {
                    console.error('addKPISection function not found');
                }
            }
        });
        
        // Update the KPI counter after all sections are added
        setTimeout(() => {
            if (typeof window.updateKPINumbers === 'function') {
                window.updateKPINumbers();
                console.log('Updated KPI numbers');
            } else {
                console.warn('updateKPINumbers function not found');
            }
        }, 100);
        
        // Change the form title to indicate edit mode
        const formTitle = document.querySelector('.kpi-title h2');
        if (formTitle) {
            formTitle.innerHTML = `<i class="fas fa-edit"></i> Edit KPIs for ${editData.employeeName}`;
        }
        
        // Add edit mode notice
        const kpiHeader = document.querySelector('.kpi-header');
        if (kpiHeader) {
            // Remove existing edit mode notice
            const existingNotice = document.querySelector('.edit-mode-notice');
            if (existingNotice) {
                existingNotice.remove();
            }
            
            // Check if current user is the same as the employee being edited
            const currentUser = window.authManager?.getUser() || JSON.parse(localStorage.getItem('currentUser') || '{}');
            const isEditingSelf = currentUser && (
                currentUser.uid === editData.employeeId || 
                currentUser.id === editData.employeeId ||
                currentUser.email === editData.employeeEmail
            );
            
            const editNotice = document.createElement('div');
            editNotice.className = 'edit-mode-notice';
            
            if (isEditingSelf) {
                // Show warning for self-editing
                editNotice.innerHTML = `
                    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-exclamation-triangle" style="color: #856404;"></i>
                        <div>
                            <strong style="color: #856404;">Self-Editing Restricted</strong>
                            <div style="font-size: 14px; color: #856404; margin-top: 2px;">
                                You cannot edit your own KPIs (<strong>${editData.employeeName}</strong>). KPI fields are locked to prevent self-evaluation.
                            </div>
                        </div>
                    </div>
                `;
                
                // Store the self-editing flag for later use
                window.isEditingSelfKPIs = true;
            } else {
                // Normal edit mode notice
                editNotice.innerHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-info-circle" style="color: #2196f3;"></i>
                        <div>
                            <strong style="color: #1976d2;">Edit Mode</strong>
                            <div style="font-size: 14px; color: #424242; margin-top: 2px;">
                                You are editing existing KPIs for <strong>${editData.employeeName}</strong>. The team member assignment is locked and cannot be changed.
                            </div>
                        </div>
                    </div>
                `;
                
                window.isEditingSelfKPIs = false;
            }
            
            // Insert after the title
            const titleElement = kpiHeader.querySelector('.kpi-title');
            if (titleElement) {
                titleElement.parentNode.insertBefore(editNotice, titleElement.nextSibling);
            } else {
                kpiHeader.appendChild(editNotice);
            }
        }
        
        // Change submit button text
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            if (window.isEditingSelfKPIs) {
                submitButton.innerHTML = '<i class="fas fa-save"></i> Update Current Values Only';
                submitButton.title = 'You can only update current values, not KPI details';
            } else {
                submitButton.innerHTML = '<i class="fas fa-save"></i> Update All KPIs';
            }
        }
        
        console.log('=== Form populated successfully with', editData.kpis.length, 'KPIs ===');
        
        // Add change listeners for evaluation tab updates
        setTimeout(() => {
            if (typeof window.addKPIDataChangeListeners === 'function') {
                window.addKPIDataChangeListeners();
                console.log('Added KPI data change listeners for evaluation tab');
            }
        }, 200);
    } else {
        console.warn('No KPIs found in edit data');
        showErrorModal('No KPI data found for editing');
    }
}

// Clear existing KPI sections (keep template but clear values)
function clearExistingKPISections() {
    console.log('Clearing existing KPI sections...');
    
    const kpiSectionsContainer = document.querySelector('#kpiSectionsContainer');
    if (kpiSectionsContainer) {
        // Remove all sections except the first one
        const sections = kpiSectionsContainer.querySelectorAll('.kpi-section');
        console.log('Found', sections.length, 'KPI sections');
        
        for (let i = 1; i < sections.length; i++) {
            console.log('Removing section', i);
            sections[i].remove();
        }
        
        // Clear the first section's values if it exists
        if (sections.length > 0) {
            const firstSection = sections[0];
            console.log('First section found:', firstSection);
            
            // Make sure the first section is visible
            firstSection.style.display = 'block';
            
            const inputs = firstSection.querySelectorAll('input, select, textarea');
            console.log('Clearing', inputs.length, 'inputs in first section');
            
            inputs.forEach(input => {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
            
            // Clear error messages
            const errorMessages = firstSection.querySelectorAll('.error-message');
            errorMessages.forEach(error => error.textContent = '');
        }
    } else {
        console.warn('KPI sections container not found');
    }
    
    // Reset KPI counter in the global scope
    if (typeof window.kpiCounter !== 'undefined') {
        window.kpiCounter = 0;
        console.log('Reset global kpiCounter to 0');
    }
}

// Helper function to clean up and format names
function cleanupName(name) {
    if (!name) return 'Unknown User';
    
    // Remove extra whitespace and trim
    let cleanName = name.toString().trim().replace(/\s+/g, ' ');
    
    // If it looks like an email, extract the part before @
    if (cleanName.includes('@') && !cleanName.includes(' ')) {
        const emailName = cleanName.split('@')[0];
        // Convert email username to readable name (e.g., john.doe -> John Doe)
        cleanName = emailName.replace(/[._-]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    } else {
        // Proper case formatting for regular names
        cleanName = cleanName.split(' ')
            .map(word => {
                if (word.length === 0) return '';
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    }
    
    return cleanName || 'Unknown User';
}

// Load employees from Firebase
async function loadEmployees() {
    try {
        console.log('Loading direct reports from Firebase...');
        
        // Get the global employee select
        const globalEmployeeSelect = document.getElementById('globalEmployee');
        
        if (!globalEmployeeSelect) {
            console.error('Global employee select element not found');
            return;
        }
        
        // Show loading state
        globalEmployeeSelect.innerHTML = '<option value="">Loading team members...</option>';
        globalEmployeeSelect.disabled = true;
        
        // Get current user from auth manager
        const currentUser = window.authManager?.getUser();
        if (!currentUser || !currentUser.uid) {
            console.error('No authenticated user found');
            globalEmployeeSelect.innerHTML = '<option value="">No authenticated user</option>';
            globalEmployeeSelect.disabled = false;
            return;
        }
        
        console.log('Current user ID:', currentUser.uid);
        
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            const directReports = [];
            
            if (data) {
                Object.entries(data).forEach(([uid, userData]) => {
                    // Only include users who report to the current user (direct reports)
                    if (userData && userData.lineManager === currentUser.uid) {
                        // Construct full name with priority: name > firstName+lastName > displayName > email
                        let fullName = userData.name;
                        
                        if (!fullName && userData.firstName && userData.lastName) {
                            fullName = `${userData.firstName} ${userData.lastName}`.trim();
                        } else if (!fullName && userData.firstName) {
                            fullName = userData.firstName;
                        } else if (!fullName && userData.lastName) {
                            fullName = userData.lastName;
                        } else if (!fullName) {
                            fullName = userData.displayName || userData.email || 'Unknown User';
                        }
                        
                        // Clean up the name (remove extra spaces, ensure proper capitalization)
                        fullName = cleanupName(fullName);
                        
                        directReports.push({
                            uid: uid,
                            name: fullName,
                            email: userData.email || '',
                            department: userData.department || '',
                            position: userData.position || '',
                            jobTitle: userData.jobTitle || '',
                            firstName: userData.firstName || '',
                            lastName: userData.lastName || ''
                        });
                        
                        console.log(`Found direct report: ${fullName} (${userData.email}) - Manager: ${userData.lineManager}`);
                    }
                });
            }
            
            // Sort direct reports by name
            directReports.sort((a, b) => a.name.localeCompare(b.name));
            
            // Generate options HTML
            let optionsHTML = '<option value="">Select Team Member</option>';
            
            if (directReports.length === 0) {
                optionsHTML += '<option value="" disabled>No direct reports found</option>';
                console.log('No direct reports found for current user');
            } else {
                directReports.forEach(employee => {
                    // Display name with job title for better identification
                    const displayText = employee.jobTitle ? 
                        `${employee.name} (${employee.jobTitle})` : 
                        employee.name;
                    
                    optionsHTML += `<option value="${employee.uid}" data-email="${employee.email}" data-department="${employee.department}" data-position="${employee.position}" data-job-title="${employee.jobTitle}" data-full-name="${employee.name}">${displayText}</option>`;
                });
                
                console.log(`Loaded ${directReports.length} direct reports for user ${currentUser.uid}`);
            }
            
            // Populate global employee dropdown
            globalEmployeeSelect.innerHTML = optionsHTML;
            globalEmployeeSelect.disabled = false;
            
        }, (error) => {
            console.error('Error loading direct reports:', error);
            globalEmployeeSelect.innerHTML = '<option value="">Error loading team members</option>';
            globalEmployeeSelect.disabled = false;
        });
        
    } catch (error) {
        console.error('Error in loadEmployees:', error);
        const globalEmployeeSelect = document.getElementById('globalEmployee');
        if (globalEmployeeSelect) {
            globalEmployeeSelect.innerHTML = '<option value="">Error loading team members</option>';
            globalEmployeeSelect.disabled = false;
        }
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    console.log('Form submission started');
    
    if (!validateAllKPIs()) {
        console.log('Form validation failed');
        showErrorModal('Please fix the errors in the form before submitting.');
        return;
    }
    
    console.log('Form validation passed');
    showLoading(true);
    
    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('mode') === 'edit';
    
    try {
        const allKPIData = collectAllKPIData();
        console.log('All KPI Data collected:', allKPIData);
        
        if (isEditMode) {
            // Update existing KPIs
            for (const kpiData of allKPIData) {
                await updateKPI(kpiData);
            }
            console.log('All KPIs updated successfully');
            showSuccessModal(`Successfully updated ${allKPIData.length} KPI${allKPIData.length > 1 ? 's' : ''}!`);
        } else {
            // Save new KPIs
            for (const kpiData of allKPIData) {
                await saveKPI(kpiData);
            }
            console.log('All KPIs saved successfully');
            showSuccessModal(`Successfully created ${allKPIData.length} KPI${allKPIData.length > 1 ? 's' : ''}!`);
        }
        
        clearDraft(); // Clear any saved draft
        
        // Redirect back to KPI board after a short delay
        setTimeout(() => {
            window.location.href = 'kpiboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving KPIs:', error);
        showErrorModal(isEditMode ? 'Failed to update KPIs. Please try again.' : 'Failed to create KPIs. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Collect data from all KPI sections
function collectAllKPIData() {
    const kpiSections = document.querySelectorAll('.kpi-section');
    const allKPIData = [];
    
    kpiSections.forEach((section, index) => {
        const kpiData = collectFormDataFromSection(index);
        allKPIData.push(kpiData);
    });
    
    return allKPIData;
}

// Collect form data from a specific section
function collectFormDataFromSection(index) {
    const suffix = `_${index}`;
    const fields = ['kpiName', 'category', 'metricType', 'frequency', 'target', 'description'];
    const kpiData = {};
    
    // Get global employee value and name
    const globalEmployee = document.getElementById('globalEmployee');
    if (globalEmployee && globalEmployee.value) {
        kpiData.employee = globalEmployee.value;
        
        // Get the selected option to extract the employee name
        const selectedOption = globalEmployee.options[globalEmployee.selectedIndex];
        if (selectedOption) {
            // Use data-full-name attribute for more accurate name, fallback to parsing text
            kpiData.employeeName = selectedOption.getAttribute('data-full-name') || 
                                   selectedOption.textContent.split(' (')[0]; // Remove department info
            kpiData.employeeEmail = selectedOption.getAttribute('data-email') || '';
            kpiData.employeeDepartment = selectedOption.getAttribute('data-department') || '';
            kpiData.employeePosition = selectedOption.getAttribute('data-position') || '';
        }
    }
    
    // Get KPI-specific fields
    fields.forEach(fieldName => {
        const fieldId = `${fieldName}${suffix}`;
        const field = document.getElementById(fieldId);
        if (field) {
            kpiData[fieldName] = field.value;
        }
    });
    
    // Always get current value, regardless of self-editing restrictions
    const currentField = document.getElementById(`current${suffix}`);
    if (currentField) {
        kpiData.current = parseFloat(currentField.value) || 0;
    }
    
    // Convert numeric fields
    kpiData.target = parseFloat(kpiData.target) || 0;
    
    // Check if this is an existing KPI (edit mode)
    const section = document.querySelector(`[data-kpi-index="${index}"]`);
    const existingKPIId = section ? section.getAttribute('data-kpi-id') : null;
    
    if (existingKPIId) {
        // This is an update - use existing ID and preserve creation data
        kpiData.id = existingKPIId;
        kpiData.updatedAt = new Date().toISOString();
        
        // If editing self, preserve all original data and only update current value
        if (window.isEditingSelfKPIs) {
            // Load original KPI data to preserve it
            const originalKPIs = JSON.parse(localStorage.getItem('kpis') || '[]');
            const originalKPI = originalKPIs.find(kpi => kpi.id === existingKPIId);
            
            if (originalKPI) {
                // Preserve all original data except current value and updatedAt
                Object.keys(originalKPI).forEach(key => {
                    if (key !== 'current' && key !== 'updatedAt') {
                        kpiData[key] = originalKPI[key];
                    }
                });
                
                console.log('Self-editing: Only updating current value for KPI', existingKPIId);
            }
        }
    } else {
        // This is a new KPI
        kpiData.id = generateKPIId();
        kpiData.createdAt = new Date().toISOString();
        // Store comprehensive creator information
        if (currentUser) {
            kpiData.createdBy = currentUser.email || currentUser.id || 'Unknown';
            kpiData.createdByName = currentUser.name || currentUser.displayName || 'Unknown User';
            kpiData.createdByInfo = {
                name: currentUser.name || currentUser.displayName || 'Unknown User',
                email: currentUser.email || '',
                id: currentUser.id || currentUser.uid || ''
            };
        } else {
            kpiData.createdBy = 'Unknown';
            kpiData.createdByName = 'Unknown User';
            kpiData.createdByInfo = {
                name: 'Unknown User',
                email: '',
                id: ''
            };
        }
        kpiData.updatedAt = new Date().toISOString();
    }
    
    return kpiData;
}

// Validate all KPI sections
function validateAllKPIs() {
    let isValid = true;
    
    // First validate the global employee field
    if (!validateField('globalEmployee')) {
        isValid = false;
    }
    
    // Then validate all KPI sections
    const kpiSections = document.querySelectorAll('.kpi-section');
    kpiSections.forEach((section, index) => {
        if (!validateKPISection(index)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Validate a specific KPI section
function validateKPISection(index) {
    let isValid = true;
    const requiredFields = ['kpiName', 'category', 'metricType', 'frequency', 'target'];
    
    requiredFields.forEach(fieldName => {
        const fieldId = `${fieldName}_${index}`;
        if (!validateField(fieldId)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Save KPI to Firebase
async function saveKPI(kpiData) {
    try {
        const kpiRef = ref(db, `kpis/${kpiData.id}`);
        await set(kpiRef, kpiData);
        console.log('KPI saved to Firebase successfully');
    } catch (error) {
        console.warn('Firebase save failed, using localStorage fallback:', error);
        // Fallback to localStorage
        const existingKPIs = JSON.parse(localStorage.getItem('kpis') || '[]');
        existingKPIs.push(kpiData);
        localStorage.setItem('kpis', JSON.stringify(existingKPIs));
        console.log('KPI saved to localStorage');
    }
}

// Update existing KPI
async function updateKPI(kpiData) {
    try {
        const kpiRef = ref(db, `kpis/${kpiData.id}`);
        await set(kpiRef, kpiData);
        console.log('KPI updated in Firebase successfully');
    } catch (error) {
        console.warn('Firebase update failed, using localStorage fallback:', error);
        // Fallback to localStorage
        const existingKPIs = JSON.parse(localStorage.getItem('kpis') || '[]');
        const kpiIndex = existingKPIs.findIndex(kpi => kpi.id === kpiData.id);
        
        if (kpiIndex !== -1) {
            // Update existing KPI
            existingKPIs[kpiIndex] = kpiData;
        } else {
            // If not found, add as new (shouldn't happen in edit mode)
            existingKPIs.push(kpiData);
        }
        
        localStorage.setItem('kpis', JSON.stringify(existingKPIs));
        console.log('KPI updated in localStorage');
    }
}

// Generate unique KPI ID
function generateKPIId() {
    return 'kpi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Form validation (legacy function for backward compatibility)
function validateForm() {
    return validateAllKPIs();
}

// Validate individual field
function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return false;
    
    // If editing self and this is not a current value field, skip validation for disabled fields
    const isCurrentValueField = fieldId.includes('current_');
    if (window.isEditingSelfKPIs && field.disabled && !isCurrentValueField) {
        return true; // Skip validation for disabled fields when editing self
    }
    
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required.';
    } else {
        const baseFieldName = fieldId.replace(/_\d+$/, '');
        switch (baseFieldName) {
            case 'kpiName':
                if (value.length < 3) {
                    isValid = false;
                    errorMessage = 'KPI name must be at least 3 characters long.';
                }
                break;
            case 'target':
                if (isNaN(value) || value === '') {
                    isValid = false;
                    errorMessage = 'Please enter a valid number.';
                }
                break;
        }
    }
    
    if (!isValid) {
        showFieldError(fieldId, errorMessage);
    } else {
        clearError(fieldId);
    }
    
    return isValid;
}

// Show field error
function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
    }
}

// Clear field error
function clearError(fieldId) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('error');
    }
}

// Save draft functionality
function saveDraft() {
    if (isDraftSaving) return;
    
    isDraftSaving = true;
    const allKPIData = collectAllKPIData();
    const globalEmployee = document.getElementById('globalEmployee');
    
    const draftData = {
        globalEmployee: globalEmployee ? globalEmployee.value : '',
        kpis: allKPIData
    };
    
    localStorage.setItem('kpiDraft', JSON.stringify(draftData));
    
    // Show temporary success message
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i> Saved';
    button.classList.add('success');
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('success');
        isDraftSaving = false;
    }, 2000);
}

// Load draft
function loadDraft() {
    const draft = localStorage.getItem('kpiDraft');
    if (draft) {
        const draftData = JSON.parse(draft);
        
        // Handle both old and new draft formats
        if (Array.isArray(draftData)) {
            // Old format - just KPI array
            populateAllKPIs(draftData);
        } else {
            // New format - object with globalEmployee and kpis
            if (draftData.globalEmployee) {
                const globalEmployee = document.getElementById('globalEmployee');
                if (globalEmployee) {
                    globalEmployee.value = draftData.globalEmployee;
                }
            }
            if (draftData.kpis) {
                populateAllKPIs(draftData.kpis);
            }
        }
        
        showSuccessModal('Draft loaded successfully!');
    } else {
        showErrorModal('No draft found.');
    }
}

// Populate a specific KPI section with data
function populateKPISection(data, index) {
    const suffix = `_${index}`;
    console.log(`Populating KPI section ${index}:`, data);
    
    if (!data) {
        console.error(`No KPI data provided for section ${index}`);
        return;
    }
    
    // Map of field names to populate
    const fieldMappings = {
        'kpiName': data.name || data.kpiName,
        'category': data.category,
        'metricType': data.metricType,
        'frequency': data.frequency,
        'target': data.target,
        'current': data.current,
        'description': data.description
    };
    
    // Populate each field
    Object.entries(fieldMappings).forEach(([fieldName, value]) => {
        const fieldId = `${fieldName}${suffix}`;
        const field = document.getElementById(fieldId);
        
        if (field && value !== undefined && value !== null) {
            field.value = value;
            console.log(`Set ${fieldId} to:`, value);
            
            // If editing self, disable KPI fields (but allow current value updates)
            if (window.isEditingSelfKPIs && fieldName !== 'current') {
                field.disabled = true;
                field.style.backgroundColor = '#f8f9fa';
                field.style.cursor = 'not-allowed';
                field.title = 'Cannot edit your own KPI details';
                
                // Add a visual indicator
                if (!field.parentNode.querySelector('.self-edit-lock')) {
                    const lockIcon = document.createElement('span');
                    lockIcon.innerHTML = '<i class="fas fa-user-lock" style="margin-left: 8px; color: #856404;" title="Self-editing restricted"></i>';
                    lockIcon.className = 'self-edit-lock';
                    field.parentNode.appendChild(lockIcon);
                }
            }
        } else if (!field) {
            console.warn(`Field ${fieldId} not found in DOM`);
        }
    });
    
    // Store the original KPI ID for updates
    if (data.id) {
        const section = document.querySelector(`[data-kpi-index="${index}"]`);
        if (section) {
            section.setAttribute('data-kpi-id', data.id);
            console.log(`Set data-kpi-id="${data.id}" for section ${index}`);
        } else {
            console.warn(`Section with data-kpi-index="${index}" not found`);
        }
    }
    
    // If editing self, also disable the remove button for this section
    if (window.isEditingSelfKPIs) {
        const removeButton = document.querySelector(`button[onclick="removeKPISection(${index})"]`);
        if (removeButton) {
            removeButton.disabled = true;
            removeButton.style.opacity = '0.5';
            removeButton.title = 'Cannot remove your own KPI sections';
        }
    }
}

// Populate all KPI sections with data
function populateAllKPIs(allKPIData) {
    // Reset form first
    resetAllKPIs();
    
    allKPIData.forEach((kpiData, index) => {
        // Add new section if needed
        if (index > 0) {
            window.addKPISection();
        }
        
        // Populate the section
        populateKPISection(kpiData, index);
    });
}

// Reset all KPI sections
function resetAllKPIs() {
    // Remove all sections except the first
    const sections = document.querySelectorAll('.kpi-section');
    sections.forEach((section, index) => {
        if (index > 0) {
            section.remove();
        }
    });
    
    // Reset the global employee field and unlock it if it was locked
    const globalEmployee = document.getElementById('globalEmployee');
    if (globalEmployee) {
        globalEmployee.selectedIndex = 0;
        
        // Unlock the dropdown if it was locked in edit mode
        globalEmployee.disabled = false;
        globalEmployee.style.backgroundColor = '';
        globalEmployee.style.cursor = '';
        globalEmployee.title = '';
        
        // Remove lock icon if it exists
        const lockIcon = globalEmployee.parentNode.querySelector('.edit-mode-lock-indicator');
        if (lockIcon) {
            lockIcon.remove();
        }
    }
    
    // Remove edit mode notice if it exists
    const editNotice = document.querySelector('.edit-mode-notice');
    if (editNotice) {
        editNotice.remove();
    }
    
    // Clear self-editing flag
    window.isEditingSelfKPIs = false;
    
    // Remove any self-edit lock icons
    document.querySelectorAll('.self-edit-lock').forEach(icon => {
        icon.remove();
    });
    
    // Reset the first section
    const firstSection = document.querySelector('.kpi-section');
    if (firstSection) {
        const inputs = firstSection.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.type === 'select-one') {
                input.selectedIndex = 0;
            } else {
                input.value = '';
            }
        });
        
        // Clear error messages
        const errorMessages = firstSection.querySelectorAll('.error-message');
        errorMessages.forEach(error => error.textContent = '');
    }
    
    // Clear global employee error
    const globalEmployeeError = document.getElementById('globalEmployeeError');
    if (globalEmployeeError) {
        globalEmployeeError.textContent = '';
    }
    
    // Reset counter if the function exists in global scope
    if (typeof window.kpiCounter !== 'undefined') {
        window.kpiCounter = 0;
    }
    
    // Update UI
    if (typeof window.toggleRemoveButtons === 'function') {
        window.toggleRemoveButtons();
    }
    if (typeof window.updateKPINumbers === 'function') {
        window.updateKPINumbers();
    }
    
    // Clear draft
    localStorage.removeItem('kpiDraft');
    
    // Reset form title to default
    const formTitle = document.querySelector('.kpi-title h2');
    if (formTitle) {
        formTitle.innerHTML = '<i class="fas fa-chart-line"></i> Create Key Performance Indicators (KPIs)';
    }
    
    // Reset submit button text to default
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-save"></i> Create All KPIs';
    }
}

// Clear draft from localStorage
function clearDraft() {
    localStorage.removeItem('kpiDraft');
    console.log('Draft cleared');
}

// Populate form with data (legacy function for backward compatibility)
function populateForm(data) {
    if (Array.isArray(data)) {
        populateAllKPIs(data);
    } else {
        populateKPISection(data, 0);
    }
}

// Auto-save draft
function enableAutoSave() {
    const form = document.getElementById('kpiForm');
    let autoSaveTimeout;
    
    form.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            if (!isDraftSaving) {
                saveDraft();
            }
        }, 30000); // Auto-save every 30 seconds
    });
}

// Preview all KPIs
function previewKPIs() {
    if (!validateAllKPIs()) {
        return;
    }
    
    const allKPIData = collectAllKPIData();
    const previewContent = generateAllKPIsPreviewHTML(allKPIData);
    
    document.getElementById('previewContent').innerHTML = previewContent;
    openModal('previewModal');
}

// Generate preview HTML for all KPIs
function generateAllKPIsPreviewHTML(allKPIData) {
    let html = '<div class="all-kpis-preview">';
    
    // Get employee name from the global select option
    const globalEmployeeSelect = document.getElementById('globalEmployee');
    const selectedOption = globalEmployeeSelect ? globalEmployeeSelect.options[globalEmployeeSelect.selectedIndex] : null;
    const employeeName = selectedOption ? selectedOption.textContent : 'Not selected';
    
    // Show global employee assignment
    html += `
        <div class="global-employee-info" style="margin-bottom: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--accent-color);">
            <h3 style="margin-top: 0; color: var(--text-primary);"><i class="fas fa-user"></i> Assigned Employee</h3>
            <p style="margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">${employeeName}</p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: var(--text-secondary);">All KPIs will be assigned to this employee</p>
        </div>
    `;
    
    allKPIData.forEach((kpiData, index) => {
        html += `
            <div class="kpi-preview-section" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #333;">KPI #${index + 1}: ${kpiData.kpiName}</h3>
                
                <div class="preview-section">
                    <h4>Basic Information</h4>
                    <div class="preview-grid">
                        <div><strong>Category:</strong> ${kpiData.category}</div>
                        <div><strong>Metric Type:</strong> ${kpiData.metricType}</div>
                    </div>
                </div>
                
                <div class="preview-section">
                    <h4>Metrics</h4>
                    <div class="preview-grid">
                        <div><strong>Frequency:</strong> ${kpiData.frequency}</div>
                        <div><strong>Target:</strong> ${kpiData.target}</div>
                    </div>
                </div>
                
                ${kpiData.description ? `
                <div class="preview-section">
                    <h4>Description</h4>
                    <p>${kpiData.description}</p>
                </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Preview KPI (legacy function for backward compatibility)
function previewKPI() {
    previewKPIs();
}

// Generate preview HTML (legacy function for backward compatibility)
function generatePreviewHTML(kpiData) {
    return generateAllKPIsPreviewHTML([kpiData]);
}

// Calculate performance
function calculatePerformance(current, thresholds) {
    if (!current || !thresholds) {
        return { label: 'No Data', class: 'no-data', percentage: 0 };
    }
    
    if (current >= thresholds.excellent) {
        return { label: 'Excellent', class: 'excellent', percentage: 100 };
    } else if (current >= thresholds.good) {
        return { label: 'Good', class: 'good', percentage: 75 };
    } else if (current >= thresholds.poor) {
        return { label: 'Average', class: 'average', percentage: 50 };
    } else {
        return { label: 'Poor', class: 'poor', percentage: 25 };
    }
}

// View KPI board
function viewKPIBoard() {
    closeModal('successModal');
    window.location.href = 'kpiboard.html';
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showSuccessModal(message = 'KPI created successfully!') {
    document.getElementById('successModal').querySelector('.modal-body p').textContent = message;
    openModal('successModal');
}

function showErrorModal(message) {
    document.getElementById('errorMessage').textContent = message;
    openModal('errorModal');
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Submit KPI from preview
function submitKPIFromPreview() {
    closeModal('previewModal');
    document.getElementById('kpiForm').dispatchEvent(new Event('submit'));
}

// Reset form (updated to handle multiple KPIs)
function resetForm() {
    resetAllKPIs();
    initializeForm();
}

// Global functions for HTML onclick events
window.loadDraft = loadDraft;
window.resetForm = resetForm;
window.saveDraft = saveDraft;
window.previewKPI = previewKPIs; // Updated to use new function
window.previewKPIs = previewKPIs;
window.submitKPIFromPreview = submitKPIFromPreview;
window.viewKPIBoard = viewKPIBoard;
window.closeModal = closeModal;
window.setupKPIEventListeners = setupKPIEventListeners;
window.validateField = validateField;
window.clearError = clearError;

// Load KPI Schedule and apply to form
function loadKPISchedule() {
    try {
        // Load schedule from localStorage
        const savedSchedule = localStorage.getItem('kpiSchedule');
        const sessionSchedule = sessionStorage.getItem('currentKPISchedule');
        
        let schedule = null;
        
        if (sessionSchedule) {
            schedule = JSON.parse(sessionSchedule);
        } else if (savedSchedule) {
            schedule = JSON.parse(savedSchedule);
        }
        
        if (schedule) {
            applyScheduleToKPIForm(schedule);
            updateFormBasedOnSchedule(schedule);
        } else {
            console.log('No KPI schedule found, using default behavior');
        }
    } catch (error) {
        console.error('Error loading KPI schedule:', error);
    }
}

// Apply schedule settings to the KPI form
function applyScheduleToKPIForm(schedule) {
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];
    
    // Determine current period
    let currentPeriod = null;
    let isAssignmentPeriod = false;
    let isMidYearPeriod = false;
    let isYearEndPeriod = false;
    
    if (today >= schedule.assignmentStartDate && today <= schedule.assignmentEndDate) {
        currentPeriod = 'assignment';
        isAssignmentPeriod = true;
    } else if (today >= schedule.midYearStartDate && today <= schedule.midYearEndDate) {
        currentPeriod = 'evaluation';
        isMidYearPeriod = true;
    } else if (today >= schedule.yearEndStartDate && today <= schedule.yearEndEndDate) {
        currentPeriod = 'yearEnd';
        isYearEndPeriod = true;
    }
    
    // Store schedule info globally for use by other functions
    window.kpiScheduleInfo = {
        schedule: schedule,
        currentPeriod: currentPeriod,
        isAssignmentPeriod: isAssignmentPeriod,
        isMidYearPeriod: isMidYearPeriod,
        isYearEndPeriod: isYearEndPeriod,
        today: today
    };
    
    console.log('Applied KPI Schedule:', window.kpiScheduleInfo);
}

// Update form behavior based on current schedule period
function updateFormBasedOnSchedule(schedule) {
    const scheduleInfo = window.kpiScheduleInfo;
    
    if (!scheduleInfo) return;
    
    // Add schedule notification to form
    addScheduleNotificationToForm(scheduleInfo);
    
    // Update tab availability based on current period
    updateTabAvailability(scheduleInfo);
    
    // Set appropriate default tab based on current period
    setDefaultTabBasedOnSchedule(scheduleInfo);
    
    // Apply field restrictions based on schedule periods with a delay to ensure DOM is ready
    setTimeout(() => {
        applyFieldRestrictionsBasedOnSchedule(scheduleInfo);
    }, 500);
}

// Add schedule notification banner to the form
function addScheduleNotificationToForm(scheduleInfo) {
    const kpiHeader = document.querySelector('.kpi-header');
    if (!kpiHeader) return;
    
    // Remove existing schedule notification
    const existingNotification = document.querySelector('.schedule-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    let notificationHTML = '';
    let notificationClass = 'info';
    
    if (scheduleInfo.isAssignmentPeriod) {
        notificationHTML = `
            <div class="schedule-notification ${notificationClass}">
                <i class="fas fa-calendar-alt"></i>
                <div class="notification-content">
                    <strong>KPI Assignment Period Active</strong>
                    <p>This is the active period for creating and assigning KPIs. Period ends: ${formatScheduleDate(scheduleInfo.schedule.assignmentEndDate)}</p>
                </div>
            </div>
        `;
    } else if (scheduleInfo.isMidYearPeriod) {
        notificationClass = 'warning';
        notificationHTML = `
            <div class="schedule-notification ${notificationClass}">
                <i class="fas fa-chart-bar"></i>
                <div class="notification-content">
                    <strong>Mid Year Evaluation Period Active</strong>
                    <p>This is the active period for mid-year KPI evaluations. Period ends: ${formatScheduleDate(scheduleInfo.schedule.midYearEndDate)}</p>
                </div>
            </div>
        `;
    } else if (scheduleInfo.isYearEndPeriod) {
        notificationClass = 'success';
        notificationHTML = `
            <div class="schedule-notification ${notificationClass}">
                <i class="fas fa-trophy"></i>
                <div class="notification-content">
                    <strong>End of Year Evaluation Period Active</strong>
                    <p>This is the active period for year-end KPI evaluations. Period ends: ${formatScheduleDate(scheduleInfo.schedule.yearEndEndDate)}</p>
                </div>
            </div>
        `;
    } else {
        notificationClass = 'neutral';
        notificationHTML = `
            <div class="schedule-notification ${notificationClass}">
                <i class="fas fa-info-circle"></i>
                <div class="notification-content">
                    <strong>Outside Active KPI Periods</strong>
                    <p>Currently outside scheduled KPI periods. Fields for expired periods are locked. Next period: ${getNextPeriodInfo(scheduleInfo)}</p>
                </div>
            </div>
        `;
    }
    
    if (notificationHTML) {
        kpiHeader.insertAdjacentHTML('afterend', notificationHTML);
    }
}

// Update tab availability based on schedule
function updateTabAvailability(scheduleInfo) {
    const assignmentTab = document.getElementById('assignmentTab');
    const evaluationTab = document.getElementById('evaluationTab');
    const yearEndTab = document.getElementById('yearEndTab');
    
    if (!assignmentTab || !evaluationTab || !yearEndTab) return;
    
    // Reset all tabs to enabled
    [assignmentTab, evaluationTab, yearEndTab].forEach(tab => {
        tab.classList.remove('disabled');
        tab.style.opacity = '1';
        tab.style.pointerEvents = 'auto';
    });
    
    // Apply restrictions based on schedule if desired
    // For now, keep all tabs accessible but highlight the appropriate one
    if (scheduleInfo.isAssignmentPeriod) {
        assignmentTab.classList.add('recommended');
    } else if (scheduleInfo.isMidYearPeriod) {
        evaluationTab.classList.add('recommended');
    } else if (scheduleInfo.isYearEndPeriod) {
        yearEndTab.classList.add('recommended');
    }
}

// Set default tab based on current schedule period
function setDefaultTabBasedOnSchedule(scheduleInfo) {
    // Only switch tabs if user hasn't already interacted with the form
    const hasFormInteraction = sessionStorage.getItem('userInteractedWithTabs');
    if (hasFormInteraction) return;
    
    if (scheduleInfo.isMidYearPeriod && typeof window.switchTab === 'function') {
        setTimeout(() => window.switchTab('evaluation'), 500);
    } else if (scheduleInfo.isYearEndPeriod && typeof window.switchTab === 'function') {
        setTimeout(() => window.switchTab('yearEnd'), 500);
    }
}

// Apply field restrictions based on schedule periods
function applyFieldRestrictionsBasedOnSchedule(scheduleInfo) {
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];
    const schedule = scheduleInfo.schedule;
    
    // Check if each period is overdue
    const isAssignmentOverdue = today > schedule.assignmentEndDate;
    const isMidYearOverdue = today > schedule.midYearEndDate;
    const isYearEndOverdue = today > schedule.yearEndEndDate;
    
    // Apply restrictions to each tab
    if (isAssignmentOverdue) {
        disableTabFields('assignmentContent', 'Assignment period has ended');
    } else {
        enableTabFields('assignmentContent');
    }
    
    if (isMidYearOverdue) {
        disableTabFields('evaluationContent', 'Mid-year evaluation period has ended');
    } else {
        enableTabFields('evaluationContent');
    }
    
    if (isYearEndOverdue) {
        disableTabFields('yearEndContent', 'End-of-year evaluation period has ended');
    } else {
        enableTabFields('yearEndContent');
    }
    
    console.log('Applied field restrictions:', {
        isAssignmentOverdue,
        isMidYearOverdue,
        isYearEndOverdue
    });
}

// Disable all form fields in a specific tab
function disableTabFields(tabContentId, reason) {
    const tabContent = document.getElementById(tabContentId);
    if (!tabContent) return;
    
    // Find all input elements (input, select, textarea, button) but be more selective
    const formElements = tabContent.querySelectorAll('input:not([readonly]), select:not([readonly]), textarea:not([readonly]), button[type="submit"], button[type="button"]:not(.tab-nav-button):not(.nav-button)');
    
    formElements.forEach(element => {
        // Skip certain elements that should remain enabled
        if (element.type === 'button' && (
            element.textContent.includes('Preview') || 
            element.textContent.includes('View') ||
            element.textContent.includes('Back to Assignment') ||
            element.textContent.includes('Go to') ||
            element.classList.contains('nav-button') ||
            element.classList.contains('btn-secondary') ||
            element.classList.contains('tab-nav-button') ||
            element.id === 'addKPIBtn'
        )) {
            return;
        }
        
        // Skip if already disabled or if it's a tab navigation element
        if (element.closest('.tab-item') || element.closest('.tab-navigation')) {
            return;
        }
        
        // Skip global employee selection (should always be available)
        if (element.id === 'globalEmployee') {
            return;
        }
        
        element.disabled = true;
        element.classList.add('field-disabled');
        
        // Add title attribute for tooltip
        if (!element.hasAttribute('data-original-title')) {
            element.setAttribute('data-original-title', element.title || '');
        }
        element.title = reason;
    });
    
    // Add visual indicator to the tab content
    if (!tabContent.querySelector('.period-expired-notice')) {
        const notice = document.createElement('div');
        notice.className = 'period-expired-notice';
        notice.innerHTML = `
            <div class="expired-notice-content">
                <i class="fas fa-lock"></i>
                <span><strong>Period Expired:</strong> ${reason}. All KPI fields in this section are now read-only.</span>
            </div>
        `;
        tabContent.insertBefore(notice, tabContent.firstChild);
    }
}

// Enable all form fields in a specific tab
function enableTabFields(tabContentId) {
    const tabContent = document.getElementById(tabContentId);
    if (!tabContent) return;
    
    // Find all input elements (input, select, textarea, button)
    const formElements = tabContent.querySelectorAll('input, select, textarea, button');
    
    formElements.forEach(element => {
        // Only enable elements that were disabled by our restriction logic
        if (element.classList.contains('field-disabled')) {
            element.disabled = false;
            element.classList.remove('field-disabled');
            
            // Restore original title
            if (element.hasAttribute('data-original-title')) {
                element.title = element.getAttribute('data-original-title');
                element.removeAttribute('data-original-title');
            } else {
                element.title = '';
            }
        }
    });
    
    // Remove visual indicator
    const existingNotice = tabContent.querySelector('.period-expired-notice');
    if (existingNotice) {
        existingNotice.remove();
    }
}

// Helper functions
function formatScheduleDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function getNextPeriodInfo(scheduleInfo) {
    const today = new Date(scheduleInfo.today);
    const schedule = scheduleInfo.schedule;
    
    const periods = [
        { name: 'KPI Assignment', start: new Date(schedule.assignmentStartDate) },
        { name: 'Mid Year Evaluation', start: new Date(schedule.midYearStartDate) },
        { name: 'Year End Evaluation', start: new Date(schedule.yearEndStartDate) }
    ];
    
    for (let period of periods) {
        if (period.start > today) {
            return `${period.name} starts ${formatScheduleDate(period.start.toISOString().split('T')[0])}`;
        }
    }
    
    return 'No upcoming periods scheduled';
}

// Make loadKPISchedule available globally
window.loadKPISchedule = loadKPISchedule;

// Make field restriction functions available globally
window.applyFieldRestrictionsBasedOnSchedule = applyFieldRestrictionsBasedOnSchedule;
window.disableTabFields = disableTabFields;
window.enableTabFields = enableTabFields;

// Function to reapply field restrictions (useful for tab switching)
function reapplyFieldRestrictions() {
    if (window.kpiScheduleInfo) {
        applyFieldRestrictionsBasedOnSchedule(window.kpiScheduleInfo);
    }
}

window.reapplyFieldRestrictions = reapplyFieldRestrictions;

// Export functions for use in other modules
export {
    saveKPI,
    generateKPIId,
    calculatePerformance,
    collectFormDataFromSection as collectFormData, // Updated export
    collectAllKPIData,
    validateAllKPIs,
    setupKPIEventListeners,
    loadKPISchedule
};
