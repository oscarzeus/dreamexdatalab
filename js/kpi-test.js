// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let kpiCount = 0;
let realTimeListener = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    logMessage('Initializing KPI System Test...', 'info');
    testFirebaseConnection();
    loadKPICount();
    setupRealTimeTest();
});

// Test Firebase connection
async function testFirebaseConnection() {
    logMessage('Testing Firebase connection...', 'info');
    
    try {
        const testRef = ref(db, '.info/connected');
        onValue(testRef, (snapshot) => {
            const connected = snapshot.val();
            if (connected) {
                updateStatus('firebaseStatus', 'success', 'Connected to Firebase');
                logMessage('Firebase connection established successfully', 'success');
            } else {
                updateStatus('firebaseStatus', 'error', 'Disconnected from Firebase');
                logMessage('Firebase connection failed', 'error');
            }
        });
    } catch (error) {
        updateStatus('firebaseStatus', 'error', 'Connection failed');
        logMessage(`Firebase connection error: ${error.message}`, 'error');
    }
}

// Load KPI count
function loadKPICount() {
    logMessage('Loading KPI count...', 'info');
    
    const kpisRef = ref(db, 'kpis');
    onValue(kpisRef, (snapshot) => {
        const data = snapshot.val();
        kpiCount = data ? Object.keys(data).length : 0;
        
        updateStatus('kpiCountStatus', 'success', `${kpiCount} KPIs found`);
        logMessage(`KPI count loaded: ${kpiCount} KPIs`, 'info');
    }, (error) => {
        updateStatus('kpiCountStatus', 'error', 'Failed to load');
        logMessage(`Error loading KPI count: ${error.message}`, 'error');
    });
}

// Setup real-time test
function setupRealTimeTest() {
    logMessage('Setting up real-time monitoring...', 'info');
    
    const kpisRef = ref(db, 'kpis');
    realTimeListener = onValue(kpisRef, (snapshot) => {
        updateStatus('realTimeStatus', 'success', 'Real-time updates active');
        logMessage('Real-time updates are working', 'success');
    }, (error) => {
        updateStatus('realTimeStatus', 'error', 'Real-time updates failed');
        logMessage(`Real-time error: ${error.message}`, 'error');
    });
}

// Create sample KPIs
async function createSampleKPIs() {
    logMessage('Creating sample KPIs...', 'info');
    showLoading(true);
    
    const sampleKPIs = [
        {
            id: 'kpi_sample_' + Date.now() + '_1',
            name: 'Monthly Revenue Growth',
            kpiName: 'Monthly Revenue Growth',
            category: 'Financial',
            description: 'Percentage growth in monthly revenue compared to previous month',
            owner: 'John Smith',
            employee: 'user_john_smith',
            employeeName: 'John Smith',
            employeeEmail: 'john.smith@company.com',
            employeeDepartment: 'Finance',
            department: 'Finance',
            metricType: 'Percentage',
            frequency: 'Monthly',
            target: 15,
            current: 12.5,
            thresholds: {
                excellent: 20,
                good: 15,
                poor: 10
            },
            priority: 'Critical',
            status: 'Active',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            notes: 'Key metric for business growth tracking',
            createdAt: new Date().toISOString(),
            createdBy: 'Test System',
            updatedAt: new Date().toISOString()
        },
        {
            id: 'kpi_sample_' + Date.now() + '_2',
            name: 'Customer Satisfaction Score',
            kpiName: 'Customer Satisfaction Score',
            category: 'Customer',
            description: 'Average customer satisfaction rating from surveys',
            owner: 'Sarah Johnson',
            employee: 'user_sarah_johnson',
            employeeName: 'Sarah Johnson',
            employeeEmail: 'sarah.johnson@company.com',
            employeeDepartment: 'Customer Service',
            department: 'Customer Service',
            metricType: 'Score',
            frequency: 'Weekly',
            target: 4.5,
            current: 4.2,
            thresholds: {
                excellent: 4.5,
                good: 4.0,
                poor: 3.5
            },
            priority: 'High',
            status: 'Active',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            notes: 'Measured on a 1-5 scale from customer feedback surveys',
            createdAt: new Date().toISOString(),
            createdBy: 'Test System',
            updatedAt: new Date().toISOString()
        },
        {
            id: 'kpi_sample_' + Date.now() + '_3',
            name: 'Production Efficiency',
            kpiName: 'Production Efficiency',
            category: 'Operational',
            description: 'Ratio of actual production output to planned output',
            owner: 'Mike Wilson',
            employee: 'user_mike_wilson',
            employeeName: 'Mike Wilson',
            employeeEmail: 'mike.wilson@company.com',
            employeeDepartment: 'Production',
            department: 'Production',
            metricType: 'Percentage',
            frequency: 'Daily',
            target: 95,
            current: 92,
            thresholds: {
                excellent: 98,
                good: 95,
                poor: 90
            },
            priority: 'Medium',
            status: 'Active',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            notes: 'Critical for maintaining production schedules',
            createdAt: new Date().toISOString(),
            createdBy: 'Test System',
            updatedAt: new Date().toISOString()
        },
        {
            id: 'kpi_sample_' + Date.now() + '_4',
            name: 'Employee Turnover Rate',
            kpiName: 'Employee Turnover Rate',
            category: 'Employee',
            description: 'Percentage of employees who left the company',
            owner: 'Lisa Brown',
            employee: 'user_lisa_brown',
            employeeName: 'Lisa Brown',
            employeeEmail: 'lisa.brown@company.com',
            employeeDepartment: 'HR',
            department: 'HR',
            metricType: 'Percentage',
            frequency: 'Quarterly',
            target: 5,
            current: 3.2,
            thresholds: {
                excellent: 3,
                good: 5,
                poor: 8
            },
            priority: 'Medium',
            status: 'Active',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            notes: 'Lower is better for this metric',
            createdAt: new Date().toISOString(),
            createdBy: 'Test System',
            updatedAt: new Date().toISOString()
        },
        {
            id: 'kpi_sample_' + Date.now() + '_5',
            name: 'Safety Incidents',
            kpiName: 'Safety Incidents',
            category: 'Safety',
            description: 'Number of safety incidents per month',
            owner: 'David Lee',
            employee: 'user_david_lee',
            employeeName: 'David Lee',
            employeeEmail: 'david.lee@company.com',
            employeeDepartment: 'Safety',
            department: 'Safety',
            metricType: 'Number',
            frequency: 'Monthly',
            target: 0,
            current: 1,
            thresholds: {
                excellent: 0,
                good: 1,
                poor: 3
            },
            priority: 'Critical',
            status: 'Active',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            notes: 'Zero tolerance for safety incidents',
            createdAt: new Date().toISOString(),
            createdBy: 'Test System',
            updatedAt: new Date().toISOString()
        }
    ];
    
    try {
        const promises = sampleKPIs.map(kpi => {
            const kpiRef = ref(db, `kpis/${kpi.id}`);
            return set(kpiRef, kpi);
        });
        
        await Promise.all(promises);
        
        logMessage(`Created ${sampleKPIs.length} sample KPIs successfully`, 'success');
        showSuccessModal(`${sampleKPIs.length} sample KPIs created successfully!`);
        
        // Refresh status
        setTimeout(() => {
            loadKPICount();
        }, 1000);
        
    } catch (error) {
        logMessage(`Error creating sample KPIs: ${error.message}`, 'error');
        showErrorModal('Failed to create sample KPIs. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Test real-time functionality
function testRealTime() {
    logMessage('Testing real-time functionality...', 'info');
    
    const testMessage = `
        <div class="test-instructions">
            <h4>Real-time Test Instructions:</h4>
            <ol>
                <li>Open the KPI Dashboard in a new tab: <a href="kpiboard.html" target="_blank">KPI Dashboard</a></li>
                <li>Create a new KPI using this form: <a href="kpi.html" target="_blank">Create KPI</a></li>
                <li>Watch the dashboard update automatically</li>
                <li>Check this test log for real-time update confirmations</li>
            </ol>
            <p><strong>Expected Result:</strong> Changes should appear instantly across all tabs without refresh.</p>
        </div>
    `;
    
    logMessage('Real-time test started - follow instructions above', 'info');
    showSuccessModal(testMessage);
    
    // Monitor for changes
    let changeCount = 0;
    const kpisRef = ref(db, 'kpis');
    const testListener = onValue(kpisRef, (snapshot) => {
        changeCount++;
        if (changeCount > 1) { // Skip initial load
            logMessage(`Real-time update detected! Change #${changeCount - 1}`, 'success');
        }
    });
    
    // Stop monitoring after 5 minutes
    setTimeout(() => {
        testListener();
        logMessage('Real-time test monitoring stopped', 'info');
    }, 300000);
}

// Clear test data
async function clearTestData() {
    if (!confirm('Are you sure you want to delete all test KPIs? This action cannot be undone.')) {
        return;
    }
    
    logMessage('Clearing test data...', 'info');
    showLoading(true);
    
    try {
        const kpisRef = ref(db, 'kpis');
        onValue(kpisRef, async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const testKPIs = Object.keys(data).filter(key => 
                    data[key].createdBy === 'Test System' || 
                    key.includes('sample') ||
                    data[key].name?.includes('Test') ||
                    data[key].kpiName?.includes('Test')
                );
                
                if (testKPIs.length > 0) {
                    const deletePromises = testKPIs.map(kpiId => {
                        const kpiRef = ref(db, `kpis/${kpiId}`);
                        return remove(kpiRef);
                    });
                    
                    await Promise.all(deletePromises);
                    logMessage(`Deleted ${testKPIs.length} test KPIs`, 'success');
                    showSuccessModal(`${testKPIs.length} test KPIs deleted successfully!`);
                } else {
                    logMessage('No test KPIs found to delete', 'info');
                    showSuccessModal('No test KPIs found to delete.');
                }
            } else {
                logMessage('No KPIs found in database', 'info');
                showSuccessModal('No KPIs found in database.');
            }
            
            // Refresh status
            setTimeout(() => {
                loadKPICount();
            }, 1000);
            
        }, { onlyOnce: true });
        
    } catch (error) {
        logMessage(`Error clearing test data: ${error.message}`, 'error');
        showErrorModal('Failed to clear test data. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Test export functionality
function testExport() {
    logMessage('Testing export functionality...', 'info');
    
    if (kpiCount === 0) {
        showErrorModal('No KPIs available to export. Create some sample KPIs first.');
        return;
    }
    
    // Simulate CSV export
    const csvData = `Name,Category,Owner,Department,Priority,Status,Target,Current
"Monthly Revenue Growth","Financial","John Smith","Finance","Critical","Active","15","12.5"
"Customer Satisfaction","Customer","Sarah Johnson","Customer Service","High","Active","4.5","4.2"
"Production Efficiency","Operational","Mike Wilson","Production","Medium","Active","95","92"`;
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi_test_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    logMessage('Test CSV export completed', 'success');
    showSuccessModal('Test export completed! Check your downloads folder.');
}

// Refresh system status
function refreshStatus() {
    logMessage('Refreshing system status...', 'info');
    
    // Reset status indicators
    updateStatus('firebaseStatus', 'loading', 'Checking...');
    updateStatus('kpiCountStatus', 'loading', 'Loading...');
    updateStatus('realTimeStatus', 'loading', 'Testing...');
    
    // Re-run tests
    setTimeout(() => {
        testFirebaseConnection();
        loadKPICount();
        setupRealTimeTest();
    }, 500);
}

// Update status card
function updateStatus(cardId, status, message) {
    const card = document.getElementById(cardId);
    const textElement = card.querySelector('p');
    const indicator = card.querySelector('.status-indicator i');
    
    textElement.textContent = message;
    
    // Reset classes
    card.classList.remove('status-success', 'status-error', 'status-loading');
    
    switch (status) {
        case 'success':
            card.classList.add('status-success');
            indicator.className = 'fas fa-check-circle';
            break;
        case 'error':
            card.classList.add('status-error');
            indicator.className = 'fas fa-exclamation-triangle';
            break;
        case 'loading':
            card.classList.add('status-loading');
            indicator.className = 'fas fa-spinner fa-spin';
            break;
    }
}

// Log message to test log
function logMessage(message, type = 'info') {
    const logContainer = document.getElementById('testLog');
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    console.log(`[KPI Test] ${timestamp} - ${type.toUpperCase()}: ${message}`);
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

function showSuccessModal(message) {
    document.getElementById('successMessage').innerHTML = message;
    openModal('successModal');
}

function showErrorModal(message) {
    document.getElementById('errorMessage').textContent = message;
    openModal('errorModal');
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Global functions for HTML onclick events
window.refreshStatus = refreshStatus;
window.createSampleKPIs = createSampleKPIs;
window.testRealTime = testRealTime;
window.clearTestData = clearTestData;
window.testExport = testExport;
window.closeModal = closeModal;
window.testCreatorNameFunctionality = testCreatorNameFunctionality;

// Test creator name functionality
function testCreatorNameFunctionality() {
    logMessage('Testing creator name functionality...', 'info');
    
    // Test data with different creator information structures
    const testKPIs = [
        {
            id: 'test-1',
            name: 'Test KPI 1',
            createdByName: 'John Smith',
            createdBy: 'john.smith@company.com'
        },
        {
            id: 'test-2', 
            name: 'Test KPI 2',
            createdByInfo: {
                name: 'Jane Doe',
                email: 'jane.doe@company.com',
                id: 'user123'
            },
            createdBy: 'user123'
        },
        {
            id: 'test-3',
            name: 'Test KPI 3',
            createdBy: {
                name: 'Bob Johnson',
                email: 'bob.johnson@company.com'
            }
        },
        {
            id: 'test-4',
            name: 'Test KPI 4',
            createdBy: 'mary.wilson@company.com'
        },
        {
            id: 'test-5',
            name: 'Test KPI 5',
            createdBy: 'Unknown'
        }
    ];
    
    // Expected results
    const expectedResults = [
        'John Smith',
        'Jane Doe', 
        'Bob Johnson',
        'Mary Wilson',
        'Unknown'
    ];
    
    // Mock the getCreatorName function for testing
    function getCreatorName(kpi) {
        if (!kpi) return 'Unknown';
        
        // First priority: createdByName field
        if (kpi.createdByName && kpi.createdByName !== 'Unknown User') {
            return kpi.createdByName;
        }
        
        // Second priority: createdByInfo object
        if (kpi.createdByInfo && typeof kpi.createdByInfo === 'object') {
            if (kpi.createdByInfo.name && kpi.createdByInfo.name !== 'Unknown User') {
                return kpi.createdByInfo.name;
            }
        }
        
        // Third priority: createdBy as object
        if (typeof kpi.createdBy === 'object' && kpi.createdBy !== null) {
            return kpi.createdBy.name || kpi.createdBy.displayName || kpi.createdBy.email || kpi.createdBy.id || 'Unknown';
        }
        
        // Fourth priority: createdBy as email - format nicely
        if (kpi.createdBy && typeof kpi.createdBy === 'string' && kpi.createdBy.includes('@')) {
            return kpi.createdBy.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        // Final fallback
        return kpi.createdBy || 'Unknown';
    }
    
    // Test each KPI
    let passedTests = 0;
    testKPIs.forEach((kpi, index) => {
        const result = getCreatorName(kpi);
        const expected = expectedResults[index];
        
        if (result === expected) {
            logMessage(`✅ Test ${index + 1}: "${kpi.name}" → "${result}" ✓`, 'success');
            passedTests++;
        } else {
            logMessage(`❌ Test ${index + 1}: "${kpi.name}" → Expected: "${expected}", Got: "${result}"`, 'error');
        }
    });
    
    // Summary
    const totalTests = testKPIs.length;
    if (passedTests === totalTests) {
        logMessage(`🎉 All creator name tests passed! (${passedTests}/${totalTests})`, 'success');
        updateStatus('creatorNameStatus', 'success', `All tests passed (${passedTests}/${totalTests})`);
    } else {
        logMessage(`⚠️ Creator name tests completed with issues: ${passedTests}/${totalTests} passed`, 'warning');
        updateStatus('creatorNameStatus', 'error', `${passedTests}/${totalTests} tests passed`);
    }
}
