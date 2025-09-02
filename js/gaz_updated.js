/**
 * GHG Emissions Calculator
 * Follows GHG Protocol standards for calculating Scope 1, 2, and 3 emissions
 * Updated with separate combustion type sections for Scope 1
 */

import { scope3FactorsByMethod } from './scope3-emission-factors.js';

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

// Counter objects for entry IDs
const entryCounters = {
    stationary: 1,
    mobile: 1,
    process: 1,
    fugitive: 1
};

// Function to create a new entry form
function createEntryForm(section) {
    const entryId = entryCounters[section]++;
    const templateId = `${section}-entries`;
    const template = document.querySelector(`#${templateId} .entry-form`);
    if (!template) return;

    const newEntry = template.cloneNode(true);
    const inputs = newEntry.querySelectorAll('input, select');
    
    // Update IDs and names to make them unique
    inputs.forEach(input => {
        if (input.id) {
            const baseId = input.id.replace(section, '');
            input.id = `${section}${baseId}-${entryId}`;
        }
        if (input.name) {
            input.name = `${input.name}-${entryId}`;
        }
    });

    // Add a remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.style.marginTop = '10px';
    removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove Entry';
    removeBtn.onclick = () => newEntry.remove();

    newEntry.appendChild(removeBtn);
    document.getElementById(`${section}-entries`).appendChild(newEntry);
    
    // Load fuel types for the new entry
    const fuelTypeSelector = newEntry.querySelector(`[id^="${section}FuelTypeSelector"]`);
    if (fuelTypeSelector) {
        loadFuelTypesForSelector(fuelTypeSelector);
    }
}

// Function to load fuel types for a specific selector
function loadFuelTypesForSelector(selector) {
    if (!selector) return;

    const fuelCategoryRef = database.ref('fieldOptions/ghg-fuel-category');
    
    fuelCategoryRef.once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const fuelCategories = snapshot.val();
                
                // Clear existing options except the first placeholder
                while (selector.options.length > 1) {
                    selector.remove(1);
                }
                
                // Add each fuel category as an option
                Object.values(fuelCategories).forEach((category) => {
                    if (category && category.label && category.value) {
                        const option = document.createElement('option');
                        option.value = category.value;
                        option.textContent = category.label;
                        selector.appendChild(option);
                    }
                });
                
                try {
                    // Add change event listener for NCV updates
                    selector.addEventListener('change', function() {
                        setNCVValue(this);
                    });

                    const event = new Event('change');
                    selector.dispatchEvent(event);
                } catch (e) {
                    console.error('Error dispatching change event:', e);
                }
            }
        })
        .catch((error) => {
            console.error('Error loading fuel categories:', error);
        });
}

// Emission Factors will be loaded from Firebase
const emissionFactors = {
    scope1: {
        stationaryCombustion: {},
        mobileCombustion: {},
        processEmissions: {},
        fugitiveEmissions: {},
        emergencyEquipment: {},
        onSiteWaste: {}
    },
    scope2: {
        electricity: {
            default: 0,
            renewable: 0
        },
        steam: 0,
        heating: 0,
        cooling: 0
    },
    scope3: scope3FactorsByMethod
};

// Function to load emission factors from Firebase
function loadEmissionFactors() {
    const efRef = database.ref('emissionFactors');
    efRef.once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.scope1) {
                    Object.assign(emissionFactors.scope1, data.scope1);
                }
                if (data.scope2) {
                    Object.assign(emissionFactors.scope2, data.scope2);
                }
            }
        })
        .catch(error => {
            console.error('Error loading emission factors:', error);
        });
}

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Load data from Firebase
    loadEmissionFactors();
    loadFuelTypes();
    
    // Set up NCV field visibility based on initial method
    updateNCVFieldVisibility();
    
    // Set up event listener for method selector
    const methodSelector = document.getElementById('scope1MethodSelector');
    if (methodSelector) {
        methodSelector.addEventListener('change', updateNCVFieldVisibility);
    }
    
    // Set up Add Entry buttons
    document.querySelectorAll('.add-entry-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const section = button.getAttribute('data-section');
            if (section) {
                createEntryForm(section);
                updateNCVFieldVisibility(); // Update NCV field visibility for new entry
            }
        });
    });
    
    // Input elements
    const inputs = {
        // Scope 1
        // Method selectors
        scope1MethodSelector: document.getElementById('scope1MethodSelector'),
        
        // Stationary combustion
        stationaryFuelTypeSelector: document.getElementById('stationaryFuelTypeSelector'),
        stationaryGasTypeSelector: document.getElementById('stationaryGasTypeSelector'),
        stationaryCombustion: document.getElementById('stationaryCombustion'),
        stationaryUnit: document.getElementById('stationaryUnit'),
        
        // Mobile combustion
        mobileFuelTypeSelector: document.getElementById('mobileFuelTypeSelector'),
        mobileGasTypeSelector: document.getElementById('mobileGasTypeSelector'),
        mobileCombustion: document.getElementById('mobileCombustion'),
        mobileUnit: document.getElementById('mobileUnit'),
        
        // Process emissions
        processTypeSelector: document.getElementById('processTypeSelector'),
        processGasTypeSelector: document.getElementById('processGasTypeSelector'),
        processEmissions: document.getElementById('processEmissions'),
        processUnit: document.getElementById('processUnit'),
        
        // Fugitive emissions
        fugitiveTypeSelector: document.getElementById('fugitiveTypeSelector'),
        fugitiveGasTypeSelector: document.getElementById('fugitiveGasTypeSelector'),
        fugitiveEmissions: document.getElementById('fugitiveEmissions'),
        
        // Emergency Equipment
        emergencyEquipmentType: document.getElementById('emergencyEquipmentType'),
        emergencyGasTypeSelector: document.getElementById('emergencyGasTypeSelector'),
        emergencyConsumption: document.getElementById('emergencyConsumption'),
        emergencyUnit: document.getElementById('emergencyUnit'),
        
        // On-site Waste Treatment
        wasteTreatmentType: document.getElementById('wasteTreatmentType'),
        wasteGasTypeSelector: document.getElementById('wasteGasTypeSelector'),
        wasteTreatmentAmount: document.getElementById('wasteTreatmentAmount'),
        wasteTreatmentUnit: document.getElementById('wasteTreatmentUnit'),
        
        // Scope 2
        scope2MethodSelector: document.getElementById('scope2MethodSelector'),
        scope2StandardSelector: document.getElementById('scope2StandardSelector'),
        purchasedElectricity: document.getElementById('purchasedElectricity'),
        gridRegionSelector: document.getElementById('gridRegionSelector'),
        purchasedSteam: document.getElementById('purchasedSteam'),
        purchasedHeating: document.getElementById('purchasedHeating'),
        purchasedCooling: document.getElementById('purchasedCooling'),
        
        // Scope 3
        scope3MethodSelector: document.getElementById('scope3MethodSelector'),
        scope3StandardSelector: document.getElementById('scope3StandardSelector'),
        purchasedGoods: document.getElementById('purchasedGoods'),
        businessTravel: document.getElementById('businessTravel'),
        employeeCommuting: document.getElementById('employeeCommuting'),
        wasteGenerated: document.getElementById('wasteGenerated'),
        transportation: document.getElementById('transportation'),
        endOfLife: document.getElementById('endOfLife')
    };

    // Result elements
    const results = {
        scope1: document.getElementById('scope1Result'),
        scope2: document.getElementById('scope2Result'),
        scope3: document.getElementById('scope3Result'),
        totalScope1: document.getElementById('totalScope1'),
        totalScope2: document.getElementById('totalScope2'),
        totalScope3: document.getElementById('totalScope3'),
        grandTotal: document.getElementById('grandTotal')
    };

    // Add event listeners to all inputs
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('input', calculateEmissions);
        }
    });

    // Initialize chart
    let emissionsChart = null;

    // Calculate emissions when inputs change
    function calculateEmissions() {
        // Calculate Scope 1 emissions
        const scope1Emissions = calculateScope1Emissions(inputs);
        
        // Calculate Scope 2 emissions
        const scope2Emissions = calculateScope2Emissions(inputs);
        
        // Calculate Scope 3 emissions
        const scope3Emissions = calculateScope3Emissions(inputs);

        // Update results
        updateResults(scope1Emissions, scope2Emissions, scope3Emissions);
        
        // Update chart
        updateChart(scope1Emissions.total, scope2Emissions.total, scope3Emissions.total);
        
        // Save data to Firebase
        saveEmissionsData(scope1Emissions, scope2Emissions, scope3Emissions);
    }

    // Calculate Scope 1 emissions
    function calculateScope1Emissions(inputs) {
        // Get selected calculation method
        const method = inputs.scope1MethodSelector ? inputs.scope1MethodSelector.value : 'ghg-protocol';
        
    // Global Warming Potentials for converting to CO2e - using values from scope1.gwp in Firebase
        const GWP = emissionFactors.scope1.gwp || {
            CO2: 1,
            CH4: 28,    // Default IPCC AR5 value if Firebase values not loaded
            N2O: 265,   // Default IPCC AR5 value if Firebase values not loaded 
            HFC: 1430,  // Default average value for common HFCs if Firebase values not loaded
            PFC: 7350,  // Default average value for common PFCs if Firebase values not loaded
            SF6: 22800  // Default value if Firebase values not loaded
        };
          // Calculate Stationary Combustion emissions
        let stationaryEmissions = 0;
        document.querySelectorAll('#stationary-entries .entry-form').forEach(entry => {
            const combustion = entry.querySelector('[id^="stationaryCombustion"]');
            const unit = entry.querySelector('[id^="stationaryUnit"]');
            const fuelType = entry.querySelector('[id^="stationaryFuelTypeSelector"]');
            const gasType = entry.querySelector('[id^="stationaryGasTypeSelector"]');

            if (combustion && combustion.value) {
                const amount = parseFloat(combustion.value || 0);
                const unitValue = unit ? unit.value : 'L';
                const fuelTypeValue = fuelType ? fuelType.value : 'diesel';
                const selectedGases = gasType ? Array.from(gasType.selectedOptions || []).map(opt => opt.value) : ['CO2'];
                
                selectedGases.forEach(gas => {
                    const gasLower = gas.toLowerCase();
                    if (emissionFactors.scope1.stationaryCombustion[gasLower] && 
                        emissionFactors.scope1.stationaryCombustion[gasLower][fuelTypeValue]) {
                        const factor = emissionFactors.scope1.stationaryCombustion[gasLower][fuelTypeValue];
                        const unitConversion = unitValue === 't' ? 1000 : 1; // Convert tonnes to kg if needed
                        stationaryEmissions += amount * factor * GWP[gas] * unitConversion;
                    }
                });
            }
        });
          // Calculate Mobile Combustion emissions
        let mobileEmissions = 0;
        document.querySelectorAll('#mobile-entries .entry-form').forEach(entry => {
            const combustion = entry.querySelector('[id^="mobileCombustion"]');
            const unit = entry.querySelector('[id^="mobileUnit"]');
            const fuelType = entry.querySelector('[id^="mobileFuelTypeSelector"]');
            const gasType = entry.querySelector('[id^="mobileGasTypeSelector"]');
            
            if (combustion && combustion.value) {
                const amount = parseFloat(combustion.value || 0);
                const unitValue = unit ? unit.value : 'L';
                const fuelTypeValue = fuelType ? fuelType.value : 'diesel';
                const selectedGases = gasType ? Array.from(gasType.selectedOptions || []).map(opt => opt.value) : ['CO2'];
                
                selectedGases.forEach(gas => {
                    const gasLower = gas.toLowerCase();
                    if (emissionFactors.scope1.mobileCombustion[gasLower] && 
                        emissionFactors.scope1.mobileCombustion[gasLower][fuelTypeValue]) {
                        const factor = emissionFactors.scope1.mobileCombustion[gasLower][fuelTypeValue];
                        const unitConversion = unitValue === 'gal' ? 3.78541 : 1; // Convert gallons to liters if needed
                        mobileEmissions += amount * factor * GWP[gas] * unitConversion;
                    }
                });
            }
        });
          // Calculate Process Emissions
        let processEmissions = 0;
        document.querySelectorAll('#process-entries .entry-form').forEach(entry => {
            const emissions = entry.querySelector('[id^="processEmissions"]');
            const unit = entry.querySelector('[id^="processUnit"]');
            const processType = entry.querySelector('[id^="processActivitySelector"]');
            const fuelType = entry.querySelector('[id^="processFuelTypeSelector"]');
            const gasType = entry.querySelector('[id^="processGasTypeSelector"]');
            
            if (emissions && emissions.value) {
                const amount = parseFloat(emissions.value || 0);
                const unitValue = unit ? unit.value : 'kg';
                const processTypeValue = processType ? processType.value : 'default';
                const selectedGases = gasType ? Array.from(gasType.selectedOptions || []).map(opt => opt.value) : ['CO2'];
                
                selectedGases.forEach(gas => {
                    const gasLower = gas.toLowerCase();
                    if (emissionFactors.scope1.processEmissions[gasLower] && 
                        emissionFactors.scope1.processEmissions[gasLower][processTypeValue]) {
                        const factor = emissionFactors.scope1.processEmissions[gasLower][processTypeValue];
                        const unitConversion = unitValue === 't' ? 1000 : 1; // Convert tonnes to kg if needed
                        processEmissions += amount * factor * GWP[gas] * unitConversion;
                    }
                });
            }
        });
          // Calculate Fugitive Emissions
        let fugitiveEmissions = 0;
        document.querySelectorAll('#fugitive-entries .entry-form').forEach(entry => {
            const emissions = entry.querySelector('[id^="fugitiveEmissions"]');
            const fugitiveType = entry.querySelector('[id^="fugitiveTypeSelector"]');
            const fuelType = entry.querySelector('[id^="fugitiveFuelTypeSelector"]');
            const gasType = entry.querySelector('[id^="fugitiveGasTypeSelector"]');
            
            if (emissions && emissions.value) {
                const amount = parseFloat(emissions.value || 0);
                const fugitiveTypeValue = fugitiveType ? fugitiveType.value : 'default';
                const selectedGases = gasType ? Array.from(gasType.selectedOptions || []).map(opt => opt.value) : ['CO2'];
                
                selectedGases.forEach(gas => {
                    const gasLower = gas.toLowerCase();
                    if (emissionFactors.scope1.fugitiveEmissions[gasLower] && 
                        emissionFactors.scope1.fugitiveEmissions[gasLower][fugitiveTypeValue]) {
                        const factor = emissionFactors.scope1.fugitiveEmissions[gasLower][fugitiveTypeValue];
                        fugitiveEmissions += amount * factor; // Factor already includes GWP
                    }
                });
            }
        });
        
        // Calculate Emergency Equipment Emissions
        let emergencyEmissions = 0;
        if (inputs.emergencyConsumption && inputs.emergencyConsumption.value) {
            const emergencyAmount = parseFloat(inputs.emergencyConsumption.value || 0);
            const emergencyUnit = inputs.emergencyUnit ? inputs.emergencyUnit.value : 'L';
            const equipmentType = inputs.emergencyEquipmentType ? inputs.emergencyEquipmentType.value : 'generators';
            const selectedGases = Array.from(inputs.emergencyGasTypeSelector?.selectedOptions || []).map(opt => opt.value);
            
            selectedGases.forEach(gas => {
                const gasLower = gas.toLowerCase();
                if (emissionFactors.scope1.emergencyEquipment[gasLower] && 
                    emissionFactors.scope1.emergencyEquipment[gasLower][equipmentType]) {
                    const factor = emissionFactors.scope1.emergencyEquipment[gasLower][equipmentType];
                    const unitConversion = emergencyUnit === 'kg' ? 1 : 1; // Add more conversions if needed
                    emergencyEmissions += emergencyAmount * factor * GWP[gas] * unitConversion;
                }
            });
        }
        
        // Calculate On-site Waste Treatment Emissions
        let wasteEmissions = 0;
        if (inputs.wasteTreatmentAmount && inputs.wasteTreatmentAmount.value) {
            const wasteAmount = parseFloat(inputs.wasteTreatmentAmount.value || 0);
            const wasteUnit = inputs.wasteTreatmentUnit ? inputs.wasteTreatmentUnit.value : 'tonnes';
            const treatmentType = inputs.wasteTreatmentType ? inputs.wasteTreatmentType.value : 'biological';
            const selectedGases = Array.from(inputs.wasteGasTypeSelector?.selectedOptions || []).map(opt => opt.value);
            
            selectedGases.forEach(gas => {
                const gasLower = gas.toLowerCase();
                if (emissionFactors.scope1.onSiteWaste[gasLower] && 
                    emissionFactors.scope1.onSiteWaste[gasLower][treatmentType]) {
                    const factor = emissionFactors.scope1.onSiteWaste[gasLower][treatmentType];
                    const unitConversion = wasteUnit === 'tonnes' ? 1000 : 1; // Convert tonnes to kg if needed
                    wasteEmissions += wasteAmount * factor * GWP[gas] * unitConversion;
                }
            });
        }

        const total = stationaryEmissions + mobileEmissions + processEmissions + 
                     fugitiveEmissions + emergencyEmissions + wasteEmissions;

        return {
            stationaryEmissions,
            mobileEmissions,
            processEmissions,
            fugitiveEmissions,
            emergencyEmissions,
            wasteEmissions,
            total
        };
    }

    // Calculate Scope 2 emissions
    function calculateScope2Emissions(inputs) {
        // Get selected calculation method and standard
        const method = inputs.scope2MethodSelector ? inputs.scope2MethodSelector.value : 'location-based';
        const standard = inputs.scope2StandardSelector ? inputs.scope2StandardSelector.value : 'ghg-protocol';
        const gridRegion = inputs.gridRegionSelector ? inputs.gridRegionSelector.value : '';
        
        // Initialize emission factors with default values
        let electricityFactor = emissionFactors.scope2.electricity.default;
        let steamFactor = emissionFactors.scope2.steam;
        let heatingFactor = emissionFactors.scope2.heating;
        let coolingFactor = emissionFactors.scope2.cooling;
        
        // Adjust electricity emission factor based on method, standard, and grid region
        if (method === 'market-based') {
            // Market-based uses supplier-specific emission factors if available
            electricityFactor = emissionFactors.scope2.electricity.renewable;
        } else {
            // Location-based uses grid average emission factors
            if (gridRegion && emissionFactors.scope2.electricity[gridRegion]) {
                electricityFactor = emissionFactors.scope2.electricity[gridRegion];
            }
        }
        
        // Calculate emissions using the adjusted factors
        const electricityEmissions = parseFloat(inputs.purchasedElectricity ? inputs.purchasedElectricity.value || 0 : 0) * electricityFactor;
        const steamEmissions = parseFloat(inputs.purchasedSteam ? inputs.purchasedSteam.value || 0 : 0) * steamFactor;
        const heatingEmissions = parseFloat(inputs.purchasedHeating ? inputs.purchasedHeating.value || 0 : 0) * heatingFactor;
        const coolingEmissions = parseFloat(inputs.purchasedCooling ? inputs.purchasedCooling.value || 0 : 0) * coolingFactor;

        const total = electricityEmissions + steamEmissions + heatingEmissions + coolingEmissions;

        return {
            electricityEmissions,
            steamEmissions,
            heatingEmissions,
            coolingEmissions,
            methodUsed: method,
            standardUsed: standard,
            gridRegion: gridRegion || 'default',
            total
        };
    }

    // Calculate Scope 3 emissions
    function calculateScope3Emissions(inputs) {
        // Get selected calculation method and standard
        const method = inputs.scope3MethodSelector ? inputs.scope3MethodSelector.value : 'spend_based';
        const standard = inputs.scope3StandardSelector ? inputs.scope3StandardSelector.value : 'ghg-protocol';
        
        // Function to safely get emission factor, with fallbacks
        const getEmissionFactor = (category, defaultMethod, defaultStandard) => {
            try {
                if (emissionFactors.scope3[method] && 
                    emissionFactors.scope3[method][standard] && 
                    emissionFactors.scope3[method][standard].co2 !== undefined) {
                    return emissionFactors.scope3[method][standard].co2;
                } else if (emissionFactors.scope3[defaultMethod] && 
                           emissionFactors.scope3[defaultMethod][defaultStandard]) {
                    return emissionFactors.scope3[defaultMethod][defaultStandard].co2;
                } else {
                    console.warn(`No emission factor found for ${category} with method ${method} and standard ${standard}`);
                    return 0;
                }
            } catch (error) {
                console.error(`Error getting emission factor for ${category}:`, error);
                return 0;
            }
        };
        
        // Calculate emissions with safe input handling
        const purchasedGoodsEmissions = parseFloat(inputs.purchasedGoods ? inputs.purchasedGoods.value || 0 : 0) * 
            getEmissionFactor('purchasedGoods', 'spend_based', 'ghg-protocol');
            
        const businessTravelEmissions = parseFloat(inputs.businessTravel ? inputs.businessTravel.value || 0 : 0) * 
            getEmissionFactor('businessTravel', 'distance_based', 'uk-defra');
            
        const employeeCommutingEmissions = parseFloat(inputs.employeeCommuting ? inputs.employeeCommuting.value || 0 : 0) * 
            getEmissionFactor('employeeCommuting', 'distance_based', 'uk-defra');
            
        const wasteEmissions = parseFloat(inputs.wasteGenerated ? inputs.wasteGenerated.value || 0 : 0) * 
            getEmissionFactor('wasteGenerated', 'activity_based', 'ghg-protocol');
            
        const transportationEmissions = parseFloat(inputs.transportation ? inputs.transportation.value || 0 : 0) * 
            getEmissionFactor('transportation', 'distance_based', 'uk-defra');
            
        const endOfLifeEmissions = parseFloat(inputs.endOfLife ? inputs.endOfLife.value || 0 : 0) * 
            getEmissionFactor('endOfLife', 'activity_based', 'ghg-protocol');

        const total = purchasedGoodsEmissions + businessTravelEmissions + employeeCommutingEmissions +
            wasteEmissions + transportationEmissions + endOfLifeEmissions;

        return {
            purchasedGoodsEmissions,
            businessTravelEmissions,
            employeeCommutingEmissions,
            wasteEmissions,
            transportationEmissions,
            endOfLifeEmissions,
            methodUsed: method,
            standardUsed: standard,
            total
        };
    }

    // Update results in the UI
    function updateResults(scope1, scope2, scope3) {
        if (!results.scope1 || !results.scope2 || !results.scope3) return;
        
        // Convert to tonnes CO2e and format
        const toTonnes = (kg) => (kg / 1000).toFixed(2);

        // Update scope results
        results.scope1.innerHTML = generateScopeResultHTML(scope1);
        results.scope2.innerHTML = generateScopeResultHTML(scope2);
        results.scope3.innerHTML = generateScopeResultHTML(scope3);

        // Update totals
        results.totalScope1.textContent = `${toTonnes(scope1.total)} tCO₂e`;
        results.totalScope2.textContent = `${toTonnes(scope2.total)} tCO₂e`;
        results.totalScope3.textContent = `${toTonnes(scope3.total)} tCO₂e`;
        
        const grandTotal = scope1.total + scope2.total + scope3.total;
        results.grandTotal.textContent = `${toTonnes(grandTotal)} tCO₂e`;
    }

    // Generate HTML for scope results
    function generateScopeResultHTML(scopeData) {
        return Object.entries(scopeData)
            .filter(([key]) => key !== 'total' && !key.includes('Used') && !key.includes('Region'))
            .map(([key, value]) => {
                if (typeof value === 'number') {
                    return `
                        <div class="result-row">
                            <span>${formatKey(key)}:</span>
                            <span>${(value / 1000).toFixed(2)} tCO₂e</span>
                        </div>
                    `;
                }
                return '';
            }).join('') + `
            <div class="result-row result-total">
                <span>Total:</span>
                <span>${(scopeData.total / 1000).toFixed(2)} tCO₂e</span>
            </div>`;
    }

    // Format keys for display
    function formatKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace('Emissions', '');
    }

    // Update the emissions chart
    function updateChart(scope1Total, scope2Total, scope3Total) {
        const chartElement = document.getElementById('emissionsChart');
        if (!chartElement) return;
        
        const ctx = chartElement.getContext('2d');
        
        if (emissionsChart) {
            emissionsChart.destroy();
        }

        emissionsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Scope 1', 'Scope 2', 'Scope 3'],
                datasets: [{
                    data: [
                        scope1Total / 1000,
                        scope2Total / 1000,
                        scope3Total / 1000
                    ],
                    backgroundColor: [
                        '#e74c3c',
                        '#f39c12',
                        '#3498db'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'GHG Emissions by Scope (tCO₂e)'
                    }
                }
            }
        });
    }

    // Save emissions data to Firebase
    function saveEmissionsData(scope1, scope2, scope3) {
        const user = auth.currentUser;
        if (!user) return;

        const emissionsData = {
            timestamp: new Date().toISOString(),
            userId: user.uid,
            scope1,
            scope2,
            scope3,
            total: scope1.total + scope2.total + scope3.total
        };

        database.ref('emissions').push(emissionsData)
            .catch(error => console.error('Error saving emissions data:', error));
    }

    // Export report
    const exportButton = document.getElementById('exportReportBtn');
    if (exportButton) {
        exportButton.addEventListener('click', exportReport);
    }

    function exportReport() {
        // Get all current data
        const scope1Data = calculateScope1Emissions(inputs);
        const scope2Data = calculateScope2Emissions(inputs);
        const scope3Data = calculateScope3Emissions(inputs);
        
        // Create CSV content
        const csvContent = generateCSVContent(scope1Data, scope2Data, scope3Data);
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `ghg-emissions-report-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function generateCSVContent(scope1, scope2, scope3) {
        const rows = [
            ['GHG Emissions Report', `Generated on ${new Date().toLocaleDateString()}`],
            [],
            ['Scope 1 Emissions (tCO₂e)'],
            ['Category', 'Emissions'],
            ...Object.entries(scope1)
                .filter(([key]) => key !== 'total' && typeof scope1[key] === 'number')
                .map(([key, value]) => [formatKey(key), (value / 1000).toFixed(2)]),
            [],
            ['Scope 2 Emissions (tCO₂e)'],
            ['Category', 'Emissions'],
            ...Object.entries(scope2)
                .filter(([key]) => key !== 'total' && !key.includes('Used') && !key.includes('Region') && typeof scope2[key] === 'number')
                .map(([key, value]) => [formatKey(key), (value / 1000).toFixed(2)]),
            [],
            ['Scope 3 Emissions (tCO₂e)'],
            ['Category', 'Emissions'],
            ...Object.entries(scope3)
                .filter(([key]) => key !== 'total' && !key.includes('Used') && !key.includes('standard') && typeof scope3[key] === 'number')
                .map(([key, value]) => [formatKey(key), (value / 1000).toFixed(2)]),
            [],
            ['Total Emissions (tCO₂e)', ((scope1.total + scope2.total + scope3.total) / 1000).toFixed(2)]
        ];

        return rows.map(row => row.join(',')).join('\n');
    }

    // Initialize the page
    calculateEmissions();
});

// Import NCV handling functions
import { setupNCVListeners, loadNCVValue } from './ncv-handler.js';

// Function to load fuel types from Firebase
function loadFuelTypes() {
    // Get all initial fuel type selectors
    document.querySelectorAll('[id$="FuelTypeSelector"]').forEach(selector => {
        loadFuelTypesForSelector(selector);
    });
    // Set up NCV field listeners
    setupNCVListeners();
}

// Updated style for the button
const buttonStyle = `
<style>
.add-entry-btn {
    margin-left: auto;
    font-size: 0.9em;
}

.emissions-form {
    position: relative;
    padding: 15px;
    border: 1px solid #eee;
    border-radius: 5px;
    margin-bottom: 15px;
}

.btn-danger {
    position: absolute;
    right: 15px;
    top: 15px;
}
</style>
`;

// Add the style to the document head
document.head.insertAdjacentHTML('beforeend', buttonStyle);

// Check authentication state
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// Function to toggle NCV field visibility
function updateNCVFieldVisibility() {
    const calculationMethod = document.getElementById('scope1MethodSelector').value;
    const ncvField = document.getElementById('ncvField');
    if (ncvField) {
        ncvField.style.display = calculationMethod === 'ipcc-2019' ? 'block' : 'none';
    }
}

// Function to set NCV value based on fuel type
function setNCVValue(selector) {
    const calculationMethod = document.getElementById('scope1MethodSelector').value;
    if (calculationMethod !== 'ipcc-2019') return;

    const fuelType = selector.value;
    const ncvValue = document.getElementById('ncvValue');
    if (!ncvValue || !fuelType) return;

    // Get the reference to the NCV value for this fuel type
    const fuelRef = database.ref(`fieldOptions/ghg-fuel-category/${fuelType}`);
    
    fuelRef.once('value')
        .then(snapshot => {
            if (snapshot.exists() && snapshot.val().ncv) {
                ncvValue.value = snapshot.val().ncv;
                ncvValue.parentElement.style.display = 'block';
            } else {
                ncvValue.value = 'N/A';
                ncvValue.parentElement.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error getting NCV value:', error);
            ncvValue.value = 'Error loading value';
            ncvValue.parentElement.style.display = 'block';
        });
}

// Event listener for method selector
document.addEventListener('DOMContentLoaded', () => {
    const methodSelector = document.getElementById('scope1MethodSelector');
    if (methodSelector) {
        methodSelector.addEventListener('change', updateNCVFieldVisibility);
        // Initial visibility check
        updateNCVFieldVisibility();
    }
    // ...existing code...
});
