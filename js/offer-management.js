/**
 * Offer Management Functions for Dreamex Datalab HSE
 * Handles offer acceptance, storage, and management
 */

/**
 * Accept an offer and move it to acceptedoffers path
 * @param {string} offerId - The ID of the offer to accept
 */
async function acceptOffer(offerId) {
    try {
        console.log('Accepting offer:', offerId);
        
        // Get the offer data from pending offers
        const offerRef = firebase.database().ref(`offers/${offerId}`);
        const snapshot = await offerRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('Offer not found');
        }
        
        const offerData = snapshot.val();
        
        // Prepare accepted offer data
        const acceptedOfferData = {
            ...offerData,
            status: 'accepted',
            acceptedAt: firebase.database.ServerValue.TIMESTAMP,
            acceptedDate: new Date().toISOString(),
            originalOfferId: offerId,
            acceptanceMethod: 'system',
            processedBy: getCurrentUser() || 'system'
        };
        
        // Store in acceptedoffers path
        const acceptedOfferRef = firebase.database().ref(`acceptedoffers/${offerId}`);
        await acceptedOfferRef.set(acceptedOfferData);
        
        // Update original offer status to accepted
        await offerRef.update({
            status: 'accepted',
            acceptedAt: firebase.database.ServerValue.TIMESTAMP,
            acceptedDate: new Date().toISOString()
        });
        
        console.log('Offer accepted successfully and stored in acceptedoffers');
        showNotification('Offer accepted successfully!', 'success');
        
        // Refresh the current view
        await refreshCurrentTab();
        
        // Update statistics
        await updateOfferStatistics();
        
        // Log the acceptance for audit
        await logOfferAction(offerId, 'accepted', 'Offer accepted and moved to acceptedoffers');
        
        return { success: true, message: 'Offer accepted successfully' };
        
    } catch (error) {
        console.error('Error accepting offer:', error);
        showNotification('Failed to accept offer: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Decline an offer
 * @param {string} offerId - The ID of the offer to decline
 * @param {string} reason - Reason for declining (optional)
 */
async function declineOffer(offerId, reason = '') {
    try {
        console.log('Declining offer:', offerId);
        
        const offerRef = firebase.database().ref(`offers/${offerId}`);
        const snapshot = await offerRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('Offer not found');
        }
        
        // Update offer status to declined
        await offerRef.update({
            status: 'declined',
            declinedAt: firebase.database.ServerValue.TIMESTAMP,
            declinedDate: new Date().toISOString(),
            declineReason: reason || 'No reason provided',
            processedBy: getCurrentUser() || 'system'
        });
        
        console.log('Offer declined successfully');
        showNotification('Offer declined successfully!', 'success');
        
        // Refresh the current view
        await refreshCurrentTab();
        
        // Update statistics
        await updateOfferStatistics();
        
        // Log the decline for audit
        await logOfferAction(offerId, 'declined', `Offer declined: ${reason}`);
        
        return { success: true, message: 'Offer declined successfully' };
        
    } catch (error) {
        console.error('Error declining offer:', error);
        showNotification('Failed to decline offer: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Load accepted offers from Firebase
 */
async function loadAcceptedOffers() {
    try {
        console.log('Loading accepted offers...');
        
        const acceptedRef = firebase.database().ref('acceptedoffers');
        const snapshot = await acceptedRef.once('value');
        
        const acceptedOffersData = snapshot.exists() ? snapshot.val() : {};
        console.log('Accepted offers loaded:', Object.keys(acceptedOffersData).length, 'offers');
        
        return acceptedOffersData;
    } catch (error) {
        console.error('Error loading accepted offers:', error);
        throw error;
    }
}

/**
 * Load all offers from Firebase
 */
async function loadAllOffers() {
    try {
        const snapshot = await firebase.database().ref('offers').once('value');
        return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
        console.error('Error loading all offers:', error);
        return {};
    }
}

/**
 * Load pending offers from Firebase
 */
async function loadPendingOffers() {
    try {
        const snapshot = await firebase.database().ref('offers')
            .orderByChild('status')
            .equalTo('pending')
            .once('value');
        return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
        console.error('Error loading pending offers:', error);
        return {};
    }
}

/**
 * Update offer statistics
 */
async function updateOfferStatistics() {
    try {
        // Load all offers data
        const [pendingOffers, acceptedOffers, allOffers] = await Promise.all([
            loadPendingOffers(),
            loadAcceptedOffers(),
            loadAllOffers()
        ]);
        
        // Calculate statistics
        const totalCount = Object.keys(allOffers).length;
        const pendingCount = Object.keys(pendingOffers).length;
        const acceptedCount = Object.keys(acceptedOffers).length;
        
        // Count declined offers
        const declinedCount = Object.values(allOffers).filter(offer => offer.status === 'declined').length;
        
        // Count expired offers (offers older than 30 days and not accepted/declined)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const expiredCount = Object.values(allOffers).filter(offer => {
            if (offer.status === 'accepted' || offer.status === 'declined') return false;
            const createdDate = new Date(offer.createdAt || offer.offerDate);
            return createdDate < thirtyDaysAgo;
        }).length;
        
        // Update DOM elements
        const elements = {
            totalOffers: totalCount,
            pendingOffers: pendingCount,
            acceptedOffers: acceptedCount,
            declinedOffers: declinedCount,
            expiredOffers: expiredCount
        };
        
        Object.entries(elements).forEach(([elementId, count]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = count;
            }
        });
        
        console.log('Offer statistics updated:', elements);
        
        return elements;
        
    } catch (error) {
        console.error('Error updating offer statistics:', error);
        return null;
    }
}

/**
 * Create a table row for accepted offer
 */
function createAcceptedOfferRow(offerId, offer) {
    const row = document.createElement('tr');
    
    const candidateName = offer.candidateName || 'Unknown Candidate';
    const jobTitle = offer.jobTitle || offer.position || 'Unknown Position';
    const department = offer.department || 'Unknown Department';
    const salary = offer.salary ? `$${parseFloat(offer.salary).toLocaleString()}` : 'N/A';
    const acceptedDate = offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleDateString() : 
                         offer.acceptedDate ? new Date(offer.acceptedDate).toLocaleDateString() : 'N/A';
    const offerDate = offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : 'N/A';
    
    row.innerHTML = `
        <td>
            <div class="candidate-info">
                <div class="candidate-avatar">${candidateName.charAt(0).toUpperCase()}</div>
                <div class="candidate-details">
                    <div class="candidate-name">${escapeHtml(candidateName)}</div>
                    <div class="candidate-email">${escapeHtml(offer.candidateEmail || 'N/A')}</div>
                </div>
            </div>
        </td>
        <td>${escapeHtml(jobTitle)}</td>
        <td>${escapeHtml(department)}</td>
        <td class="job-salary">${salary}</td>
        <td>${offerDate}</td>
        <td>${acceptedDate}</td>
        <td>
            <span class="status-badge status-offer-accepted">Accepted</span>
        </td>
        <td class="actions-cell">
            <div class="action-buttons">
                <button class="btn-action btn-view" onclick="viewOffer('${offerId}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action btn-info" onclick="viewOfferContract('${offerId}')" title="View Contract">
                    <i class="fas fa-file-contract"></i>
                </button>
                <button class="btn-action btn-mail" onclick="sendWelcomeEmail('${offerId}')" title="Send Welcome Email">
                    <i class="fas fa-envelope"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

/**
 * Render accepted offers table
 */
async function renderAcceptedOffersTable() {
    try {
        showLoadingState('acceptedOffers');
        
        const acceptedOffers = await loadAcceptedOffers();
        const tableBody = document.getElementById('acceptedOffersTableBody');
        
        if (!tableBody) {
            console.error('Accepted offers table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        const offerEntries = Object.entries(acceptedOffers);
        
        if (offerEntries.length === 0) {
            showEmptyState('acceptedOffers');
            return;
        }
        
        offerEntries.forEach(([offerId, offer]) => {
            const row = createAcceptedOfferRow(offerId, offer);
            tableBody.appendChild(row);
        });
        
        hideLoadingState('acceptedOffers');
        showTable('acceptedOffers');
        
    } catch (error) {
        console.error('Error rendering accepted offers table:', error);
        showErrorState('acceptedOffers', 'Failed to load accepted offers');
    }
}

/**
 * Log offer actions for audit trail
 */
async function logOfferAction(offerId, action, details) {
    try {
        const logData = {
            offerId,
            action,
            details,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            date: new Date().toISOString(),
            user: getCurrentUser() || 'system'
        };
        
        await firebase.database().ref(`offerLogs/${offerId}/${Date.now()}`).set(logData);
        console.log('Offer action logged:', logData);
    } catch (error) {
        console.error('Error logging offer action:', error);
    }
}

/**
 * Get current user (you may need to adapt this based on your auth system)
 */
function getCurrentUser() {
    // Adapt this based on your authentication system
    const user = firebase.auth().currentUser;
    return user ? user.email : null;
}

/**
 * Refresh the current active tab
 */
async function refreshCurrentTab() {
    const activeTab = document.querySelector('.tab-nav-btn.active');
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab');
        await switchTab(tabId);
    }
}

/**
 * Show loading state for specific tab
 */
function showLoadingState(tabName) {
    const loadingElement = document.getElementById(`${tabName}LoadingState`);
    const tableElement = document.getElementById(`${tabName}Table`);
    const emptyElement = document.getElementById(`${tabName}EmptyState`);
    
    if (loadingElement) loadingElement.style.display = 'block';
    if (tableElement) tableElement.style.display = 'none';
    if (emptyElement) emptyElement.style.display = 'none';
}

/**
 * Hide loading state for specific tab
 */
function hideLoadingState(tabName) {
    const loadingElement = document.getElementById(`${tabName}LoadingState`);
    if (loadingElement) loadingElement.style.display = 'none';
}

/**
 * Show table for specific tab
 */
function showTable(tabName) {
    const tableElement = document.getElementById(`${tabName}Table`);
    if (tableElement) tableElement.style.display = 'table';
}

/**
 * Show empty state for specific tab
 */
function showEmptyState(tabName) {
    const emptyElement = document.getElementById(`${tabName}EmptyState`);
    const tableElement = document.getElementById(`${tabName}Table`);
    
    if (emptyElement) emptyElement.style.display = 'block';
    if (tableElement) tableElement.style.display = 'none';
}

/**
 * Show error state for specific tab
 */
function showErrorState(tabName, message) {
    hideLoadingState(tabName);
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        console.error(message);
    }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, function(m) { return map[m]; }) : '';
}

// Export functions for use in offer.html
if (typeof window !== 'undefined') {
    window.acceptOffer = acceptOffer;
    window.declineOffer = declineOffer;
    window.loadAcceptedOffers = loadAcceptedOffers;
    window.updateOfferStatistics = updateOfferStatistics;
    window.renderAcceptedOffersTable = renderAcceptedOffersTable;
    window.createAcceptedOfferRow = createAcceptedOfferRow;
}
