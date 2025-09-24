<?php
// Zilliz email tracking pixel for examarkchat.com
// Upload to: examarkchat.com/track/pixel/

header('Content-Type: image/png');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Extract tracking ID from URL path
$path = $_SERVER['REQUEST_URI'];
preg_match('/\/track\/pixel\/([^\/\?]+)/', $path, $matches);
$trackingId = $matches[1] ?? null;

if ($trackingId) {
    // Check for image proxy services (false positives)
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    
    $imageProxyPatterns = [
        '/GoogleImageProxy/i',
        '/ggpht\.com/i', 
        '/proxymail\.facebook\.com/i',
        '/outlook\.com.*safelinks/i',
        '/protection\.outlook\.com/i',
        '/mimecast/i',
        '/barracuda/i',
        '/proofpoint/i',
        '/symantec/i',
        '/messagelab/i',
        '/bot/i',
        '/crawler/i',
        '/spider/i'
    ];
    
    $isImageProxy = false;
    foreach ($imageProxyPatterns as $pattern) {
        if (preg_match($pattern, $userAgent) || preg_match($pattern, $referer)) {
            $isImageProxy = true;
            break;
        }
    }
    
    // Only process if not an image proxy
    if (!$isImageProxy) {
        // Prepare tracking data for Zilliz
        $trackingData = [
            'tracking_id' => $trackingId,
            'event_type' => 'email_open',
            'timestamp' => date('c'),
            'user_agent' => $userAgent,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown',
            'email_address' => 'Unknown',
            'recipient' => 'Unknown',
            'processed' => false,
            'dummy_vector' => [0.0, 0.0]
        ];

    // Send to your deployed server's Zilliz API endpoint
    // TODO: Replace with your actual deployed server URL
    $zillizUrl = "https://YOUR-DEPLOYED-SERVER.onrender.com/api/zilliz-tracking/email-opened";
    
    $postData = json_encode([
        'trackingId' => $trackingId,
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? '',
        'emailAddress' => 'Unknown'
    ]);
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $postData,
            'timeout' => 3
        ]
    ]);
    
    // Try to send to Zilliz (don't block if it fails)
    @file_get_contents($zillizUrl, false, $context);
    } else {
        // Log image proxy detection (optional)
        error_log("Image proxy detected for tracking $trackingId: $userAgent");
    }
}

// Return 16x16 green PNG image
$greenPixel = base64_decode('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABklEQVR4nGJhYGAAAQABQAD+AAoAAABJRU5ErkJggg==');
echo $greenPixel;
?>
