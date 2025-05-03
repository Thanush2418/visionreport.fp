<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Include database configuration
require_once 'db-config.php';

// Validate API credentials
if (!validateCredentials()) {
    sendJsonResponse(['success' => false, 'error' => 'Unauthorized'], 401);
}

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Get JSON data from the request body
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data || !is_array($data)) {
    sendJsonResponse(['success' => false, 'error' => 'Invalid data format'], 400);
}

// Connect to the database
$conn = connectDB();
if (!$conn) {
    sendJsonResponse(['success' => false, 'error' => 'Database connection failed'], 500);
}

// Make sure the table exists
if (!ensureTableExists($conn)) {
    $conn->close();
    sendJsonResponse(['success' => false, 'error' => 'Could not create required table'], 500);
}

// Prepare the statement for inserting data
$stmt = $conn->prepare("INSERT INTO student_data (name, email, report_link, password, created_at, updated_at, upload_info, source, data_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

if (!$stmt) {
    $conn->close();
    sendJsonResponse(['success' => false, 'error' => 'Prepare statement failed: ' . $conn->error], 500);
}

// Track inserted records
$inserted_records = [];
$error_count = 0;

// Insert each record
foreach ($data as $record) {
    // Validate required fields
    $email = isset($record['email']) ? trim(strtolower($record['email'])) : '';
    
    // Skip if email is empty
    if (empty($email)) {
        $error_count++;
        continue;
    }
    
    // Set values for the prepared statement
    $name = isset($record['name']) ? $record['name'] : '';
    $report_link = isset($record['report_link']) ? $record['report_link'] : '';
    $password = isset($record['password']) ? $record['password'] : '';
    $created_at = isset($record['created_at']) ? $record['created_at'] : date('Y-m-d H:i:s');
    $updated_at = date('Y-m-d H:i:s');
    $upload_info = isset($record['upload_info']) ? $record['upload_info'] : null;
    $source = isset($record['source']) ? $record['source'] : 'mysql_import';
    $data_type = isset($record['data_type']) ? $record['data_type'] : 'excel_extraction';
    
    // Bind parameters
    $stmt->bind_param("sssssssss", $name, $email, $report_link, $password, $created_at, $updated_at, $upload_info, $source, $data_type);
    
    // Execute the statement
    if ($stmt->execute()) {
        // Get the inserted ID
        $id = $stmt->insert_id;
        
        // Add to inserted records
        $inserted_records[] = [
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'report_link' => $report_link,
            'password' => $password,
            'created_at' => $created_at,
            'updated_at' => $updated_at
        ];
    } else {
        $error_count++;
    }
}

// Close the statement and connection
$stmt->close();
$conn->close();

// Send response
sendJsonResponse([
    'success' => count($inserted_records) > 0,
    'records' => $inserted_records,
    'total_processed' => count($data),
    'total_inserted' => count($inserted_records),
    'total_errors' => $error_count
]);
?> 