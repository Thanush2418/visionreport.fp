import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { parseExcelFile, autoMatchColumns, mapDataFromColumns } from '../../utils/excelParser';
import { saveStudentData, saveToServer } from '../../utils/storage';
import { getAllDataFromServer } from '../../utils/api';
import './Upload.css';

const Upload = () => {
  const [fileName, setFileName] = useState('No file chosen');
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    email: '',
    reportLink: '',
    password: ''
  });
  const [processedData, setProcessedData] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const fileInputRef = useRef(null);

  // Load upload history when component mounts
  useEffect(() => {
    loadUploadHistory();
  }, []);

  // Function to load upload history from Firestore
  const loadUploadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      
      // Get all data from the server
      const allData = await getAllDataFromServer();
      
      if (allData && Array.isArray(allData)) {
        // Extract unique upload info and sort by upload time (newest first)
        const uniqueUploads = {};
        
        allData.forEach(item => {
          if (item.uploadInfo && item.uploadInfo.fileName && item.uploadInfo.timestamp) {
            // Use timestamp as unique identifier
            const key = item.uploadInfo.timestamp;
            if (!uniqueUploads[key]) {
              uniqueUploads[key] = {
                fileName: item.uploadInfo.fileName,
                uploadTime: item.uploadInfo.uploadTime,
                timestamp: item.uploadInfo.timestamp,
                fileSize: item.uploadInfo.fileSize,
                recordCount: 1,
                source: item.source || 'excel_upload'
              };
            } else {
              // Increment record count if the same file was found again
              uniqueUploads[key].recordCount++;
            }
          }
        });
        
        // Convert to array and sort by timestamp (newest first)
        const historyArray = Object.values(uniqueUploads).sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        setUploadHistory(historyArray);
      }
    } catch (error) {
      console.error("Error loading upload history:", error);
      setDebugInfo(prev => `${prev}\n<strong>Error loading upload history</strong>\n${error.message}\n\n`);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Debug log function
  const debugLog = (message, data) => {
    console.log(message, data);
    
    // Format data as string
    let dataStr = '';
    if (data !== undefined) {
      if (typeof data === 'object') {
        dataStr = JSON.stringify(data, null, 2);
      } else {
        dataStr = String(data);
      }
    }
    
    setDebugInfo(prev => `${prev}\n<strong>${message}</strong>\n${dataStr}\n\n`);
  };

  // Handle file selection
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const currentTime = new Date();
    const formattedTime = currentTime.toLocaleString();
    
    setFileName(file.name);
    setUploadInfo({
      fileName: file.name,
      fileSize: (file.size / 1024).toFixed(2) + ' KB',
      uploadTime: formattedTime,
      timestamp: currentTime.toISOString()
    });
    
    setIsLoading(true);
    setShowError(false);
    setDebugInfo('');

    try {
      // Temporary file processing - the file itself is not stored
      debugLog("Processing Excel file for data extraction...", file.name);
      
      const data = await parseExcelFile(file);
      setExcelData(data);
      
      // Get column names
      const columns = Object.keys(data[0]);
      setAvailableColumns(columns);
      
      // Try to auto-match columns
      const matches = autoMatchColumns(columns);
      setColumnMapping(matches);
      
      debugLog("Excel data extracted in memory", data.slice(0, 3));
      debugLog("Available columns", columns);
      
      setShowColumnMapper(true);
    } catch (error) {
      debugLog("Error parsing Excel", error.message);
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column selection change
  const handleColumnChange = (field, value) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Process data after column mapping and save to database
  const handleProcessData = async () => {
    // Validate that at least report link column is selected
    if (!columnMapping.reportLink) {
      alert('Please select at least the Report Link column.');
      return;
    }

    setIsLoading(true);
    setShowSuccess(false);
    setShowError(false);
    setStatusMessage({
      type: 'info',
      text: 'Processing data and saving to Excel Data collection...'
    });
    
    try {
      // Map data using selected columns - extract only what we need
      debugLog("Extracting structured data from Excel...");
      const studentData = mapDataFromColumns(excelData, columnMapping);
      
      // Normalize email addresses to lowercase for consistent database queries
      const normalizedData = studentData.map(student => ({
        ...student,
        email: student.email ? student.email.toLowerCase() : student.email
      }));
      
      // Add upload info and timestamp for when the record was created
      const dataWithInfo = normalizedData.map(student => ({
        ...student,
        createdAt: new Date().toISOString(),
        uploadInfo: uploadInfo,
        source: "excel_upload",
        dataType: "excel_extraction"
      }));
      
      setProcessedData(dataWithInfo);
      
      debugLog("Data extraction complete - saving to Excel Data collection", dataWithInfo);
      
      // Save to database
      const serverSaved = await saveToServer(dataWithInfo);
      
      if (serverSaved) {
        debugLog("SUCCESS: Data saved to Excel Data collection successfully");
        setStatusMessage({
          type: 'success',
          text: 'Data saved to Excel Data collection successfully!'
        });
        
        // Refresh upload history after successful upload
        await loadUploadHistory();
      } else {
        debugLog("WARNING: Could not save to Excel Data collection, using local storage as backup");
        setStatusMessage({
          type: 'warning',
          text: 'Could not save to Excel Data collection, but data was saved locally and will still be available.'
        });
      }
      
      // Clear temporary Excel data from memory
      setExcelData([]);
      
      // Hide column mapper and show data preview
      setShowColumnMapper(false);
      setShowDataPreview(true);
      setShowSuccess(true);
    } catch (error) {
      debugLog("Error processing data", error.message);
      setStatusMessage({
        type: 'error',
        text: 'Error saving data. Data was saved locally as a backup.'
      });
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Create table preview of data
  const renderDataTable = () => {
    if (processedData.length === 0) {
      return <p>No data found in the Excel file.</p>;
    }

    const maxRows = Math.min(5, processedData.length);
    
    return (
      <div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Report Link</th>
              <th>Password</th>
            </tr>
          </thead>
          <tbody>
            {processedData.slice(0, maxRows).map((row, index) => (
              <tr key={index}>
                <td>{row.name || ''}</td>
                <td>{row.email || ''}</td>
                <td>{row.reportLink || ''}</td>
                <td>{row.password || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {processedData.length > 5 && (
          <p>Showing 5 of {processedData.length} rows.</p>
        )}
      </div>
    );
  };

  // Render upload history
  const renderUploadHistory = () => {
    if (isLoadingHistory) {
      return <div className="loading-indicator">Loading upload history...</div>;
    }
    
    if (uploadHistory.length === 0) {
      return <p>No previous uploads found.</p>;
    }
    
    return (
      <div className="upload-history-table">
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Upload Time</th>
              <th>File Size</th>
              <th>Records</th>
              <th>Storage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {uploadHistory.map((item, index) => (
              <tr key={index}>
                <td>{item.fileName}</td>
                <td>{item.uploadTime}</td>
                <td>{item.fileSize}</td>
                <td>{item.recordCount}</td>
                <td>
                  <span className="collection-tag">
                    {item.source === 'excel_upload' ? 'excelData' : 'studentData'}
                  </span>
                </td>
                <td>
                  <Link 
                    to="/messages" 
                    className="view-messages-link"
                    title="View messages from this upload"
                  >
                    View Messages
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container">
      <h1>FACE Prep - Excel Upload</h1>
      
      <div className="instruction">
        <h3>Instructions</h3>
        <p>Upload an Excel file with student data. The file should have the following information:</p>
        <ul>
          <li><strong>Student Name</strong> - The student's full name</li>
          <li><strong>Email</strong> - The student's email address</li>
          <li><strong>Report Link</strong> - Link to the student's report</li>
          <li><strong>Password</strong> - Password for accessing the report</li>
        </ul>
        <p>Don't worry if your column names don't match exactly - you'll be able to map them after upload.</p>
      </div>
      
      {uploadInfo && (
        <div className="upload-info">
          <h3>Current Upload</h3>
          <p><strong>File:</strong> {uploadInfo.fileName}</p>
          <p><strong>Size:</strong> {uploadInfo.fileSize}</p>
          <p><strong>Uploaded:</strong> {uploadInfo.uploadTime}</p>
        </div>
      )}
      
      {showSuccess && (
        <div className="success-alert">
          <strong>Success!</strong> Your file was processed and the data has been saved to the Excel Data collection. 
          Messages can now be retrieved from the database on the <Link to="/messages" style={{ fontWeight: 'bold' }}>Messages Page</Link>.
        </div>
      )}
      
      {statusMessage && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      
      {showError && !statusMessage && (
        <div className="error-alert">
          Error processing Excel file. Please check the file format and try again.
        </div>
      )}
      
      <div className="upload-section">
        <p>Upload your Excel file with student data</p>
        <input 
          type="file" 
          ref={fileInputRef}
          id="excelFile" 
          className="file-input" 
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
        />
        <label htmlFor="excelFile" className="button">Choose File</label>
        <p>{fileName}</p>
        {isLoading && <div className="loader" style={{ display: 'block' }}></div>}
      </div>
      
      {/* Upload History Section */}
      <div className="upload-history">
        <h2>Upload History</h2>
        {renderUploadHistory()}
        <button 
          className="refresh-button" 
          onClick={loadUploadHistory} 
          disabled={isLoadingHistory}
        >
          {isLoadingHistory ? 'Loading...' : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="refresh-icon">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh History
            </>
          )}
        </button>
      </div>
      
      {/* Column Mapping UI */}
      {showColumnMapper && (
        <div className="column-mapper">
          <h3>Map Your Excel Columns</h3>
          <p>Please select which Excel column corresponds to each required field:</p>
          
          <div>
            <label htmlFor="nameColumn">Student Name:</label>
            <select 
              id="nameColumn"
              value={columnMapping.name}
              onChange={(e) => handleColumnChange('name', e.target.value)}
            >
              <option value="">-- Select Column --</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="emailColumn">Email Address:</label>
            <select 
              id="emailColumn"
              value={columnMapping.email}
              onChange={(e) => handleColumnChange('email', e.target.value)}
            >
              <option value="">-- Select Column --</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="reportLinkColumn">Report Link:</label>
            <select 
              id="reportLinkColumn"
              value={columnMapping.reportLink}
              onChange={(e) => handleColumnChange('reportLink', e.target.value)}
            >
              <option value="">-- Select Column --</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="passwordColumn">Password:</label>
            <select 
              id="passwordColumn"
              value={columnMapping.password}
              onChange={(e) => handleColumnChange('password', e.target.value)}
            >
              <option value="">-- Select Column --</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
          
          <button onClick={handleProcessData} className="button" style={{ marginTop: '20px' }}>Process Data</button>
        </div>
      )}
      
      {/* Data Preview */}
      {showDataPreview && (
        <div className="data-preview">
          <h2>Data Preview</h2>
          {renderDataTable()}
          
          <div className="data-storage-info">
            <p><strong>Storage Location:</strong> MySQL Database - Table: <code>student_reports</code></p>
            <p><strong>Data Type:</strong> Excel Extraction</p>
            <p><strong>Upload Time:</strong> {uploadInfo ? uploadInfo.uploadTime : 'Unknown'}</p>
          </div>
          
          <h3>Message Template</h3>
          <div className="message-preview">
{`Dear {name},
Greetings from FACE Prep!
email id : {email}
Thank you for attending the VISION Test.
Please find your test report and password below:

Report Link: {reportLink}
Password: {password}

Wishing you the very best for your future endeavors!

Regards,
FACE Prep Team`}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/messages" className="button">View Messages</Link>
          </div>
        </div>
      )}
      
      {/* Debug Panel */}
      <div 
        className="debug-info" 
        style={{ display: debugInfo ? 'block' : 'none' }}
        dangerouslySetInnerHTML={{ __html: debugInfo }}
      ></div>
    </div>
  );
};

export default Upload; 