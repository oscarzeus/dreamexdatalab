class NotificationManager {
    constructor() {
        this.notifications = this.loadNotifications();
        this.settings = this.loadSettings();
        this.firebaseInitialized = false;
        this.firebaseListener = null;
        
        this.initializeNotifications();
        this.initializePermissions();
        this.initializeSettings();
        this.initializeFirebase();
    }

    initializePermissions() {
        // Initial check for notification settings
        this.updateSettingsAccessibility();

        // Re-check permissions when role changes
        window.addEventListener('roleChanged', () => {
            this.updateSettingsAccessibility();
        });
    }

    updateSettingsAccessibility() {
        const hasEditPermission = window.roleManager?.hasPermission('notification_settings_view', 'edit');
        
        // Get notification settings elements
        const notifySubmitter = document.getElementById('notifySubmitter');
        const notifyApprovers = document.getElementById('notifyApprovers');
        const notifyOnComplete = document.getElementById('notifyOnComplete');
        const saveButton = document.getElementById('saveNotificationSettings');
        
        // Apply permission checks
        [notifySubmitter, notifyApprovers, notifyOnComplete].forEach(checkbox => {
            if (checkbox) {
                checkbox.disabled = !hasEditPermission;
            }
        });

        if (saveButton) {
            saveButton.style.display = hasEditPermission ? '' : 'none';
        }
    }

    initializeSettings() {
        const form = document.getElementById('notificationSettingsForm');
        if (!form) return;

        // Load saved settings into form
        Object.entries(this.settings).forEach(([key, value]) => {
            const input = form[key];
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value;
                }
            }
        });

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings(form);
        });
    }

    loadSettings() {
        const defaultSettings = {
            emailNotifications: true,
            notifySubmitter: true,
            notifyApprovers: true,
            notifyOnComplete: true,
            systemUpdates: true,
            securityAlerts: true,
            notificationDisplay: '30',
            showReadNotifications: true
        };

        const savedSettings = localStorage.getItem('notificationSettings');
        return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    }

    saveSettings(form) {
        const settings = {};
        Array.from(form.elements).forEach(input => {
            if (input.name && input.type !== 'submit') {
                settings[input.name] = input.type === 'checkbox' ? input.checked : input.value;
            }
        });

        this.settings = settings;
        localStorage.setItem('notificationSettings', JSON.stringify(settings));

        // Show success notification
        this.addNotification({
            type: 'Success',
            message: 'Notification settings saved successfully.'
        });

        // Update notification display based on new settings
        this.renderNotifications();
    }    initializeNotifications() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupNotificationElements();
            });
        } else {
            this.setupNotificationElements();
        }
    }

    setupNotificationElements() {
        // Add event listeners
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                const dropdown = document.querySelector('.notification-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('show');
                }
            });
        }

        // Handle mark all as read
        const markAllReadBtn = document.querySelector('.mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications')) {
                const dropdown = document.querySelector('.notification-dropdown');
                if (dropdown) {
                    dropdown.classList.remove('show');
                }
            }
        });        // Force update badge after setup
        this.updateNotificationBadge();
        this.renderNotifications();
          // Set up periodic badge updates
        this.startPeriodicBadgeUpdate();
        
        // Listen for storage changes to sync across tabs
        this.setupStorageSync();
        
        // Add sample notifications if none exist (for testing)
        this.addSampleNotificationsIfEmpty();
    }

    setupStorageSync() {
        // Listen for localStorage changes to sync notifications across tabs/pages
        window.addEventListener('storage', (e) => {
            if (e.key === 'notifications') {
                // Reload notifications from storage and update badge
                this.notifications = this.loadNotifications();
                this.updateNotificationBadge();
                this.renderNotifications();
            }
        });
    }

    startPeriodicBadgeUpdate() {
        // Update badge every 30 seconds to ensure it stays current
        setInterval(() => {
            this.updateNotificationBadge();
        }, 30000);
    }

    addSampleNotificationsIfEmpty() {
        // Only add sample notifications if there are no existing notifications
        if (this.notifications.length === 0) {
            this.addNotification({
                type: 'System Update',
                message: 'Welcome to the HSE Management System! Your dashboard is ready to use.'
            });
            
            this.addNotification({
                type: 'Approval Required',
                message: 'New safety training request requires your review.'
            });
            
            this.addNotification({
                type: 'Reminder',
                message: 'Monthly safety inspection is due next week.'
            });
        }
    }

    loadNotifications() {
        const notifications = localStorage.getItem('notifications');
        return notifications ? JSON.parse(notifications) : [];
    }    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
        
        // Force update badge immediately
        setTimeout(() => {
            this.updateNotificationBadge();
        }, 10);
        
        // Also update the notifications display
        this.renderNotifications();
    }

    addNotification(notification) {
        const newNotification = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };

        this.notifications.unshift(newNotification);
        this.saveNotifications();

        // Send email if enabled and it's an important notification
        if (this.settings.emailNotifications && 
            (notification.type === 'Approval Required' || 
             notification.type === 'Security Alert' ||
             notification.type === 'System Update')) {
            this.sendEmailNotification(newNotification);
        }
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        this.saveNotifications();
    }

    deleteNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveNotifications();
    }    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            const userNotifications = this.getUserNotifications();
            const unreadCount = userNotifications.filter(n => !n.read).length;
            badge.textContent = unreadCount.toString();
            
            // Show badge if there are unread notifications, hide if none
            if (unreadCount > 0) {
                badge.style.display = 'inline-block';
                badge.setAttribute('data-count', unreadCount);
            } else {
                badge.style.display = 'none';
                badge.removeAttribute('data-count');
            }
        } else {
            // Retry after a short delay if badge element not found
            setTimeout(() => {
                const retryBadge = document.querySelector('.notification-badge');
                if (retryBadge) {
                    const userNotifications = this.getUserNotifications();
                    const unreadCount = userNotifications.filter(n => !n.read).length;
                    retryBadge.textContent = unreadCount.toString();
                    
                    if (unreadCount > 0) {
                        retryBadge.style.display = 'inline-block';
                        retryBadge.setAttribute('data-count', unreadCount);
                    } else {
                        retryBadge.style.display = 'none';
                        retryBadge.removeAttribute('data-count');
                    }
                }
            }, 100);
        }
    }

    /**
     * Get notifications for the current user only
     * Filters out notifications that are not intended for the current user
     */
    getUserNotifications() {
        const currentUser = window.auth?.currentUser;
        if (!currentUser) {
            // If no user is logged in, show all notifications (backward compatibility)
            return this.notifications;
        }

        return this.notifications.filter(notification => {
            // Show notification if:
            // 1. It doesn't have a specific user target (general notifications)
            // 2. It's targeted to the current user's ID
            // 3. It's targeted to the current user's email
            // 4. It's a general system/success notification
            
            if (!notification.recipientUserId && !notification.recipientEmail) {
                // General notification without specific target
                return true;
            }
            
            if (notification.recipientUserId === currentUser.uid) {
                // Targeted to current user's ID
                return true;
            }
            
            if (notification.recipientEmail === currentUser.email) {
                // Targeted to current user's email
                return true;
            }
            
            // System notifications should be visible to all users
            if (notification.type === 'Success' || 
                notification.type === 'System Update' || 
                notification.type === 'Info') {
                return true;
            }
            
            return false;
        });
    }renderNotifications() {
        const notificationList = document.querySelector('.notification-list');
        if (!notificationList) return;

        notificationList.innerHTML = '';

        // Filter notifications based on settings and user
        let filteredNotifications = this.getUserNotifications();
        
        // Filter by date
        const daysToShow = parseInt(this.settings.notificationDisplay);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToShow);
        
        filteredNotifications = filteredNotifications.filter(notification => 
            new Date(notification.timestamp) > cutoffDate
        );

        // Filter read notifications if setting is disabled
        if (!this.settings.showReadNotifications) {
            filteredNotifications = filteredNotifications.filter(n => !n.read);
        }

        if (filteredNotifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-item">No notifications</div>';
            return;
        }

        filteredNotifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
            
            const date = new Date(notification.timestamp);
            const timeString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            notificationElement.innerHTML = `
                <div class="notification-header">
                    <span class="notification-type">${notification.type}</span>
                    <span class="notification-time">${timeString}</span>
                </div>
                <div class="notification-content">${notification.message}</div>
            `;

            notificationElement.addEventListener('click', () => {
                this.markAsRead(notification.id);
                if (notification.link) {
                    window.location.href = notification.link;
                }
            });

            notificationList.appendChild(notificationElement);
        });
    }

    sendEmailNotification(notification) {
        // This is a placeholder for email notification functionality
        // In a real application, this would integrate with an email service
        console.log('Sending email notification:', notification);
    }

    notifyFormSubmission(formType, formId) {
        // Notify the submitter
        this.addNotification({
            type: 'Submission',
            message: `Your ${formType} request (#${formId}) has been submitted successfully.`,
            link: `${formType.toLowerCase()}board.html?id=${formId}`
        });

        // Notify approvers
        const approvers = this.getApprovers(formType);
        approvers.forEach(approver => {
            this.addNotificationForUser(approver, {
                type: 'Approval Required',
                message: `New ${formType} request (#${formId}) requires your approval.`,
                link: `${formType.toLowerCase()}board.html?id=${formId}`
            });
        });
    }

    notifyStatusChange(formType, formId, newStatus, comment = '') {
        const submitter = this.getSubmitter(formId);
        this.addNotificationForUser(submitter, {
            type: 'Status Update',
            message: `Your ${formType} request (#${formId}) has been ${newStatus.toLowerCase()}.${comment ? ` Comment: ${comment}` : ''}`,
            link: `${formType.toLowerCase()}board.html?id=${formId}`
        });
    }

    getApprovers(formType) {
        // In a real application, this would fetch approvers from the server
        // For demo purposes, we'll return dummy data
        return ['approver1', 'approver2'];
    }

    getSubmitter(formId) {
        // In a real application, this would fetch the submitter from the server
        // For demo purposes, we'll return dummy data
        return 'submitter1';
    }    addNotificationForUser(userId, notification) {
        // In a real application, this would send the notification to a specific user
        // For demo purposes, we'll just add it to the current user's notifications
        this.addNotification(notification);
    }

    /**
     * Initialize Firebase integration for real-time notifications
     */
    async initializeFirebase() {
        try {
            // Wait for Firebase auth to be ready
            if (window.auth && window.db) {
                this.setupFirebaseListener();
            } else {
                // Wait and retry
                setTimeout(() => this.initializeFirebase(), 1000);
            }
        } catch (error) {
            console.error('Error initializing Firebase for notifications:', error);
        }
    }

    /**
     * Set up Firebase listener for real-time notifications
     */
    async setupFirebaseListener() {
        if (!window.auth?.currentUser || this.firebaseListener) return;

        try {
            const { ref, onValue, off } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
            
            // Listen to all notifications in Firebase
            const notificationsRef = ref(window.db, 'notifications');
            
            this.firebaseListener = onValue(notificationsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const firebaseNotifications = [];
                    snapshot.forEach((childSnapshot) => {
                        const notification = {
                            firebaseId: childSnapshot.key,
                            ...childSnapshot.val()
                        };
                        firebaseNotifications.push(notification);
                    });
                    
                    // Merge Firebase notifications with local ones
                    this.mergeFirebaseNotifications(firebaseNotifications);
                }
            });
            
            this.firebaseInitialized = true;
        } catch (error) {
            console.error('Error setting up Firebase listener:', error);
        }
    }

    /**
     * Merge Firebase notifications with local notifications
     */
    mergeFirebaseNotifications(firebaseNotifications) {
        const currentUser = window.auth?.currentUser;
        if (!currentUser) return;

        // Filter Firebase notifications for the current user
        const userFirebaseNotifications = firebaseNotifications.filter(notification => {
            // Check if notification is for current user
            if (notification.recipientUserId === currentUser.uid) return true;
            if (notification.recipientEmail === currentUser.email) return true;
            if (!notification.recipientUserId && !notification.recipientEmail) return true;
            return false;
        });

        // Convert Firebase notifications to local format
        const convertedNotifications = userFirebaseNotifications.map(fbNotification => ({
            id: fbNotification.firebaseId ? `fb_${fbNotification.firebaseId}` : Date.now(),
            timestamp: fbNotification.createdAt || new Date().toISOString(),
            read: fbNotification.status === 'read',
            type: fbNotification.type || 'Info',
            message: fbNotification.message || fbNotification.title || 'New notification',
            link: fbNotification.link,
            firebaseId: fbNotification.firebaseId,
            recipientUserId: fbNotification.recipientUserId,
            recipientEmail: fbNotification.recipientEmail,
            title: fbNotification.title
        }));

        // Merge with existing local notifications (avoid duplicates)
        const mergedNotifications = [...this.notifications];
        
        convertedNotifications.forEach(fbNotification => {
            const existingIndex = mergedNotifications.findIndex(n => 
                n.firebaseId === fbNotification.firebaseId || n.id === fbNotification.id
            );
            
            if (existingIndex >= 0) {
                // Update existing notification
                mergedNotifications[existingIndex] = fbNotification;
            } else {
                // Add new notification
                mergedNotifications.unshift(fbNotification);
            }
        });

        // Sort by timestamp (newest first)
        mergedNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        this.notifications = mergedNotifications;
        this.saveNotifications();
    }

    /**
     * Clean up Firebase listener
     */
    cleanup() {
        if (this.firebaseListener && window.db) {
            try {
                const { off } = require("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
                off(this.firebaseListener);
            } catch (error) {
                console.error('Error cleaning up Firebase listener:', error);
            }
        }
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// Export for use in other modules
window.notificationManager = notificationManager;

// Export as ES6 module as well
export default notificationManager;
export { NotificationManager };

// Monitor authentication state changes
if (window.auth) {
    window.auth.onAuthStateChanged((user) => {
        if (user && !notificationManager.firebaseInitialized) {
            // User logged in, initialize Firebase listener
            notificationManager.initializeFirebase();
        } else if (!user && notificationManager.firebaseListener) {
            // User logged out, cleanup Firebase listener
            notificationManager.cleanup();
            notificationManager.firebaseInitialized = false;
        }
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (notificationManager) {
        notificationManager.cleanup();
    }
});

// Ensure notification badge is updated on page load across all pages
window.addEventListener('load', () => {
    if (window.notificationManager) {
        window.notificationManager.updateNotificationBadge();
    }
});

// Also update when DOM content is loaded (earlier than window load)
document.addEventListener('DOMContentLoaded', () => {
    if (window.notificationManager) {
        setTimeout(() => {
            window.notificationManager.updateNotificationBadge();
        }, 100);
    }
});