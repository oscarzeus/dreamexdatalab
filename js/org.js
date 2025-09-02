// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

class OrganizationChart {
    constructor() {
        this.departments = new Map();
        this.employees = {};
        this.currentScale = 1;
        
        // Initialize elements
        this.searchInput = document.getElementById('searchEmployee');
        this.orgChartContainer = document.getElementById('orgChart');
        this.departmentLevel = document.getElementById('departmentLevel');
        this.hodLevel = document.getElementById('hodLevel');
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        this.db = getDatabase(app);
        this.auth = getAuth(app);
        
        // Initialize zoom controls and load data
        this.initializeZoomControls();
        this.loadDepartmentsAndEmployees();
        this.setupEventListeners();
    }

    initializeZoomControls() {
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(-0.1));
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());
    }
    
    zoom(delta) {
        this.currentScale = Math.min(Math.max(0.5, this.currentScale + delta), 2);
        this.orgChartContainer.style.transform = `scale(${this.currentScale})`;
    }
    
    resetZoom() {
        this.currentScale = 1;
        this.orgChartContainer.style.transform = 'scale(1)';
    }

    loadDepartmentsAndEmployees() {
        const usersRef = ref(this.db, 'users');
        const deptConfigRef = ref(this.db, 'fieldOptions/department');
        
        // Get both users and department configurations
        Promise.all([
            get(usersRef),
            get(deptConfigRef)
        ]).then(([usersSnapshot, deptConfigSnapshot]) => {
            this.employees = {};
            this.departments.clear();
            
            // Create a map of department configurations
            const deptConfigs = new Map();
            if (deptConfigSnapshot.exists()) {
                deptConfigSnapshot.forEach((deptSnapshot) => {
                    const dept = deptSnapshot.val();
                    if (dept.value) {
                        deptConfigs.set(dept.value, {
                            headOfDepartmentName: dept.headOfDepartmentName || null,
                            headOfDepartment: dept.headOfDepartment || null,
                            label: dept.label || dept.value
                        });
                        console.log(`Department config for ${dept.value}:`, {
                            headOfDepartment: dept.headOfDepartment,
                            label: dept.label || dept.value
                        });
                    }
                });
            }
            
            // First pass: collect all employees
            usersSnapshot.forEach((childSnapshot) => {
                const employee = childSnapshot.val();
                if (employee.firstName && employee.lastName) {
                    this.employees[childSnapshot.key] = {
                        id: childSnapshot.key,
                        ...employee
                    };
                }
            });
            
            // Second pass: organize departments and establish relationships
            Object.values(this.employees).forEach(employee => {
                if (employee.department) {
                    if (!this.departments.has(employee.department)) {
                        const deptConfig = deptConfigs.get(employee.department) || {};
                        this.departments.set(employee.department, {
                            name: deptConfig.label || employee.department,
                            headOfDepartment: null,
                            headOfDepartmentName: deptConfig.headOfDepartmentName || null,
                            employees: []
                        });
                    }
                    
                    const dept = this.departments.get(employee.department);
                    dept.employees.push(employee);
                    
                    // If this employee is the head of department from config
                    const deptConfig = deptConfigs.get(employee.department);
                    if (deptConfig && deptConfig.headOfDepartment === employee.id) {
                        console.log(`Setting ${employee.firstName} ${employee.lastName} as head of department ${dept.name}`);
                        dept.headOfDepartment = employee;
                        // Note: We do NOT set line managers here - line managers are set individually in user records
                    }
                }
            });

            // Log all line manager relationships for debugging
            console.log('=== Line Manager Relationships ===');
            Object.values(this.employees).forEach(employee => {
                if (employee.lineManager) {
                    const manager = this.employees[employee.lineManager];
                    if (manager) {
                        console.log(`${employee.firstName} ${employee.lastName} reports to ${manager.firstName} ${manager.lastName} (ID: ${employee.lineManager})`);
                    } else {
                        console.log(`${employee.firstName} ${employee.lastName} has line manager ID ${employee.lineManager} but manager not found`);
                    }
                } else {
                    console.log(`${employee.firstName} ${employee.lastName} has no line manager`);
                }
            });

            // Log all direct reports for each potential manager
            console.log('=== Direct Reports Summary ===');
            Object.values(this.employees).forEach(potentialManager => {
                const directReports = Object.values(this.employees).filter(emp => 
                    emp.lineManager === potentialManager.id
                );
                if (directReports.length > 0) {
                    console.log(`${potentialManager.firstName} ${potentialManager.lastName} has ${directReports.length} direct reports:`, 
                        directReports.map(emp => `${emp.firstName} ${emp.lastName}`));
                }
            });

            // Log all direct reports for each department head
            this.departments.forEach((dept, deptName) => {
                if (dept.headOfDepartment) {
                    const directReports = Object.values(this.employees).filter(emp => 
                        emp.lineManager === dept.headOfDepartment.id
                    );
                    console.log(`Direct reports for HoD ${dept.headOfDepartment.firstName} ${dept.headOfDepartment.lastName} (${deptName}):`, 
                        directReports.map(emp => `${emp.firstName} ${emp.lastName}`));
                }
            });
            
            this.renderOrganizationChart();
        });
    }
    
    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    }
    
    handleSearch(searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        const deptNodes = document.querySelectorAll('.dept-node');
        const hodNodes = document.querySelectorAll('.hod-node');
        
        deptNodes.forEach(node => {
            const name = node.querySelector('.dept-name').textContent.toLowerCase();
            const matches = name.includes(searchTerm);
            node.style.display = matches ? '' : 'none';
        });
        
        hodNodes.forEach(node => {
            const name = node.querySelector('.hod-name').textContent.toLowerCase();
            const title = node.querySelector('.hod-title').textContent.toLowerCase();
            const matches = name.includes(searchTerm) || title.includes(searchTerm);
            node.style.display = matches ? '' : 'none';
        });
    }
    
    getDepartmentNodeHTML(department) {
        return `
            <div class="dept-node ${department.name.toLowerCase().replace(/\s+/g, '-')}">
                <div class="dept-name">${department.name}</div>
                <div class="dept-employee-count">${department.employees.length} employees</div>
            </div>
        `;
    }
    
    getHodNodeHTML(department) {
        const hod = department.headOfDepartment;
        const hodName = hod ? 
            `${hod.firstName} ${hod.lastName}` : 
            (department.headOfDepartmentName || 'No Head of Department');
        
        // Find direct reports - employees who have this person as their line manager in the database
        let directReports = [];
        if (hod) {
            directReports = Object.values(this.employees).filter(employee => {
                // Use the actual lineManager field from the database
                return employee.lineManager === hod.id;
            });
            
            // Debug log for this specific manager
            console.log(`Direct reports for ${hodName}:`, directReports.map(emp => `${emp.firstName} ${emp.lastName} (lineManager: ${emp.lineManager})`));
        }
        
        // Generate direct reports HTML
        const directReportsHTML = directReports.length > 0 ? `
            <div class="direct-reports">
                <div class="direct-reports-title">Direct Reports (${directReports.length})</div>
                ${directReports.map(employee => `
                    <div class="direct-report">
                        <div class="direct-report-avatar">
                            ${employee.firstName[0]}${employee.lastName[0]}
                        </div>
                        <div class="direct-report-info">
                            <div class="direct-report-name">${employee.firstName} ${employee.lastName}</div>
                            <div class="direct-report-title">${employee.jobTitle || ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="direct-reports">
                <div class="direct-reports-title">No Direct Reports</div>
            </div>
        `;

        return `
            <div class="dept-node ${department.name.toLowerCase().replace(/\s+/g, '-')}">
                <div class="hod-node">
                    <div class="hod-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="hod-info">
                        <div class="hod-name">${hodName}</div>
                        <div class="hod-title">Head of ${department.name}</div>
                    </div>
                </div>
                ${directReportsHTML}
            </div>
        `;
    }
    
    renderOrganizationChart() {
        if (!this.departmentLevel || !this.hodLevel) return;
        
        // Clear previous content
        this.departmentLevel.innerHTML = '';
        this.hodLevel.innerHTML = '';
        
        // Render departments and their heads
        this.departments.forEach(department => {
            // Add department to first level
            const deptHTML = this.getDepartmentNodeHTML(department);
            this.departmentLevel.insertAdjacentHTML('beforeend', deptHTML);
            
            // Add head of department to second level
            const hodHTML = this.getHodNodeHTML(department);
            this.hodLevel.insertAdjacentHTML('beforeend', hodHTML);
        });
    }
}

// Initialize the organization chart when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.orgChart = new OrganizationChart();
});