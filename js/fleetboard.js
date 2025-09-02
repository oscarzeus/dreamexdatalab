import { getFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
import { getCurrentUser } from './auth.js';
import { renderApprovalFlow } from './approval-flow-renderer.js';

const db = getFirestore();
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let currentVehicles = [];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadVehicles();
});

function setupEventListeners() {
    // Filter event listeners
    document.getElementById('statusFilter').addEventListener('change', loadVehicles);
    document.getElementById('vehicleTypeFilter').addEventListener('change', loadVehicles);
    document.getElementById('startDate').addEventListener('change', loadVehicles);
    document.getElementById('endDate').addEventListener('change', loadVehicles);

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));

    // Search
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', debounce(loadVehicles, 300));

    // Modal events
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('approveBtn').addEventListener('click', () => updateVehicleStatus('approved'));
    document.getElementById('rejectBtn').addEventListener('click', () => updateVehicleStatus('rejected'));
}

async function loadVehicles() {
    try {
        const status = document.getElementById('statusFilter').value;
        const vehicleType = document.getElementById('vehicleTypeFilter').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const searchQuery = document.querySelector('.search-input').value.toLowerCase();

        let q = query(collection(db, 'fleet'), orderBy('submittedDate', 'desc'));

        // Apply filters
        if (status !== 'all') {
            q = query(q, where('status', '==', status));
        }
        if (vehicleType !== 'all') {
            q = query(q, where('vehicleType', '==', vehicleType));
        }

        const querySnapshot = await getDocs(q);
        let vehicles = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Apply date filter
            if (startDate && new Date(data.submittedDate.toDate()) < new Date(startDate)) return;
            if (endDate && new Date(data.submittedDate.toDate()) > new Date(endDate)) return;

            // Apply search filter
            const searchString = `${data.registrationNumber} ${data.make} ${data.model}`.toLowerCase();
            if (searchQuery && !searchString.includes(searchQuery)) return;

            vehicles.push({
                id: doc.id,
                ...data
            });
        });

        currentVehicles = vehicles;
        totalPages = Math.ceil(vehicles.length / ITEMS_PER_PAGE);
        currentPage = 1;
        updatePagination();
        displayVehicles();
    } catch (error) {
        console.error('Error loading vehicles:', error);
        alert('Error loading vehicles. Please try again.');
    }
}

function displayVehicles() {
    const tableBody = document.getElementById('fleetTableBody');
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageVehicles = currentVehicles.slice(start, end);

    pageVehicles.forEach(vehicle => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vehicle.registrationNumber}</td>
            <td>${vehicle.vehicleType}</td>
            <td>${vehicle.make} ${vehicle.model}</td>
            <td>${vehicle.year}</td>
            <td>${new Date(vehicle.insuranceExpiry).toLocaleDateString()}</td>
            <td><span class="status-badge ${vehicle.status}">${vehicle.status}</span></td>
            <td>${vehicle.submittedDate.toDate().toLocaleDateString()}</td>
            <td>
                <button class="btn btn-icon" onclick="showVehicleDetails('${vehicle.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updatePagination() {
    document.getElementById('currentPage').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updatePagination();
        displayVehicles();
    }
}

window.showVehicleDetails = async (vehicleId) => {
    const vehicle = currentVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    const modal = document.getElementById('vehicleModal');
    const details = document.getElementById('vehicleDetails');
    
    details.innerHTML = `
        <div class="details-grid">
            <div class="detail-item">
                <label>Registration Number:</label>
                <span>${vehicle.registrationNumber}</span>
            </div>
            <div class="detail-item">
                <label>Vehicle Type:</label>
                <span>${vehicle.vehicleType}</span>
            </div>
            <div class="detail-item">
                <label>Make:</label>
                <span>${vehicle.make}</span>
            </div>
            <div class="detail-item">
                <label>Model:</label>
                <span>${vehicle.model}</span>
            </div>
            <div class="detail-item">
                <label>Year:</label>
                <span>${vehicle.year}</span>
            </div>
            <div class="detail-item">
                <label>Color:</label>
                <span>${vehicle.color || '-'}</span>
            </div>
            <div class="detail-item">
                <label>Insurance Number:</label>
                <span>${vehicle.insuranceNumber}</span>
            </div>
            <div class="detail-item">
                <label>Insurance Expiry:</label>
                <span>${new Date(vehicle.insuranceExpiry).toLocaleDateString()}</span>
            </div>
            <div class="detail-item full-width">
                <label>Purpose/Use:</label>
                <span>${vehicle.purpose}</span>
            </div>
            <div class="detail-item full-width">
                <label>Comments:</label>
                <span>${vehicle.comments || '-'}</span>
            </div>
            <div class="detail-item full-width">
                <label>Documents:</label>
                <div class="document-links">
                    ${vehicle.documents.map((url, index) => `
                        <a href="${url}" target="_blank" class="document-link">
                            <i class="fas fa-file"></i> Document ${index + 1}
                        </a>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Show/hide approval buttons based on status
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    if (vehicle.status === 'pending') {
        approveBtn.style.display = 'block';
        rejectBtn.style.display = 'block';
    } else {
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }

    modal.style.display = 'block';
    window.currentVehicleId = vehicleId;
};

async function updateVehicleStatus(status) {
    if (!window.currentVehicleId) return;

    try {
        const vehicleRef = doc(db, 'fleet', window.currentVehicleId);
        await updateDoc(vehicleRef, {
            status: status,
            updatedDate: new Date(),
            updatedBy: (await getCurrentUser()).uid
        });

        closeModal();
        loadVehicles();
        alert(`Vehicle registration ${status} successfully!`);
    } catch (error) {
        console.error('Error updating vehicle status:', error);
        alert('Error updating vehicle status. Please try again.');
    }
}

function closeModal() {
    const modal = document.getElementById('vehicleModal');
    modal.style.display = 'none';
    window.currentVehicleId = null;
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

async function renderApprovalFlow(fleet) {
    try {
        const flowRef = ref(db, 'approvalFlows/fleet');
        const flowSnapshot = await get(flowRef);
        
        if (!flowSnapshot.exists()) {
            return '';  // No approval flow configured
        }

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
            const currentLevel = fleet.approvals?.[levelKey];
            const status = currentLevel?.isCompleted ? 'approved' : 'waiting';
            
            // Get approver details
            let approverInfos = [];
            for (const role of roles) {
                let approverInfo = { 
                    name: 'Not assigned', 
                    title: '', 
                    department: '' 
                };
                
                if (role.value.startsWith('user_')) {
                    const userId = role.value.replace('user_', '');
                    const approverSnapshot = await get(ref(db, `users/${userId}`));
                    if (approverSnapshot.exists()) {
                        const approver = approverSnapshot.val();
                        approverInfo = {
                            name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || approver.email,
                            title: approver.jobTitle || '',
                            department: approver.department || ''
                        };
                    }
                } else if (role.value.startsWith('function_')) {
                    approverInfo = {
                        name: role.text,
                        title: 'Function',
                        department: role.department || ''
                    };
                } else if (role.value === 'L+1' && fleet.requestedBy) {
                    // Get the requestor's line manager
                    const requestorSnapshot = await get(ref(db, `users/${fleet.requestedBy}`));
                    if (requestorSnapshot.exists()) {
                        const requestor = requestorSnapshot.val();
                        if (requestor.lineManager) {
                            const lineManagerSnapshot = await get(ref(db, `users/${requestor.lineManager}`));
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

            flowHTML += `
                <div class="approval-level ${status === 'waiting' ? 'locked' : ''} ${status === 'approved' ? 'approved' : ''}">
                    <div class="level-content">
                        <div class="level-header">
                            <span class="level-number">Level ${levelNumber}</span>
                            <span class="status-badge ${status}">
                                <i class="fas fa-${status === 'approved' ? 'check' : 'clock'}"></i>
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        ${approverInfos.map(approverInfo => `
                            <div class="approver-info">
                                <div class="approver-avatar">
                                    ${approverInfo.name !== 'Not assigned' ? 
                                        approverInfo.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                                </div>
                                <div class="approver-details">
                                    <span class="approver-name">${approverInfo.name}</span>
                                    ${approverInfo.title ? 
                                        `<span class="approver-title">${approverInfo.title}${approverInfo.department ? 
                                            ` - ${approverInfo.department}` : ''}</span>` : ''}
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
                </div>`;
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

async function showFleetDetails(fleetId) {
    const fleet = fleets.find(f => f.id === fleetId);
    if (!fleet) return;

    const modal = document.getElementById('fleetModal');
    if (!modal) return;

    modal.dataset.fleetId = fleetId;
    const approvalFlowHtml = await renderApprovalFlow(fleet, 'fleet');
    
    modal.querySelector('.modal-body').innerHTML = `
        // ...existing details...
        ${approvalFlowHtml}
    `;

    // Update approval buttons visibility
    window.approvalManager?.updateModalButtons(modal, 'fleet', fleet);
    modal.classList.add('show');
}