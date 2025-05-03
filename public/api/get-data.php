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

// Check if request is GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Get email from query parameters
$email = isset($_GET['email']) ? trim(strtolower($_GET['email'])) : '';

if (empty($email)) {
    sendJsonResponse(['success' => false, 'error' => 'Email parameter is required'], 400);
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

// Prepare the query
$stmt = $conn->prepare("SELECT * FROM student_data WHERE email = ? ORDER BY created_at DESC");

if (!$stmt) {
    $conn->close();
    sendJsonResponse(['success' => false, 'error' => 'Prepare statement failed: ' . $conn->error], 500);
}

// Bind parameters
$stmt->bind_param("s", $email);

// Execute the query
if (!$stmt->execute()) {
    $stmt->close();
    $conn->close();
    sendJsonResponse(['success' => false, 'error' => 'Query execution failed: ' . $stmt->error], 500);
}

// Get the result
$result = $stmt->get_result();

$records = [];
while ($row = $result->fetch_assoc()) {
    $records[] = $row;
}

// Close the statement and connection
$stmt->close();
$conn->close();

// Send response
sendJsonResponse([
    'success' => true,
    'records' => $records,
    'count' => count($records)
]);
?> 