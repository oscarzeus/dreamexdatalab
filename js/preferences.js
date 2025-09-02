import { getDatabase, ref, set, onValue, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getCurrentUser } from './auth.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class PreferencesManager {
    constructor() {
        this.db = getDatabase();
        this.form = document.getElementById('preferencesForm');
        this.notificationForm = document.getElementById('notificationPreferencesForm');
        this.initializeTabs();
        this.initializeNotificationPreferences();
        this.initializePreferences();
        this.setupUserPreferencesSync();
        this.initializeAdditionalMenuItems();
        this.initializeEmailHistory();
        this.itemsPerPage = 10;
        this.currentPage = 1;
        this.emailHistory = [];
    }    initializeTabs() {
        console.log('Initializing tabs...');
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        console.log('Found tab buttons:', tabButtons.length);
        console.log('Found tab panes:', tabPanes.length);
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-tab');
                console.log('Tab clicked:', targetId);
                
                // Remove active class from all buttons and panes
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // Add active class to clicked button and corresponding pane
                button.classList.add('active');
                const targetPane = document.getElementById(targetId);
                if (targetPane) {
                    targetPane.classList.add('active');
                    console.log('Activated tab pane:', targetId);
                } else {
                    console.error('Target pane not found:', targetId);
                }
                
                // Save last active tab
                localStorage.setItem('lastActivePreferencesTab', targetId);
            });
        });

        // Restore last active tab
        const lastActiveTab = localStorage.getItem('lastActivePreferencesTab');
        if (lastActiveTab) {
            const button = document.querySelector(`[data-tab="${lastActiveTab}"]`);
            if (button) button.click();
        }
        
        console.log('Tab initialization complete');
    }
    }

    initializeNotificationPreferences() {
        // Initialize notification preferences form
        if (this.notificationForm) {
            this.notificationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveNotificationPreferences();
            });

            // Initialize quiet hours toggle
            const quietHoursToggle = document.getElementById('quietHours');
            const quietHoursTimes = document.getElementById('quietHoursTimes');
            
            if (quietHoursToggle && quietHoursTimes) {
                quietHoursToggle.addEventListener('change', () => {
                    quietHoursTimes.style.display = quietHoursToggle.checked ? 'block' : 'none';
                });
            }

            // Initialize test notifications button
            const testButton = document.getElementById('testNotifications');
            if (testButton) {
                testButton.addEventListener('click', () => this.testNotifications());
            }

            // Initialize clear notifications button
            const clearButton = document.getElementById('clearNotifications');
            if (clearButton) {
                clearButton.addEventListener('click', () => this.clearAllNotifications());
            }

            // Load notification preferences
            this.loadNotificationPreferences();
        }
    }

    async loadNotificationPreferences() {
        const user = await getCurrentUser();
        if (!user) return;

        try {
            const prefsRef = ref(this.db, `notifications/${user.uid}/preferences`);
            const snapshot = await get(prefsRef);

            if (snapshot.exists()) {
                const preferences = snapshot.val();
                this.applyNotificationPreferences(preferences);
            } else {
                // Set default notification preferences
                await this.setDefaultNotificationPreferences();
            }
        } catch (error) {
            console.error('Error loading notification preferences:', error);
            this.showNotification('Error loading notification preferences', 'error');
        }
    }

    async saveNotificationPreferences() {
        const user = await getCurrentUser();
        if (!user) return;

        const preferences = this.getNotificationPreferences();

        try {
            await set(ref(this.db, `notifications/${user.uid}/preferences`), preferences);
            this.showNotification('Notification preferences saved successfully', 'success');
        } catch (error) {
            console.error('Error saving notification preferences:', error);
            this.showNotification('Error saving notification preferences', 'error');
        }
    }

    getNotificationPreferences() {
        const preferences = {};
        const form = this.notificationForm;

        // Email notifications
        preferences.emailAccessRequests = form.emailAccessRequests.checked;
        preferences.emailSafetyIncidents = form.emailSafetyIncidents.checked;
        preferences.emailInspections = form.emailInspections.checked;
        preferences.emailTraining = form.emailTraining.checked;
        preferences.emailSystemUpdates = form.emailSystemUpdates.checked;

        // In-app notifications
        preferences.inAppRealTime = form.inAppRealTime.checked;
        preferences.inAppSound = form.inAppSound.checked;
        preferences.inAppDesktop = form.inAppDesktop.checked;

        // Notification frequency
        preferences.notificationFrequency = form.notificationFrequency.value;

        // Priority settings
        preferences.emergencyAlerts = form.emergencyAlerts.checked;
        preferences.urgentApprovals = form.urgentApprovals.checked;

        // Quiet hours
        preferences.quietHours = {
            enabled: form.quietHours.checked,
            start: form.quietStart.value,
            end: form.quietEnd.value
        };

        return preferences;
    }

    applyNotificationPreferences(preferences) {
        const form = this.notificationForm;
        if (!form) return;

        // Apply email notification settings
        form.emailAccessRequests.checked = preferences.emailAccessRequests ?? true;
        form.emailSafetyIncidents.checked = preferences.emailSafetyIncidents ?? true;
        form.emailInspections.checked = preferences.emailInspections ?? true;
        form.emailTraining.checked = preferences.emailTraining ?? false;
        form.emailSystemUpdates.checked = preferences.emailSystemUpdates ?? false;

        // Apply in-app notification settings
        form.inAppRealTime.checked = preferences.inAppRealTime ?? true;
        form.inAppSound.checked = preferences.inAppSound ?? false;
        form.inAppDesktop.checked = preferences.inAppDesktop ?? false;

        // Apply frequency settings
        form.notificationFrequency.value = preferences.notificationFrequency ?? 'instant';

        // Apply priority settings
        form.emergencyAlerts.checked = preferences.emergencyAlerts ?? true;
        form.urgentApprovals.checked = preferences.urgentApprovals ?? true;

        // Apply quiet hours settings
        if (preferences.quietHours) {
            form.quietHours.checked = preferences.quietHours.enabled ?? false;
            form.quietStart.value = preferences.quietHours.start ?? '22:00';
            form.quietEnd.value = preferences.quietHours.end ?? '08:00';
            
            // Update quiet hours visibility
            document.getElementById('quietHoursTimes').style.display = 
                preferences.quietHours.enabled ? 'block' : 'none';
        }
    }

    async setDefaultNotificationPreferences() {
        const defaults = {
            emailAccessRequests: true,
            emailSafetyIncidents: true,
            emailInspections: true,
            emailTraining: false,
            emailSystemUpdates: false,
            inAppRealTime: true,
            inAppSound: false,
            inAppDesktop: false,
            notificationFrequency: 'instant',
            emergencyAlerts: true,
            urgentApprovals: true,
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
            }
        };

        this.applyNotificationPreferences(defaults);
        await this.saveNotificationPreferences();
    }

    testNotifications() {
        // Test email notification if browser notifications are enabled
        if (Notification.permission === 'granted') {
            new Notification('Test Notification', {
                body: 'This is a test notification from DreamEx DataLab',
                icon: '/images/logo.png'
            });
        }

        // Show in-app notification
        this.showNotification('Test notification sent successfully!', 'success');

        // Play notification sound if enabled
        if (document.getElementById('inAppSound').checked) {
            this.playNotificationSound();
        }
    }

    async clearAllNotifications() {
        if (!confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
            return;
        }

        const user = await getCurrentUser();
        if (!user) return;

        try {
            await set(ref(this.db, `notifications/${user.uid}/messages`), null);
            this.showNotification('All notifications cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            this.showNotification('Error clearing notifications', 'error');
        }
    }

    playNotificationSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIcAjJ+zPLNeSsFIHPE7+SXRAw=');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Could not play notification sound:', e));
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-message ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async initializePreferences() {
        // Load existing preferences
        const user = await getCurrentUser();
        if (!user) return;

        const prefsRef = ref(this.db, `userPreferences/${user.uid}`);
        const snapshot = await get(prefsRef);
        if (snapshot.exists()) {
            const preferences = snapshot.val();
            this.applyPreferencesToForm(preferences);
        }

        // Set up form submission
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.savePreferences();
        });

        // Set up reset functionality
        this.form.addEventListener('reset', () => {
            setTimeout(() => this.applyDefaultPreferences(), 0);
        });
    }

    setupUserPreferencesSync() {
        getCurrentUser().then(user => {
            if (!user) return;

            const prefsRef = ref(this.db, `userPreferences/${user.uid}`);
            onValue(prefsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const preferences = snapshot.val();
                    // Only update if the changes weren't made by this instance
                    if (!this.isSaving) {
                        this.applyPreferencesToForm(preferences);
                        // Dispatch event for other parts of the application
                        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
                            detail: preferences
                        }));
                    }
                }
            });
        });
    }

    async savePreferences() {
        const user = await getCurrentUser();
        if (!user) return;

        const preferences = this.getFormPreferences();
        this.isSaving = true;

        try {
            // Save to Firebase
            await set(ref(this.db, `userPreferences/${user.uid}`), preferences);
            
            // Save to localStorage for faster initial load
            localStorage.setItem('userPreferences', JSON.stringify(preferences));

            // Notify other components
            window.dispatchEvent(new CustomEvent('preferencesUpdated', {
                detail: preferences
            }));

            // Show success message
            alert('Preferences saved successfully');
        } catch (error) {
            console.error('Error saving preferences:', error);
            alert('Error saving preferences. Please try again.');
        } finally {
            this.isSaving = false;
        }
    }

    getFormPreferences() {
        const formData = new FormData(this.form);
        const preferences = {};
        
        for (const [key, value] of formData.entries()) {
            if (key === 'additionalMenuItems[]') {
                if (!preferences.additionalMenuItems) {
                    preferences.additionalMenuItems = [];
                }
                preferences.additionalMenuItems.push(value);
            } else {
                preferences[key] = value;
            }
        }

        preferences.spage = Array.from(document.getElementById('spage').selectedOptions).map(opt => opt.value);

        return preferences;
    }

    applyPreferencesToForm(preferences) {
        for (const [key, value] of Object.entries(preferences)) {
            const input = this.form.elements[key];
            if (input) {
                if (key === 'spage' && Array.isArray(value)) {
                    // Handle multiple select for spage
                    Array.from(input.options).forEach(option => {
                        option.selected = value.includes(option.value);
                    });
                } else {
                    input.value = value;
                }
            }
        }

        // Handle additional menu items
        if (Array.isArray(preferences.additionalMenuItems)) {
            this.selectedItemsContainer.innerHTML = '';
            preferences.additionalMenuItems.forEach(value => {
                const select = document.getElementById('additionalMenuSelect');
                const option = Array.from(select.options).find(opt => opt.value === value);
                if (option) {
                    const optGroup = option.parentElement.label;
                    const itemElement = document.createElement('div');
                    itemElement.className = 'selected-item';
                    itemElement.setAttribute('data-value', value);
                    itemElement.innerHTML = `
                        <span class="item-group">${optGroup}</span>
                        <span class="item-label">${option.text}</span>
                        <button type="button" class="remove-btn">
                            <i class="fas fa-times"></i>
                        </button>
                        <input type="hidden" name="additionalMenuItems[]" value="${value}">
                    `;
                    this.selectedItemsContainer.appendChild(itemElement);

                    itemElement.querySelector('.remove-btn').addEventListener('click', () => {
                        itemElement.remove();
                    });
                }
            });
        }

        // Update previews
        this.setupFormatPreviews();
    }

    async initializeEmailHistory() {
        const user = await getCurrentUser();
        if (!user) return;

        // Initialize search
        const searchInput = document.getElementById('emailHistorySearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterEmailHistory());
        }

        // Initialize refresh button
        const refreshBtn = document.getElementById('refreshEmailHistory');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshEmailHistory());
        }

        // Set up real-time listener for email history
        const emailTrackingRef = ref(this.db, 'email-tracking');
        onValue(emailTrackingRef, (snapshot) => {
            if (snapshot.exists()) {
                this.emailHistory = [];
                snapshot.forEach((childSnapshot) => {
                    const email = childSnapshot.val();
                    // Only show emails for the current user
                    if (email.recipientId === user.uid) {
                        this.emailHistory.push({
                            id: childSnapshot.key,
                            ...email,
                            timestamp: new Date(email.timestamp)
                        });
                    }
                });
                
                // Sort by timestamp descending
                this.emailHistory.sort((a, b) => b.timestamp - a.timestamp);
                
                // Update the table
                this.updateEmailHistoryTable();
            }
        });
    }

    filterEmailHistory() {
        const searchTerm = document.getElementById('emailHistorySearch').value.toLowerCase();
        const filteredHistory = this.emailHistory.filter(email => 
            email.subject?.toLowerCase().includes(searchTerm) ||
            email.recipient?.toLowerCase().includes(searchTerm) ||
            email.category?.toLowerCase().includes(searchTerm)
        );
        this.updateEmailHistoryTable(filteredHistory);
    }

    refreshEmailHistory() {
        const refreshBtn = document.getElementById('refreshEmailHistory');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
            
            // The real-time listener will automatically update the data
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                this.showNotification('Email history refreshed', 'success');
            }, 1000);
        }
    }

    updateEmailHistoryTable(data = this.emailHistory) {
        const tbody = document.getElementById('emailHistoryTableBody');
        const pagination = document.getElementById('emailHistoryPagination');
        if (!tbody || !pagination) return;

        // Calculate pagination
        const totalPages = Math.ceil(data.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentData = data.slice(startIndex, endIndex);

        // Clear existing rows
        tbody.innerHTML = '';

        // Add new rows
        currentData.forEach(email => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(email.timestamp)}</td>
                <td>${this.escapeHtml(email.subject || '')}</td>
                <td>${this.escapeHtml(email.recipient || '')}</td>
                <td>
                    <span class="status-badge status-${email.status?.toLowerCase() || 'pending'}">
                        ${this.capitalizeFirstLetter(email.status || 'Pending')}
                    </span>
                </td>
                <td>${this.escapeHtml(email.category || '')}</td>
            `;
            tbody.appendChild(row);
        });

        // Update pagination
        this.updatePagination(totalPages, pagination);
    }

    updatePagination(totalPages, paginationElement) {
        let paginationHtml = '';
        
        // Previous button
        paginationHtml += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.preferencesManager.changePage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `
                <button class="${this.currentPage === i ? 'active' : ''}" onclick="window.preferencesManager.changePage(${i})">
                    ${i}
                </button>
            `;
        }

        // Next button
        paginationHtml += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.preferencesManager.changePage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationElement.innerHTML = paginationHtml;
    }

    changePage(page) {
        this.currentPage = page;
        this.updateEmailHistoryTable();
    }

    formatDate(date) {
        return new Date(date).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async setDefaultPreferences() {
        const defaults = {
            language: 'en',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12',
            firstDayOfWeek: '0',
            measurementSystem: 'metric',
            fontScale: '1',
            contrastMode: 'normal',
            animationReduction: 'none',
            screenReaderOptimization: 'auto',
            colorScheme: 'system',
            accentColor: 'blue',
            defaultFont: 'Inter',
            fontSize: '14',
            density: 'comfortable',
            defaultPageSize: '25',
            dataRefreshRate: '60',
            defaultSort: 'newest',
            spage: []
        };

        this.applyPreferencesToForm(defaults);
        this.savePreferences();
    }

    setupFormatPreviews() {
        const now = new Date();
        
        // Date format preview
        const dateFormat = this.form.elements.dateFormat;
        if (dateFormat) {
            const preview = dateFormat.nextElementSibling;
            preview.textContent = new Intl.DateTimeFormat(this.form.elements.language.value, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(now);
        }

        // Time format preview
        const timeFormat = this.form.elements.timeFormat;
        if (timeFormat) {
            const preview = timeFormat.nextElementSibling;
            preview.textContent = new Intl.DateTimeFormat(this.form.elements.language.value, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: timeFormat.value === '12'
            }).format(now);
        }

        // Font preview
        const defaultFont = this.form.elements.defaultFont;
        if (defaultFont) {
            const preview = defaultFont.nextElementSibling;
            preview.style.fontFamily = defaultFont.value;
        }

        // Font size preview
        const fontSize = this.form.elements.fontSize;
        if (fontSize) {
            const preview = fontSize.nextElementSibling;
            preview.style.fontSize = `${fontSize.value}px`;
        }
    }

    initializeAdditionalMenuItems() {
        const addBtn = document.getElementById('addAdditionalMenuItemBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addAdditionalMenuItem());
        }

        // Initialize selected items container
        this.selectedItemsContainer = document.getElementById('selectedAdditionalItems');
    }

    addAdditionalMenuItem() {
        const select = document.getElementById('additionalMenuSelect');
        const selectedOption = select.options[select.selectedIndex];
        const optionValue = selectedOption.value;
        const optionLabel = selectedOption.text;
        const optGroup = selectedOption.parentElement.label;

        // Check if item is already selected
        if (!this.selectedItemsContainer.querySelector(`[data-value="${optionValue}"]`)) {
            const itemElement = document.createElement('div');
            itemElement.className = 'selected-item';
            itemElement.setAttribute('data-value', optionValue);
            itemElement.innerHTML = `
                <span class="item-group">${optGroup}</span>
                <span class="item-label">${optionLabel}</span>
                <button type="button" class="remove-btn">
                    <i class="fas fa-times"></i>
                </button>
                <input type="hidden" name="additionalMenuItems[]" value="${optionValue}">
            `;

            this.selectedItemsContainer.appendChild(itemElement);

            // Add remove event listener
            itemElement.querySelector('.remove-btn').addEventListener('click', () => {
                itemElement.remove();
            });
        }
    }
}

// Initialize preferences manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.preferencesManager = new PreferencesManager();
});

const fieldOptions = {
    'department': [
        { label: 'HSE', value: 'hse', color: '#dc3545', enabled: true },
        { label: 'Operations', value: 'operations', color: '#0d6efd', enabled: true },
        { label: 'Maintenance', value: 'maintenance', color: '#fd7e14', enabled: true },
        { label: 'Production', value: 'production', color: '#198754', enabled: true },
        { label: 'Logistics', value: 'logistics', color: '#6f42c1', enabled: true },
        { label: 'HR', value: 'hr', color: '#20c997', enabled: true },
        { label: 'IT', value: 'it', color: '#17a2b8', enabled: true }
    ]
};