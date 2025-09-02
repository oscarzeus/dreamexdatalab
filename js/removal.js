import { getDatabase, ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

class RemovalManager {
    constructor() {
        this.db = getDatabase();
        this.initializeForm();
    }

    initializeForm() {
        const form = document.getElementById('removalRequestForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Check if user has permission to create removal requests
            if (!window.roleManager?.hasPermission('removal_view', 'create')) {
                window.notificationManager?.addNotification({
                    type: 'Error',
                    message: 'You do not have permission to create removal requests.'
                });
                return;
            }

            const formData = {
                propertyType: form.propertyType.value,
                propertyDescription: form.propertyDescription.value,
                quantity: parseInt(form.quantity.value),
                purpose: form.purpose.value,
                removalDate: form.removalDate.value,
                returnDate: form.returnDate.value || null,
                department: form.department.value,
                status: 'pending',
                requestedBy: window.authManager.getUser()?.uid,
                requestedAt: serverTimestamp()
            };

            try {
                await push(ref(this.db, 'removal_requests'), formData);
                window.notificationManager?.addNotification({
                    type: 'Success',
                    message: 'Property removal request submitted successfully.'
                });
                window.location.href = 'removalboard.html';
            } catch (error) {
                console.error('Error submitting removal request:', error);
                window.notificationManager?.addNotification({
                    type: 'Error',
                    message: `Failed to submit request: ${error.message}`
                });
            }
        });

        // Set minimum date for removal and return date inputs
        const today = new Date().toISOString().split('T')[0];
        form.removalDate.min = today;
        form.returnDate.min = today;

        // Update return date min value when removal date changes
        form.removalDate.addEventListener('change', () => {
            form.returnDate.min = form.removalDate.value;
            if (form.returnDate.value && form.returnDate.value < form.removalDate.value) {
                form.returnDate.value = form.removalDate.value;
            }
        });
    }
}

// Initialize removal manager
const removalManager = new RemovalManager();