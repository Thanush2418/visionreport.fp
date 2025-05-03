/**
 * MySQL client utility for server-side communication
 * This will be used through PHP endpoints since we can't directly connect to MySQL from the client
 */

// The base URL for the PHP API
const API_BASE_URL = "https://panel.fpln.site/api";

// Database connection config
const DB_CONFIG = {
  username: "Thanush24",
  password: "mAPupA1MYS0e78SBi30j",
  host: "panel.fpln.site",
  database: "mailtracker_data"
};

/**
 * Helper function to handle API requests
 * @param {string} endpoint - The API endpoint
 * @param {object} data - The data to send
 * @param {string} method - The HTTP method
 * @returns {Promise} - Promise that resolves with the response
 */
const apiRequest = async (endpoint, data = null, method = "GET") => {
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${DB_CONFIG.username}:${DB_CONFIG.password}`)}`
      },
      credentials: "include"
    };

    // Add body for non-GET requests
    if (method !== "GET" && data) {
      options.body = JSON.stringify(data);
    }

    // For GET requests with data, add as query params
    const queryUrl = method === "GET" && data 
      ? `${url}?${new URLSearchParams(data).toString()}`
      : url;

    const response = await fetch(queryUrl, options);
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
};

/**
 * Test the MySQL connection
 * @returns {Promise<boolean>} - Promise that resolves with connection status
 */
export const testMySQLConnection = async () => {
  try {
    const response = await apiRequest("connection-test.php");
    console.log("MySQL connection test result:", response);
    return response.connected === true;
  } catch (error) {
    console.error("MySQL connection test failed:", error);
    return false;
  }
};

/**
 * Save data to MySQL
 * @param {Array} data - The data to save
 * @returns {Promise} - Promise that resolves with the saved records
 */
export const saveDataToMySQL = async (data) => {
  try {
    // Transform data before sending to server
    const formattedData = Array.isArray(data) ? data : [data];
    
    const transformedData = formattedData.map(student => ({
      name: student.name || '',
      email: student.email ? student.email.toLowerCase() : '',
      report_link: student.reportLink || '',
      password: student.password || '',
      created_at: student.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      upload_info: student.uploadInfo ? JSON.stringify(student.uploadInfo) : null,
      source: student.source || "excel_upload",
      data_type: student.dataType || "excel_extraction"
    }));

    const response = await apiRequest("save-data.php", transformedData, "POST");
    
    if (response.success && response.records) {
      console.log(`Successfully saved ${response.records.length} records to database`);
      return response.records;
    } else {
      console.warn("No records were saved to database");
      return [];
    }
  } catch (error) {
    console.error("Error saving data to MySQL:", error);
    return [];
  }
};

/**
 * Get data from MySQL by email
 * @param {string} email - The email to search for
 * @returns {Promise} - Promise that resolves with the matching records
 */
export const getDataFromMySQL = async (email) => {
  try {
    const response = await apiRequest("get-data.php", { email: email.toLowerCase() });
    
    if (response.success && response.records) {
      const transformedRecords = response.records.map(record => ({
        id: record.id,
        name: record.name || '',
        email: record.email || '',
        reportLink: record.report_link || '',
        password: record.password || '',
        createdAt: record.created_at || null,
        uploadInfo: record.upload_info ? JSON.parse(record.upload_info) : null,
        source: record.source || 'mysql_data'
      }));
      
      console.log(`Found ${transformedRecords.length} records for email: ${email}`);
      return transformedRecords;
    } else {
      console.log(`No records found for email: ${email}`);
      return [];
    }
  } catch (error) {
    console.error("Error getting data from MySQL:", error);
    return [];
  }
};

/**
 * Get all data from MySQL
 * @returns {Promise} - Promise that resolves with all records
 */
export const getAllDataFromMySQL = async () => {
  try {
    const response = await apiRequest("get-all-data.php");
    
    if (response.success && response.records) {
      const transformedRecords = response.records.map(record => ({
        id: record.id,
        name: record.name || '',
        email: record.email || '',
        reportLink: record.report_link || '',
        password: record.password || '',
        createdAt: record.created_at || null,
        uploadInfo: record.upload_info ? JSON.parse(record.upload_info) : null,
        source: record.source || 'mysql_data'
      }));
      
      console.log(`Retrieved ${transformedRecords.length} records from database`);
      return transformedRecords;
    } else {
      console.log("No records found in database");
      return [];
    }
  } catch (error) {
    console.error("Error getting all data from MySQL:", error);
    return [];
  }
};

// Export MySQL utility functions
export {
  apiRequest,
  DB_CONFIG
}; 