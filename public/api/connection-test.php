<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

// Test database connection
$conn = connectDB();
if ($conn) {
    // Make sure the table exists
    if (ensureTableExists($conn)) {
        $conn->close();
        sendJsonResponse(['success' => true, 'connected' => true, 'message' => 'Database connection successful']);
    } else {
        $conn->close();
        sendJsonResponse(['success' => false, 'connected' => false, 'error' => 'Could not create required table']);
    }
} else {
    sendJsonResponse(['success' => false, 'connected' => false, 'error' => 'Could not connect to database']);
}
?> 