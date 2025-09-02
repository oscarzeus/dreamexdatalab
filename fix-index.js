// RECOVERY SCRIPT FOR INDEX.HTML
// This script will fix the broken login system

console.log('🔧 Starting index.html recovery...');

// Backup current file
const fs = require('fs');
const path = require('path');

const indexPath = 'index.html';
const backupPath = 'index.html.broken';

try {
  // Create backup
  fs.copyFileSync(indexPath, backupPath);
  console.log('✅ Backup created: index.html.broken');
  
  // Read current file
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Find the broken script section (look for Firebase script imports)
  const scriptStartPattern = /<!-- Domain-specific login script/;
  const scriptEndPattern = /<script src="js\/user-display\.js"><\/script>/;
  
  const startMatch = content.search(scriptStartPattern);
  const endMatch = content.search(scriptEndPattern);
  
  if (startMatch !== -1 && endMatch !== -1) {
    // Replace the broken section with clean version
    const beforeScript = content.substring(0, startMatch);
    const afterScript = content.substring(endMatch + '<script src="js/user-display.js"></script>'.length);
    
    const cleanScript = `  <!-- Self-contained login system - no external dependencies -->
  <script>
    // Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyCUTmTn0rRBb0M-UkQJxnUMrWqXYU_BgIc",
      authDomain: "users-8be65.firebaseapp.com",
      databaseURL: "https://users-8be65-default-rtdb.firebaseio.com",
      projectId: "users-8be65",
      storageBucket: "users-8be65.firebasestorage.app",
      messagingSenderId: "829083030831",
      appId: "1:829083030831:web:36a370e62691e560bc3dda"
    };

    // Initialize Firebase when page loads
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof window.firebase !== 'undefined' && (!window.firebase.apps || window.firebase.apps.length === 0)) {
        try {
          window.firebase.initializeApp(firebaseConfig);
          console.log('✅ Firebase initialized successfully');
        } catch (error) {
          console.error('❌ Firebase initialization failed:', error);
        }
      }
    });

    // Self-contained login function
    window.handleDomainLogin = async function(email, password) {
      // Wait for Firebase to be available
      let retryCount = 0;
      while (typeof window.firebase === 'undefined' && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
      }
      
      if (typeof window.firebase === 'undefined') {
        throw new Error('Login system not available. Please refresh the page and try again.');
      }
      
      // Initialize Firebase if not already done
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        window.firebase.initializeApp(firebaseConfig);
      }
      
      const auth = window.firebase.auth();
      const database = window.firebase.database();
      
      // Sign in with Firebase
      console.log('🔥 Attempting Firebase sign in...');
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const userData = userCredential.user;
      
      console.log('✅ Firebase sign in successful:', userData.uid);
      
      // Search for user in company structures
      const companiesRef = database.ref('companies');
      const companiesSnapshot = await companiesRef.once('value');
      
      let userInfo = null;
      let companyData = null;
      
      if (companiesSnapshot.exists()) {
        const companies = companiesSnapshot.val();
        let foundUser = null;
        let foundCompanyId = null;
        
        // Search through all companies for a user with matching authUid
        for (const [companyId, company] of Object.entries(companies)) {
          // Check company status first
          if (company.status !== 'active') {
            continue; // Skip inactive companies
          }
          
          // Check in company users
          if (company.users) {
            for (const [userId, user] of Object.entries(company.users)) {
              if (user.authUid === userData.uid || userId === userData.uid) {
                foundUser = user;
                foundCompanyId = companyId;
                companyData = company;
                break;
              }
            }
          }
          
          // Also check in admin section for company admins
          if (!foundUser && company.admin && (company.admin.authUid === userData.uid || company.admin.userId === userData.uid)) {
            foundUser = company.admin;
            foundCompanyId = companyId;
            companyData = company;
          }
          
          if (foundUser) break;
        }
        
        if (foundUser) {
          // Create userInfo from company user data
          userInfo = {
            uid: userData.uid,
            email: foundUser.email,
            name: foundUser.name || foundUser.adminName,
            role: foundUser.role,
            department: foundUser.department,
            companyId: foundCompanyId,
            requiresPasswordChange: foundUser.requiresPasswordChange,
            isFirstLogin: foundUser.isFirstLogin,
            isCompanyAdmin: foundUser.isCompanyAdmin
          };
          companyData = companies[foundCompanyId];
          console.log('✅ User found in company scope:', foundCompanyId);
        } else {
          throw new Error('Your account is not associated with any company. Please contact your administrator.');
        }
      } else {
        throw new Error('No companies found. Please contact support.');
      }
      
      // Verify company is active  
      if (companyData.status !== 'active') {
        throw new Error('Your company account is inactive. Please contact support.');
      }
      
      // Check if this is the user's first login and requires password change
      if (userInfo.requiresPasswordChange || userInfo.isFirstLogin) {
        throw new Error('First login detected. Please use the main login page to complete account setup.');
      }
      
      // Update user data with company info
      userData.companyId = userInfo.companyId;
      userData.companyName = companyData.companyName;
      userData.role = userInfo.role;
      userData.department = userInfo.department;
      userData.name = userInfo.name;
      
      // Store user info in both keys for compatibility
      const userDataToStore = {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        companyId: userData.companyId,
        companyName: userData.companyName,
        department: userData.department,
        lastLogin: new Date().toISOString()
      };
      
      localStorage.setItem('user', JSON.stringify(userDataToStore));
      localStorage.setItem('currentUser', JSON.stringify(userDataToStore));
      
      // Update user display immediately
      if (window.updateAllUserDisplayElements) {
        window.updateAllUserDisplayElements();
      }
      
      // Show success message
      if (window.showSuccessMessage) {
        window.showSuccessMessage('Welcome back, ' + userData.name + '!');
      }
      
      // Redirect to dashboard page
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    };
    
    // Global functions for login modal
    window.loginModalFunctions = {
      openModal: function() {
        document.getElementById('loginModal').classList.add('active');
        document.body.style.overflow = 'hidden';
      },
      
      closeModal: function() {
        document.getElementById('loginModal').classList.remove('active');
        document.body.style.overflow = 'auto';
      },
      
      handleLogin: async function(email, password) {
        const spinner = document.getElementById('login-spinner');
        const errorMessage = document.getElementById('error-message');
        
        try {
          spinner.style.display = 'block';
          errorMessage.style.display = 'none';
          
          // Use the self-contained login system
          console.log('🔄 Using self-contained login system...');
          await window.handleDomainLogin(email, password);
          
          // Close modal on successful login
          this.closeModal();
          
        } catch (error) {
          console.error('Login error:', error);
          
          // Show error message
          errorMessage.textContent = error.message || 'An error occurred during login. Please try again.';
          errorMessage.style.display = 'block';
          
        } finally {
          spinner.style.display = 'none';
        }
      }
    };
  </script>

  <script>
    // Login Modal Management
    const loginModal = document.getElementById('loginModal');
    const loginButton = document.getElementById('loginButton');
    const mobileLoginButton = document.getElementById('mobileLoginButton');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const loginForm = document.getElementById('login-form');
    const togglePassword = document.getElementById('togglePassword');
    
    // Open login modal
    function openLoginModal() {
      loginModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    // Close login modal
    function closeLoginModalFunc() {
      loginModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
    
    // Event listeners for login buttons
    loginButton.addEventListener('click', openLoginModal);
    mobileLoginButton.addEventListener('click', openLoginModal);
    closeLoginModal.addEventListener('click', closeLoginModalFunc);
    
    // Close modal when clicking outside
    loginModal.addEventListener('click', function(e) {
      if (e.target === loginModal) {
        closeLoginModalFunc();
      }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && loginModal.classList.contains('active')) {
        closeLoginModalFunc();
      }
    });
    
    // Password toggle functionality
    togglePassword.addEventListener('click', function() {
      const passwordInput = document.getElementById('modal-password');
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Toggle eye icon
      this.classList.toggle('fa-eye');
      this.classList.toggle('fa-eye-slash');
    });
    
    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('modal-email').value;
      const password = document.getElementById('modal-password').value;
      
      // Basic validation
      if (!email || !password) {
        showError('Please fill in all fields.');
        return;
      }
      
      // Use the self-contained login system
      await window.loginModalFunctions.handleLogin(email, password);
    });
    
    // Utility functions
    function showError(message) {
      const errorDiv = document.getElementById('error-message');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      
      // Shake animation
      loginForm.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        loginForm.style.animation = '';
      }, 500);
    }
    
    function showSuccessMessage(message) {
      // Create and show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300';
      notification.innerHTML = \`
        <div class="flex items-center">
          <i class="fas fa-check-circle mr-2"></i>
          <span>\${message}</span>
        </div>
      \`;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
    
    // Make showSuccessMessage available globally
    window.showSuccessMessage = showSuccessMessage;
    
    // User login status check
    function checkLoginStatus() {
      // Check both localStorage and sessionStorage
      const user = JSON.parse(localStorage.getItem('user')) || JSON.parse(sessionStorage.getItem('user'));
      
      if (user) {
        // User is logged in, show username and logout button
        document.getElementById('username').textContent = user.name;
        document.getElementById('mobileUsername').textContent = user.name;
        
        document.getElementById('userStatus').classList.remove('hidden');
        document.getElementById('userStatus').classList.add('flex');
        document.getElementById('loginButton').classList.add('hidden');
        document.getElementById('logoutButton').classList.remove('hidden');
        
        document.getElementById('mobileUserStatus').classList.remove('hidden');
        document.getElementById('mobileLoginButton').classList.add('hidden');
        document.getElementById('mobileLogoutButton').classList.remove('hidden');
      } else {
        // User is not logged in, show login button
        document.getElementById('userStatus').classList.add('hidden');
        document.getElementById('userStatus').classList.remove('flex');
        document.getElementById('loginButton').classList.remove('hidden');
        document.getElementById('logoutButton').classList.add('hidden');
        
        document.getElementById('mobileUserStatus').classList.add('hidden');
        document.getElementById('mobileLoginButton').classList.remove('hidden');
        document.getElementById('mobileLogoutButton').classList.add('hidden');
      }
    }
    
    // Handle logout
    function handleLogout() {
      localStorage.removeItem('user');
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('currentUser');
      checkLoginStatus();
      showSuccessMessage('You have been logged out successfully.');
      
      // Also logout from Firebase
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth().signOut().catch(console.error);
      }
    }
    
    // Set up logout button listeners
    document.getElementById('logoutButton').addEventListener('click', handleLogout);
    document.getElementById('mobileLogoutButton').addEventListener('click', handleLogout);
    
    // Check login status when page loads
    document.addEventListener('DOMContentLoaded', checkLoginStatus);
  </script>
  <script src="js/user-display.js"></script>`;
    
    const fixedContent = beforeScript + cleanScript + afterScript;
    
    // Write the fixed content
    fs.writeFileSync(indexPath, fixedContent);
    console.log('✅ index.html fixed successfully!');
    
  } else {
    console.log('❌ Could not find script section to replace');
  }
  
} catch (error) {
  console.error('❌ Recovery failed:', error);
}
