import * as XLSX from 'xlsx';

// Parse Excel file and return JSON data
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        
        // Convert Excel to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          reject(new Error('No data found in Excel file'));
          return;
        }
        
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsBinaryString(file);
  });
};

// Get common column patterns for matching
export const getColumnPatterns = () => {
  return {
    name: ['name', 'full name', 'student name', 'studentname'],
    email: ['email', 'mail', 'email id', 'emailid', 'emailaddress', 'email address'],
    reportLink: ['report', 'link', 'url', 'reportlink', 'report link', 'report url'],
    password: ['password', 'pass', 'pwd', 'key']
  };
};

// Auto-match columns based on common patterns
export const autoMatchColumns = (columns) => {
  const patterns = getColumnPatterns();
  const matches = {
    name: '',
    email: '',
    reportLink: '',
    password: ''
  };
  
  // Check each column against patterns
  for (const column of columns) {
    const lowerCol = column.toLowerCase();
    
    // Check for name column
    if (patterns.name.some(pattern => lowerCol.includes(pattern))) {
      matches.name = column;
    }
    
    // Check for email column
    if (patterns.email.some(pattern => lowerCol.includes(pattern))) {
      matches.email = column;
    }
    
    // Check for report link column
    if (patterns.reportLink.some(pattern => lowerCol.includes(pattern))) {
      matches.reportLink = column;
    }
    
    // Check for password column
    if (patterns.password.some(pattern => lowerCol.includes(pattern))) {
      matches.password = column;
    }
  }
  
  return matches;
};

// Map Excel data to consistent format using selected columns
export const mapDataFromColumns = (excelData, columnMapping) => {
  return excelData.map(row => {
    return {
      name: columnMapping.name ? row[columnMapping.name] || '' : '',
      email: columnMapping.email ? row[columnMapping.email] || '' : '',
      reportLink: columnMapping.reportLink ? row[columnMapping.reportLink] || '' : '',
      password: columnMapping.password ? row[columnMapping.password] || '' : ''
    };
  });
}; 