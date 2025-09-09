<?php
// Enhanced tracking pixel for examarkchat.com
// Upload to: examarkchat.com/track/pixel/pixel.php

header('Content-Type: image/png');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$trackingId = $_GET['id'] ?? '';

// Send tracking data to desktop app
if ($trackingId) {
    $desktopUrl = "http://localhost:8080/webhooks/track-open";
    $postData = json_encode([
        'trackingId' => $trackingId,
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'timestamp' => date('c')
    ]);
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $postData,
            'timeout' => 1
        ]
    ]);
    
    @file_get_contents($desktopUrl, false, $context);
}

// Return 1x1 transparent PNG
echo base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
?>
$path = $_SERVER['REQUEST_URI'];
preg_match('/\/track\/pixel\/([^\.]+)\.png/', $path, $matches);
$trackingId = $matches[1] ?? null;

// Get webhook parameters
$webhookUrl = $_GET['webhook'] ?? null;
$secret = $_GET['secret'] ?? null;

if ($trackingId && $webhookUrl && $secret) {
    // Send tracking data to desktop app webhook
    $data = [
        'trackingId' => $trackingId,
        'secret' => $secret,
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];
    
    // POST to desktop app
    $options = [
        'http' => [
            'header' => "Content-type: application/json\r\n",
            'method' => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    @file_get_contents($webhookUrl, false, $context);
}

// Return 1x1 transparent PNG
$pixel = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
echo $pixel;
?>
