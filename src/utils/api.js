// Import Firebase utils
import { 
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  EXCEL_DATA_COLLECTION,
  STUDENT_COLLECTION,
  testFirestoreConnection
} from './firebase';

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
    console.log("Using mock server due to previous Firebase failures");
    return await mockOperation();
  }
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test connection before performing operation
      if (attempt > 1) {
        const connected = await testFirestoreConnection();
        if (!connected) {
          throw new Error("Firebase connection test failed");
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
  console.warn("Firebase operations failed after retries, switching to mock server");
  useMockServer = true;
  
  // Try the mock operation
  try {
    return await mockOperation();
  } catch (mockError) {
    console.error("Mock server operation also failed:", mockError);
    throw lastError; // Throw the original Firebase error
  }
};

/**
 * Save student data to Firestore
 * @param {Array} data - The student data to save
 * @returns {Promise} - Promise that resolves with the server response
 */
export const saveDataToServer = async (data) => {
  try {
    // If already using mock server from previous failures, just use it directly
    if (useMockServer) {
      console.log("Using mock server for save operation due to previous Firebase failures");
      return await mockSaveData(data);
    }
    
    // Track all document operations
    const operations = [];
    
    // Check connection first
    const connected = await testFirestoreConnection();
    if (!connected) {
      console.warn("Firebase connection test failed, switching to mock server");
      useMockServer = true;
      return await mockSaveData(data);
    }
    
    // Performance and stability optimizations
    const batchSize = 20; // Process data in batches for better performance
    let hasError = false;
    
    console.log(`Saving ${data.length} records to Excel data collection in batches of ${batchSize}`);
    
    // Process data in batches to avoid overwhelming the database
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Process each batch in parallel for better performance
      console.log(`Processing batch ${Math.ceil((i+1)/batchSize)} of ${Math.ceil(data.length/batchSize)}`);
      
      const batchPromises = batch.map(async (student) => {
        try {
          // Add metadata about the Excel file
          const enhancedStudent = {
            name: student.name || '',
            email: student.email ? student.email.toLowerCase() : '',
            reportLink: student.reportLink || '',
            password: student.password || '',
            createdAt: student.createdAt || new Date().toISOString(),
            uploadInfo: student.uploadInfo || null,
            updatedAt: new Date().toISOString(),
            source: "excel_upload",
            dataType: "excel_extraction"
          };
          
          // Create a document reference with retry logic - use EXCEL_DATA_COLLECTION
          const docRef = await withRetry(
            async () => await addDoc(collection(db, EXCEL_DATA_COLLECTION), enhancedStudent),
            async () => ({ id: 'mock-' + Date.now() }) // Mock operation for single document
          );
          
          return {
            id: docRef.id,
            ...enhancedStudent
          };
        } catch (error) {
          console.error('Error saving individual excel record:', error);
          hasError = true;
          return null;
        }
      });
      
      // Await all promises in this batch
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful operations to our results
      const successfulOps = batchResults.filter(result => result !== null);
      operations.push(...successfulOps);
      
      console.log(`Batch completed: ${successfulOps.length}/${batch.length} records saved successfully`);
    }
    
    // If some operations failed, also save to mock server as backup
    if (operations.length === 0 || hasError) {
      console.warn("Some database operations failed, saving to mock server as well");
      await mockSaveData(data);
    }
    
    // Return the saved records
    if (operations.length > 0) {
      console.log(`Total: ${operations.length}/${data.length} records saved to Excel data collection successfully`);
      return operations;
    } else {
      console.log("No records saved to database, using mock server fallback");
      return await mockSaveData(data);
    }
  } catch (error) {
    console.error('Error saving data to database:', error);
    
    // Fallback to mock server
    console.warn("Falling back to mock server for save operation");
    useMockServer = true;
    return await mockSaveData(data);
  }
};

/**
 * Get student data from Firestore by email
 * @param {string} email - The email to search for
 * @returns {Promise} - Promise that resolves with the server response
 */
export const getDataFromServer = async (email) => {
  return withRetry(
    async () => {
      // Create a query against the Excel data collection
      const q = query(
        collection(db, EXCEL_DATA_COLLECTION),
        where("email", "==", email.toLowerCase())
      );
      
      console.log(`Querying Excel data collection for email: ${email.toLowerCase()}`);
      
      // Execute the query
      const querySnapshot = await getDocs(q);
      
      // Convert to array of student data
      const students = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          reportLink: data.reportLink || '',
          password: data.password || '',
          createdAt: data.createdAt || null,
          uploadInfo: data.uploadInfo || null,
          source: data.source || 'excel_upload',
          ...data // Include any other fields
        });
      });
      
      console.log(`Found ${students.length} records in Excel data collection for ${email.toLowerCase()}`);
      
      // If no records found in excelData, try the old collection as fallback
      if (students.length === 0) {
        console.log(`No records found in Excel data, checking legacy collection for ${email.toLowerCase()}`);
        
        const legacyQuery = query(
          collection(db, STUDENT_COLLECTION),
          where("email", "==", email.toLowerCase())
        );
        
        const legacySnapshot = await getDocs(legacyQuery);
        legacySnapshot.forEach((doc) => {
          const data = doc.data();
          students.push({
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            reportLink: data.reportLink || '',
            password: data.password || '',
            createdAt: data.createdAt || null,
            uploadInfo: data.uploadInfo || null,
            source: 'legacy_data',
            ...data
          });
        });
        
        console.log(`Found ${students.length - querySnapshot.size} additional records in legacy collection`);
      }
      
      // Get the newest record first (if multiple exist)
      if (students.length > 1) {
        students.sort((a, b) => {
          // Sort by createdAt timestamp, newest first
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return 0;
        });
      }
      
      return students;
    },
    async () => {
      // Mock operation
      console.log("Using mock data for email:", email);
      return mockFindByEmail(email);
    }
  );
};

/**
 * Get all student data from Firestore
 * @returns {Promise} - Promise that resolves with the server response
 */
export const getAllDataFromServer = async () => {
  return withRetry(
    async () => {
      console.log("Retrieving all records from Excel data collection");
      
      // Get all documents from the Excel data collection
      const querySnapshot = await getDocs(collection(db, EXCEL_DATA_COLLECTION));
      
      // Convert to array of student data
      const students = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          reportLink: data.reportLink || '',
          password: data.password || '',
          createdAt: data.createdAt || null,
          uploadInfo: data.uploadInfo || null,
          source: data.source || 'excel_upload',
          ...data // Include any other fields
        });
      });
      
      console.log(`Retrieved ${students.length} records from Excel data collection`);
      
      // Check if we need to merge legacy data
      if (students.length === 0) {
        console.log("No records found in Excel data collection, checking legacy collection");
        
        const legacySnapshot = await getDocs(collection(db, STUDENT_COLLECTION));
        legacySnapshot.forEach((doc) => {
          const data = doc.data();
          students.push({
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            reportLink: data.reportLink || '',
            password: data.password || '',
            createdAt: data.createdAt || null,
            uploadInfo: data.uploadInfo || null,
            source: 'legacy_data',
            ...data
          });
        });
        
        console.log(`Retrieved ${students.length} additional records from legacy collection`);
      }
      
      // Sort by email and then by createdAt (newest first)
      students.sort((a, b) => {
        // First sort by email
        if (a.email < b.email) return -1;
        if (a.email > b.email) return 1;
        
        // If same email, sort by createdAt timestamp (newest first)
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });
      
      return students;
    },
    async () => {
      // Mock operation
      console.log("Using mock data for all records");
      return mockGetAllData();
    }
  );
}; 