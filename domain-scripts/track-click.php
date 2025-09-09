<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get tracking ID and URL from path parameters
$trackingId = $_GET['id'] ?? null;
$redirectUrl = $_GET['url'] ?? null;

// Get visitor information
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$timestamp = date('c');

// Prepare data for webhook
$webhookData = [
    'trackingId' => $trackingId,
    'url' => $redirectUrl,
    'userAgent' => $userAgent,
    'ip' => $ip,
    'timestamp' => $timestamp
];

// Send data to localhost desktop app
if ($trackingId && $redirectUrl) {
    $webhookUrl = 'http://localhost:8080/webhooks/track-click';
    
    $options = [
        'http' => [
            'header' => "Content-type: application/json\r\n",
            'method' => 'POST',
            'content' => json_encode($webhookData),
            'timeout' => 1 // 1 second timeout
        ]
    ];
    
    $context = stream_context_create($options);
    
    // Try to send webhook (don't wait for response)
    try {
        @file_get_contents($webhookUrl, false, $context);
    } catch (Exception $e) {
        // Silently fail if desktop app not running
        error_log("ExaMark webhook failed: " . $e->getMessage());
    }
    
    // Redirect user to the actual URL
    header('Location: ' . $redirectUrl, true, 302);
    exit();
} else {
    // Invalid request - redirect to a default page
    header('Location: https://examarkchat.com', true, 302);
    exit();
}
?>
