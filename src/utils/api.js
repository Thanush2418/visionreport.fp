// Import MySQL utils
import {
  testMySQLConnection,
  saveDataToMySQL,
  getDataFromMySQL,
  getAllDataFromMySQL
} from './mysql';

// Import mock server fallback
import {
  saveData as mockSaveData,
  getAllData as mockGetAllData,
  findByEmail as mockFindByEmail
} from './mockServer';

// Flag to track if we should use mock server
let useMockServer = false;

// Maximum number of retry attempts
const MAX_RETRIES = 3;
// Delay between retry attempts (ms)
const RETRY_DELAY = 1000;

// Helper function to add retry logic
const withRetry = async (operation, mockOperation, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
  // If we've decided to use mock server due to previous failures, just use it
  if (useMockServer) {
    console.log("Using mock server due to previous MySQL failures");
    return await mockOperation();
  }
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test connection before performing operation
      if (attempt > 1) {
        const connected = await testMySQLConnection();
        if (!connected) {
          throw new Error("MySQL connection test failed");
        }
      }
      
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted retries, switch to mock server
  console.warn("MySQL operations failed after retries, switching to mock server");
  useMockServer = true;
  
  // Try the mock operation
  try {
    return await mockOperation();
  } catch (mockError) {
    console.error("Mock server operation also failed:", mockError);
    throw lastError; // Throw the original MySQL error
  }
};

/**
 * Save student data to MySQL
 * @param {Array} data - The student data to save
 * @returns {Promise} - Promise that resolves with the server response
 */
export const saveDataToServer = async (data) => {
  try {
    // If already using mock server from previous failures, just use it directly
    if (useMockServer) {
      console.log("Using mock server for save operation due to previous MySQL failures");
      return await mockSaveData(data);
    }
    
    // Check connection first
    const connected = await testMySQLConnection();
    if (!connected) {
      console.warn("MySQL connection test failed, switching to mock server");
      useMockServer = true;
      return await mockSaveData(data);
    }
    
    console.log(`Saving ${Array.isArray(data) ? data.length : 1} records to MySQL database`);
    
    // Save data to MySQL
    const result = await saveDataToMySQL(data);
    
    if (result && result.length > 0) {
      console.log(`Successfully saved ${result.length} records to MySQL database`);
      return result;
    } else {
      console.warn("No records saved to MySQL database, using mock server fallback");
      return await mockSaveData(data);
    }
  } catch (error) {
    console.error('Error saving data to MySQL database:', error);
    
    // Fallback to mock server
    console.warn("Falling back to mock server for save operation");
    useMockServer = true;
    return await mockSaveData(data);
  }
};

/**
 * Get student data from MySQL by email
 * @param {string} email - The email to search for
 * @returns {Promise} - Promise that resolves with the server response
 */
export const getDataFromServer = async (email) => {
  return withRetry(
    async () => {
      console.log(`Querying MySQL database for email: ${email.toLowerCase()}`);
      
      // Get data from MySQL
      const students = await getDataFromMySQL(email);
      
      console.log(`Found ${students.length} records in MySQL for ${email.toLowerCase()}`);
      
      return students;
    },
    async () => {
      // Mock server fallback
      return await mockFindByEmail(email);
    }
  );
};

/**
 * Get all student data from MySQL
 * @returns {Promise} - Promise that resolves with all student data
 */
export const getAllDataFromServer = async () => {
  return withRetry(
    async () => {
      console.log("Retrieving all data from MySQL database");
      
      // Get all data from MySQL
      const students = await getAllDataFromMySQL();
      
      console.log(`Retrieved ${students.length} records from MySQL database`);
      
      return students;
    },
    async () => {
      // Mock server fallback
      return await mockGetAllData();
    }
  );
};

// Export the test connection function too
export const testConnection = testMySQLConnection; 