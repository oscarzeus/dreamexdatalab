const fs = require('fs');
const path = require('path');

// Firebase v8 script tags to add
const firebaseScripts = `
    <!-- Firebase v8 CDN for compatibility -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js"></script>`;

// List of HTML files that use auth.js
const htmlFiles = [
    'dashboard.html',
    'staff.html',
    'roles.html',
    'settings.html',
    'profile.html',
    'session.html',
    'tasks.html',
    'waste.html',
    'wasteboard.html',
    'trainingboard.html',
    'trainingform.html',
    'riskboard.html',
    'risk.html',
    'recruit.html',
    'recruitboard.html',
    'company.html',
    'companymanagement.html',
    'approval-settings.html',
    'unauthorized.html'
];

function addFirebaseScripts(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if Firebase v8 scripts are already present
        if (content.includes('firebase-app.js') && content.includes('8.10.1')) {
            console.log(`✅ Firebase v8 already present in: ${filePath}`);
            return;
        }

        // Remove any existing Firebase v10 imports
        content = content.replace(/import.*firebasejs\/10\.\d+\.\d+.*\n/g, '');
        
        // Find the head section and add Firebase scripts
        const headMatch = content.match(/<head[^>]*>/i);
        if (headMatch) {
            const headEndIndex = content.indexOf('</head>', headMatch.index);
            if (headEndIndex !== -1) {
                const beforeHead = content.substring(0, headEndIndex);
                const afterHead = content.substring(headEndIndex);
                
                const newContent = beforeHead + firebaseScripts + '\n' + afterHead;
                fs.writeFileSync(filePath, newContent);
                console.log(`✅ Added Firebase v8 scripts to: ${filePath}`);
            }
        } else {
            console.log(`⚠️  Could not find <head> section in: ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
}

// Process all HTML files
console.log('🔧 Adding Firebase v8 scripts to HTML files...\n');

htmlFiles.forEach(file => {
    addFirebaseScripts(file);
});

console.log('\n✅ Firebase v8 script addition complete!');
