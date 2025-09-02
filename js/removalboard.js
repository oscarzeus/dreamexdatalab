import { getDatabase, ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { renderApprovalFlow } from './approval-flow-renderer.js';

class RemovalBoardManager {
    constructor() {
        this.db = getDatabase();
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.requests = [];
        this.filteredRequests = [];
        this.userCache = new Map();
        this.initializeBoard();
    }

    initializeBoard() {
        this.loadRequests();
        this.initializeFilters();
        this.initializeModal();
        this.initializePagination();
        this.updateActionButtonsVisibility();
    }

    loadRequests() {
        const requestsRef = ref(this.db, 'removal_requests');
        onValue(requestsRef, async (snapshot) => {
            this.requests = [];
            const promises = [];

            snapshot.forEach((childSnapshot) => {
                const request = {
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                };
                this.requests.push(request);

                // Cache user data if not already cached
                if (request.requestedBy && !this.userCache.has(request.requestedBy)) {
                    promises.push(this.loadUserData(request.requestedBy));
                }
            });

            await Promise.all(promises);
            this.applyFilters();
            this.renderRequests();
        });
    }

    async loadUserData(userId) {
        try {
            const userRef = ref(this.db, `users/${userId}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                this.userCache.set(userId, snapshot.val());
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    initializeFilters() {
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        const departmentFilter = document.getElementById('departmentFilter');
        const searchInput = document.getElementById('searchInput');

        [statusFilter, typeFilter, departmentFilter].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => this.applyFilters());
            }
        });

        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.applyFilters();
                }, 300);
            });
        }
    }

    applyFilters() {
        const status = document.getElementById('statusFilter')?.value;
        const type = document.getElementById('typeFilter')?.value;
        const department = document.getElementById('departmentFilter')?.value;
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();

        this.filteredRequests = this.requests.filter(request => {
            const matchesStatus = status === 'all' || request.status === status;
            const matchesType = type === 'all' || request.propertyType === type;
            const matchesDepartment = department === 'all' || request.department === department;
            const matchesSearch = !searchTerm ||
                request.propertyDescription.toLowerCase().includes(searchTerm) ||
                this.userCache.get(request.requestedBy)?.name.toLowerCase().includes(searchTerm);

            return matchesStatus && matchesType && matchesDepartment && matchesSearch;
        });

        this.currentPage = 1;
        this.renderRequests();
    }

    renderRequests() {
        const tbody = document.getElementById('removalTableBody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageRequests = this.filteredRequests.slice(startIndex, endIndex);

        tbody.innerHTML = '';
        pageRequests.forEach(request => {
            const user = this.userCache.get(request.requestedBy);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${request.id.slice(-6).toUpperCase()}</td>
                <td>${user?.name || 'Unknown'}</td>
                <td>${request.department}</td>
                <td>${request.propertyType}</td>
                <td>${request.propertyDescription}</td>
                <td>${request.quantity}</td>
                <td>${request.removalDate}</td>
                <td>${request.returnDate || 'N/A'}</td>
                <td><span class="status-badge ${request.status}">${request.status}</span></td>
                <td>
                    <button class="btn btn-view" onclick="removalBoardManager.showRequestDetails('${request.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.updatePaginationControls();
    }

    async showRequestDetails(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) return;

        const modal = document.getElementById('removalModal');
        if (!modal) return;

        const user = this.userCache.get(request.requestedBy);
        const modalBody = modal.querySelector('.modal-body');
        
        // Get approval flow HTML first
        const approvalFlowHTML = await renderApprovalFlow(request, 'removal');
        
        modalBody.innerHTML = `
            <div class="request-details">
                <div class="detail-group">
                    <label>Request ID:</label>
                    <span>${request.id.slice(-6).toUpperCase()}</span>
                </div>
                <div class="detail-group">
                    <label>Requester:</label>
                    <span>${user?.name || 'Unknown'}</span>
                </div>
                <div class="detail-group">
                    <label>Department:</label>
                    <span>${request.department}</span>
                </div>
                <div class="detail-group">
                    <label>Property Type:</label>
                    <span>${request.propertyType}</span>
                </div>
                <div class="detail-group">
                    <label>Property Description:</label>
                    <span>${request.propertyDescription}</span>
                </div>
                <div class="detail-group">
                    <label>Quantity:</label>
                    <span>${request.quantity}</span>
                </div>
                <div class="detail-group">
                    <label>Purpose:</label>
                    <span>${request.purpose}</span>
                </div>
                <div class="detail-group">
                    <label>Removal Date:</label>
                    <span>${request.removalDate}</span>
                </div>
                <div class="detail-group">
                    <label>Return Date:</label>
                    <span>${request.returnDate || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <label>Status:</label>
                    <span class="status-badge ${request.status}">${request.status}</span>
                </div>
                <!-- Approval Flow Section -->
                ${approvalFlowHTML}
            </div>
        `;

        // Show/hide action buttons based on status and permissions
        const approveBtn = modal.querySelector('[data-action="approve"]');
        const declineBtn = modal.querySelector('[data-action="decline"]');
        const editBtn = modal.querySelector('[data-action="edit"]');

        if (approveBtn && declineBtn && editBtn) {
            const isPending = request.status === 'pending';
            approveBtn.style.display = isPending ? '' : 'none';
            declineBtn.style.display = isPending ? '' : 'none';
            editBtn.style.display = isPending ? '' : 'none';
        }

        modal.classList.add('show');
        this.currentRequestId = requestId;
    }

    initializeModal() {
        const modal = document.getElementById('removalModal');
        if (!modal) return;

        // Close modal when clicking close button or outside
        const closeBtn = modal.querySelector('.close-modal');
        const closeAction = modal.querySelector('[data-action="close"]');
        [closeBtn, closeAction].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => modal.classList.remove('show'));
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        // Add event listeners for action buttons
        const approveBtn = modal.querySelector('[data-action="approve"]');
        const declineBtn = modal.querySelector('[data-action="decline"]');
        const editBtn = modal.querySelector('[data-action="edit"]');

        if (approveBtn) {
            approveBtn.addEventListener('click', () => this.updateRequestStatus('approved'));
        }

        if (declineBtn) {
            declineBtn.addEventListener('click', () => this.updateRequestStatus('declined'));
        }

        if (editBtn) {
            editBtn.addEventListener('click', () => this.editRequest());
        }
    }

    async updateRequestStatus(newStatus) {
        if (!this.currentRequestId) return;

        try {
            await update(ref(this.db, `removal_requests/${this.currentRequestId}`), {
                status: newStatus,
                updatedBy: window.authManager.getUser()?.uid,
                updatedAt: new Date().toISOString()
            });

            window.notificationManager?.addNotification({
                type: 'Success',
                message: `Request ${newStatus} successfully.`
            });

            document.getElementById('removalModal').classList.remove('show');
        } catch (error) {
            console.error('Error updating request status:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: `Failed to update request: ${error.message}`
            });
        }
    }

    editRequest() {
        const request = this.requests.find(r => r.id === this.currentRequestId);
        if (!request) return;

        // Redirect to the edit form with request ID in URL
        window.location.href = `removal.html?edit=${this.currentRequestId}`;
    }

    initializePagination() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderRequests();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const maxPage = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
                if (this.currentPage < maxPage) {
                    this.currentPage++;
                    this.renderRequests();
                }
            });
        }
    }

    updatePaginationControls() {
        const totalPages = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
        }
    }

    updateActionButtonsVisibility() {
        // Hide/show action buttons based on permissions
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            const feature = button.getAttribute('data-feature') || 'removal_view';
            
            // Map actions directly to permissions
            const permissionType = {
                'edit': 'edit',
                'approve': 'approve',
                'decline': 'decline',
                'delete': 'delete',
                'create': 'create'
            }[action] || 'view';

            const hasPermission = window.roleManager?.hasPermission(feature, permissionType);
            if (!hasPermission) {
                button.style.display = 'none';
            } else {
                button.style.display = '';
            }
        });
    }
}

// Initialize removal board manager
const removalBoardManager = new RemovalBoardManager();
window.removalBoardManager = removalBoardManager;