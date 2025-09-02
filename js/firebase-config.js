// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Authentication functions
export const loginWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Get user role and other data from the database
        const userRef = ref(db, `users/${user.uid}`);
        return new Promise((resolve, reject) => {
            onValue(userRef, (snapshot) => {
                const userData = snapshot.val() || {};
                resolve({
                    uid: user.uid,
                    email: user.email,
                    role: userData.role || 'standard',
                    name: userData.name || user.email.split('@')[0],
                    department: userData.department || 'Unknown'
                });
            }, {
                onlyOnce: true
            });
        });
    } catch (error) {
        throw error;
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
};

export const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.code };
    }
};

// Database functions
export const saveTrainingRequest = async (trainingRequest) => {
    try {
        await set(ref(db, `trainingRequests/${trainingRequest.id}`), trainingRequest);
        return true;
    } catch (error) {
        console.error('Error saving training request:', error);
        return false;
    }
};

export const updateTrainingRequest = async (id, updates) => {
    try {
        await update(ref(db, `trainingRequests/${id}`), updates);
        return true;
    } catch (error) {
        console.error('Error updating training request:', error);
        return false;
    }
};

export const deleteTrainingRequest = async (id) => {
    try {
        await remove(ref(db, `trainingRequests/${id}`));
        return true;
    } catch (error) {
        console.error('Error deleting training request:', error);
        return false;
    }
};

export const subscribeToTrainingRequests = (callback) => {
    const trainingRequestsRef = ref(db, 'trainingRequests');
    onValue(trainingRequestsRef, (snapshot) => {
        const data = snapshot.val();
        const trainingRequests = data ? Object.values(data) : [];
        callback(trainingRequests.sort((a, b) => b.id - a.id));
    });
};

// Access Request functions
export const saveAccessRequest = async (accessRequest) => {
    try {
        const accessRequestId = Date.now().toString();
        const accessRequestWithId = { ...accessRequest, id: accessRequestId };
        await set(ref(db, `access/${accessRequestId}`), accessRequestWithId);
        return accessRequestId;
    } catch (error) {
        console.error('Error saving access request:', error);
        throw error;
    }
};

export const updateAccessRequest = async (id, updates) => {
    try {
        await update(ref(db, `access/${id}`), updates);
        return true;
    } catch (error) {
        console.error('Error updating access request:', error);
        return false;
    }
};

export const deleteAccessRequest = async (id) => {
    try {
        await remove(ref(db, `access/${id}`));
        return true;
    } catch (error) {
        console.error('Error deleting access request:', error);
        return false;
    }
};

export const subscribeToAccessRequests = (callback) => {
    const accessRequestsRef = ref(db, 'access');
    onValue(accessRequestsRef, (snapshot) => {
        const data = snapshot.val();
        const accessRequests = data ? Object.values(data) : [];
        callback(accessRequests.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)));
    });
};

// KPI Evaluation functions
export const saveKPIEvaluation = async (employeeId, evaluationType, evaluationData) => {
    try {
        await set(ref(db, `kpiEvaluations/${employeeId}/${evaluationType}`), evaluationData);
        return true;
    } catch (error) {
        console.error('Error saving KPI evaluation:', error);
        return false;
    }
};

export const updateKPIEvaluation = async (employeeId, evaluationType, updates) => {
    try {
        await update(ref(db, `kpiEvaluations/${employeeId}/${evaluationType}`), updates);
        return true;
    } catch (error) {
        console.error('Error updating KPI evaluation:', error);
        return false;
    }
};

export const subscribeToKPIEvaluation = (employeeId, evaluationType, callback) => {
    const evaluationRef = ref(db, `kpiEvaluations/${employeeId}/${evaluationType}`);
    const unsubscribe = onValue(evaluationRef, (snapshot) => {
        const data = snapshot.val();
        callback(data);
    }, (error) => {
        console.error('Error subscribing to KPI evaluation:', error);
        callback(null);
    });
    return unsubscribe;
};

// Export database and auth for direct use
export { db, auth, ref, set, get, onValue, remove, update };