// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  connectFirestoreEmulator,
  enableIndexedDbPersistence
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCshK44mguwXD_gs4MzoKn7W07ZOWATHG4",
  authDomain: "test-63890.firebaseapp.com",
  projectId: "test-63890",
  storageBucket: "test-63890.firebasestorage.app",
  messagingSenderId: "76573579745",
  appId: "1:76573579745:web:ec9fe3f7bcc258452fdaa0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence when possible
try {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log("Firestore persistence enabled successfully");
    })
    .catch((err) => {
      console.error("Error enabling Firestore persistence:", err);
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all features required for Firestore persistence.');
      }
    });
} catch (err) {
  console.error("Error setting up Firestore persistence:", err);
}

// If in development mode and you want to use emulator
// Uncomment the line below to use Firebase local emulator
// if (window.location.hostname === "localhost") {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

// Collection references
const EXCEL_DATA_COLLECTION = "excelData";
const STUDENT_COLLECTION = "studentData"; // Keep for backward compatibility

// Simple connection test function
const testFirestoreConnection = async () => {
  try {
    const testQuery = query(collection(db, EXCEL_DATA_COLLECTION));
    await getDocs(testQuery);
    console.log("Firestore connection test: SUCCESS");
    return true;
  } catch (error) {
    console.error("Firestore connection test: FAILED", error);
    return false;
  }
};

// Run connection test
testFirestoreConnection();

export { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  EXCEL_DATA_COLLECTION,
  STUDENT_COLLECTION,
  testFirestoreConnection
}; 