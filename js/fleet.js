import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-storage.js';
import { getCurrentUser } from './auth.js';

const db = getFirestore();
const storage = getStorage();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('fleetForm');
    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();
    
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            alert('You must be logged in to submit a vehicle registration.');
            return;
        }

        const formData = new FormData(e.target);
        const documents = formData.getAll('documents');
        const documentUrls = [];

        // Upload documents to Firebase Storage
        for (const file of documents) {
            if (file.size > 0) {
                const storageRef = ref(storage, `fleet-documents/${Date.now()}-${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                documentUrls.push(url);
            }
        }

        // Prepare vehicle data
        const vehicleData = {
            vehicleType: formData.get('vehicleType'),
            registrationNumber: formData.get('registrationNumber'),
            make: formData.get('make'),
            model: formData.get('model'),
            year: parseInt(formData.get('year')),
            color: formData.get('color'),
            purpose: formData.get('purpose'),
            insuranceNumber: formData.get('insuranceNumber'),
            insuranceExpiry: formData.get('insuranceExpiry'),
            documents: documentUrls,
            comments: formData.get('comments'),
            status: 'pending',
            submittedBy: currentUser.uid,
            submittedDate: serverTimestamp(),
        };

        // Save to Firestore
        await addDoc(collection(db, 'fleet'), vehicleData);

        alert('Vehicle registration submitted successfully!');
        window.location.href = 'fleetboard.html';
    } catch (error) {
        console.error('Error submitting vehicle registration:', error);
        alert('Error submitting vehicle registration. Please try again.');
    }
}