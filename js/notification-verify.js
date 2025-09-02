// Notification System Verification Script
// Run this in the browser console to check notification status

function verifyNotificationSystem() {
    console.log('=== NOTIFICATION SYSTEM VERIFICATION ===');
    
    // Check if NotificationManager exists
    if (typeof window.notificationManager === 'undefined') {
        console.error('❌ NotificationManager not found on window object');
        return;
    }
    
    console.log('✅ NotificationManager found');
    
    // Check current notifications
    const notifications = window.notificationManager.notifications;
    console.log(`📊 Total notifications: ${notifications.length}`);
    
    const unread = notifications.filter(n => !n.read);
    console.log(`📬 Unread notifications: ${unread.length}`);
    
    // Check badge element
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        console.log('✅ Notification badge element found');
        console.log(`🔢 Badge text: "${badge.textContent}"`);
        console.log(`👁️ Badge visible: ${badge.style.display !== 'none'}`);
    } else {
        console.error('❌ Notification badge element not found');
    }
    
    // List all notifications
    if (notifications.length > 0) {
        console.log('\n📋 All notifications:');
        notifications.forEach((n, index) => {
            console.log(`${index + 1}. [${n.read ? 'READ' : 'UNREAD'}] ${n.type}: ${n.message}`);
        });
    } else {
        console.log('📭 No notifications found');
    }
    
    // Test badge update
    console.log('\n🔄 Testing badge update...');
    window.notificationManager.updateNotificationBadge();
    
    setTimeout(() => {
        const badgeAfter = document.querySelector('.notification-badge');
        if (badgeAfter) {
            console.log(`🔢 Badge text after update: "${badgeAfter.textContent}"`);
            console.log(`👁️ Badge visible after update: ${badgeAfter.style.display !== 'none'}`);
        }
    }, 100);
    
    console.log('\n=== VERIFICATION COMPLETE ===');
}

// Add test notification function
function addTestNotificationConsole() {
    if (window.notificationManager) {
        window.notificationManager.addNotification({
            type: 'Console Test',
            message: 'Test notification added from console at ' + new Date().toLocaleTimeString()
        });
        console.log('✅ Test notification added');
        verifyNotificationSystem();
    } else {
        console.error('❌ NotificationManager not available');
    }
}

// Export functions to global scope for console use
window.verifyNotificationSystem = verifyNotificationSystem;
window.addTestNotificationConsole = addTestNotificationConsole;

console.log('Notification verification script loaded. Use verifyNotificationSystem() or addTestNotificationConsole() in console.');
