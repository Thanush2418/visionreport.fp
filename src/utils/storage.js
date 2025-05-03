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
  try {
    localStorage.setItem(STUDENT_DATA_KEY, JSON.stringify(data));
    
    // Update memory cache
    memoryCache.data = data;
    memoryCache.timestamp = Date.now();
    
    // Also cache by email for faster lookups
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.email) {
          const email = item.email.toLowerCase();
          memoryCache.emailCache[email] = item;
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving student data:', error);
    return false;
  }
};

// Save data to server with localStorage fallback
export const saveToServer = async (data) => {
  try {
    // First, save to localStorage as a fallback
    localStorage.setItem(SERVER_DATA_KEY, JSON.stringify(data));
    
    // Set cache expiry
    localStorage.setItem(CACHE_EXPIRY_KEY, Date.now() + CACHE_DURATION);
    
    // Update memory cache
    memoryCache.data = data;
    memoryCache.timestamp = Date.now();
    
    // Also cache by email for faster lookups
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.email) {
          const email = item.email.toLowerCase();
          memoryCache.emailCache[email] = item;
          
          // Also save email-specific data to localStorage for persistence
          localStorage.setItem(`${EMAIL_CACHE_PREFIX}${email}`, JSON.stringify(item));
        }
      });
    }
    
    console.log("Saving data to MySQL server...");
    
    // Then attempt to save to the server
    const result = await saveDataToServer(data);
    
    if (result && result.length > 0) {
      console.log(`Successfully saved ${result.length} records to MySQL database`);
      return true;
    } else {
      console.warn("No records were saved to database, using local storage backup");
      return false;
    }
  } catch (error) {
    console.error('Error during save operation:', error);
    // Even if the server save fails, we still have local data
    return localStorage.getItem(SERVER_DATA_KEY) !== null;
  }
};

// Load student data from localStorage
export const loadStudentData = () => {
  // Check memory cache first for fastest retrieval
  if (memoryCache.data && Date.now() - memoryCache.timestamp < CACHE_DURATION) {
    console.log("Using in-memory cache for data retrieval");
    return memoryCache.data;
  }
  
  try {
    const data = localStorage.getItem(STUDENT_DATA_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      
      // Update memory cache
      memoryCache.data = parsedData;
      memoryCache.timestamp = Date.now();
      
      // Also cache by email for faster lookups
      if (Array.isArray(parsedData)) {
        parsedData.forEach(item => {
          if (item.email) {
            memoryCache.emailCache[item.email.toLowerCase()] = item;
          }
        });
      }
      
      return parsedData;
    }
    return null;
  } catch (error) {
    console.error('Error loading student data:', error);
    return null;
  }
};

// Check if cache is still valid
const isCacheValid = () => {
  const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
  return expiry && parseInt(expiry) > Date.now();
};

// Load data from server with cache optimization for specific email
export const loadFromServer = async (email = null) => {
  // For email-specific requests, check memory cache first
  if (email) {
    const normalizedEmail = email.toLowerCase();
    
    // 1. Check in-memory email cache first (fastest)
    if (memoryCache.emailCache[normalizedEmail] && 
        Date.now() - memoryCache.timestamp < CACHE_DURATION) {
      console.log("Using in-memory email cache for faster retrieval");
      return [memoryCache.emailCache[normalizedEmail]];
    }
    
    // 2. Check localStorage for this specific email
    try {
      const emailData = localStorage.getItem(`${EMAIL_CACHE_PREFIX}${normalizedEmail}`);
      if (emailData) {
        console.log("Using email-specific localStorage cache");
        const parsedData = JSON.parse(emailData);
        
        // Update email cache
        memoryCache.emailCache[normalizedEmail] = parsedData;
        return [parsedData];
      }
    } catch (err) {
      console.warn("Error reading email cache:", err);
    }
  }
  
  // For all data requests or if email cache missed
  // Check memory cache first for fastest retrieval
  if (memoryCache.data && Date.now() - memoryCache.timestamp < CACHE_DURATION) {
    console.log("Using in-memory cache for faster data retrieval");
    
    if (email && Array.isArray(memoryCache.data)) {
      // Filter by email if requested
      const matchingData = memoryCache.data.filter(item => 
        item.email && item.email.toLowerCase() === email.toLowerCase()
      );
      
      if (matchingData.length > 0) {
        return matchingData;
      }
    } else if (Array.isArray(memoryCache.data)) {
      return memoryCache.data;
    }
  }
  
  // Check if the localStorage cache is still valid
  if (isCacheValid()) {
    const cachedData = localStorage.getItem(SERVER_DATA_KEY);
    if (cachedData) {
      console.log("Using local storage cache for data retrieval");
      const parsedData = JSON.parse(cachedData);
      
      // Update memory cache
      memoryCache.data = parsedData;
      memoryCache.timestamp = Date.now();
      
      // Also update email cache
      if (Array.isArray(parsedData)) {
        parsedData.forEach(item => {
          if (item.email) {
            memoryCache.emailCache[item.email.toLowerCase()] = item;
          }
        });
      }
      
      if (email && Array.isArray(parsedData)) {
        // Filter by email if requested
        return parsedData.filter(item => 
          item.email && item.email.toLowerCase() === email.toLowerCase()
        );
      }
      
      return parsedData;
    }
  }
  
  // If no valid cache, fetch from server
  try {
    console.log(`Retrieving data from MySQL database${email ? ` for email: ${email}` : ''}`);
    
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
      
      // Update memory cache
      if (!email) {
        memoryCache.data = serverData;
        memoryCache.timestamp = Date.now();
        
        // Cache by email for faster future lookups
        serverData.forEach(item => {
          if (item.email) {
            const normalizedEmail = item.email.toLowerCase();
            memoryCache.emailCache[normalizedEmail] = item;
            localStorage.setItem(`${EMAIL_CACHE_PREFIX}${normalizedEmail}`, JSON.stringify(item));
          }
        });
        
        // Update localStorage cache
        localStorage.setItem(SERVER_DATA_KEY, JSON.stringify(serverData));
        localStorage.setItem(CACHE_EXPIRY_KEY, Date.now() + CACHE_DURATION);
      } else if (serverData.length > 0) {
        // For single email lookup, cache that specific record
        const normalizedEmail = email.toLowerCase();
        memoryCache.emailCache[normalizedEmail] = serverData[0];
        localStorage.setItem(`${EMAIL_CACHE_PREFIX}${normalizedEmail}`, JSON.stringify(serverData[0]));
      }
      
      return serverData;
    } else {
      console.log(`No data retrieved from server${email ? ` for email: ${email}` : ''}`);
      return [];
    }
  } catch (error) {
    console.error('Error loading data from server:', error);
    
    // Try to use local fallback on error
    if (email) {
      const localData = loadStudentData();
      if (localData && Array.isArray(localData)) {
        const matchingData = localData.filter(item => 
          item.email && item.email.toLowerCase() === email.toLowerCase()
        );
        
        if (matchingData.length > 0) {
          console.log("Using local data fallback for error recovery");
          return matchingData;
        }
      }
    }
    
    // If nothing found in localStorage either
    return [];
  }
};

// Clear all cached data
export const clearAllData = () => {
  try {
    // Clear localStorage
    localStorage.removeItem(STUDENT_DATA_KEY);
    localStorage.removeItem(SERVER_DATA_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
    
    // Clear email-specific entries
    for (const key in localStorage) {
      if (key.startsWith(EMAIL_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    
    // Clear memory cache
    memoryCache = {
      data: null,
      timestamp: 0,
      emailCache: {}
    };
    
    return true;
  } catch (error) {
    console.error('Error clearing cached data:', error);
    return false;
  }
}; 