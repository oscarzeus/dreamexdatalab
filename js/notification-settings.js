import { getDatabase, ref, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class NotificationSettingsManager {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.initializeNotificationSettings();
    }

    initializeNotificationSettings() {
        const form = document.getElementById('notificationSettingsForm');
        if (!form) return;

        // Load current settings
        this.loadSettings();

        // Handle form submission
        form.addEventListener('submit', (e) => this.handleSettingsUpdate(e));
    }

    loadSettings() {
        const user = this.auth.currentUser;
        if (!user) return;

        const settingsRef = ref(this.db, `users/${user.uid}/notificationSettings`);
        onValue(settingsRef, (snapshot) => {
            const settings = snapshot.val() || {};
            
            // Update form fields with saved settings
            document.getElementById('emailNotifications').checked = settings.emailNotifications ?? true;
            document.getElementById('desktopNotifications').checked = settings.desktopNotifications ?? true;
            document.getElementById('notifyApprovalRequired').checked = settings.notifyApprovalRequired ?? true;
            document.getElementById('notifyStatusChanges').checked = settings.notifyStatusChanges ?? true;
            document.getElementById('notifyComments').checked = settings.notifyComments ?? true;
            document.getElementById('notifyReminders').checked = settings.notifyReminders ?? true;
            
            document.getElementById('notificationFrequency').value = settings.notificationFrequency || 'instant';
            document.getElementById('quietHoursStart').value = settings.quietHours?.start || '';
            document.getElementById('quietHoursEnd').value = settings.quietHours?.end || '';

            // Request desktop notification permission if enabled
            if (settings.desktopNotifications) {
                this.requestNotificationPermission();
            }
        }, {
            onlyOnce: true
        });
    }

    async handleSettingsUpdate(e) {
        e.preventDefault();
        const form = e.target;
        const user = this.auth.currentUser;
        
        if (!user) {
            window.notificationManager.addNotification({
                type: 'Error',
                message: 'You must be logged in to update notification settings.'
            });
            return;
        }

        try {
            const updates = {
                emailNotifications: form.emailNotifications.checked,
                desktopNotifications: form.desktopNotifications.checked,
                notifyApprovalRequired: form.notifyApprovalRequired.checked,
                notifyStatusChanges: form.notifyStatusChanges.checked,
                notifyComments: form.notifyComments.checked,
                notifyReminders: form.notifyReminders.checked,
                notificationFrequency: form.notificationFrequency.value,
                quietHours: {
                    start: form.quietHoursStart.value,
                    end: form.quietHoursEnd.value
                },
                lastModifiedAt: new Date().toISOString()
            };

            // Update in Firebase Database
            await update(ref(this.db, `users/${user.uid}/notificationSettings`), updates);

            // Request notification permission if desktop notifications are enabled
            if (updates.desktopNotifications) {
                await this.requestNotificationPermission();
            }

            window.notificationManager.addNotification({
                type: 'Success',
                message: 'Notification settings updated successfully.'
            });
        } catch (error) {
            console.error('Error updating notification settings:', error);
            window.notificationManager.addNotification({
                type: 'Error',
                message: `Failed to update notification settings: ${error.message}`
            });
        }
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support desktop notifications');
            return;
        }

        if (Notification.permission === 'granted') {
            return;
        }

        if (Notification.permission !== 'denied') {
            await Notification.requestPermission();
        }
    }
}

// Initialize notification settings manager
const notificationSettingsManager = new NotificationSettingsManager();

// Export for use in other modules
window.notificationSettingsManager = notificationSettingsManager;