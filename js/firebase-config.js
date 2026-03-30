// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, push, get, query, orderByChild, limitToLast, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyBBAIW9IVz2DduP_vIHWbUfW0U7DQt-a4U",
    authDomain: "alg-simulator.firebaseapp.com",
    databaseURL: "https://alg-simulator-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "alg-simulator",
    storageBucket: "alg-simulator.firebasestorage.app",
    messagingSenderId: "244754223699",
    appId: "1:244754223699:web:b33f8505997ad4909c6ca6",
    measurementId: "G-LMWJ64Y6K6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, push, get, query, orderByChild, limitToLast, onValue };
