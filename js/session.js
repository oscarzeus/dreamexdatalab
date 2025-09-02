// Import Firebase functions
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

class SessionManager {
    constructor() {
        this.db = getDatabase();
        this.sessionsList = document.getElementById('sessionsList');
        this.initializeSessionManagement();
    }

    initializeSessionManagement() {
        this.loadSessions();

        // Add search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filterSessions(e.target.value);
                }, 300);
            });
        }
    }

    loadSessions() {
        const sessionsRef = ref(this.db, 'sessions');
        onValue(sessionsRef, (snapshot) => {
            const sessions = [];
            snapshot.forEach((childSnapshot) => {
                sessions.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            this.renderSessions(sessions);
        });
    }

    renderSessions(sessions) {
        if (!this.sessionsList) return;

        this.sessionsList.innerHTML = '';
        sessions.forEach(session => {
            const row = document.createElement('tr');
            const loginTime = new Date(session.loginTime);
            const logoutTime = session.logoutTime ? new Date(session.logoutTime) : null;
            const status = logoutTime ? 'Ended' : 'Active';

            row.innerHTML = `
                <td>${session.userName}</td>
                <td>${loginTime.toLocaleString()}</td>
                <td>${logoutTime ? logoutTime.toLocaleString() : '-'}</td>
                <td>${session.ipAddress}</td>
                <td>${session.device}</td>
                <td>${session.browser}</td>
                <td><span class="status-badge ${status.toLowerCase()}">${status}</span></td>
                <td>
                    ${status === 'Active' ? `
                        <button class="btn btn-terminate" data-session-id="${session.id}">
                            <i class="fas fa-times"></i> Terminate
                        </button>
                    ` : ''}
                    <button class="btn btn-details" data-session-id="${session.id}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </td>
            `;

            // Add event listeners for buttons
            const terminateBtn = row.querySelector('.btn-terminate');
            if (terminateBtn) {
                terminateBtn.addEventListener('click', () => this.terminateSession(session.id));
            }

            const detailsBtn = row.querySelector('.btn-details');
            if (detailsBtn) {
                detailsBtn.addEventListener('click', () => this.showSessionDetails(session));
            }

            this.sessionsList.appendChild(row);
        });
    }

    async terminateSession(sessionId) {
        if (!confirm('Are you sure you want to terminate this session?')) return;

        try {
            await remove(ref(this.db, `sessions/${sessionId}`));
            window.notificationManager?.addNotification({
                type: 'Success',
                message: 'Session terminated successfully.'
            });
        } catch (error) {
            console.error('Error terminating session:', error);
            window.notificationManager?.addNotification({
                type: 'Error',
                message: `Failed to terminate session: ${error.message}`
            });
        }
    }

    showSessionDetails(session) {
        // Create and show modal with session details
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Session Details</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="details-grid">
                        <div class="detail-item">
                            <label>User:</label>
                            <span>${session.userName}</span>
                        </div>
                        <div class="detail-item">
                            <label>Login Time:</label>
                            <span>${new Date(session.loginTime).toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label>Logout Time:</label>
                            <span>${session.logoutTime ? new Date(session.logoutTime).toLocaleString() : '-'}</span>
                        </div>
                        <div class="detail-item">
                            <label>IP Address:</label>
                            <span>${session.ipAddress}</span>
                        </div>
                        <div class="detail-item">
                            <label>Device:</label>
                            <span>${session.device}</span>
                        </div>
                        <div class="detail-item">
                            <label>Browser:</label>
                            <span>${session.browser}</span>
                        </div>
                        <div class="detail-item">
                            <label>Operating System:</label>
                            <span>${session.os}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="status-badge ${session.logoutTime ? 'ended' : 'active'}">
                                ${session.logoutTime ? 'Ended' : 'Active'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add close button functionality
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    filterSessions(searchTerm) {
        const rows = this.sessionsList.querySelectorAll('tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }
}

// Initialize session manager
const sessionManager = new SessionManager();