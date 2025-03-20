// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCUTmTn0rRBb0M-UkQJxnUMrWqXYU_BgIc",
    authDomain: "users-8be65.firebaseapp.com",
    databaseURL: "https://users-8be65-default-rtdb.firebaseio.com",
    projectId: "users-8be65",
    storageBucket: "users-8be65.appspot.com",
    messagingSenderId: "829083030831",
    appId: "1:829083030831:web:36a370e62691e560bc3dda"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();

/**
 * Send notification to line manager when assigned to an event
 * @param {string} lineManagerId - Firebase UID of the line manager
 * @param {Object} eventData - Event details including title and ID
 * @returns {Promise} - Promise that resolves when notification is sent
 */
async function notifyLineManager(lineManagerId, eventData) {
    try {
        if (!lineManagerId) {
            console.log('No line manager specified, skipping notification');
            return;
        }

        // Create notification object
        const notification = {
            userId: lineManagerId,
            type: 'event_assignment',
            title: 'New Event Assignment',
            message: `You have been assigned as line manager for event: ${eventData.title}`,
            eventId: eventData.id,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            read: false
        };

        // Save notification to database
        const newNotificationRef = database.ref('notifications').push();
        await newNotificationRef.set(notification);

        // Update unread notification count for the line manager
        const userRef = database.ref(`users/${lineManagerId}`);
        
        // Use a transaction to safely increment the counter
        await userRef.child('unreadNotifications').transaction(count => {
            return (count || 0) + 1;
        });

        console.log(`Line manager ${lineManagerId} notified about event assignment`);
        return newNotificationRef.key;
    } catch (error) {
        console.error('Error sending line manager notification:', error);
        throw error;
    }
}

// Listen for event form submissions
document.addEventListener('DOMContentLoaded', function() {
    // Find event submission forms
    const eventForms = document.querySelectorAll('form[data-event-form], form.event-form');
    
    eventForms.forEach(form => {
        form.addEventListener('submit', handleEventSubmission);
    });
    
    // Also listen for dynamically added forms
    document.addEventListener('submit', function(e) {
        if (e.target.getAttribute('data-event-form') !== null || 
            e.target.classList.contains('event-form')) {
            handleEventSubmission(e);
        }
    });
});

/**
 * Handle event submission and send notifications
 * @param {Event} e - Form submission event
 */
async function handleEventSubmission(e) {
    try {
        // Don't prevent default form submission if it's coming from the global listener
        if (e.type === 'submit' && e.currentTarget === document) {
            // Let the form submission continue normally
        } else {
            e.preventDefault(); // Prevent default form submission initially
        }
        
        const form = e.target;
        const formData = new FormData(form);
        
        // Get line manager ID (assuming it's in a select or input field)
        const lineManagerId = formData.get('lineManager') || 
                             form.querySelector('[name="lineManager"]')?.value ||
                             form.querySelector('.line-manager-select')?.value;
        
        // Get event details
        const eventTitle = formData.get('title') || 
                          formData.get('eventTitle') || 
                          form.querySelector('[name="title"]')?.value ||
                          form.querySelector('[name="eventTitle"]')?.value ||
                          'New Event';
                          
        // Create event data object for notification
        const eventData = {
            id: 'event_' + Date.now(),
            title: eventTitle,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            // Add other event properties as needed
        };
        
        // If we have a line manager, send notification
        if (lineManagerId) {
            // Send notification to line manager
            await notifyLineManager(lineManagerId, eventData);
            
            // Show success message if the form isn't being auto-submitted
            if (e.type !== 'submit' || e.currentTarget !== document) {
                alert('Event submitted and line manager notified!');
            }
        }
        
        // If this was intercepted by our custom handler, submit the form now
        if (e.type === 'submit' && e.currentTarget !== document && !e.defaultPrevented) {
            form.submit();
        }
        
    } catch (error) {
        console.error('Error processing event submission:', error);
        // Don't block form submission on error
    }
}

// Expose functions for use in other scripts
window.eventNotifications = {
    notifyLineManager
};
