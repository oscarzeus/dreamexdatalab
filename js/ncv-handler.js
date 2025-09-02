// Function to load NCV value from Firebase for a specific fuel type
// Load NCV value from Firebase for a specific fuel type
export function loadNCVValue(fuelType, ncvInput) {
    if (!fuelType || !ncvInput) return;

    // Reference to the fuel type data in Firebase
    const fuelRef = database.ref(`ghg-fuel-types/${fuelType}`);
    fuelRef.once('value')
        .then((snapshot) => {
            if (snapshot.exists() && snapshot.val().ncv) {
                const ncvData = snapshot.val().ncv;
                ncvInput.value = typeof ncvData === 'number' ? ncvData.toFixed(2) : ncvData;
                ncvInput.parentElement.style.display = 'block';
            } else {
                // Try to load from legacy path
                const legacyRef = database.ref(`fieldOptions/ghg-fuel-category/${fuelType}`);
                return legacyRef.once('value');
            }
        })
        .then((legacySnapshot) => {
            if (legacySnapshot && legacySnapshot.exists() && legacySnapshot.val().ncv) {
                const ncvData = legacySnapshot.val().ncv;
                ncvInput.value = typeof ncvData === 'number' ? ncvData.toFixed(2) : ncvData;
                ncvInput.parentElement.style.display = 'block';
            } else {
                ncvInput.value = 'N/A';
                ncvInput.parentElement.style.display = 'block';
            }
        })
        .catch((error) => {
            console.error('Error loading NCV value:', error);
            ncvInput.value = 'Error loading value';
            ncvInput.parentElement.style.display = 'block';
        });
}

// Function to set up NCV field listeners
export function setupNCVListeners() {
    const fuelSelectors = document.querySelectorAll('[id$="FuelTypeSelector"]');
    
    fuelSelectors.forEach(selector => {
        selector.addEventListener('change', (event) => {
            const sectionPrefix = event.target.id.replace('FuelTypeSelector', '');
            const ncvInput = document.getElementById(`${sectionPrefix}NcvValue`);
            if (ncvInput) {
                loadNCVValue(event.target.value, ncvInput);
            }
        });
    });
}
