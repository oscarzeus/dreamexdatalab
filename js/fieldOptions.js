
/**
 * Set up Excel import functionality for field options
 * @param {string} fieldType - The type of field to import options for
 */
function setupExcelImport(fieldType) {
    const importBtn = document.getElementById('importExcelBtn');
    const fileInput = document.getElementById('excelFileInput');
    const modal = document.getElementById('excelImportModal');
    const uploadArea = document.getElementById('excelUploadArea');
    const preview = document.getElementById('excelPreview');
    const previewContent = document.getElementById('excelPreviewContent');
    const confirmBtn = document.getElementById('confirmImportBtn');
    const cancelBtn = document.getElementById('cancelImportBtn');
    
    if (!importBtn || !fileInput || !modal || !uploadArea) return;
    
    // Import button click handler
    importBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });
    
    // Close modal handlers
    modal.querySelector('.close-button').addEventListener('click', () => {
        modal.style.display = 'none';
        preview.style.display = 'none';
        previewContent.innerHTML = '';
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        preview.style.display = 'none';
        previewContent.innerHTML = '';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            preview.style.display = 'none';
            previewContent.innerHTML = '';
        }
    });
    
    // Upload area click handler
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleExcelFile(files[0], fieldType);
        }
    });
    
    // File input change handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleExcelFile(e.target.files[0], fieldType);
        }
    });
    
    // Confirm import handler
    confirmBtn.addEventListener('click', () => {
        if (!window.excelImportData || !window.excelImportData.length) return;
        
        // Convert Excel data to field options format
        const options = window.excelImportData.map(row => {
            const option = {
                label: row.Label || row.label,
                value: row.Value || row.value || createValueFromLabel(row.Label || row.label),
                color: row.Color || row.color || '#3498db',
                enabled: getBoolean(row.Enabled || row.enabled, true)
            };
            
            // Process optional columns
            const columns = [];
            for (const [key, value] of Object.entries(row)) {
                if (!['Label', 'label', 'Value', 'value', 'Color', 'color', 'Enabled', 'enabled'].includes(key)) {
                    const parts = key.split('|');
                    if (parts.length > 1) {
                        const columnName = parts[0];
                        const settings = {};
                        
                        parts.slice(1).forEach(part => {
                            const [setting, val] = part.split(':');
                            settings[setting.trim()] = val.trim();
                        });
                        
                        columns.push({
                            name: columnName,
                            type: settings.type || 'text',
                            required: getBoolean(settings.required, false),
                            defaultValue: settings.default || '',
                            placeholder: settings.placeholder || ''
                        });
                    }
                }
            }
            
            if (columns.length > 0) {
                option.columns = columns;
            }
            
            return option;
        });
        
        // Save the options to Firebase
        saveOptionsToFirebase(fieldType, options)
            .then(() => {
                console.log('Options imported successfully');
                showStatusMessage('success', 'Options imported successfully!');
                modal.style.display = 'none';
                preview.style.display = 'none';
                previewContent.innerHTML = '';
                // Refresh the options list
                loadFieldOptions(fieldType);
            })
            .catch(error => {
                console.error('Error importing options:', error);
                showStatusMessage('error', 'Failed to import options: ' + error.message);
            });
    });
}

/**
 * Handle Excel file selection and parsing
 * @param {File} file - The Excel file to process
 * @param {string} fieldType - The type of field to import options for
 */
function handleExcelFile(file, fieldType) {
    const preview = document.getElementById('excelPreview');
    const previewContent = document.getElementById('excelPreviewContent');
    
    if (!file || !preview || !previewContent) return;
    
    // Check file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showStatusMessage('error', 'Please select a valid Excel file (.xlsx or .xls)');
        return;
    }
    
    // Show loading state
    previewContent.innerHTML = '<div class="loading">Processing Excel file...</div>';
    preview.style.display = 'block';
    
    // Read file using ExcelJS (assumes ExcelJS is loaded)
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(e.target.result);
            
            // Get the first worksheet
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('No worksheet found in Excel file');
            }
            
            // Convert worksheet to array of objects
            const data = [];
            const headers = [];
            
            // Get headers from first row
            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[colNumber - 1] = cell.value;
            });
            
            // Get data from remaining rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row
                
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    rowData[headers[colNumber - 1]] = cell.value;
                });
                data.push(rowData);
            });
            
            // Store data for later use
            window.excelImportData = data;
            
            // Show preview
            showExcelPreview(data);
            
        } catch (error) {
            console.error('Error processing Excel file:', error);
            previewContent.innerHTML = `<div class="error">Error processing Excel file: ${error.message}</div>`;
        }
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * Show preview of Excel data
 * @param {Array} data - Array of objects representing Excel rows
 */
function showExcelPreview(data) {
    const previewContent = document.getElementById('excelPreviewContent');
    if (!previewContent || !data.length) return;
    
    // Create preview table
    let html = '<div class="table-responsive"><table class="table table-sm">';
    
    // Add headers
    html += '<thead><tr>';
    const headers = Object.keys(data[0]);
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';
    
    // Add data rows (max 5 for preview)
    html += '<tbody>';
    data.slice(0, 5).forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            html += `<td>${row[header] || ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    
    // Add summary
    html += `<div class="preview-summary">
        <p>Total rows: ${data.length}</p>
        <p>Columns: ${headers.join(', ')}</p>
        ${data.length > 5 ? '<p class="text-muted">(Showing first 5 rows)</p>' : ''}
    </div>`;
    
    previewContent.innerHTML = html;
}

/**
 * Create value from label by converting to lowercase and replacing spaces with hyphens
 * @param {string} label - The label to convert
 * @returns {string} The converted value
 */
function createValueFromLabel(label) {
    return label.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Convert various value types to boolean
 * @param {*} value - The value to convert
 * @param {boolean} defaultValue - Default value if conversion fails
 * @returns {boolean} The converted boolean value
 */
function getBoolean(value, defaultValue = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (['true', 'yes', '1'].includes(lower)) return true;
        if (['false', 'no', '0'].includes(lower)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    return defaultValue;
}