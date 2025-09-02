import { getDatabase, ref, onValue, remove, update, get, push, set, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import companyDataService from './company-data-service.js';

// Global tab switching function
function switchToTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-nav-btn');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // Show selected tab content and activate button
    const selectedContent = document.getElementById(`${tabName}TabContent`);
    const selectedButton = document.getElementById(`${tabName}TabBtn`);
    
    if (selectedContent) selectedContent.classList.add('active');
    if (selectedButton) selectedButton.classList.add('active');
    
    // Initialize tab specific functionality
    if (tabName === 'departments') {
        if (window.companyBoard) {
            window.companyBoard.initializeDepartmentsTab();
        }
    }
}

// Make switchToTab available globally
window.switchToTab = switchToTab;

class CompanyBoard {    constructor() {
        this.db = getDatabase();
        this.auth = getAuth();
        this.companyDataService = companyDataService;
        this.companiesRef = ref(this.db, 'companies');
        this.departmentsRef = ref(this.db, 'departments');
        this.usersRef = ref(this.db, 'users');
        this.approvalFlowsRef = ref(this.db, 'approvalFlows/company_creation');
        this.tbody = document.getElementById('companiesTableBody');
        this.searchInput = document.getElementById('searchInput');
        this.statusFilter = document.getElementById('statusFilter');
        this.typeFilter = document.getElementById('typeFilter');
        this.industryFilter = document.getElementById('industryFilter');
        this.modal = document.getElementById('companyModal');
        this.departmentModal = document.getElementById('departmentModal');
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.companies = [];
        this.departments = [];
        this.users = [];
        this.locations = [];
        this.filteredCompanies = [];
        this.filteredDepartments = [];
        this.selectedCompanyId = null;
        this.currentUser = null;
        this.clickTimeout = null;

        // Get current user
        const auth = getAuth();
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                await this.companyDataService.initializeUserContext();
                await this.loadCompanies();
                await this.loadDepartments();
                await this.loadUsers();
                await this.loadLocations();
            }
        });

        this.initializeEventListeners();
        this.initializeDepartmentEventListeners();
    }

    initializeEventListeners() {
        this.searchInput.addEventListener('input', () => this.filterCompanies());
        this.statusFilter.addEventListener('change', () => this.filterCompanies());
        this.typeFilter.addEventListener('change', () => this.filterCompanies());
        this.industryFilter.addEventListener('change', () => this.filterCompanies());
        
        // Modal events
        const closeModalBtn = document.querySelector('.close-modal');
        const closeBtn = document.getElementById('closeModal');
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));
        
        // Add click event listener for the entire table
        this.tbody.addEventListener('click', (e) => this.handleTableClick(e));
        this.tbody.addEventListener('dblclick', (e) => this.handleTableDoubleClick(e));
    }

    handleTableClick(e) {
        const row = e.target.closest('tr');
        if (!row) return;

        const companyId = row.dataset.companyId;
        if (!companyId) return;

        // If clicked element is a button, don't show modal
        if (e.target.closest('button')) {
            return;
        }

        // Use setTimeout to delay single click action to allow double-click detection
        this.clickTimeout = setTimeout(() => {
            // Show modal with company details (single click)
            const company = this.companies.find(c => c.id === companyId);
            if (company) {
                this.showModal(company);
            }
        }, 250); // 250ms delay to detect double-click
    }

    handleTableDoubleClick(e) {
        const row = e.target.closest('tr');
        if (!row) return;

        const companyId = row.dataset.companyId;
        if (!companyId) return;

        // If clicked element is a button, don't proceed
        if (e.target.closest('button')) {
            return;
        }

        // Clear the single click timeout
        if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
        }

        // Add visual feedback
        row.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 300);

        // Find the company and switch to departments tab
        const company = this.companies.find(c => c.id === companyId);
        if (company) {
            console.log(`Double-clicked on company: ${company.companyName}`);
            this.switchToCompanyDepartments(company);
        }
    }

    switchToCompanyDepartments(company) {
        // Switch to departments tab
        window.switchToTab('departments');
        
        // Scroll to top for better user experience
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Ensure the departments tab is properly initialized and company dropdown is populated
        setTimeout(() => {
            this.populateCompanySelect();
            
            // Set the company in the dropdown
            const companySelectFilter = document.getElementById('companySelectFilter');
            if (companySelectFilter) {
                companySelectFilter.value = company.id;
                
                // Trigger the company selection with a visual indication
                this.selectCompanyForDepartments(company.id);
                
                // Add a subtle highlight to show the company was selected
                companySelectFilter.style.borderColor = '#007bff';
                companySelectFilter.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                
                setTimeout(() => {
                    companySelectFilter.style.borderColor = '';
                    companySelectFilter.style.boxShadow = '';
                }, 1500);
            }
        }, 100);
    }

    async loadCompanies() {
        await this.companyDataService.initializeUserContext();
        const currentCompanyId = this.companyDataService.getCurrentCompanyId();
        
        if (!currentCompanyId) {
            console.error('No company context available');
            this.companies = [];
            this.filterCompanies();
            return;
        }

        // Load only the current user's company
        const companyRef = ref(this.db, `companies/${currentCompanyId}`);
        onValue(companyRef, (snapshot) => {
            this.companies = [];
            if (snapshot.exists()) {
                const company = snapshot.val();
                company.id = currentCompanyId; // Add the ID to the company object
                this.companies.push(company);
            }
            this.filterCompanies();
        });
    }    async filterCompanies() {
        let filtered = [...this.companies];

        // First filter by permissions
        const currentUser = this.auth.currentUser;
        if (currentUser) {
            const viewableCompanies = [];
            for (const company of filtered) {
                if (await window.canViewCompany(company, currentUser)) {
                    viewableCompanies.push(company);
                }
            }
            filtered = viewableCompanies;
        } else {
            filtered = [];
        }
        
        // Apply search filter
        const searchTerm = this.searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(company => 
                company.companyName.toLowerCase().includes(searchTerm) ||
                company.companyRegistration.toLowerCase().includes(searchTerm)
            );
        }

        // Apply status filter
        const statusValue = this.statusFilter.value;
        if (statusValue !== 'all') {
            filtered = filtered.filter(company => company.status === statusValue);
        }        // Apply type filter
        const typeValue = this.typeFilter.value;
        if (typeValue !== 'all') {
            filtered = filtered.filter(company => company.companyType === typeValue);
        }

        // Apply industry filter
        const industryValue = this.industryFilter.value;
        if (industryValue !== 'all') {
            filtered = filtered.filter(company => company.industry === industryValue);
        }

        // Sort by created date
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        this.renderCompanies(filtered);
    }

    async renderCompanies(companies) {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginatedCompanies = companies.slice(start, end);
        
        this.tbody.innerHTML = '';
        
        for (const company of paginatedCompanies) {
            const row = document.createElement('tr');
            
            // Set data attribute for company ID
            row.dataset.companyId = company.id;
            
            const createdDate = new Date(company.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            // Get requestor info if available
            let requestorName = '-';
            if (company.requestedBy) {
                const requestorSnapshot = await get(ref(this.db, `users/${company.requestedBy}`));
                if (requestorSnapshot.exists()) {
                    const requestor = requestorSnapshot.val();
                    requestorName = `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim() || requestor.email;
                }
            }
            
            // Format company type
            const companyTypeClass = company.companyType === 'main' ? 'status-badge-approved' : 'status-badge-pending';
            const companyTypeText = company.companyType ? company.companyType.charAt(0).toUpperCase() + company.companyType.slice(1) : '-';
            
            row.innerHTML = `
                <td>${company.companyName}</td>
                <td><span class="status-badge ${companyTypeClass}">${companyTypeText}</span></td>
                <td>${company.companyRegistration}</td>
                <td>${company.industry}</td>
                <td>${company.country}</td>
                <td>${company.subscriptionPlan}</td>
                <td>${createdDate}</td>
                <td>${requestorName}</td>
                <td>
                    <span class="status-badge ${this.getStatusClass(company)}">
                        ${this.getCompanyStatus(company)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-view" onclick="companyBoard.viewCompany('${company.id}')" 
                                data-feature="company_management_view" data-action="view">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-edit" onclick="companyBoard.editCompany('${company.id}')" 
                                data-feature="company_management_view" data-action="edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="companyBoard.deleteCompany('${company.id}')" 
                                data-feature="company_management_view" data-action="delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            this.tbody.appendChild(row);
        }

        // Update pagination info
        const totalPages = Math.ceil(companies.length / this.itemsPerPage);
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;

        // Update stats
        this.updateStats();
    }

    updateStats() {
        const totalCompanies = this.companies.length;
        const activeCompanies = this.companies.filter(company => 
            this.getCompanyStatus(company) === 'Active'
        ).length;
        const pendingCompanies = this.companies.filter(company => 
            this.getCompanyStatus(company) === 'Pending'
        ).length;

        const totalEl = document.getElementById('totalCompanies');
        const activeEl = document.getElementById('activeCompanies');
        const pendingEl = document.getElementById('pendingCompanies');

        if (totalEl) totalEl.textContent = totalCompanies;
        if (activeEl) activeEl.textContent = activeCompanies;
        if (pendingEl) pendingEl.textContent = pendingCompanies;
    }

    getStatusClass(company) {
        const today = new Date();
        const endDate = new Date(company.subscriptionEndDate);
        
        if (endDate < today) {
            return 'status-inactive';
        }
        return 'status-active';
    }

    getCompanyStatus(company) {
        const today = new Date();
        const endDate = new Date(company.subscriptionEndDate);
        
        if (endDate < today) {
            return 'Inactive';
        }
        return 'Active';
    }

    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.ceil(this.companies.length / this.itemsPerPage);
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.filterCompanies();
        }
    }

    async renderApprovalFlow(company) {
        try {
            const flowRef = ref(this.db, 'approvalFlows/company_creation');
            const flowSnapshot = await get(flowRef);
            if (!flowSnapshot.exists()) return '';

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            const isSequential = flow.approvalOrder === 'sequential';

            let flowHTML = `
                <div class="detail-section">
                    <h3><i class="fas fa-tasks"></i> Approval Flow</h3>
                    <div class="approval-flow-container">
                        <div class="approval-type">
                            <i class="fas fa-${isSequential ? 'stream' : 'random'}"></i>
                            ${isSequential ? 'Sequential Approval' : 'Parallel Approval'}
                        </div>
                        <div class="approval-levels">`;

            // For each level in the approval flow
            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                const levelNumber = parseInt(levelKey.replace('level', ''));
                const currentLevel = company.approvals?.[levelKey];
                const status = currentLevel?.isCompleted ? 'approved' : 'waiting';
                
                // Get approver details
                let approverInfos = [];
                for (const role of roles) {
                    let approverInfo = { name: 'Not assigned', title: '', department: '' };
                    
                    if (role.value.startsWith('user_')) {
                        const userId = role.value.replace('user_', '');
                        const approverSnapshot = await get(ref(this.db, `users/${userId}`));
                        if (approverSnapshot.exists()) {
                            const approver = approverSnapshot.val();
                            approverInfo = {
                                name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || approver.email,
                                title: approver.jobTitle || '',
                                department: approver.department || ''
                            };
                        }
                    } else if (role.value.startsWith('function_')) {
                        // Get the function name and properly format it
                        const functionName = role.value.replace('function_', '');
                        const formattedName = functionName
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');
                        
                        approverInfo = {
                            name: formattedName,
                            title: 'Function',
                            department: role.department || ''
                        };
                    } else if (role.value === 'L+1' && company.requestedBy) {
                        // Get the requestor's line manager
                        const requestorSnapshot = await get(ref(this.db, `users/${company.requestedBy}`));
                        if (requestorSnapshot.exists()) {
                            const requestor = requestorSnapshot.val();
                            if (requestor.lineManager) {
                                const lineManagerSnapshot = await get(ref(this.db, `users/${requestor.lineManager}`));
                                if (lineManagerSnapshot.exists()) {
                                    const lineManager = lineManagerSnapshot.val();
                                    approverInfo = {
                                        name: `${lineManager.firstName || ''} ${lineManager.lastName || ''}`.trim() || lineManager.email,
                                        title: lineManager.jobTitle || 'Line Manager',
                                        department: lineManager.department || ''
                                    };
                                }
                            }
                        }
                    }
                    approverInfos.push(approverInfo);
                }

                // Also log the whole array of roles for this level to see complete structure
                console.log(`Full roles data for Level ${levelNumber}:`, JSON.stringify(roles));

                flowHTML += `
                    <div class="approval-level ${status === 'waiting' ? 'locked' : ''} ${status === 'approved' ? 'approved' : ''}">
                        <div class="level-content">
                            <div class="level-header">
                                <span class="level-number">Level ${levelNumber}</span>
                                <span class="status-badge status-${status}">
                                    <i class="fas fa-${status === 'approved' ? 'check' : 
                                                     status === 'rejected' ? 'times' : 
                                                     'clock'}"></i>
                                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                            </div>
                            ${approverInfos.map(approverInfo => `
                                <div class="approver-info">
                                    <div class="approver-avatar">
                                        ${approverInfo.name !== 'Not assigned' ? approverInfo.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                                    </div>
                                    <div class="approver-details">
                                        <span class="approver-name">${approverInfo.name}</span>
                                        ${approverInfo.title ? `
                                            <span class="approver-title">${approverInfo.title}${approverInfo.department ? ` - ${approverInfo.department}` : ''}</span>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                            ${currentLevel?.comments ? `
                                <div class="approval-comments">
                                    <i class="fas fa-comment-alt"></i>
                                    <p>${currentLevel.comments}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            flowHTML += `
                        </div>
                    </div>
                </div>`;

            return flowHTML;
        } catch (error) {
            console.error('Error rendering approval flow:', error);
            return '';
        }
    }

    async showModal(company) {
        const modalBody = this.modal.querySelector('.modal-body');
        const createdDate = new Date(company.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        // Format subscription dates if available
        const subscriptionStart = company.subscriptionStartDate ? new Date(company.subscriptionStartDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '-';
        
        const subscriptionEnd = company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '-';
        
        // Set the company ID in the modal's dataset
        this.modal.dataset.companyId = company.id;
        
        // Update header
        const modalHeader = this.modal.querySelector('.modal-header');
        modalHeader.innerHTML = `
            <div class="header-content">
                <h2><i class="fas fa-building"></i> ${company.companyName}</h2>
                <div class="approval-status">
                    ${this.getApprovalBadge(company)}
                </div>
            </div>
            <button class="close-modal">&times;</button>
        `;
        
        // Get approval flow HTML
        const approvalFlowHTML = await this.renderApprovalFlow(company);
        
        // Render the company details
        modalBody.innerHTML = `
            <div class="company-details">
                <!-- Basic Company Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-info-circle"></i> Basic Information</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-id-card"></i> Registration Number</label>
                            <span>${company.companyRegistration}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-industry"></i> Industry</label>
                            <span>${company.industry}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-check-circle"></i> Status</label>
                            <span class="status-badge ${this.getStatusClass(company)}">${this.getCompanyStatus(company)}</span>
                        </div>
                        ${company.website ? `
                        <div class="detail-group">
                            <label><i class="fas fa-link"></i> Website</label>
                            <span><a href="${company.website}" target="_blank">${company.website}</a></span>
                        </div>` : ''}
                    </div>
                </div>
                
                <!-- Location Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-globe"></i> Country</label>
                            <span>${company.country || '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-city"></i> City</label>
                            <span>${company.city || '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-map-marked-alt"></i> Address</label>
                            <span>${company.address || '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-mail-bulk"></i> Postal Code</label>
                            <span>${company.postalCode || '-'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Contact Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-address-card"></i> Contact Information</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-user"></i> Name</label>
                            <span>${company.contactName || '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-envelope"></i> Email</label>
                            <span>${company.contactEmail ? `<a href="mailto:${company.contactEmail}">${company.contactEmail}</a>` : '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-phone"></i> Phone</label>
                            <span>${company.contactPhone || '-'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Subscription Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-file-invoice-dollar"></i> Subscription</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-tag"></i> Plan</label>
                            <span>${company.subscriptionPlan || '-'}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-calendar-plus"></i> Start Date</label>
                            <span>${subscriptionStart}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-calendar-times"></i> End Date</label>
                            <span>${subscriptionEnd}</span>
                        </div>
                        <div class="detail-group">
                            <label><i class="fas fa-users"></i> Maximum Users</label>
                            <span>${company.maxUsers || '-'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Domain Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-at"></i> Domain</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-at"></i> Primary Domain</label>
                            <span>${company.primaryDomain || '-'}</span>
                        </div>
                        ${company.additionalDomains ? `
                        <div class="detail-group">
                            <label><i class="fas fa-network-wired"></i> Additional Domains</label>
                            <span>${this.formatAdditionalDomains(company.additionalDomains)}</span>
                        </div>` : ''}
                    </div>
                </div>
                
                <!-- System Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-cogs"></i> System Information</h3>
                    <div class="section-content">
                        <div class="detail-group">
                            <label><i class="fas fa-clock"></i> Created At</label>
                            <span>${createdDate}</span>
                        </div>
                        ${company.notes ? `
                        <div class="detail-group">
                            <label><i class="fas fa-sticky-note"></i> Notes</label>
                            <span>${company.notes}</span>
                        </div>` : ''}
                    </div>
                </div>
                
                <!-- Approval Flow Section -->
                ${approvalFlowHTML}
                
                <!-- Approval History -->
                ${this.getApprovalHistory(company)}
            </div>
        `;

        // Add the action buttons to the modal footer
        const modalFooter = this.modal.querySelector('.modal-footer');
        
        // Check role-based permissions and approver status
        const hasEditPermission = window.roleManager?.hasPermission('company_management_view', 'edit');
        const hasApprovePermission = window.roleManager?.hasPermission('company_management_view', 'approve');
        const hasDeclinePermission = window.roleManager?.hasPermission('company_management_view', 'decline');
        const hasDeletePermission = window.roleManager?.hasPermission('company_management_view', 'delete');
        const hasExportPermission = window.roleManager?.hasPermission('company_management_view', 'export');
        
        // Check if user is an approver
        const isApprover = await this.isUserCompanyApprover();
        
        // Show buttons based on either role permissions or approver status and company status
        const buttons = [];
        
        // Get user's job title
        const currentUser = this.auth.currentUser;
        let userJobTitle = null;
        if (currentUser) {
            const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
            if (userSnapshot.exists()) {
                userJobTitle = userSnapshot.val().jobTitle?.toLowerCase();
            }
        }

        // Fetch approval flow and check if user's job title matches any approver role
        let isJobTitleApprover = false;
        const approvalFlowSnapshot = await get(this.approvalFlowsRef);
        if (approvalFlowSnapshot.exists() && userJobTitle) {
            const flow = approvalFlowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};
            
            // Check each level for function-based roles
            for (const levelRoles of Object.values(selectedRoles)) {
                for (const role of levelRoles) {
                    if (role.value.startsWith('function_')) {
                        const functionId = role.value.replace('function_', '');
                        if (functionId.toLowerCase() === userJobTitle) {
                            isJobTitleApprover = true;
                            break;
                        }
                    }
                }
                if (isJobTitleApprover) break;
            }
        }

        // Update button visibility logic to include isJobTitleApprover
        if (hasEditPermission || isApprover || isJobTitleApprover) {
            buttons.push(`
                <button class="btn btn-edit" id="editCompany" data-feature="company_management_view" data-action="edit">
                    <i class="fas fa-edit"></i> Edit
                </button>
            `);
        }
        
        // Only show approve/decline buttons if status is pending or under review
        if ((hasApprovePermission || isApprover || isJobTitleApprover) && 
            company.status !== 'approved' && 
            company.status !== 'declined') {
            buttons.push(`
                <button class="btn btn-success" id="approveCompany" data-feature="company_management_view" data-action="approve">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-danger" id="declineCompany" data-feature="company_management_view" data-action="decline">
                    <i class="fas fa-times"></i> Decline
                </button>
            `);
        }

        // Delete button - requires explicit delete permission
        if (hasDeletePermission) {
            buttons.push(`
                <button class="btn btn-delete" id="deleteCompany" data-feature="company_management_view" data-action="delete">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `);
        }

        // Export button - requires explicit export permission
        if (hasExportPermission) {
            buttons.push(`
                <button class="btn btn-secondary" id="exportCompany" data-feature="company_management_view" data-action="export">
                    <i class="fas fa-file-export"></i> Export
                </button>
            `);
        }

        // Always add close button
        buttons.push(`
            <button class="btn btn-secondary" id="closeModal">Close</button>
        `);
        
        modalFooter.innerHTML = buttons.join('');

        // Add event handlers for modal buttons with proper binding
        const currentCompanyId = company.id; // Store company ID in closure

        if (hasEditPermission || isApprover || isJobTitleApprover) {
            const editBtn = document.getElementById('editCompany');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editCompany(currentCompanyId));
            }
        }
        
        if ((hasApprovePermission || isApprover || isJobTitleApprover) && company.status !== 'approved' && company.status !== 'declined') {
            const approveBtn = document.getElementById('approveCompany');
            if (approveBtn) {
                approveBtn.addEventListener('click', () => this.approveCompany(currentCompanyId));
            }
            
            const declineBtn = document.getElementById('declineCompany');
            if (declineBtn) {
                declineBtn.addEventListener('click', () => this.declineCompany(currentCompanyId));
            }
        }
        
        if (hasDeletePermission) {
            document.getElementById('deleteCompany')?.addEventListener('click', () => this.deleteCompany(company.id));
        }
        
        if (hasExportPermission) {
            document.getElementById('exportCompany')?.addEventListener('click', () => this.exportCompany(company));
        }
        
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());

        // Show the modal with animation
        this.modal.classList.add('show');
        
        // Get approval flow to check if it's sequential and current user's level
        const flowSnapshot = await get(this.approvalFlowsRef);
        if (flowSnapshot.exists()) {
            const flow = flowSnapshot.val();
            const isSequential = flow.approvalOrder === 'sequential';
            
            if (isSequential) {
                // Get the current user's job title
                const currentUser = this.auth.currentUser;
                let userJobTitle = null;
                let userLevel = null;
                
                if (currentUser) {
                    const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
                    if (userSnapshot.exists()) {
                        userJobTitle = userSnapshot.val().jobTitle?.toLowerCase();
                        
                        // Find the user's level in the approval flow
                        const selectedRoles = flow.selectedRoles || {};
                        for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                            const role = roles[0]; // We expect only one role per level
                            if (role) {
                                if (role.value === `user_${currentUser.uid}` || 
                                    (role.value.startsWith('function_') && 
                                    role.value.replace('function_', '').toLowerCase() === userJobTitle)) {
                                    userLevel = levelKey;
                                    break;
                                }
                            }
                        }
                        
                        // If user is level 2+ approver, check if level 1 has approved
                        if (userLevel) {
                            const levelNumber = parseInt(userLevel.replace('level', ''));
                            if (levelNumber > 1) {
                                // Check if previous levels are approved
                                let previousLevelApproved = true;
                                for (let i = 1; i < levelNumber; i++) {
                                    const previousLevel = `level${i}`;
                                    if (!company.approvals?.[previousLevel]?.isCompleted) {
                                        previousLevelApproved = false;
                                        break;
                                    }
                                }
                                
                                // If previous levels are not fully approved, disable the approve button
                                if (!previousLevelApproved) {
                                    const approveBtn = document.getElementById('approveCompany');
                                    if (approveBtn) {
                                        approveBtn.disabled = true;
                                        approveBtn.classList.add('btn-disabled');
                                        approveBtn.title = 'Previous approval levels must be completed first';
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Ensure smooth scrolling behavior
        const modalBodyElement = this.modal.querySelector('.modal-body');
        if (modalBodyElement) {
            modalBodyElement.style.scrollBehavior = 'smooth';
        }
    }
    
    formatAdditionalDomains(domains) {
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return '-';
        }
        
        return domains.map(domain => `<div>${domain}</div>`).join('');
    }

    getApprovalBadge(company) {
        // Check for approval status
        const status = company.status || 'pending';
        
        let badgeClass = '';
        let badgeIcon = '';
        let badgeText = '';
        
        switch(status.toLowerCase()) {
            case 'approved':
                badgeClass = 'approval-badge-approved';
                badgeIcon = 'check-circle';
                badgeText = 'Approved';
                break;
            case 'declined':
                badgeClass = 'approval-badge-declined';
                badgeIcon = 'times-circle';
                badgeText = 'Declined';
                break;
            case 'pending':
                badgeClass = 'approval-badge-pending';
                badgeIcon = 'clock';
                badgeText = 'Pending Approval';
                break;
            default:
                badgeClass = 'approval-badge-pending';
                badgeIcon = 'question-circle';
                badgeText = 'Review Required';
        }
        
        return `<span class="approval-badge ${badgeClass}">
            <i class="fas fa-${badgeIcon}"></i> ${badgeText}
        </span>`;
    }
    
    getApprovalHistory(company) {
        // If there's no approval history, return empty
        if (!company.approvedAt && !company.declinedAt) return '';
        
        // Format for approval or decline
        let historyHTML = '<div class="detail-group full-width approval-history">';
        historyHTML += '<label><i class="fas fa-history"></i> Approval History</label>';
        historyHTML += '<div class="history-timeline">';
        
        if (company.approvedAt) {
            const approvedDate = new Date(company.approvedAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            historyHTML += `
                <div class="timeline-item approved">
                    <i class="fas fa-check-circle"></i>
                    <div class="timeline-content">
                        <h4>Approved</h4>
                        <p>${approvedDate}</p>
                    </div>
                </div>
            `;
        }
        
        if (company.declinedAt) {
            const declinedDate = new Date(company.declinedAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            historyHTML += `
                <div class="timeline-item declined">
                    <i class="fas fa-times-circle"></i>
                    <div class="timeline-content">
                        <h4>Declined</h4>
                        <p>${declinedDate}</p>
                        ${company.declineReason ? `<p class="decline-reason"><strong>Reason:</strong> ${company.declineReason}</p>` : ''}
                    </div>
                </div>
            `;
        }
        
        historyHTML += '</div></div>';
        return historyHTML;
    }

    closeModal() {
        if (!this.modal) return;
        
        const modalContent = this.modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'scale(0.7)';
            modalContent.style.opacity = '0';
        }
        
        // Remove show class after animation
        setTimeout(() => {
            this.modal.classList.remove('show');
        }, 300);

        // Remove any existing event listeners from buttons
        const modalFooter = this.modal.querySelector('.modal-footer');
        if (modalFooter) {
            const buttons = modalFooter.querySelectorAll('button');
            buttons.forEach(button => {
                button.replaceWith(button.cloneNode(true));
            });
        }
    }

    async deleteCompany(companyId) {
        if (!window.roleManager?.hasPermission('company_management_view', 'delete') && !await this.isUserCompanyApprover()) {
            alert('You do not have permission to delete companies.');
            return;
        }

        if (confirm('Are you sure you want to delete this company?')) {
            try {
                await remove(ref(this.db, `companies/${companyId}`));
                alert('Company deleted successfully');
            } catch (error) {
                console.error('Error deleting company:', error);
                alert('Error deleting company. Please try again.');
            }
        }
    }

    async approveCompany(companyId) {
        // Check both role permission and approver status
        if (!window.roleManager?.hasPermission('company_management_view', 'approve') && !await this.isUserCompanyApprover()) {
            alert('You do not have permission to approve companies.');
            return;
        }

        if (!confirm('Are you sure you want to approve this company?')) {
            return;
        }

        try {
            const companyRef = ref(this.db, `companies/${companyId}`);
            const flowRef = ref(this.db, 'approvalFlows/company_creation');
            
            // Get current company data and approval flow configuration
            const [companySnapshot, flowSnapshot] = await Promise.all([
                get(companyRef),
                get(flowRef)
            ]);

            if (!companySnapshot.exists() || !flowSnapshot.exists()) {
                alert('Error: Company or approval flow configuration not found.');
                return;
            }

            const company = companySnapshot.val();
            const flow = flowSnapshot.val();
            const isSequential = flow.approvalOrder === 'sequential';
            const selectedRoles = flow.selectedRoles || {};
            const currentUser = this.auth.currentUser;

            // Get current user's job title
            const userSnapshot = await get(ref(this.db, `users/${currentUser.uid}`));
            const userJobTitle = userSnapshot.exists() ? userSnapshot.val().jobTitle?.toLowerCase() : null;

            // Find the current user's approval level
            let userLevel = null;
            let canApproveCurrentLevel = false;

            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                const role = roles[0]; // We expect only one role per level
                if (role) {
                    if (role.value === `user_${currentUser.uid}` || 
                        (role.value.startsWith('function_') && 
                         role.value.replace('function_', '').toLowerCase() === userJobTitle)) {
                        userLevel = levelKey;
                        break;
                    }
                }
            }

            if (!userLevel) {
                alert('Error: You are not configured as an approver in the approval flow.');
                return;
            }

            // In sequential flow, check if previous levels are approved
            if (isSequential) {
                const levelNumber = parseInt(userLevel.replace('level', ''));
                if (levelNumber > 1) {
                    // Check all previous levels, not just the immediate one
                    for (let i = 1; i < levelNumber; i++) {
                        const previousLevel = `level${i}`;
                        if (!company.approvals?.[previousLevel]?.isCompleted) {
                            alert(`Sequential approval requires level ${i} to be completed first.`);
                            return;
                        }
                    }
                }
            }

            // Update company approvals
            const approvals = company.approvals || {};
            approvals[userLevel] = approvals[userLevel] || { approvals: [], isCompleted: false };
            
            // Add current user's approval if not already present
            if (!approvals[userLevel].approvals.some(a => a.approverId === currentUser.uid)) {
                approvals[userLevel].approvals.push({
                    approverId: currentUser.uid,
                    approverRole: userJobTitle,
                    timestamp: Date.now()
                });
            }

            // Mark this level as completed
            approvals[userLevel].isCompleted = true;

            // Check if all approval levels are completed to update overall status
            let isFullyApproved = true;
            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                if (!approvals[levelKey]?.isCompleted) {
                    isFullyApproved = false;
                    break;
                }
            }

            // Update company status if all approval levels are completed
            let updates = {
                [`companies/${companyId}/approvals`]: approvals
            };

            if (isFullyApproved) {
                updates[`companies/${companyId}/status`] = 'active';
                updates[`companies/${companyId}/approvedAt`] = Date.now();
            }

            // Apply updates
            await update(ref(this.db), updates);

            // Show success message
            alert(isFullyApproved ? 'Company has been approved and activated.' : 'Your approval has been recorded.');

            this.loadCompanies();
            document.getElementById('companyModal').classList.remove('show');

        } catch (error) {
            console.error('Error during approval:', error);
            alert('An error occurred while processing your approval. Please try again.');
        }
    }

    async declineCompany(companyId) {
        // Check both role permission and approver status
        if (!window.roleManager?.hasPermission('company_management_view', 'decline') && !await this.isUserCompanyApprover()) {
            alert('You do not have permission to decline companies.');
            return;
        }

        const reason = prompt('Please provide a reason for declining:');
        if (reason) {
            try {
                const companyRef = ref(this.db, `companies/${companyId}`);
                await update(companyRef, {
                    status: 'declined', // Set status to declined
                    declinedAt: new Date().toISOString(),
                    declinedBy: this.auth.currentUser.uid,
                    declineReason: reason
                });
                alert('Company declined successfully');
                this.closeModal(); // Close the modal after decline
                this.loadCompanies(); // Refresh the list
            } catch (error) {
                console.error('Error declining company:', error);
                alert('Error declining company. Please try again.');
            }
        }
    }

    exportCompany(company) {
        // Create CSV content
        const csvContent = [
            ['Field', 'Value'],
            ['Company Name', company.companyName],
            ['Registration Number', company.companyRegistration],
            ['Industry', company.industry],
            ['Country', company.country],
            ['City', company.city || ''],
            ['Address', company.address || ''],
            ['Subscription Plan', company.subscriptionPlan],
            ['Subscription Start Date', company.subscriptionStartDate || ''],
            ['Subscription End Date', company.subscriptionEndDate || ''],
            ['Contact Name', company.contactName],
            ['Contact Email', company.contactEmail],
            ['Contact Phone', company.contactPhone],
            ['Created Date', new Date(company.createdAt).toLocaleString()]
        ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

        // Create a Blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `company_${company.companyName}_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Add method to check if user has company management permissions
    async isUserCompanyApprover() {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) return false;

        try {
            // First check if user has role-based permissions
            const hasRolePermission = window.roleManager?.hasPermission('company_management_view', 'approve') ||
                window.roleManager?.hasPermission('company_management_view', 'edit') ||
                window.roleManager?.hasPermission('company_management_view', 'delete');

            if (hasRolePermission) {
                return true;
            }

            // If no role permission, check approval flow assignment
            const snapshot = await get(this.approvalFlowsRef);
            if (!snapshot.exists()) return false;

            const flow = snapshot.val();
            const selectedRoles = flow.selectedRoles || {};

            // Get the current user's data to check their job title
            const userRef = ref(this.db, `users/${currentUser.uid}`);
            const userSnapshot = await get(userRef);
            if (!userSnapshot.exists()) return false;
            
            const userData = userSnapshot.val();
            const userJobTitle = userData.jobTitle;

            // Check each level for the current user
            for (const level of Object.values(selectedRoles)) {
                for (const role of level) {
                    if (role.value.startsWith('user_')) {
                        // Direct user assignment
                        if (role.value === `user_${currentUser.uid}`) {
                            return true;
                        }
                    } else if (role.value.startsWith('function_')) {
                        // Function/job title based assignment - compare with user's job title
                        const functionId = role.value.replace('function_', '');
                        if (userJobTitle && userJobTitle.toLowerCase() === functionId.toLowerCase()) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking approver status:', error);
            return false;
        }
    }

    async viewCompany(companyId) {
        if (!window.roleManager?.hasPermission('company_management_view', 'view') && !await this.isUserCompanyApprover()) {
            alert('You do not have permission to view company details.');
            return;
        }
        
        try {
            const companySnapshot = await get(ref(this.db, `companies/${companyId}`));
            if (companySnapshot.exists()) {
                const company = { id: companyId, ...companySnapshot.val() };
                await this.showCompanyDetails(company);
            } else {
                alert('Company not found.');
            }
        } catch (error) {
            console.error('Error viewing company:', error);
            alert('Error loading company details.');
        }
    }

    async editCompany(companyId) {
        if (!window.roleManager?.hasPermission('company_management_view', 'edit') && !await this.isUserCompanyApprover()) {
            alert('You do not have permission to edit companies.');
            return;
        }
        
        window.location.href = `company.html?id=${companyId}`;
    }

    // Department Management Methods
    initializeDepartmentEventListeners() {
        // Company selection for departments
        const companySelectFilter = document.getElementById('companySelectFilter');
        if (companySelectFilter) {
            companySelectFilter.addEventListener('change', (e) => {
                this.selectCompanyForDepartments(e.target.value);
            });
        }

        // Department search
        const departmentSearchInput = document.getElementById('departmentSearchInput');
        if (departmentSearchInput) {
            departmentSearchInput.addEventListener('input', () => this.filterDepartments());
        }

        // Add department buttons
        const addDepartmentBtn = document.getElementById('addDepartmentBtn');
        const addFirstDepartmentBtn = document.getElementById('addFirstDepartmentBtn');
        
        if (addDepartmentBtn) {
            addDepartmentBtn.addEventListener('click', () => this.showDepartmentModal());
        }
        
        if (addFirstDepartmentBtn) {
            addFirstDepartmentBtn.addEventListener('click', () => this.showDepartmentModal());
        }

        // Department modal events
        const closeDepartmentModal = document.getElementById('closeDepartmentModal');
        const cancelDepartmentBtn = document.getElementById('cancelDepartmentBtn');
        const departmentForm = document.getElementById('departmentForm');

        if (closeDepartmentModal) {
            closeDepartmentModal.addEventListener('click', () => this.closeDepartmentModal());
        }

        if (cancelDepartmentBtn) {
            cancelDepartmentBtn.addEventListener('click', () => this.closeDepartmentModal());
        }

        if (departmentForm) {
            departmentForm.addEventListener('submit', (e) => this.saveDepartment(e));
        }

        // Close modal when clicking outside
        if (this.departmentModal) {
            this.departmentModal.addEventListener('click', (e) => {
                if (e.target === this.departmentModal) {
                    this.closeDepartmentModal();
                }
            });
        }
    }

    async loadDepartments() {
        try {
            onValue(this.departmentsRef, (snapshot) => {
                const departmentsData = snapshot.val();
                this.departments = departmentsData ? Object.keys(departmentsData).map(id => ({
                    id,
                    ...departmentsData[id]
                })) : [];
                
                if (this.selectedCompanyId) {
                    this.filterDepartmentsByCompany();
                }
            });
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }

    async loadUsers() {
        try {
            await this.companyDataService.initializeUserContext();
            const currentCompanyId = this.companyDataService.getCurrentCompanyId();
            
            if (!currentCompanyId) {
                console.error('No company context available for loading users');
                this.users = [];
                return;
            }

            // Query users by company ID
            const usersQuery = query(this.usersRef, orderByChild('companyId'), equalTo(currentCompanyId));
            onValue(usersQuery, (snapshot) => {
                this.users = [];
                snapshot.forEach((childSnapshot) => {
                    this.users.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
            });
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadLocations() {
        try {
            const locationsUrl = 'https://users-8be65-default-rtdb.firebaseio.com/fieldOptions/locations.json';
            const response = await fetch(locationsUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const locationsData = await response.json();
            
            this.locations = [];
            if (locationsData) {
                // Extract location labels from the Firebase data structure
                Object.keys(locationsData).forEach(key => {
                    const location = locationsData[key];
                    if (location && location.label) {
                        this.locations.push({
                            id: key,
                            label: location.label
                        });
                    }
                });
            }
            
            // Sort locations alphabetically
            this.locations.sort((a, b) => a.label.localeCompare(b.label));
            
            console.log('Loaded locations:', this.locations);
            
            // If no locations found, add some default ones
            if (this.locations.length === 0) {
                console.warn('No locations found, using default locations');
                this.locations = [
                    { id: 'default-1', label: 'Head Office' },
                    { id: 'default-2', label: 'Warehouse' },
                    { id: 'default-3', label: 'Remote' },
                    { id: 'default-4', label: 'Field Office' }
                ];
            }
        } catch (error) {
            console.error('Error loading locations:', error);
            
            // Fallback locations if API fails
            this.locations = [
                { id: 'fallback-1', label: 'Head Office' },
                { id: 'fallback-2', label: 'Branch Office' },
                { id: 'fallback-3', label: 'Warehouse' },
                { id: 'fallback-4', label: 'Remote' },
                { id: 'fallback-5', label: 'Field Office' },
                { id: 'fallback-6', label: 'Manufacturing Plant' },
                { id: 'fallback-7', label: 'Research Lab' }
            ];
            
            console.log('Using fallback locations:', this.locations);
        }
    }

    initializeDepartmentsTab() {
        this.populateCompanySelect();
    }

    populateCompanySelect() {
        const companySelect = document.getElementById('companySelectFilter');
        if (!companySelect) return;

        // Clear existing options except the first one
        companySelect.innerHTML = '<option value="">Choose a company...</option>';
        
        // Add companies to select
        this.companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.companyName;
            companySelect.appendChild(option);
        });
    }

    selectCompanyForDepartments(companyId) {
        console.log(`Selecting company for departments: ${companyId}`);
        this.selectedCompanyId = companyId;
        
        const selectedCompanyName = document.getElementById('selectedCompanyName');
        const selectedCompanyInfo = document.getElementById('selectedCompanyInfo');
        const departmentActions = document.getElementById('departmentActions');
        const departmentsTableContainer = document.getElementById('departmentsTableContainer');
        const departmentsEmptyState = document.getElementById('departmentsEmptyState');

        if (companyId) {
            const company = this.companies.find(c => c.id === companyId);
            if (company) {
                console.log(`Found company: ${company.companyName}`);
                selectedCompanyName.textContent = company.companyName;
                selectedCompanyInfo.textContent = `Manage departments for ${company.companyName}`;
                departmentActions.style.display = 'flex';
                
                this.filterDepartmentsByCompany();
            } else {
                console.warn(`Company not found: ${companyId}`);
            }
        } else {
            selectedCompanyName.textContent = 'Select a Company';
            selectedCompanyInfo.textContent = 'Choose a company to view and manage its departments';
            departmentActions.style.display = 'none';
            departmentsTableContainer.style.display = 'none';
            departmentsEmptyState.style.display = 'none';
        }
    }

    filterDepartmentsByCompany() {
        if (!this.selectedCompanyId) return;

        const companyDepartments = this.departments.filter(dept => 
            dept.companyId === this.selectedCompanyId
        );

        // Apply search filter
        const searchTerm = document.getElementById('departmentSearchInput')?.value.toLowerCase() || '';
        this.filteredDepartments = companyDepartments.filter(dept =>
            dept.name.toLowerCase().includes(searchTerm) ||
            dept.code.toLowerCase().includes(searchTerm) ||
            (dept.manager && dept.manager.toLowerCase().includes(searchTerm))
        );

        this.renderDepartments();
    }

    filterDepartments() {
        this.filterDepartmentsByCompany();
    }

    renderDepartments() {
        const tableContainer = document.getElementById('departmentsTableContainer');
        const emptyState = document.getElementById('departmentsEmptyState');
        const tbody = document.getElementById('departmentsTableBody');

        if (!tbody) return;

        if (this.filteredDepartments.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.style.display = 'none';

        tbody.innerHTML = '';

        this.filteredDepartments.forEach(department => {
            const row = document.createElement('tr');
            const createdDate = new Date(department.createdAt || Date.now()).toLocaleDateString();
            
            // Get manager name from users array
            let managerName = '-';
            if (department.manager) {
                const manager = this.users.find(user => user.id === department.manager);
                if (manager) {
                    managerName = `${manager.firstName || ''} ${manager.lastName || ''}`.trim();
                    if (!managerName) {
                        managerName = manager.email;
                    }
                }
            }
            
            row.innerHTML = `
                <td>${department.name}</td>
                <td>${department.code}</td>
                <td>${managerName}</td>
                <td>${department.employeeCount || 0}</td>
                <td>${department.budget ? '$' + Number(department.budget).toLocaleString() : '-'}</td>
                <td>${department.location || '-'}</td>
                <td>
                    <span class="status-badge ${department.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${department.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" onclick="companyBoard.editDepartment('${department.id}')" 
                                data-feature="company_management_view" data-action="edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="companyBoard.deleteDepartment('${department.id}')" 
                                data-feature="company_management_view" data-action="delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    showDepartmentModal(departmentId = null) {
        const modal = this.departmentModal;
        const title = document.getElementById('departmentModalTitle');
        const form = document.getElementById('departmentForm');

        if (departmentId) {
            title.textContent = 'Edit Department';
            this.populateDepartmentForm(departmentId);
        } else {
            title.textContent = 'Add New Department';
            form.reset();
        }

        // Populate manager dropdown with users
        this.populateManagerDropdown();
        
        // Populate location dropdown
        this.populateLocationDropdown();

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    populateManagerDropdown() {
        const managerSelect = document.getElementById('departmentManager');
        if (!managerSelect) return;

        // Clear existing options except the first one
        managerSelect.innerHTML = '<option value="">Select Manager</option>';
        
        // Filter users to show only active users, sorted by name
        const activeUsers = this.users
            .filter(user => user.status === 'active')
            .sort((a, b) => {
                const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
                const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
                return nameA.localeCompare(nameB);
            });

        // Add users to the dropdown
        activeUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            
            // Create display name with job title if available
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            const displayName = user.jobTitle 
                ? `${fullName} - ${user.jobTitle}` 
                : fullName || user.email;
            
            option.textContent = displayName;
            managerSelect.appendChild(option);
        });
    }

    populateLocationDropdown() {
        const locationSelect = document.getElementById('departmentLocation');
        if (!locationSelect) return;

        // Clear existing options and show loading state
        locationSelect.innerHTML = '<option value="">Loading locations...</option>';
        locationSelect.disabled = true;
        
        // If locations aren't loaded yet, wait a bit and try again
        if (this.locations.length === 0) {
            setTimeout(() => {
                this.populateLocationDropdown();
            }, 1000);
            return;
        }
        
        // Enable dropdown and add locations
        locationSelect.disabled = false;
        locationSelect.innerHTML = '<option value="">Select Location</option>';
        
        // Add locations to the dropdown
        this.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.label; // Use the label as the value
            option.textContent = location.label;
            locationSelect.appendChild(option);
        });
    }

    closeDepartmentModal() {
        const modal = this.departmentModal;
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Reset form
        const form = document.getElementById('departmentForm');
        if (form) form.reset();
    }

    async populateDepartmentForm(departmentId) {
        const department = this.departments.find(d => d.id === departmentId);
        if (!department) return;

        // First populate the dropdowns
        this.populateManagerDropdown();
        this.populateLocationDropdown();

        // Then set the form values
        document.getElementById('departmentName').value = department.name || '';
        document.getElementById('departmentCode').value = department.code || '';
        document.getElementById('departmentManager').value = department.manager || '';
        document.getElementById('departmentBudget').value = department.budget || '';
        document.getElementById('departmentLocation').value = department.location || '';
        document.getElementById('departmentStatus').value = department.status || 'active';
        document.getElementById('departmentDescription').value = department.description || '';
    }

    async saveDepartment(event) {
        event.preventDefault();
        
        if (!this.selectedCompanyId) {
            alert('Please select a company first.');
            return;
        }

        const formData = {
            name: document.getElementById('departmentName').value.trim(),
            code: document.getElementById('departmentCode').value.trim(),
            manager: document.getElementById('departmentManager').value,
            budget: document.getElementById('departmentBudget').value,
            location: document.getElementById('departmentLocation').value.trim(),
            status: document.getElementById('departmentStatus').value,
            description: document.getElementById('departmentDescription').value.trim(),
            companyId: this.selectedCompanyId,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.uid
        };

        if (!formData.name || !formData.code) {
            alert('Please fill in all required fields.');
            return;
        }

        try {
            // Check if department code already exists for this company
            const existingDept = this.departments.find(d => 
                d.companyId === this.selectedCompanyId && 
                d.code === formData.code
            );

            if (existingDept) {
                alert('Department code already exists for this company.');
                return;
            }

            const newDepartmentRef = push(this.departmentsRef);
            await set(newDepartmentRef, formData);

            this.closeDepartmentModal();
            alert('Department saved successfully!');
        } catch (error) {
            console.error('Error saving department:', error);
            alert('Error saving department. Please try again.');
        }
    }

    async editDepartment(departmentId) {
        this.showDepartmentModal(departmentId);
    }

    async deleteDepartment(departmentId) {
        if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
            return;
        }

        try {
            await remove(ref(this.db, `departments/${departmentId}`));
            alert('Department deleted successfully!');
        } catch (error) {
            console.error('Error deleting department:', error);
            alert('Error deleting department. Please try again.');
        }
    }
}

// Initialize the company board when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.companyBoard = new CompanyBoard();
});