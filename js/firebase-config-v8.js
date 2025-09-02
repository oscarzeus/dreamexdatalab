// Firebase v8 configuration for domain compatibility
// This file provides v8 compatible Firebase functions for use across all pages

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUTmTn0rRBb0M-UkQJxnUMrWqXYU_BgIc",
    authDomain: "users-8be65.firebaseapp.com",
    databaseURL: "https://users-8be65-default-rtdb.firebaseio.com",
    projectId: "users-8be65",
    storageBucket: "users-8be65.firebasestorage.app",
    messagingSenderId: "909025468149",
    appId: "1:909025468149:web:fb4e7c4a8b4bd6d1076e4d",
    measurementId: "G-XHFMRCJQEZ"
};

// Initialize Firebase v8 if not already initialized
function initializeFirebase() {
    if (!window.firebase || !window.firebase.apps || window.firebase.apps.length === 0) {
        window.firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase v8 initialized successfully');
    }
    return window.firebase;
}

// Authentication functions using Firebase v8
export function loginWithEmail(email, password) {
    return new Promise((resolve, reject) => {
        const firebase = initializeFirebase();
        const auth = firebase.auth();
        
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                resolve(userCredential.user);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

export function logoutUser() {
    return new Promise((resolve, reject) => {
        const firebase = initializeFirebase();
        const auth = firebase.auth();
        
        auth.signOut()
            .then(() => {
                resolve(true);
            })
            .catch((error) => {
                console.error('Logout error:', error);
                resolve(false);
            });
    });
}

export function resetPassword(email) {
    return new Promise((resolve, reject) => {
        const firebase = initializeFirebase();
        const auth = firebase.auth();
        
        auth.sendPasswordResetEmail(email)
            .then(() => {
                resolve({ success: true });
            })
            .catch((error) => {
                resolve({ success: false, error: error.code });
            });
    });
}

// Database functions using Firebase v8
export function getDatabase() {
    const firebase = initializeFirebase();
    return firebase.database();
}

export function ref(database, path) {
    return database.ref(path);
}

export function get(reference) {
    return reference.once('value');
}

export function set(reference, value) {
    return reference.set(value);
}

export function update(reference, values) {
    return reference.update(values);
}

export function remove(reference) {
    return reference.remove();
}

export function onValue(reference, callback, options = {}) {
    if (options.onlyOnce) {
        return reference.once('value', callback);
    } else {
        return reference.on('value', callback);
    }
}

// Initialize Firebase when this module is loaded
initializeFirebase();
