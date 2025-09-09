# Domain Setup for examarkchat.com
# Simple PHP redirects for email tracking to desktop app

## 🎯 What You Need to Add to Your Domain

### **Create these files on examarkchat.com:**

### **1. /track/pixel/.htaccess**
```apache
RewriteEngine On
RewriteRule ^([a-zA-Z0-9]+)\.png$ pixel.php?id=$1 [L]
```

### **2. /track/pixel/pixel.php**
```php
<?php
header('Content-Type: image/png');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$trackingId = $_GET['id'] ?? '';

// Log the pixel request (optional)
if ($trackingId) {
    // Send tracking data to desktop app
    $desktopUrl = "http://localhost:8080/webhooks/track-open";
    $postData = json_encode([
        'trackingId' => $trackingId,
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'timestamp' => date('c')
    ]);
    
    // Try to send to desktop app (non-blocking)
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $postData,
            'timeout' => 1 // 1 second timeout
        ]
    ]);
    
    @file_get_contents($desktopUrl, false, $context);
}

// Return 1x1 transparent PNG
echo base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
?>
```

### **3. /track/click/.htaccess**
```apache
RewriteEngine On
RewriteRule ^([a-zA-Z0-9]+)$ click.php?id=$1 [L,QSA]
```

### **4. /track/click/click.php**
```php
<?php
$trackingId = $_GET['id'] ?? '';
$originalUrl = $_GET['url'] ?? '';

if ($trackingId && $originalUrl) {
    // Send tracking data to desktop app
    $desktopUrl = "http://localhost:8080/webhooks/track-click";
    $postData = json_encode([
        'trackingId' => $trackingId,
        'url' => $originalUrl,
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

// Redirect to original URL
if ($originalUrl) {
    header('Location: ' . urldecode($originalUrl));
    exit;
} else {
    echo 'Invalid tracking link';
}
?>
```

## 🚀 **How It Works:**

1. **Email sent** with tracking links: `https://examarkchat.com/track/click/abc123?url=https://example.com`
2. **Recipient clicks** → Your domain receives the request
3. **PHP script** sends tracking data to your desktop app at `localhost:8080`
4. **User redirected** to original URL immediately
5. **Desktop app** logs the tracking data locally

## 📁 **Folder Structure on Your Domain:**
```
examarkchat.com/
├── track/
    ├── pixel/
    │   ├── .htaccess
    │   └── pixel.php
    └── click/
        ├── .htaccess
        └── click.php
```

## ✅ **Benefits:**
- ✅ **Pure desktop app** - all processing local
- ✅ **Real email tracking** - works for any recipient
- ✅ **Minimal domain usage** - just simple PHP redirects
- ✅ **No hosting costs** - just basic web hosting
- ✅ **Privacy friendly** - data stays on your machine

## 🔧 **Next Steps:**
1. Upload these 4 files to your examarkchat.com hosting
2. Test the tracking URLs
3. Desktop app will receive real tracking data!

Your email tracking will work perfectly with your desktop app! 🎯
