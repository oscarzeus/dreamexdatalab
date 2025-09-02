<?php
// Security headers
header("Content-Security-Policy: default-src 'self'");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");

// Allow CORS from your domain
header("Access-Control-Allow-Origin: *");  // Replace * with your domain in production
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Validate required parameters
$required = ['endpoint', 'api_version', 'device_id'];
foreach ($required as $param) {
    if (!isset($_GET[$param])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required parameter: $param"]);
        exit;
    }
}

// Extract parameters
$endpoint = $_GET['endpoint'];
$apiVersion = $_GET['api_version'];
$deviceId = $_GET['device_id'];
$accessToken = isset($_GET['access_token']) ? $_GET['access_token'] : '';
$clientId = isset($_GET['client_id']) ? $_GET['client_id'] : '';
$timestamp = isset($_GET['t']) ? $_GET['t'] : time() * 1000;
$sign = isset($_GET['sign']) ? $_GET['sign'] : '';

// Validate endpoint to prevent request forgery
$allowedEndpoints = [
    'properties' => "/v2.0/cloud/thing/{device_id}/shadow/properties",
    'status' => "/v2.0/cloud/thing/batch",
    'token' => "/v1.0/token"
];

if (!isset($allowedEndpoints[$endpoint])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid endpoint']);
    exit;
}

// Build the URL
$baseUrl = "https://openapi.tuyaeu.com";
$urlPath = str_replace('{device_id}', $deviceId, $allowedEndpoints[$endpoint]);

if ($endpoint === 'status') {
    $url = "$baseUrl$urlPath?device_ids=$deviceId";
} else if ($endpoint === 'token') {
    $url = "$baseUrl$urlPath?grant_type=1";
} else {
    $url = "$baseUrl$urlPath";
}

// Set up cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

// Set headers
$headers = [
    'Content-Type: application/json',
    'sign_method: HMAC-SHA256',
    'client_id: ' . $clientId,
    't: ' . $timestamp,
    'sign: ' . $sign
];

if (!empty($accessToken)) {
    $headers[] = 'access_token: ' . $accessToken;
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute the request
$response = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_error($ch)) {
    http_response_code(500);
    echo json_encode(['error' => 'Proxy Error: ' . curl_error($ch)]);
} else {
    // Forward the response status
    http_response_code($statusCode);
    echo $response;
}

curl_close($ch);
?>