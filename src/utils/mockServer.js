/**
 * Mock server implementation using localStorage
 * This provides a fallback when Firebase connection fails
 */

// Storage key for mock database
const MOCK_DB_KEY = 'mockFirestore_studentData';

// Generate a random ID similar to Firebase document IDs
const generateId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Initialize the mock database if it doesn't exist
const initMockDb = () => {
  if (!localStorage.getItem(MOCK_DB_KEY)) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify([]));
  }
};

// Get all data from mock database
const getAllData = () => {
  initMockDb();
  try {
    return JSON.parse(localStorage.getItem(MOCK_DB_KEY)) || [];
  } catch (error) {
    console.error('Error reading from mock database:', error);
    return [];
  }
};

// Save data to mock database
const saveData = (data) => {
  initMockDb();
  try {
    let mockDb = getAllData();
    
    // Format each record to look like a Firestore document
    const operations = data.map(record => {
      const id = generateId();
      return { id, ...record };
    });
    
    // Add new records to the database
    mockDb = [...mockDb, ...operations];
    
    // Save back to localStorage
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(mockDb));
    
    return operations;
  } catch (error) {
    console.error('Error saving to mock database:', error);
    throw error;
  }
};

// Find data by email
const findByEmail = (email) => {
  const normalizedEmail = email.toLowerCase();
  const allData = getAllData();
  
  return allData.filter(record => 
    record.email && record.email.toLowerCase() === normalizedEmail
  );
};

// Clear all data
const clearData = () => {
  localStorage.removeItem(MOCK_DB_KEY);
};

export {
  saveData,
  getAllData,
  findByEmail,
  clearData
}; 