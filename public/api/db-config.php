<?php
// Database configuration
$db_config = [
    'host' => 'localhost',
    'username' => 'Thanush24',
    'password' => 'mAPupA1MYS0e78SBi30j',
    'database' => 'mailtracker_data'
];

// Function to connect to the database
function connectDB() {
    global $db_config;
    
    $conn = new mysqli(
        $db_config['host'],
        $db_config['username'],
        $db_config['password'],
        $db_config['database']
    );
    
    // Check connection
    if ($conn->connect_error) {
        return false;
    }
    
    // Set charset
    $conn->set_charset("utf8mb4");
    
    return $conn;
}

// Function to validate API credentials
function validateCredentials() {
    global $db_config;
    
    // Check for Authorization header
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        list($type, $credentials) = explode(' ', $headers['Authorization'], 2);
        
        if (strtolower($type) === 'basic') {
            list($username, $password) = explode(':', base64_decode($credentials), 2);
            
            // Check if credentials match
            if ($username === $db_config['username'] && $password === $db_config['password']) {
                return true;
            }
        }
    }
    
    return false;
}

// Function to send JSON response
function sendJsonResponse($data, $status = 200) {
    header('Content-Type: application/json');
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// If table doesn't exist, create it
function ensureTableExists($conn) {
    $createTableSQL = "CREATE TABLE IF NOT EXISTS student_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        report_link TEXT,
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        upload_info TEXT,
        source VARCHAR(50),
        data_type VARCHAR(50)
    )";
    
    if (!$conn->query($createTableSQL)) {
        return false;
    }
    
    // Create email index for faster lookups
    $conn->query("CREATE INDEX IF NOT EXISTS idx_email ON student_data (email)");
    
    return true;
}
?> 