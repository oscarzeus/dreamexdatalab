import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

class SubmissionNotificationManager {
    constructor() {
        this.currentUser = null;
        this.submissions = [];
        this.filteredSubmissions = [];
        this.activeFilter = 'all';
        this.searchQuery = '';
        
        this.initializeAuth();
        this.initializeEventListeners();
    }

    initializeAuth() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadSubmissions();
            } else {
                window.location.href = 'index.html';
            }
        });
    }    initializeEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setActiveFilter(filter);
            });
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.filterAndRenderSubmissions();
            });
        }

        // Add refresh functionality by listening for F5 or manual refresh
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                this.refreshSubmissions();
            }
        });    }

    refreshSubmissions() {
        this.showLoadingState();
        this.submissions = [];
        this.filteredSubmissions = [];
        this.loadSubmissions();
    }

    setActiveFilter(filter) {
        this.activeFilter = filter;
        
        // Update button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.filterAndRenderSubmissions();
    }    async loadSubmissions() {
        this.showLoadingState();
        
        try {
            const submissions = [];
            
            // Load different types of submissions
            const submissionTypes = [
                { path: 'access', type: 'access-request', name: 'Access Request' },
                { path: 'incidents', type: 'incident', name: 'Incident Report' },
                { path: 'inspections', type: 'inspection', name: 'Inspection' },
                { path: 'propertyRemovals', type: 'property-removal', name: 'Property Removal' },
                { path: 'training', type: 'training', name: 'Training Request' },
                { path: 'risks', type: 'risk', name: 'Risk Assessment' },
                { path: 'permits', type: 'permit', name: 'Work Permit' },
                { path: 'events', type: 'event', name: 'Event Request' }
            ];

            const loadPromises = submissionTypes.map(submissionType => 
                this.loadSubmissionType(submissionType).catch(error => {
                    console.warn(`Failed to load ${submissionType.type}:`, error);
                    return []; // Return empty array on error to continue with other types
                })
            );

            const results = await Promise.all(loadPromises);
            
            // Flatten and combine all submissions
            results.forEach(typeSubmissions => {
                if (Array.isArray(typeSubmissions)) {
                    submissions.push(...typeSubmissions);
                }
            });

            // Sort by creation date (newest first)
            submissions.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.submittedAt || a.timestamp || 0);
                const dateB = new Date(b.createdAt || b.submittedAt || b.timestamp || 0);
                return dateB - dateA;
            });

            this.submissions = submissions;
            this.filterAndRenderSubmissions();
            this.updateStats();        } catch (error) {
            console.error('Error loading submissions:', error);
            this.showError('Failed to load submissions. Please try refreshing the page.');
        } finally {
            // Show completion message only if there are submissions
            if (this.submissions.length > 0) {
                console.log(`Loaded ${this.submissions.length} submission notifications`);
            }
        }
    }    async loadSubmissionType(submissionType) {
        try {
            const snapshot = await get(ref(db, submissionType.path));
            if (!snapshot.exists()) return [];

            const data = snapshot.val();
            const submissions = [];

            for (const [id, item] of Object.entries(data)) {
                // Skip invalid items
                if (!item || typeof item !== 'object') continue;

                try {
                    const isCreator = this.isUserCreator(item);
                    const isApprover = await this.isUserApprover(item, submissionType.type);

                    // Only include if user is creator or approver
                    if (isCreator || isApprover) {
                        submissions.push({
                            id,
                            ...item,
                            submissionType: submissionType.type,
                            submissionName: submissionType.name,
                            userRole: isCreator ? 'creator' : 'approver',
                            isCreator,
                            isApprover,
                            // Ensure we have a created date
                            createdAt: item.createdAt || item.submittedAt || item.timestamp || new Date().toISOString()
                        });
                    }
                } catch (itemError) {
                    console.warn(`Error processing ${submissionType.type} item ${id}:`, itemError);
                    // Continue with next item instead of failing completely
                }
            }

            return submissions;
        } catch (error) {
            console.error(`Error loading ${submissionType.type} submissions:`, error);
            // Return empty array instead of throwing to allow other submission types to load
            return [];
        }
    }

    isUserCreator(item) {
        const creatorId = item.createdBy?.uid || item.submittedBy || item.requesterId;
        return creatorId === this.currentUser.uid;
    }

    async isUserApprover(item, submissionType) {
        try {
            // Get approval flow for this submission type
            const flowSnapshot = await get(ref(db, `approvalFlows/${submissionType}`));
            if (!flowSnapshot.exists()) return false;

            const flow = flowSnapshot.val();
            const selectedRoles = flow.selectedRoles || {};

            // Get current user's data
            const userSnapshot = await get(ref(db, `users/${this.currentUser.uid}`));
            if (!userSnapshot.exists()) return false;

            const userData = userSnapshot.val();
            const userJobTitle = userData.jobTitle?.toLowerCase();

            // Check each approval level
            for (const [levelKey, roles] of Object.entries(selectedRoles)) {
                for (const role of roles) {
                    // Direct user assignment
                    if (role.value === `user_${this.currentUser.uid}`) {
                        return true;
                    }
                    
                    // Function-based assignment
                    if (role.value.startsWith('function_') && userJobTitle) {
                        const functionId = role.value.replace('function_', '').toLowerCase();
                        if (userJobTitle === functionId) {
                            return true;
                        }
                    }
                    
                    // Hierarchy-based assignment (L+1, L+2, etc.)
                    if (role.value.startsWith('L+')) {
                        const isInHierarchy = await this.checkUserInHierarchy(item, role.value, userData);
                        if (isInHierarchy) {
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking if user is approver:', error);
            return false;
        }
    }

    async checkUserInHierarchy(item, levelValue, userData) {
        try {
            const submitterId = item.createdBy?.uid || item.submittedBy || item.requesterId;
            if (!submitterId || submitterId === this.currentUser.uid) return false;

            // For L+1, check if current user is the line manager
            if (levelValue === 'L+1') {
                const submitterSnapshot = await get(ref(db, `users/${submitterId}`));
                if (submitterSnapshot.exists()) {
                    const submitterData = submitterSnapshot.val();
                    return submitterData.lineManager === this.currentUser.uid;
                }
            }

            // For higher levels, would need more complex hierarchy logic
            // This is a placeholder for future implementation
            return false;
        } catch (error) {
            console.error('Error checking hierarchy:', error);
            return false;
        }
    }

    filterAndRenderSubmissions() {
        let filtered = [...this.submissions];

        // Apply filter
        switch (this.activeFilter) {
            case 'created':
                filtered = filtered.filter(s => s.isCreator);
                break;
            case 'approver':
                filtered = filtered.filter(s => s.isApprover);
                break;
            case 'pending':
                filtered = filtered.filter(s => this.isPendingStatus(s.status));
                break;
            case 'completed':
                filtered = filtered.filter(s => this.isCompletedStatus(s.status));
                break;
            case 'all':
            default:
                // No additional filtering
                break;
        }

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(submission => {
                const searchableText = [
                    submission.referenceNumber,
                    submission.purpose,
                    submission.subject,
                    submission.title,
                    submission.submissionName,
                    submission.department?.label || submission.department,
                    submission.company?.name || submission.company,
                    submission.createdBy?.displayName || submission.createdBy?.email
                ].filter(Boolean).join(' ').toLowerCase();

                return searchableText.includes(this.searchQuery);
            });
        }

        this.filteredSubmissions = filtered;
        this.renderSubmissions();
    }

    isPendingStatus(status) {
        return ['pending', 'submitted', 'in-progress', 'under-review'].includes(status?.toLowerCase());
    }

    isCompletedStatus(status) {
        return ['approved', 'completed', 'rejected', 'closed'].includes(status?.toLowerCase());
    }

    renderSubmissions() {
        const submissionList = document.getElementById('submissionList');
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');

        // Hide loading state
        loadingState.style.display = 'none';

        if (this.filteredSubmissions.length === 0) {
            emptyState.style.display = 'block';
            submissionList.innerHTML = '';
            submissionList.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';
        submissionList.innerHTML = '';

        this.filteredSubmissions.forEach(submission => {
            const submissionElement = this.createSubmissionElement(submission);
            submissionList.appendChild(submissionElement);
        });
    }

    createSubmissionElement(submission) {
        const element = document.createElement('div');
        element.className = 'submission-item';
        element.setAttribute('data-submission-id', submission.id);
        element.setAttribute('data-submission-type', submission.submissionType);

        const icon = this.getSubmissionIcon(submission.submissionType);
        const status = this.getSubmissionStatus(submission.status);
        const userRole = submission.userRole;
        
        // Format date
        const createdDate = submission.createdAt ? 
            new Date(submission.createdAt).toLocaleDateString() : 
            'Unknown date';

        // Get submission details
        const details = this.getSubmissionDetails(submission);

        element.innerHTML = `
            <div class="submission-icon ${submission.submissionType}">
                <i class="${icon}"></i>
            </div>
            <div class="submission-content">
                <div class="submission-header">
                    <h4 class="submission-title">
                        ${submission.referenceNumber || submission.title || submission.subject || 'Untitled'}
                    </h4>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span class="submission-type ${submission.submissionType}">
                            ${submission.submissionName}
                        </span>
                        <span class="user-role-badge ${userRole}">
                            ${userRole === 'creator' ? 'My Submission' : 'Assigned to Me'}
                        </span>
                    </div>
                </div>
                <div class="submission-details">
                    ${details.map(detail => `
                        <span class="submission-detail">
                            <i class="${detail.icon}"></i>
                            ${detail.text}
                        </span>
                    `).join('')}
                </div>
                <div class="submission-status">
                    <span class="status-badge ${status.class}">
                        ${status.text}
                    </span>
                    <span class="submission-detail">
                        <i class="fas fa-calendar"></i>
                        ${createdDate}
                    </span>
                </div>
            </div>
        `;

        // Add click handler to view details
        element.addEventListener('click', () => {
            this.viewSubmissionDetails(submission);
        });

        return element;
    }

    getSubmissionIcon(type) {
        const icons = {
            'access-request': 'fas fa-key',
            'incident': 'fas fa-exclamation-triangle',
            'inspection': 'fas fa-search',
            'property-removal': 'fas fa-box',
            'training': 'fas fa-graduation-cap',
            'risk': 'fas fa-shield-alt',
            'permit': 'fas fa-file-signature',
            'event': 'fas fa-calendar-check'
        };
        return icons[type] || 'fas fa-file';
    }

    getSubmissionStatus(status) {
        const statusLower = (status || '').toLowerCase();
        
        if (['pending', 'submitted', 'under-review'].includes(statusLower)) {
            return { class: 'pending', text: 'Pending' };
        } else if (['in-progress', 'processing'].includes(statusLower)) {
            return { class: 'in-progress', text: 'In Progress' };
        } else if (['approved', 'completed'].includes(statusLower)) {
            return { class: 'approved', text: 'Approved' };
        } else if (['rejected', 'denied'].includes(statusLower)) {
            return { class: 'rejected', text: 'Rejected' };
        } else {
            return { class: 'pending', text: status || 'Unknown' };
        }
    }

    getSubmissionDetails(submission) {
        const details = [];

        // Add purpose/subject
        if (submission.purpose) {
            details.push({
                icon: 'fas fa-clipboard-list',
                text: submission.purpose.length > 50 ? 
                      submission.purpose.substring(0, 50) + '...' : 
                      submission.purpose
            });
        } else if (submission.subject) {
            details.push({
                icon: 'fas fa-clipboard-list',
                text: submission.subject.length > 50 ? 
                      submission.subject.substring(0, 50) + '...' : 
                      submission.subject
            });
        }

        // Add department
        if (submission.department) {
            const dept = typeof submission.department === 'object' ? 
                        submission.department.label || submission.department.name : 
                        submission.department;
            if (dept) {
                details.push({
                    icon: 'fas fa-building',
                    text: dept
                });
            }
        }

        // Add company
        if (submission.company) {
            const company = typeof submission.company === 'object' ? 
                           submission.company.name : 
                           submission.company;
            if (company) {
                details.push({
                    icon: 'fas fa-industry',
                    text: company
                });
            }
        }

        // Add priority if high
        if (submission.priority && submission.priority.toLowerCase() === 'high') {
            details.push({
                icon: 'fas fa-exclamation',
                text: 'High Priority'
            });
        }

        return details.slice(0, 3); // Limit to 3 details for clean display
    }

    viewSubmissionDetails(submission) {
        // Navigate to the appropriate board/page based on submission type
        const typeRoutes = {
            'access-request': 'accessboard.html',
            'incident': 'incidentboard.html',
            'inspection': 'inspectionboard.html',
            'property-removal': 'removalboard.html',
            'training': 'trainin.html',
            'risk': 'riskboard.html',
            'permit': 'ptwboard.html',
            'event': 'eventboard.html'
        };

        const route = typeRoutes[submission.submissionType];
        if (route) {
            // Store the submission ID to highlight it on the target page
            sessionStorage.setItem('highlightSubmission', submission.id);
            window.location.href = route;
        }
    }

    updateStats() {
        const total = this.submissions.length;
        const mySubmissions = this.submissions.filter(s => s.isCreator).length;
        const pendingApprovals = this.submissions.filter(s => 
            s.isApprover && this.isPendingStatus(s.status)
        ).length;
        const requiresAction = this.submissions.filter(s => 
            s.isApprover && this.isPendingStatus(s.status) && !s.isCreator
        ).length;

        document.getElementById('totalSubmissions').textContent = total;
        document.getElementById('mySubmissions').textContent = mySubmissions;
        document.getElementById('pendingApprovals').textContent = pendingApprovals;
        document.getElementById('requiresAction').textContent = requiresAction;
    }    showLoadingState() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const submissionList = document.getElementById('submissionList');

        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        submissionList.innerHTML = '';
        submissionList.appendChild(loadingState);
        
        // Add loading feedback
        console.log('Loading submission notifications...');
    }    showError(message) {
        const submissionList = document.getElementById('submissionList');
        submissionList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Submissions</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Initialize the submission notification manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SubmissionNotificationManager();
});
