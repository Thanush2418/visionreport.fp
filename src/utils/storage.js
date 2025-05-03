// Import API services
import { saveDataToServer, getDataFromServer, getAllDataFromServer } from './api';

// Constants for storage keys
const STUDENT_DATA_KEY = 'facePrep_studentData';
const SERVER_DATA_KEY = 'server_facePrep_studentData';
const CACHE_EXPIRY_KEY = 'facePrep_cacheExpiry';
const EMAIL_CACHE_PREFIX = 'facePrep_email_';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Global memory cache for faster subsequent lookups
let memoryCache = {
  data: null,
  timestamp: 0,
  // Store email-specific data separately for faster retrieval
  emailCache: {}
};

// Save student data to localStorage
export const saveStudentData = (data) => {
  console.warn("saveStudentData() is deprecated - data is now saved directly to database");
  return false;
};

// Save data to server with localStorage fallback
export const saveToServer = async (data) => {
  try {
    console.log("Saving data to server...");
    
    // Send data directly to the server
    const result = await saveDataToServer(data);
    
    if (result && result.length > 0) {
      console.log(`Successfully saved ${result.length} records to database`);
      return true;
    } else {
      console.warn("No records were saved to database");
      return false;
    }
  } catch (error) {
    console.error('Error during save operation:', error);
    return false;
  }
};

// Load student data from localStorage
export const loadStudentData = () => {
  console.warn("loadStudentData() is deprecated - data is now fetched directly from database");
  return null;
};

// Check if cache is still valid
const isCacheValid = () => {
  const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
  return expiry && parseInt(expiry) > Date.now();
};

// Load data from server with cache optimization for specific email
export const loadFromServer = async (email = null) => {
  try {
    console.log(`Retrieving data from database${email ? ` for email: ${email}` : ''}`);
    
    let serverData;
    
    if (email) {
      // If email is provided, get data for that specific email
      serverData = await getDataFromServer(email);
    } else {
      // Otherwise get all data
      serverData = await getAllDataFromServer();
    }
    
    // Handle server response
    if (serverData && serverData.length > 0) {
      console.log(`Successfully retrieved ${serverData.length} records from database`);
      return serverData;
    }
    
    return [];
  } catch (error) {
    console.error('Error retrieving data from server:', error);
    return [];
  }
};

// Clear all stored data
export const clearAllData = () => {
  console.warn("clearAllData() is deprecated - no local data to clear");
}; 