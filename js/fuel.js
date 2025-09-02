/**
 * Fuel Emission Factors Management
 * This script handles fuel type emission factors management for GHG calculations
 */

// Initialize Firebase config
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Check authentication state
let currentUser = null;
let userRoles = [];

// DOM Elements
const ghgStandardFilter = document.getElementById('ghgStandardFilter');
const searchFilter = document.getElementById('searchFilter');
const addNewFuelBtn = document.getElementById('addNewFuel');
const saveChangesBtn = document.getElementById('saveChanges');
const fuelFactorsTableBody = document.getElementById('fuelFactorsTableBody');
const successNotification = document.getElementById('successNotification');
const errorNotification = document.getElementById('errorNotification');
const loadingIndicator = document.getElementById('loadingIndicator');
const currentUserDisplay = document.getElementById('currentUserDisplay');

// Store original and modified data
let originalFuelData = {};
let modifiedFuelData = {};
let fuelCategories = {};
let hasUnsavedChanges = false;

// Wait for authentication to be ready
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        
        // Update UI with user info
        if (currentUserDisplay) {
            currentUserDisplay.textContent = user.displayName || user.email || 'User';
        }
        
        // Show loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
          // Load data
        Promise.all([
            loadUserRoles(),
            loadFuelData(),
            loadFuelCategories(),
            loadGHGStandards()
        ]).then(() => {
            // Hide loading indicator when all data is loaded
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }).catch(error => {
            console.error('Error loading data:', error);
            // Hide loading indicator even if there was an error
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        });
    } else {
        // Redirect to login page if not authenticated
        window.location.href = 'login.html';
    }
});

// Load user roles from Firebase
function loadUserRoles() {
    if (!currentUser) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        const userRef = database.ref(`users/${currentUser.uid}`);
        userRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    userRoles = userData.roles || [];
                    updateUIBasedOnRoles();
                    resolve();
                } else {
                    resolve();
                }
            })
            .catch(error => {
                console.error('Error loading user roles:', error);
                reject(error);
            });
    });
}

// Load GHG emission standards from Firebase
function loadGHGStandards() {
    return new Promise((resolve, reject) => {
        const standardsRef = database.ref('fieldOptions/ghg-emission-standard');
        standardsRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    const standards = snapshot.val();
                    populateGHGStandardsDropdown(standards);
                    console.log('GHG emission standards loaded successfully');
                    resolve();
                } else {
                    console.warn('No GHG emission standards found in Firebase, using fallback options');
                    addFallbackGHGStandards();
                    resolve();
                }
            })
            .catch(error => {
                console.error('Error loading GHG emission standards:', error);
                addFallbackGHGStandards();
                reject(error);
            });
    });
}

// Populate the GHG standards dropdown with Firebase data
function populateGHGStandardsDropdown(standards) {
    if (!ghgStandardFilter) return;
    
    // Clear existing options except "All Standards"
    ghgStandardFilter.innerHTML = '<option value="all">All Standards</option>';
    
    // Add options from Firebase data
    Object.keys(standards).forEach(key => {
        const standard = standards[key];
        const option = document.createElement('option');
          // Handle both object format and string format
        if (typeof standard === 'object') {
            // Object format: { name: "IPCC 2006", value: "ipcc", label: "IPCC 2006" }
            option.value = key; // Use the Firebase key as the value for filtering
            option.textContent = standard.label || standard.name || standard.value || formatStandardLabel(key);
        } else if (typeof standard === 'string') {
            // String format: just the display name
            option.value = key; // Use the Firebase key as the value for filtering
            option.textContent = standard;
        } else {
            // Fallback: use key with proper capitalization
            option.value = key;
            option.textContent = formatStandardLabel(key);
        }
        
        ghgStandardFilter.appendChild(option);
    });
}

// Helper function to format standard labels from keys
function formatStandardLabel(key) {
    // Convert kebab-case and snake_case to readable format
    return key
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => {
            // Special handling for common abbreviations
            if (word.toLowerCase() === 'ipcc') return 'IPCC';
            if (word.toLowerCase() === 'ghg') return 'GHG';
            if (word.toLowerCase() === 'epa') return 'EPA';
            if (word.toLowerCase() === 'api') return 'API';
            if (word.toLowerCase() === 'iso') return 'ISO';
            // Regular capitalization for other words
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

// Add fallback GHG standards if Firebase loading fails
function addFallbackGHGStandards() {
    if (!ghgStandardFilter) return;
    
    // Clear existing options except "All Standards"
    ghgStandardFilter.innerHTML = '<option value="all">All Standards</option>';
    
    // Add fallback options with proper labels
    const fallbackStandards = [
        { value: 'ipcc', text: 'IPCC 2006' },
        { value: 'ghg-protocol', text: 'GHG Protocol' },
        { value: 'epa', text: 'EPA' }
    ];
    
    fallbackStandards.forEach(standard => {
        const option = document.createElement('option');
        option.value = standard.value;
        option.textContent = standard.text;
        ghgStandardFilter.appendChild(option);
    });
    
    console.log('Using fallback GHG emission standards');
}

// Update UI based on user roles
function updateUIBasedOnRoles() {
    const canEdit = userRoles.includes('admin') || userRoles.includes('editor');
    
    // Always show both buttons
    addNewFuelBtn.style.display = 'block'; 
    saveChangesBtn.style.display = 'block';
    
    // Make table cells editable or read-only based on roles
    const editableCells = document.querySelectorAll('.editable-cell');
    editableCells.forEach(cell => {
        const input = cell.querySelector('input');
        if (input) {
            input.disabled = !canEdit;
        }
    });
    
    // Show/hide action buttons based on roles
    const actionButtons = document.querySelectorAll('.btn-row-action');
    actionButtons.forEach(button => {
        button.style.display = canEdit ? 'inline-block' : 'none';
    });
}

// Load fuel categories from Firebase
function loadFuelCategories() {
    return new Promise((resolve, reject) => {
        const categoryRef = database.ref('fieldOptions/ghg-fuel-category');
        categoryRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    fuelCategories = snapshot.val();
                    console.log('Fuel categories loaded successfully');
                }
                resolve();
            })
            .catch(error => {
                console.error('Error loading fuel categories:', error);
                reject(error);
            });
    });
}

// Load fuel data from Firebase
function loadFuelData() {
    return new Promise((resolve, reject) => {
        const fuelRef = database.ref('emissionFactors/fuelTypes');
        fuelRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    originalFuelData = snapshot.val();
                    modifiedFuelData = JSON.parse(JSON.stringify(originalFuelData)); // Deep copy
                    renderFuelTable();
                } else {
                    // If no fuel data exists yet, initialize with empty object
                    originalFuelData = {};
                    modifiedFuelData = {};
                }
                resolve();
            })
            .catch(error => {
                console.error('Error loading fuel data:', error);
                showNotification('error', 'Error loading fuel data. Please try again.');
                reject(error);
            });
    });
}

// Render fuel table based on filters
function renderFuelTable() {
    // Clear existing rows
    fuelFactorsTableBody.innerHTML = '';
      // Get current filter values
    const standardFilter = ghgStandardFilter.value;
    const searchText = searchFilter.value.toLowerCase();
    
    // Filter and render fuel data
    Object.keys(modifiedFuelData).forEach(fuelId => {
        const fuel = modifiedFuelData[fuelId];
        
        // Apply filters - combine IPCC standards
        let matchesStandard;
        if (standardFilter === 'ipcc') {
            matchesStandard = ['ipcc', 'ipcc-2006', 'ipcc-2019'].includes(fuel.standard);
        } else {
            matchesStandard = standardFilter === 'all' || fuel.standard === standardFilter;
        }
        const matchesSearch = 
            !searchText || 
            fuel.name.toLowerCase().includes(searchText) || 
            (fuel.description && fuel.description.toLowerCase().includes(searchText));
          if (matchesStandard && matchesSearch) {
            renderFuelRow(fuelId, fuel);
        }
    });
}

// Render a single fuel row
function renderFuelRow(fuelId, fuel) {
    const row = document.createElement('tr');
    row.setAttribute('data-fuel-id', fuelId);
      // Add cells for each field
    row.innerHTML = `
        <td class="editable-cell">
            <input type="text" value="${fuel.name || ''}" data-field="name">
        </td>        <td>            <select class="form-control" data-field="standard">
                <option value="ipcc" ${['ipcc', 'ipcc-2006', 'ipcc-2019'].includes(fuel.standard) ? 'selected' : ''}>IPCC</option>
                <option value="ghg-protocol" ${fuel.standard === 'ghg-protocol' ? 'selected' : ''}>GHG Protocol</option>
                <option value="epa" ${fuel.standard === 'epa' ? 'selected' : ''}>EPA</option>
            </select>
        </td>
        <td class="editable-cell">
            <input type="number" step="0.1" value="${fuel.ncv || '0'}" data-field="ncv">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.CO2 || '0'}" data-field="CO2">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.CH4 || '0'}" data-field="CH4">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.N2O || '0'}" data-field="N2O">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.NOx || '0'}" data-field="NOx">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.CO || '0'}" data-field="CO">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.NMVOC || '0'}" data-field="NMVOC">
        </td>
        <td class="editable-cell">
            <input type="number" step="0.001" value="${fuel.factors?.SO2 || '0'}" data-field="SO2">
        </td>
        <td class="actions-cell">
            <button class="btn-row-action btn-duplicate" title="Duplicate">
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn-row-action btn-delete" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    // Attach event handlers to inputs in this row
    row.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', event => handleCellEdit(event, fuelId));
    });
    
    // Attach event handlers to action buttons
    row.querySelector('.btn-duplicate').addEventListener('click', () => duplicateFuel(fuelId));
    row.querySelector('.btn-delete').addEventListener('click', () => deleteFuel(fuelId));
    
    // Add the row to the table
    fuelFactorsTableBody.appendChild(row);
}

// Generate options for category select dropdown
function generateCategoryOptions(selectedCategory) {
    let options = '';
    
    // Add each category as an option
    Object.values(fuelCategories).forEach(category => {
        if (category && category.label && category.value) {
            const selected = category.value === selectedCategory ? 'selected' : '';
            options += `<option value="${category.value}" ${selected}>${category.label}</option>`;
        }
    });
    
    return options;
}

// Handle cell edit event
function handleCellEdit(event, fuelId) {
    const field = event.target.getAttribute('data-field');
    const value = event.target.value;
    
    // Ensure fuel object and factors object exist
    if (!modifiedFuelData[fuelId]) {
        modifiedFuelData[fuelId] = {};
    }
      // Handle emission factor fields
    if (['CO2', 'CH4', 'N2O', 'NOx', 'CO', 'NMVOC', 'SO2'].includes(field)) {
        if (!modifiedFuelData[fuelId].factors) {
            modifiedFuelData[fuelId].factors = {};
        }
        modifiedFuelData[fuelId].factors[field] = parseFloat(value);
    } else if (field === 'ncv') {
        // Handle NCV field as a number
        modifiedFuelData[fuelId][field] = parseFloat(value);
    } else {
        // Handle other fields as strings
        modifiedFuelData[fuelId][field] = value;
    }
    
    // Set unsaved changes flag
    hasUnsavedChanges = true;
    
    // Update save button to indicate changes
    saveChangesBtn.style.backgroundColor = '#e74c3c';
    saveChangesBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes*';
}

// Create a new fuel type
function addNewFuel() {
    // Generate a new unique ID
    const newFuelId = `fuel_${Date.now()}`;    // Create new fuel object with default values
    modifiedFuelData[newFuelId] = {
        name: 'New Fuel Type',
        category: Object.values(fuelCategories)[0]?.value || 'solid',
        standard: 'ipcc',
        ncv: 0,
        factors: {
            CO2: 0,
            CH4: 0,
            N2O: 0,
            NOx: 0,
            CO: 0,
            NMVOC: 0,
            SO2: 0
        }
    };
    
    // Set unsaved changes flag
    hasUnsavedChanges = true;
    saveChangesBtn.style.backgroundColor = '#e74c3c';
    saveChangesBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes*';
    
    // Render the table to include the new fuel type
    renderFuelTable();
    
    // Scroll to the bottom to see the new entry
    setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight);
    }, 100);
}

// Duplicate an existing fuel type
function duplicateFuel(fuelId) {
    // Generate a new unique ID
    const newFuelId = `fuel_${Date.now()}`;
    
    // Create a deep copy of the selected fuel
    const fuelToDuplicate = JSON.parse(JSON.stringify(modifiedFuelData[fuelId]));
    
    // Modify the name to indicate it's a copy
    fuelToDuplicate.name = `${fuelToDuplicate.name} (Copy)`;
    
    // Add the duplicate to the modified data
    modifiedFuelData[newFuelId] = fuelToDuplicate;
    
    // Render the table to include the duplicate
    renderFuelTable();
}

// Delete a fuel type
function deleteFuel(fuelId) {
    if (confirm('Are you sure you want to delete this fuel type? This action cannot be undone.')) {
        // Get reference to the specific fuel type in Firebase
        const fuelRef = database.ref(`emissionFactors/fuelTypes/${fuelId}`);
        
        // Remove from Firebase
        fuelRef.remove()
            .then(() => {
                // Remove from modified data
                delete modifiedFuelData[fuelId];
                delete originalFuelData[fuelId];
                
                // Render table without the deleted fuel
                renderFuelTable();
                
                // Show success notification
                showNotification('success', 'Fuel type deleted successfully!');
            })
            .catch(error => {
                console.error('Error deleting fuel type:', error);
                showNotification('error', 'Error deleting fuel type. Please try again.');
            });
    }
}

// Save changes to Firebase
function saveChanges() {
    const fuelRef = database.ref('emissionFactors/fuelTypes');
    
    // Save the modified data to Firebase
    fuelRef.set(modifiedFuelData)
        .then(() => {
            // Update original data to reflect the saved changes
            originalFuelData = JSON.parse(JSON.stringify(modifiedFuelData));
            
            // Show success notification
            showNotification('success', 'Changes saved successfully!');
        })
        .catch(error => {
            console.error('Error saving fuel data:', error);
            showNotification('error', 'Error saving changes. Please try again.');
        });
}

// Show notification
function showNotification(type, message) {
    const notification = type === 'success' ? successNotification : errorNotification;
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Filter change event listeners
    ghgStandardFilter.addEventListener('change', renderFuelTable);
    searchFilter.addEventListener('input', renderFuelTable);
    
    // Button click event listeners
    addNewFuelBtn.addEventListener('click', addNewFuel);
    saveChangesBtn.addEventListener('click', saveChanges);
    
    // Listen for fuel data import events
    document.addEventListener('fuelDataImported', async (event) => {
        console.log('Fuel data imported, refreshing table...');
        try {
            // Reload fuel data from Firebase and refresh the table
            await loadFuelData();
            renderFuelTable();
            console.log('Table refreshed after import');
        } catch (error) {
            console.error('Error refreshing table after import:', error);
        }
    });
});
