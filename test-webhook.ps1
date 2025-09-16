$body = @{
    trackingId = "f1e151"
    userAgent = "Mozilla/5.0 Test"
    timestamp = "2025-09-16T18:40:00.000Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/webhooks/track-open" -Method POST -Body $body -ContentType "application/json"
