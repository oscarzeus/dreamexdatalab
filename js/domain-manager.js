import { db } from './firebase-config.js';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export async function updateRoleDomainSettings(roleName, settings) {
    try {
        const roleRef = doc(db, 'roles', roleName);
        await updateDoc(roleRef, {
            domainSettings: {
                allowAllDomains: settings.allowAllDomains,
                allowedDomains: settings.allowedDomains || []
            }
        });
    } catch (error) {
        console.error("Error updating domain settings:", error);
        throw error;
    }
}

export async function validateUserDomain(email, role) {
    const domain = email.split('@')[1];
    const roleDoc = await getDoc(doc(db, 'roles', role));
    
    if (!roleDoc.exists()) return false;
    
    const domainSettings = roleDoc.data().domainSettings || { allowAllDomains: true };
    
    return domainSettings.allowAllDomains || 
           domainSettings.allowedDomains?.includes(domain);
}
