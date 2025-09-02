// Excel import handler for fuel emission factors
document.addEventListener('DOMContentLoaded', function() {
    console.log('Excel import handler loaded');
    
    const fileInput = document.getElementById('excelFileInput');
    const notification = document.getElementById('uploadNotification');
    
    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                // Check if XLSX is available
                if (typeof XLSX === 'undefined') {
                    console.error('XLSX library not loaded');
                    showNotification('error', 'Excel library not loaded. Please refresh the page and try again.');
                    return;
                }

                // Show processing message
                showNotification('info', 'Processing Excel file...');

                // Read the file
                const data = await readFile(file);
                const workbook = XLSX.read(data, { type: 'binary' });
                
                // Get the first worksheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Process the data
                const processedData = processExcelData(jsonData);
                
                if (processedData.length === 0) {
                    showNotification('error', 'No valid fuel data found in the Excel file. Please check the format.');
                    return;
                }

                // Import the data to Firebase
                await importFuelData(processedData);
                
                showNotification('success', `Successfully imported ${processedData.length} fuel types`);                // Refresh the fuel types table by dispatching a custom event
                const refreshEvent = new CustomEvent('fuelDataImported', {
                    detail: { count: processedData.length }
                });
                document.dispatchEvent(refreshEvent);

            } catch (error) {
                console.error('Error processing Excel file:', error);
                showNotification('error', 'Error processing Excel file: ' + error.message);
            } finally {
                // Clear the file input
                fileInput.value = '';
            }
        });
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    }

    function processExcelData(jsonData) {
        const processedData = [];
        
        // Skip the header row and process data rows
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Skip empty rows
            if (!row || !row[0] || row[0].toString().trim() === '') {
                continue;
            }            try {
                const fuelData = {
                    name: row[0] ? row[0].toString().trim() : '',
                    standard: row[1] ? row[1].toString().toLowerCase().trim() : 'ipcc',
                    ncv: parseFloat(row[2]) || 0,
                    factors: {
                        CO2: parseFloat(row[3]) || 0,
                        CH4: parseFloat(row[4]) || 0,
                        N2O: parseFloat(row[5]) || 0,
                        NOx: parseFloat(row[6]) || 0,
                        CO: parseFloat(row[7]) || 0,
                        NMVOC: parseFloat(row[8]) || 0,
                        SO2: parseFloat(row[9]) || 0
                    }
                };

                // Validate required fields
                if (fuelData.name) {
                    processedData.push(fuelData);
                }
            } catch (error) {
                console.warn(`Error processing row ${i + 1}:`, error);
            }
        }

        return processedData;
    }    async function importFuelData(fuelDataArray) {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            throw new Error('Firebase not available');
        }

        const database = firebase.database();
        const fuelRef = database.ref('emissionFactors/fuelTypes');

        // Get current fuel data
        const snapshot = await fuelRef.once('value');
        const currentData = snapshot.val() || {};

        // Add new fuel types
        let importCount = 0;
        for (const fuelData of fuelDataArray) {
            // Generate a unique key
            const fuelKey = `fuel_${Date.now()}_${importCount}`;
              // Create the fuel entry matching the structure expected by fuel.js
            const fuelEntry = {
                name: fuelData.name,
                standard: fuelData.standard,
                ncv: fuelData.ncv,
                factors: fuelData.factors,
                imported: true,
                importDate: new Date().toISOString()
            };

            currentData[fuelKey] = fuelEntry;
            importCount++;
        }

        // Save to Firebase
        await fuelRef.set(currentData);
        return importCount;
    }

    function showNotification(type, message) {
        if (notification) {
            notification.textContent = message;
            notification.className = `notification show ${type}`;
            
            // Auto-hide after 5 seconds for success/info messages
            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    notification.className = 'notification';
                }, 5000);
            }
        }
    }
});
