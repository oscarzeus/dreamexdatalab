/**
 * KPI Dashboard - Security Model:
 * Users can only view, edit, and delete KPIs that they either:
 * 1. Created themselves (checked via createdBy fields)
 * 2. Are assigned to them (checked via employee field)
 * This ensures data privacy and proper access control.
 */

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let allKPIs = [];
let filteredKPIs = [];
let employees = {}; // Cache employee data
let currentPage = 1;
const itemsPerPage = 10;
let sortColumn = 'name';
let sortDirection = 'asc';
let currentKPIForEdit = null;
let currentKPIForDelete = null;

// DOM Elements
const tableBody = document.getElementById('kpiTableBody');
const pagination = document.getElementById('pagination');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('KPI Dashboard initializing...');
    
    // Load employees first, then KPIs
    loadEmployees().then(() => {
        loadKPIs();
    });
    
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Items per page
    document.getElementById('itemsPerPage').addEventListener('change', changeItemsPerPage);
    
    // Table sorting
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => sortTable(header.dataset.sort));
    });
    
    // Edit form submission
    document.getElementById('editKPIForm').addEventListener('submit', handleEditSubmit);
    
    // Event delegation for action buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon')) {
            const button = e.target.closest('.btn-icon');
            const action = button.dataset.action;
            const kpiId = button.dataset.kpiId;
            
            switch (action) {
                case 'view':
                    viewKPI(kpiId);
                    break;
                case 'edit':
                    editKPI(kpiId);
                    break;
                case 'delete':
                    deleteKPI(kpiId);
                    break;
            }
        }
    });
}

// Load employees from Firebase
async function loadEmployees() {
    try {
        console.log('Loading employees from Firebase...');
        const usersRef = ref(db, 'users');
        
        return new Promise((resolve) => {
            onValue(usersRef, (snapshot) => {
                const usersData = snapshot.val();
                employees = {}; // Reset cache
                
                if (usersData) {
                    Object.keys(usersData).forEach(uid => {
                        const user = usersData[uid];
                        if (user.name || user.firstName || user.lastName) {
                            // Construct full name with fallback options
                            let fullName = user.name;
                            if (!fullName && user.firstName && user.lastName) {
                                fullName = `${user.firstName} ${user.lastName}`.trim();
                            } else if (!fullName && user.firstName) {
                                fullName = user.firstName;
                            } else if (!fullName && user.lastName) {
                                fullName = user.lastName;
                            } else if (!fullName) {
                                fullName = user.displayName || user.email || 'Unknown User';
                            }
                            
                            employees[uid] = {
                                uid: uid,
                                name: fullName,
                                email: user.email || '',
                                lineManager: user.lineManager || null  // Include line manager info
                            };
                        }
                    });
                }
                
                console.log('Employees loaded:', Object.keys(employees).length);
                resolve();
            }, {once: true});
        });
    } catch (error) {
        console.error('Error loading employees:', error);
        employees = {}; // Fallback to empty object
    }
}

// Get employee name by UID or from stored KPI data
function getEmployeeName(uid, kpi = null) {
    if (!uid) return 'Not Assigned';
    
    // If KPI has stored employee name, use that first
    if (kpi && kpi.employeeName) {
        return kpi.employeeName;
    }
    
    // Fallback to looking up by UID
    return employees[uid] ? employees[uid].name : 'Unknown Employee';
}

// Utility to get creator name from KPI
function getCreatorName(kpi) {
    if (!kpi) return 'Unknown';
    
    // First priority: createdByName field (stores the full name directly)
    if (kpi.createdByName && kpi.createdByName !== 'Unknown User') {
        return kpi.createdByName;
    }
    
    // Second priority: createdByInfo object (comprehensive creator info)
    if (kpi.createdByInfo && typeof kpi.createdByInfo === 'object') {
        if (kpi.createdByInfo.name && kpi.createdByInfo.name !== 'Unknown User') {
            return kpi.createdByInfo.name;
        }
    }
    
    // Third priority: createdBy as object with name/displayName (legacy support)
    if (typeof kpi.createdBy === 'object' && kpi.createdBy !== null) {
        return kpi.createdBy.name || kpi.createdBy.displayName || kpi.createdBy.email || kpi.createdBy.id || 'Unknown';
    }
    
    // Fourth priority: createdBy as UID - lookup in employees cache
    if (kpi.createdBy && employees[kpi.createdBy]) {
        return employees[kpi.createdBy].name;
    }
    
    // Fifth priority: createdBy as email - try to find user by email or format nicely
    if (kpi.createdBy && typeof kpi.createdBy === 'string' && kpi.createdBy.includes('@')) {
        // Try to find the user in employees by email
        const userByEmail = Object.values(employees).find(emp => emp.email === kpi.createdBy);
        if (userByEmail && userByEmail.name) return userByEmail.name;
        // If not found, format the email part nicely (only as last resort)
        return kpi.createdBy.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Final fallback
    return kpi.createdBy || 'Unknown';
}

// Load KPIs from Firebase
function loadKPIs() {
    showLoading(true);
    
    const kpisRef = ref(db, 'kpis');
    onValue(kpisRef, (snapshot) => {
        const data = snapshot.val();
        allKPIs = data ? Object.values(data) : [];
        
        // Filter KPIs for current user - only show KPIs created by user or assigned to user
        filteredKPIs = filterKPIsForCurrentUser(allKPIs);
        
        updateSummaryCards();
        updateTable();
        updatePagination();
        updateResultsCount();
        showLoading(false);
    }, (error) => {
        console.error('Error loading KPIs:', error);
        showErrorModal('Failed to load KPIs. Please refresh the page.');
        showLoading(false);
    });
}

// Update summary cards
function updateSummaryCards() {
    const totalKPIs = filteredKPIs.length;
    const targetsAchieved = filteredKPIs.filter(kpi => {
        return kpi.current && kpi.target && kpi.current >= kpi.target;
    }).length;
    
    document.getElementById('totalKPIs').textContent = totalKPIs;
    document.getElementById('targetsAchieved').textContent = targetsAchieved;
    
    // Update other cards with meaningful metrics
    const categories = [...new Set(filteredKPIs.map(kpi => kpi.category).filter(Boolean))];
    const avgPerformance = filteredKPIs.filter(kpi => kpi.current && kpi.target)
        .reduce((acc, kpi) => acc + (parseFloat(kpi.current) / parseFloat(kpi.target) * 100), 0) / 
        filteredKPIs.filter(kpi => kpi.current && kpi.target).length || 0;
    
    document.getElementById('activeKPIs').textContent = Math.round(avgPerformance) + '%';
    document.getElementById('criticalKPIs').textContent = categories.length;
}



// Sort table
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredKPIs.sort((a, b) => {
        let aValue, bValue;
        
        // Handle employee column specifically
        if (column === 'employee') {
            aValue = (a.employeeName || getEmployeeName(a.employee, a)).toLowerCase();
            bValue = (b.employeeName || getEmployeeName(b.employee, b)).toLowerCase();
        } else {
            aValue = a[column];
            bValue = b[column];
            
            // Handle numeric values
            if (column === 'target' || column === 'current') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            } else {
                aValue = aValue?.toString().toLowerCase() || '';
                bValue = bValue?.toString().toLowerCase() || '';
            }
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateTable();
    updatePagination();
    updateResultsCount();
    updateSortIndicators();
}

// Update sort indicators
function updateSortIndicators() {
    document.querySelectorAll('th[data-sort] i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const currentHeader = document.querySelector(`th[data-sort="${sortColumn}"] i`);
    if (currentHeader) {
        currentHeader.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
    }
}

// Update table
function updateTable() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // Group KPIs by employee
    const groupedKPIs = groupKPIsByEmployee(filteredKPIs);
    const pageData = groupedKPIs.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        tableBody.innerHTML = '';
        document.getElementById('noResults').style.display = 'block';
        document.querySelector('.table-container').style.display = 'none';
        return;
    }
    
    document.getElementById('noResults').style.display = 'none';
    document.querySelector('.table-container').style.display = 'block';
    
    tableBody.innerHTML = pageData.map(groupedKPI => createEmployeeTableRow(groupedKPI)).join('');
}

// Group KPIs by employee
function groupKPIsByEmployee(kpis) {
    const grouped = {};
    
    kpis.forEach(kpi => {
        const employeeId = kpi.employee || 'unassigned';
        if (!grouped[employeeId]) {
            // Use stored employee name from KPI if available, otherwise lookup by ID
            const employeeName = kpi.employeeName || getEmployeeName(employeeId, kpi);
            
            grouped[employeeId] = {
                employeeId: employeeId,
                employeeName: employeeName,
                kpis: [],
                totalKPIs: 0,
                avgPerformance: 0,
                avgVariance: 0,
                targetsAchieved: 0,
                categories: new Set()
            };
        }
        
        grouped[employeeId].kpis.push(kpi);
        grouped[employeeId].totalKPIs++;
        grouped[employeeId].categories.add(kpi.category || 'N/A');
        
        // Count targets achieved
        if (kpi.current && kpi.target && parseFloat(kpi.current) >= parseFloat(kpi.target)) {
            grouped[employeeId].targetsAchieved++;
        }
    });
    
    // Calculate average performance for each employee
    Object.values(grouped).forEach(group => {
        const performanceValues = group.kpis
            .filter(kpi => kpi.current && kpi.target)
            .map(kpi => (parseFloat(kpi.current) / parseFloat(kpi.target)) * 100);
        
        // Calculate average variance for each employee
        const varianceValues = group.kpis
            .filter(kpi => kpi.current && kpi.target)
            .map(kpi => ((parseFloat(kpi.current) - parseFloat(kpi.target)) / parseFloat(kpi.target)) * 100);
        
        if (performanceValues.length > 0) {
            group.avgPerformance = performanceValues.reduce((a, b) => a + b, 0) / performanceValues.length;
            group.avgVariance = varianceValues.reduce((a, b) => a + b, 0) / varianceValues.length;
        }
        
        // Convert categories Set to Array for easier handling
        group.categories = Array.from(group.categories);
    });
    
    return Object.values(grouped);
}

// Create employee table row (showing aggregated KPI data)
function createEmployeeTableRow(groupedKPI) {
    const performance = calculateGroupPerformance(groupedKPI);
    const categoriesText = groupedKPI.categories.slice(0, 3).join(', ') + 
                          (groupedKPI.categories.length > 3 ? `, +${groupedKPI.categories.length - 3} more` : '');
    const recentKPI = groupedKPI.kpis.sort((a, b) => 
        new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)
    )[0];
    // Get creator name from the most recent KPI in the group
    const creatorName = getCreatorName(recentKPI);
    return `
        <tr class="employee-row clickable-row" data-employee-id="${groupedKPI.employeeId}" onclick="toggleEmployeeKPIs('${groupedKPI.employeeId}')" ondblclick="viewEmployeeKPIs('${groupedKPI.employeeId}')" style="cursor: pointer;" title="Click to expand/collapse KPIs, Double-click to view details">
            <td>
                <div class="kpi-name">
                    <strong>KPI Portfolio (${groupedKPI.totalKPIs} KPIs)</strong>
                    <small>Click to view individual KPIs</small>
                </div>
            </td>
            <td>
                <span class="category-badge multi-category" title="${groupedKPI.categories.join(', ')}">
                    ${categoriesText}
                </span>
            </td>
            <td>
                <div class="employee-info">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(groupedKPI.employeeName)}</span>
                </div>
            </td>
            <td>
                <div class="performance-indicator ${performance.class}">
                    <div class="performance-bar">
                        <div class="performance-fill" style="width: ${performance.percentage}%"></div>
                    </div>
                    <span class="performance-label">${performance.label} (${groupedKPI.avgVariance >= 0 ? '+' : ''}${groupedKPI.avgVariance ? groupedKPI.avgVariance.toFixed(1) : '0.0'}%)</span>
                </div>
            </td>
            <td>
                <div class="target-summary">
                    <strong>${groupedKPI.targetsAchieved}/${groupedKPI.totalKPIs}</strong>
                    <small>Targets Achieved</small>
                </div>
            </td>
            <td>
                <div class="performance-summary">
                    <strong>${Math.round(groupedKPI.avgPerformance)}%</strong>
                    <small>Avg Performance</small>
                </div>
            </td>
            <td>
                <span class="frequency-summary">Mixed</span>
            </td>
            <!-- <td>
                <span>${escapeHtml(creatorName)}</span>
            </td>
            <td>
                <div class="action-buttons" onclick="event.stopPropagation();" style="text-align: left;">
                    <button class="btn-icon btn-secondary" onclick="editEmployeeKPIs('${groupedKPI.employeeId}')" title="Bulk Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td> -->
        </tr>
        <tr class="employee-kpis-row" id="kpis-${groupedKPI.employeeId}" style="display: none;">
            <td colspan="7">
                <div class="employee-kpis-container">
                    <h4><i class="fas fa-chart-line"></i> Individual KPIs for ${escapeHtml(groupedKPI.employeeName)}</h4>
                    <div class="individual-kpis-table">
                        <table class="nested-kpi-table">
                            <thead>
                                <tr>
                                    <th>KPI Name</th>
                                    <th class="mobile-hide">Category</th>
                                    <th>Performance</th>
                                    <th class="mobile-hide">Target</th>
                                    <th class="mobile-hide">Current</th>
                                    <th class="mobile-hide">Frequency</th>
                                    <!-- <th>Created By</th>
                                    <th>Actions</th> -->
                                </tr>
                            </thead>
                            <tbody>
                                ${groupedKPI.kpis.map(kpi => createIndividualKPIRow(kpi)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Update createIndividualKPIRow to show Created By
function createIndividualKPIRow(kpi) {
    const performance = calculatePerformance(kpi.current, kpi.thresholds);
    const progressPercentage = kpi.current && kpi.target ? 
        Math.min((parseFloat(kpi.current) / parseFloat(kpi.target)) * 100, 100) : 0;
    
    // Calculate variance percentage: (current - target) / target * 100
    const variancePercentage = kpi.current && kpi.target ? 
        ((parseFloat(kpi.current) - parseFloat(kpi.target)) / parseFloat(kpi.target)) * 100 : 0;
    
    const creatorName = getCreatorName(kpi);
    return `
        <tr class="nested-kpi-row clickable-row" onclick="viewKPI('${kpi.id}')" ondblclick="viewKPI('${kpi.id}')" style="cursor: pointer;" title="Click to view KPI details, Double-click to open modal">
            <td>
                <div class="nested-kpi-name">
                    <strong>${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')}</strong>
                    ${kpi.description ? `<small>${escapeHtml(kpi.description)}</small>` : ''}
                </div>
            </td>
            <td class="mobile-hide">
                <span class="category-badge small">${escapeHtml(kpi.category || 'N/A')}</span>
            </td>
            <td>
                <div class="performance-indicator small ${performance.class}">
                    <div class="performance-bar">
                        <div class="performance-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <span class="performance-label">${performance.label} (${variancePercentage >= 0 ? '+' : ''}${variancePercentage.toFixed(1)}%)</span>
                </div>
            </td>
            <td class="mobile-hide">${formatValue(kpi.target, kpi.metricType)}</td>
            <td class="mobile-hide">${formatValue(kpi.current, kpi.metricType)}</td>
            <td class="mobile-hide">${escapeHtml(kpi.frequency || 'N/A')}</td>
            <!-- <td>${escapeHtml(creatorName)}</td>
            <td>
                <div class="action-buttons" onclick="event.stopPropagation();" style="text-align: left;">
                    <button class="btn-icon btn-secondary btn-small" onclick="editKPI('${kpi.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td> -->
        </tr>
    `;
}

// Calculate performance for grouped KPIs
function calculateGroupPerformance(groupedKPI) {
    const avgPerformance = groupedKPI.avgPerformance;
    
    if (avgPerformance >= 120) {
        return { label: 'Excellent', class: 'excellent', percentage: 100 };
    } else if (avgPerformance >= 100) {
        return { label: 'Good', class: 'good', percentage: 75 };
    } else if (avgPerformance >= 80) {
        return { label: 'Average', class: 'average', percentage: 50 };
    } else if (avgPerformance > 0) {
        return { label: 'Poor', class: 'poor', percentage: 25 };
    } else {
        return { label: 'No Data', class: 'no-data', percentage: 0 };
    }
}

// Create individual KPI card for expanded view (kept for modal usage)
function createIndividualKPICard(kpi) {
    const performance = calculatePerformance(kpi.current, kpi.thresholds);
    
    // Calculate variance percentage: (current - target) / target * 100
    const variancePercentage = kpi.current && kpi.target ? 
        ((parseFloat(kpi.current) - parseFloat(kpi.target)) / parseFloat(kpi.target)) * 100 : 0;
    
    return `
        <div class="individual-kpi-card">
            <div class="kpi-card-header">
                <h5>${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')}</h5>
                <span class="category-badge small">${escapeHtml(kpi.category || 'N/A')}</span>
            </div>
            <div class="kpi-card-body">
                <div class="kpi-metrics">
                    <div class="metric">
                        <label>Target:</label>
                        <span>${formatValue(kpi.target, kpi.metricType)}</span>
                    </div>
                    <div class="metric">
                        <label>Current:</label>
                        <span>${formatValue(kpi.current, kpi.metricType)}</span>
                    </div>
                    <div class="metric">
                        <label>Variance:</label>
                        <span class="${variancePercentage >= 0 ? 'text-success' : 'text-danger'}">${variancePercentage >= 0 ? '+' : ''}${variancePercentage.toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <label>Frequency:</label>
                        <span>${escapeHtml(kpi.frequency || 'N/A')}</span>
                    </div>
                </div>
                <div class="performance-indicator small ${performance.class}">
                    <div class="performance-bar">
                        <div class="performance-fill" style="width: ${performance.percentage}%"></div>
                    </div>
                    <span class="performance-label">${performance.label}</span>
                </div>
                ${kpi.description ? `<p class="kpi-description">${escapeHtml(kpi.description)}</p>` : ''}
            </div>
            <div class="kpi-card-actions">
                <button class="btn-icon btn-primary" onclick="viewKPI('${kpi.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-secondary" onclick="editKPI('${kpi.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
    `;
}

// Calculate performance
function calculatePerformance(current, thresholds) {
    if (!current || !thresholds) {
        return { label: 'No Data', class: 'no-data', percentage: 0 };
    }
    
    const currentVal = parseFloat(current);
    const excellent = parseFloat(thresholds.excellent);
    const good = parseFloat(thresholds.good);
    const poor = parseFloat(thresholds.poor);
    
    if (isNaN(currentVal) || isNaN(excellent) || isNaN(good) || isNaN(poor)) {
        return { label: 'No Data', class: 'no-data', percentage: 0 };
    }
    
    if (currentVal >= excellent) {
        return { label: 'Excellent', class: 'excellent', percentage: 100 };
    } else if (currentVal >= good) {
        return { label: 'Good', class: 'good', percentage: 75 };
    } else if (currentVal >= poor) {
        return { label: 'Average', class: 'average', percentage: 50 };
    } else {
        return { label: 'Poor', class: 'poor', percentage: 25 };
    }
}

// Format value based on metric type
function formatValue(value, metricType) {
    if (!value && value !== 0) return 'N/A';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';
    
    switch (metricType) {
        case 'Percentage':
            return numValue.toFixed(1) + '%';
        case 'Currency':
            return '$' + numValue.toLocaleString();
        case 'Time':
            return numValue + (numValue === 1 ? ' hour' : ' hours');
        default:
            return numValue.toLocaleString();
    }
}

// View KPI details
function viewKPI(kpiId) {
    const kpi = allKPIs.find(k => k.id === kpiId);
    if (!kpi) return;
    
    const content = generateKPIDetailHTML(kpi);
    document.getElementById('kpiDetailContent').innerHTML = content;
    
    // Ensure edit button is visible and set its onclick handler
    const editBtn = document.getElementById('editKPIBtn');
    if (editBtn) {
        editBtn.style.display = 'inline-block'; // Make sure it's visible
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit KPI'; // Reset button text
        editBtn.onclick = () => editKPI(kpiId);
    }
    
    openModal('kpiDetailModal');
}

// Generate KPI detail HTML
function generateKPIDetailHTML(kpi) {
    const performance = calculatePerformance(kpi.current, kpi.thresholds);
    
    // Calculate variance percentage: (current - target) / target * 100
    const variancePercentage = kpi.current && kpi.target ? 
        ((parseFloat(kpi.current) - parseFloat(kpi.target)) / parseFloat(kpi.target)) * 100 : 0;
    
    // Calculate performance percentage for visual indicator
    const performancePercentage = kpi.current && kpi.target ? 
        Math.min((parseFloat(kpi.current) / parseFloat(kpi.target)) * 100, 100) : 0;
    
    return `
        <div class="kpi-detail-enhanced">
            <!-- Hero Section -->
            <div class="kpi-hero">
                <div class="kpi-hero-content">
                    <div class="kpi-title-section">
                        <h2 class="kpi-title">${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')}</h2>
                        <div class="kpi-meta">
                            <span class="kpi-category">${escapeHtml(kpi.category || 'General')}</span>
                            <span class="kpi-frequency">${escapeHtml(kpi.frequency || 'N/A')}</span>
                            <span class="kpi-type">${escapeHtml(kpi.metricType || 'Number')}</span>
                        </div>
                    </div>
                    <div class="kpi-status-badge ${kpi.status?.toLowerCase() || 'active'}">
                        <i class="fas fa-circle"></i>
                        ${escapeHtml(kpi.status || 'Active')}
                    </div>
                </div>
            </div>

            <!-- Performance Dashboard -->
            <div class="performance-dashboard">
                <div class="performance-card primary">
                    <div class="performance-header">
                        <h3>Performance Overview</h3>
                        <div class="performance-rating ${performance.class}">
                            <span class="rating-label">${performance.label}</span>
                            <div class="rating-indicator">
                                <div class="rating-circle">
                                    <svg class="rating-svg" viewBox="0 0 36 36">
                                        <path class="rating-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                                        <path class="rating-fill ${performance.class}" stroke-dasharray="${performancePercentage}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                                    </svg>
                                    <div class="rating-text">${Math.round(performancePercentage)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon target">
                            <i class="fas fa-bullseye"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Target</div>
                            <div class="metric-value">${formatValue(kpi.target, kpi.metricType)}</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon current">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Current</div>
                            <div class="metric-value">${formatValue(kpi.current, kpi.metricType)}</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon variance ${variancePercentage >= 0 ? 'positive' : 'negative'}">
                            <i class="fas fa-${variancePercentage >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Variance</div>
                            <div class="metric-value ${variancePercentage >= 0 ? 'text-success' : 'text-danger'}">
                                ${variancePercentage >= 0 ? '+' : ''}${variancePercentage.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Sections -->
            ${kpi.description ? `
            <div class="content-section">
                <div class="section-header">
                    <h3><i class="fas fa-info-circle"></i> Description</h3>
                </div>
                <div class="section-content">
                    <p class="description-text">${escapeHtml(kpi.description)}</p>
                </div>
            </div>
            ` : ''}
            
            ${kpi.notes ? `
            <div class="content-section">
                <div class="section-header">
                    <h3><i class="fas fa-sticky-note"></i> Notes</h3>
                </div>
                <div class="section-content">
                    <p class="notes-text">${escapeHtml(kpi.notes)}</p>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

// Edit KPI
function editKPI(kpiId) {
    const kpi = allKPIs.find(k => k.id === kpiId);
    if (!kpi) return;
    
    currentKPIForEdit = kpi;
    const editForm = generateEditForm(kpi);
    document.getElementById('editKPIContent').innerHTML = editForm;
    
    closeModal('kpiDetailModal');
    openModal('editKPIModal');
}

// Generate edit form
function generateEditForm(kpi) {
    // Get current employee name for this KPI
    const currentEmployeeName = kpi.employeeName || getEmployeeName(kpi.employee, kpi);
    
    return `
        <div class="edit-form-grid">
            <div class="form-group">
                <label for="editKpiName">KPI Name</label>
                <input type="text" id="editKpiName" name="kpiName" value="${escapeHtml(kpi.name || kpi.kpiName || '')}" required>
            </div>
            
            <div class="form-group">
                <label for="editCategory">Category</label>
                <select id="editCategory" name="category" required>
                    <option value="">Select Category</option>
                    ${generateOptions(['Financial', 'Operational', 'Customer', 'Employee', 'Quality', 'Safety', 'Compliance', 'Innovation', 'Environmental', 'Other'], kpi.category)}
                </select>
            </div>
            
            <div class="form-group">
                <label for="editEmployee">Team Member <i class="fas fa-lock" style="margin-left: 4px; color: #6c757d; font-size: 0.8em;" title="Locked - cannot be changed"></i></label>
                <select id="editEmployee" name="employee" required disabled title="Team member cannot be changed when editing KPI" style="background-color: #f8f9fa; color: #6c757d; cursor: not-allowed;">
                    ${generateEmployeeOptions(kpi.employee, kpi)}
                </select>
            </div>
            
            <div class="form-group">
                <label for="editDepartment">Department</label>
                <select id="editDepartment" name="department" required>
                    <option value="">Select Department</option>
                    ${generateOptions(['Finance', 'Operations', 'HR', 'Sales', 'Marketing', 'IT', 'Production', 'Quality', 'Safety', 'Management', 'Other'], kpi.department)}
                </select>
            </div>
            
            <div class="form-group">
                <label for="editTarget">Target</label>
                <input type="number" id="editTarget" name="target" value="${kpi.target || ''}" step="0.01" required>
            </div>
            
            <div class="form-group">
                <label for="editCurrent">Current</label>
                <input type="number" id="editCurrent" name="current" value="${kpi.current || ''}" step="0.01">
            </div>
            
            <div class="form-group">
                <label for="editStatus">Status</label>
                <select id="editStatus" name="status" required>
                    <option value="">Select Status</option>
                    ${generateOptions(['Active', 'Inactive', 'Draft'], kpi.status)}
                </select>
            </div>
            
            <div class="form-group full-width">
                <label for="editDescription">Description</label>
                <textarea id="editDescription" name="description" rows="3">${escapeHtml(kpi.description || '')}</textarea>
            </div>
            
            <div class="form-group full-width">
                <label for="editNotes">Notes</label>
                <textarea id="editNotes" name="notes" rows="3">${escapeHtml(kpi.notes || '')}</textarea>
            </div>
        </div>
    `;
}

// Generate options for select elements
function generateOptions(options, selectedValue) {
    return options.map(option => 
        `<option value="${option}" ${option === selectedValue ? 'selected' : ''}>${option}</option>`
    ).join('');
}

// Generate employee options for select elements
function generateEmployeeOptions(selectedEmployeeId, kpi = null) {
    let options = '';
    
    // When editing, we want to show only the selected employee
    if (selectedEmployeeId) {
        // Use the getEmployeeName function to get the proper employee name
        const employeeName = getEmployeeName(selectedEmployeeId, kpi);
        options = `<option value="${selectedEmployeeId}" selected>${escapeHtml(employeeName)}</option>`;
    } else {
        // For new KPIs, show all available employees
        options = '<option value="">Select Team Member</option>';
        Object.keys(employees).forEach(uid => {
            const employee = employees[uid];
            options += `<option value="${uid}">${escapeHtml(employee.name)}</option>`;
        });
    }
    
    return options;
}

// Handle edit form submission
async function handleEditSubmit(event) {
    event.preventDefault();
    
    if (!currentKPIForEdit) return;
    
    showLoading(true);
    
    try {
        const formData = new FormData(event.target);
        const updatedData = {};
        
        for (let [key, value] of formData.entries()) {
            updatedData[key] = value;
        }
        
        // Convert numeric fields
        updatedData.target = parseFloat(updatedData.target) || 0;
        updatedData.current = parseFloat(updatedData.current) || 0;
        
        // Preserve existing data
        const kpiData = {
            ...currentKPIForEdit,
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        // Update in Firebase
        const kpiRef = ref(db, `kpis/${currentKPIForEdit.id}`);
        await update(kpiRef, kpiData);
        
        closeModal('editKPIModal');
        showSuccessModal('KPI updated successfully!');
        
    } catch (error) {
        console.error('Error updating KPI:', error);
        showErrorModal('Failed to update KPI. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Delete KPI
function deleteKPI(kpiId) {
    const kpi = allKPIs.find(k => k.id === kpiId);
    if (!kpi) return;
    
    currentKPIForDelete = kpi;
    
    // Reset modal to single delete mode
    resetDeleteModal();
    
    // Clear any bulk delete data
    window.currentEmployeeKPIsForDelete = null;
    
    document.getElementById('deleteKPISummary').innerHTML = `
        <div class="delete-summary">
            <strong>${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')}</strong>
            <div class="delete-details">
                <span>Category: ${escapeHtml(kpi.category || 'N/A')}</span>
                <span>Department: ${escapeHtml(kpi.department || 'N/A')}</span>
            </div>
        </div>
    `;
    
    openModal('deleteModal');
}

// Delete all KPIs for an employee
function deleteEmployeeKPIs(employeeId) {
    console.log('Deleting KPIs for employee:', employeeId);
    
    // Find all KPIs for this employee from filtered KPIs (user can only delete what they can see)
    const employeeKPIs = filteredKPIs.filter(kpi => {
        return kpi.employeeId === employeeId || 
               kpi.employee === employeeId || 
               kpi.assignedTo === employeeId;
    });
    
    console.log('Found KPIs for deletion:', employeeKPIs.length);
    
    if (employeeKPIs.length === 0) {
        showErrorModal('No KPIs found for this employee.');
        return;
    }
    
    // Get employee name from the first KPI or fallback to lookup
    let employeeName = 'Unknown Employee';
    if (employeeKPIs.length > 0 && employeeKPIs[0].employeeName) {
        employeeName = employeeKPIs[0].employeeName;
    } else {
        employeeName = getEmployeeName(employeeId);
    }
    
    // Store the employee KPIs for deletion
    window.currentEmployeeKPIsForDelete = {
        employeeId: employeeId,
        employeeName: employeeName,
        kpis: employeeKPIs
    };
    
    // Update the delete modal content for bulk deletion
    document.getElementById('deleteKPISummary').innerHTML = `
        <div class="delete-summary">
            <strong>Delete All KPIs for ${escapeHtml(employeeName)}</strong>
            <div class="delete-details">
                <span><i class="fas fa-exclamation-triangle text-warning"></i> This will delete ${employeeKPIs.length} KPI(s)</span>
                <div class="kpi-list-preview">
                    ${employeeKPIs.slice(0, 3).map(kpi => `
                        <div class="kpi-preview-item">
                            <i class="fas fa-chart-line"></i>
                            ${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')} (${escapeHtml(kpi.category || 'N/A')})
                        </div>
                    `).join('')}
                    ${employeeKPIs.length > 3 ? `<div class="kpi-preview-item"><i class="fas fa-ellipsis-h"></i> +${employeeKPIs.length - 3} more KPIs</div>` : ''}
                </div>
                <div class="warning-text">
                    <strong>Warning:</strong> This action cannot be undone. All KPI data, evaluations, and history will be permanently deleted.
                </div>
            </div>
        </div>
    `;
    
    // Update the delete modal title and button for bulk deletion
    document.querySelector('#deleteModal .modal-header h3').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Confirm Bulk Delete';
    const deleteButton = document.querySelector('#deleteModal .btn-danger');
    if (deleteButton) {
        deleteButton.setAttribute('onclick', 'confirmDelete()');
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete All KPIs';
    }
    
    openModal('deleteModal');
}

// Unified delete confirmation function
async function confirmDelete() {
    if (window.currentEmployeeKPIsForDelete) {
        // Bulk delete mode - delegate to confirmBulkDelete
        return confirmBulkDelete();
    } else if (currentKPIForDelete) {
        // Single delete mode
        console.log('Confirming single delete for KPI:', currentKPIForDelete.id);
        
        showLoading(true);
        
        try {
            // Use Firebase Realtime Database for consistency
            const kpiRef = ref(db, `kpis/${currentKPIForDelete.id}`);
            await remove(kpiRef);
            
            showSuccessModal('KPI deleted successfully!');
            
            // Remove from local array
            const index = allKPIs.findIndex(k => k.id === currentKPIForDelete.id);
            if (index !== -1) {
                allKPIs.splice(index, 1);
            }
            
            // Refresh the table
            updateTable();
            updatePagination();
            updateResultsCount();
            
            // Reset and close modal
            resetDeleteModal();
            closeModal('deleteModal');
            
        } catch (error) {
            console.error('Error deleting KPI:', error);
            showErrorModal('Error deleting KPI: ' + error.message);
        } finally {
            showLoading(false);
        }
    } else {
        console.error('No KPI selected for deletion');
        showErrorModal('No KPI selected for deletion');
        closeModal('deleteModal');
    }
}

// Confirm bulk delete for employee KPIs
async function confirmBulkDelete() {
    if (!window.currentEmployeeKPIsForDelete) {
        console.error('No employee KPIs data found for deletion');
        showErrorModal('No KPIs selected for deletion.');
        return;
    }
    
    const { employeeId, employeeName, kpis } = window.currentEmployeeKPIsForDelete;
    
    console.log('Starting bulk delete for:', {employeeId, employeeName, kpiCount: kpis.length});
    
    showLoading(true);
    
    try {
        // Delete all KPIs for this employee
        const deletePromises = kpis.map(kpi => {
            console.log('Deleting KPI:', kpi.id);
            const kpiRef = ref(db, `kpis/${kpi.id}`);
            return remove(kpiRef);
        });
        
        await Promise.all(deletePromises);
        
        console.log('Bulk delete completed successfully');
        
        closeModal('deleteModal');
        showSuccessModal(`Successfully deleted ${kpis.length} KPI(s) for ${employeeName}!`);
        
        // Reset the delete modal for single KPI deletion
        resetDeleteModal();
        
        // Clear the stored data
        window.currentEmployeeKPIsForDelete = null;
        
    } catch (error) {
        console.error('Error deleting employee KPIs:', error);
        showErrorModal(`Failed to delete KPIs: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Reset delete modal to single KPI deletion mode
function resetDeleteModal() {
    // Clear any bulk delete data
    window.currentEmployeeKPIsForDelete = null;
    currentKPIForDelete = null;
    
    // Reset modal title and button
    document.querySelector('#deleteModal .modal-header h3').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Confirm Delete';
    const deleteButton = document.querySelector('#deleteModal .btn-danger');
    if (deleteButton) {
        deleteButton.setAttribute('onclick', 'confirmDelete()');
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete KPI';
    }
    
    // Clear the summary
    const summaryElement = document.getElementById('deleteKPISummary');
    if (summaryElement) {
        summaryElement.innerHTML = '';
    }
}

// Export KPIs to CSV
function exportKPIs() {
    if (filteredKPIs.length === 0) {
        showErrorModal('No KPIs to export.');
        return;
    }
    
    const headers = [
        'Name', 'Category', 'Department', 'Status',
        'Metric Type', 'Frequency', 'Target', 'Current', 'Performance',
        'Start Date', 'End Date', 'Created', 'Created By', 'Description', 'Notes'
    ];
    
    const csvData = filteredKPIs.map(kpi => {
        const performance = calculatePerformance(kpi.current, kpi.thresholds);
        return [
            kpi.name || kpi.kpiName || '',
            kpi.category || '',
            kpi.department || '',
            kpi.status || '',
            kpi.metricType || '',
            kpi.frequency || '',
            kpi.target || '',
            kpi.current || '',
            performance.label,
            kpi.startDate || '',
            kpi.endDate || '',
            formatDate(kpi.createdAt),
            getCreatorName(kpi),
            kpi.description || '',
            kpi.notes || ''
        ].map(field => `"${field.toString().replace(/"/g, '""')}"`);
    });
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpis_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Refresh data
function refreshData() {
    loadKPIs();
    showSuccessModal('Data refreshed successfully!');
}

// Change items per page
function changeItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('itemsPerPage').value);
    currentPage = 1;
    updateTable();
    updatePagination();
    updateResultsCount();
}

// Update pagination
function updatePagination() {
    const groupedKPIs = groupKPIsByEmployee(filteredKPIs);
    const totalPages = Math.ceil(groupedKPIs.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="page-dots">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                    onclick="changePage(${i})">${i}</button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="page-dots">...</span>`;
        }
        paginationHTML += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    const groupedKPIs = groupKPIsByEmployee(filteredKPIs);
    const totalPages = Math.ceil(groupedKPIs.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    updateTable();
    updatePagination();
    updateResultsCount();
}

// Update results count
function updateResultsCount() {
    const groupedKPIs = groupKPIsByEmployee(filteredKPIs);
    const total = groupedKPIs.length;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + itemsPerPage - 1, total);
    
    const totalKPIs = filteredKPIs.length;
    
    document.getElementById('resultsCount').textContent = 
        total === 0 ? 'No employees found' : 
        total === 1 ? `1 employee (${totalKPIs} KPI${totalKPIs === 1 ? '' : 's'})` :
        `${start}-${end} of ${total} employees (${totalKPIs} KPI${totalKPIs === 1 ? '' : 's'} total)`;
}

// Filter KPIs for current user - only show KPIs created by user or assigned to user
function filterKPIsForCurrentUser(kpis) {
    try {
        // Get current user from auth manager
        const currentUser = window.authManager?.getUser();
        if (!currentUser || !currentUser.uid) {
            console.warn('No authenticated user found, showing no KPIs');
            return [];
        }
        
        console.log('Filtering KPIs for current user:', currentUser.uid);
        
        // Get list of direct reports (users who have current user as line manager)
        const directReportIds = getDirectReportIds(currentUser.uid);
        console.log(`Found ${directReportIds.length} direct reports for user ${currentUser.uid}:`, directReportIds);
        
        const filteredKPIs = kpis.filter(kpi => {
            // Check if KPI was created by current user
            const isCreatedByUser = isKPICreatedByUser(kpi, currentUser);
            
            // Check if KPI is assigned to current user
            const isAssignedToUser = kpi.employee === currentUser.uid;
            
            // Check if KPI is assigned to a direct report
            const isAssignedToDirectReport = directReportIds.includes(kpi.employee);
            
            // Include KPI if any condition is true
            return isCreatedByUser || isAssignedToUser || isAssignedToDirectReport;
        });
        
        console.log(`Filtered ${filteredKPIs.length} KPIs out of ${kpis.length} total for user ${currentUser.uid} (including direct reports)`);
        return filteredKPIs;
        
    } catch (error) {
        console.error('Error filtering KPIs for current user:', error);
        // In case of error, return empty array for security
        return [];
    }
}

// Check if KPI was created by the specified user
function isKPICreatedByUser(kpi, user) {
    if (!kpi || !user) return false;
    
    // Check various creator fields that might contain the user ID
    
    // 1. Check createdByInfo.uid (most reliable)
    if (kpi.createdByInfo && typeof kpi.createdByInfo === 'object' && kpi.createdByInfo.uid === user.uid) {
        return true;
    }
    
    // 2. Check createdBy as UID string
    if (typeof kpi.createdBy === 'string' && kpi.createdBy === user.uid) {
        return true;
    }
    
    // 3. Check createdBy as object with uid/id
    if (typeof kpi.createdBy === 'object' && kpi.createdBy !== null) {
        if (kpi.createdBy.uid === user.uid || kpi.createdBy.id === user.uid) {
            return true;
        }
    }
    
    // 4. Check by email if available
    if (user.email && kpi.createdBy === user.email) {
        return true;
    }
    
    // 5. Check createdByInfo.email
    if (kpi.createdByInfo && kpi.createdByInfo.email === user.email) {
        return true;
    }
    
    return false;
}

// Get direct report IDs for the current manager
function getDirectReportIds(managerId) {
    try {
        const directReportIds = [];
        
        // Check if employees data is loaded
        if (!employees || Object.keys(employees).length === 0) {
            console.warn('Employee data not loaded yet, cannot determine direct reports');
            return directReportIds;
        }
        
        // Find all users who have the current user as their line manager
        Object.entries(employees).forEach(([uid, userData]) => {
            if (userData && userData.lineManager === managerId) {
                directReportIds.push(uid);
                console.log(`Direct report found: ${userData.name} (${uid}) reports to ${managerId}`);
            }
        });
        
        return directReportIds;
    } catch (error) {
        console.error('Error getting direct report IDs:', error);
        return [];
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString();
    } catch {
        return 'N/A';
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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
    document.getElementById('successMessage').textContent = message;
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
window.exportKPIs = exportKPIs;
window.refreshData = refreshData;
window.viewKPI = viewKPI;
window.editKPI = editKPI;
window.deleteKPI = deleteKPI;
window.confirmDelete = confirmDelete;
// Make functions available globally for HTML onclick
window.deleteKPI = deleteKPI;
window.deleteEmployeeKPIs = deleteEmployeeKPIs;
window.confirmDelete = confirmDelete;
window.confirmBulkDelete = confirmBulkDelete;
window.resetDeleteModal = resetDeleteModal;
window.changePage = changePage;
window.closeModal = closeModal;
window.openModal = openModal;
window.showSuccessModal = showSuccessModal;
window.showErrorModal = showErrorModal;

// Employee KPI management functions
window.toggleEmployeeKPIs = toggleEmployeeKPIs;
window.viewEmployeeKPIs = viewEmployeeKPIs;
window.editEmployeeKPIs = editEmployeeKPIs;
window.deleteEmployeeKPIs = deleteEmployeeKPIs;

// Toggle employee KPIs visibility
function toggleEmployeeKPIs(employeeId) {
    const kpiRow = document.getElementById(`kpis-${employeeId}`);
    const toggleButton = document.querySelector(`[onclick="toggleEmployeeKPIs('${employeeId}')"] i`);
    
    if (kpiRow.style.display === 'none') {
        kpiRow.style.display = 'table-row';
        toggleButton.className = 'fas fa-chevron-up';
    } else {
        kpiRow.style.display = 'none';
        toggleButton.className = 'fas fa-chevron-down';
    }
}

// View all KPIs for an employee in a modal
function viewEmployeeKPIs(employeeId) {
    const employeeKPIs = filteredKPIs.filter(kpi => kpi.employee === employeeId);
    
    // Get employee name from the first KPI or fallback to lookup
    let employeeName = 'Unknown Employee';
    if (employeeKPIs.length > 0 && employeeKPIs[0].employeeName) {
        employeeName = employeeKPIs[0].employeeName;
    } else {
        employeeName = getEmployeeName(employeeId);
    }
    
    if (employeeKPIs.length === 0) {
        showErrorModal('No KPIs found for this employee.');
        return;
    }
    
    const content = generateEmployeeKPIModalContent(employeeName, employeeKPIs);
    document.getElementById('kpiDetailContent').innerHTML = content;
    
    // Show edit button for portfolio management and set up bulk edit
    const editBtn = document.getElementById('editKPIBtn');
    if (editBtn) {
        editBtn.style.display = 'inline-block'; // Make sure it's visible
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Manage Portfolio';
        editBtn.onclick = () => editEmployeeKPIs(employeeId);
    }
    
    openModal('kpiDetailModal');
}

// Generate content for employee KPI modal
function generateEmployeeKPIModalContent(employeeName, kpis) {
    const totalKPIs = kpis.length;
    const targetsAchieved = kpis.filter(kpi => 
        kpi.current && kpi.target && parseFloat(kpi.current) >= parseFloat(kpi.target)
    ).length;
    
    const avgPerformance = kpis
        .filter(kpi => kpi.current && kpi.target)
        .reduce((acc, kpi) => acc + (parseFloat(kpi.current) / parseFloat(kpi.target) * 100), 0) / 
        kpis.filter(kpi => kpi.current && kpi.target).length || 0;
    
    const categories = [...new Set(kpis.map(kpi => kpi.category).filter(Boolean))];
    
    return `
        <div class="employee-kpi-overview">
            <div class="employee-header">
                <h3><i class="fas fa-user"></i> ${escapeHtml(employeeName)}</h3>
                <div class="employee-stats">
                    <div class="stat-item">
                        <span class="stat-value">${totalKPIs}</span>
                        <span class="stat-label">Total KPIs</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${targetsAchieved}</span>
                        <span class="stat-label">Targets Achieved</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${Math.round(avgPerformance)}%</span>
                        <span class="stat-label">Avg Performance</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${categories.length}</span>
                        <span class="stat-label">Categories</span>
                    </div>
                </div>
            </div>
            
            <div class="employee-kpis-list">
                <h4>Individual KPIs</h4>
                <div class="kpi-cards-grid">
                    ${kpis.map(kpi => createKPICard(kpi)).join('')}
                </div>
            </div>
        </div>
    `;
}

// Create KPI card for modal view
function createKPICard(kpi) {
    const performance = calculatePerformance(kpi.current, kpi.thresholds);
    const progressPercentage = kpi.current && kpi.target ? 
        Math.min((parseFloat(kpi.current) / parseFloat(kpi.target)) * 100, 100) : 0;
    
    // Calculate variance percentage: (current - target) / target * 100
    const variancePercentage = kpi.current && kpi.target ? 
        ((parseFloat(kpi.current) - parseFloat(kpi.target)) / parseFloat(kpi.target)) * 100 : 0;
    
    return `
        <div class="kpi-modal-card">
            <div class="kpi-card-header">
                <h5>${escapeHtml(kpi.name || kpi.kpiName || 'Unnamed KPI')}</h5>
                <span class="category-badge small">${escapeHtml(kpi.category || 'N/A')}</span>
            </div>
            <div class="kpi-card-content">
                <div class="kpi-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${performance.class}" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Current: ${formatValue(kpi.current, kpi.metricType)}</span>
                        <span>Target: ${formatValue(kpi.target, kpi.metricType)}</span>
                        <span class="${variancePercentage >= 0 ? 'text-success' : 'text-danger'}">Variance: ${variancePercentage >= 0 ? '+' : ''}${variancePercentage.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="kpi-meta">
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHtml(kpi.frequency || 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-flag"></i>
                        <span>${escapeHtml(kpi.priority || 'N/A')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-circle status-${(kpi.status || '').toLowerCase()}"></i>
                        <span>${escapeHtml(kpi.status || 'N/A')}</span>
                    </div>
                </div>
                ${kpi.description ? `<p class="kpi-description">${escapeHtml(kpi.description)}</p>` : ''}
            </div>
            <div class="kpi-card-actions">
                <button class="btn-small btn-primary" onclick="viewKPI('${kpi.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-small btn-secondary" onclick="editKPI('${kpi.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
    `;
}

// Edit employee KPIs (redirect to KPI form with data)
function editEmployeeKPIs(employeeId) {
    const employeeKPIs = filteredKPIs.filter(kpi => kpi.employee === employeeId);
    
    // Get employee name with multiple fallback strategies
    let employeeName = 'Unknown Employee';
    
    // Strategy 1: Get from first KPI's stored employeeName
    if (employeeKPIs.length > 0 && employeeKPIs[0].employeeName) {
        employeeName = employeeKPIs[0].employeeName;
    } 
    // Strategy 2: Lookup from loaded employees cache
    else if (employeeId && employees && employees[employeeId]) {
        employeeName = employees[employeeId].name;
    }
    // Strategy 3: Fallback to getEmployeeName function
    else {
        const fallbackName = getEmployeeName(employeeId);
        if (fallbackName !== 'Unknown Employee') {
            employeeName = fallbackName;
        }
    }
    
    // Strategy 4: Last resort - try to find employee name from the grouped display
    if (employeeName === 'Unknown Employee') {
        const employeeRow = document.querySelector(`tr[data-employee-id="${employeeId}"] .employee-info span`);
        if (employeeRow && employeeRow.textContent.trim()) {
            employeeName = employeeRow.textContent.trim();
        }
    }
    
    console.log('Editing KPIs for employee:', { employeeId, employeeName, kpiCount: employeeKPIs.length });
    
    if (employeeKPIs.length === 0) {
        showErrorModal('No KPIs found for this employee.');
        return;
    }
    
    // Prepare data for the KPI form
    const editData = {
        mode: 'edit',
        employeeId: employeeId,
        employeeName: employeeName,
        kpis: employeeKPIs.map(kpi => ({
            id: kpi.id,
            name: kpi.name || kpi.kpiName,
            category: kpi.category,
            metricType: kpi.metricType,
            frequency: kpi.frequency,
            target: kpi.target,
            current: kpi.current,
            description: kpi.description,
            createdAt: kpi.createdAt,
            updatedAt: kpi.updatedAt
        }))
    };
    
    // Store data in sessionStorage for the KPI form to retrieve
    sessionStorage.setItem('kpiEditData', JSON.stringify(editData));
    
    console.log('Stored edit data for KPI form:', editData);
    
    // Redirect to KPI form
    window.location.href = 'kpi.html?mode=edit&employee=' + encodeURIComponent(employeeId);
}

// Bulk update functions (placeholders for now)
function bulkUpdateStatus(employeeId) {
    showErrorModal('Bulk status update feature will be implemented in a future update.');
}

function bulkUpdatePriority(employeeId) {
    showErrorModal('Bulk priority update feature will be implemented in a future update.');
}

function bulkUpdateCategory(employeeId) {
    showErrorModal('Bulk category update feature will be implemented in a future update.');
}

function bulkUpdateValues(employeeId) {
    showErrorModal('Bulk values update feature will be implemented in a future update.');
}
