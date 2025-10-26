# API Rate Limiting System

## Overview
User-configurable API rate limiting system that allows each user to set their own quotas for Apollo, OpenAI, Mailgun, and ZeroBounce APIs.

## Features

### 1. **User-Configurable Limits**
- Each user can set their own hourly, daily, and monthly limits
- Limits are stored in DynamoDB `meridian-user-settings` table
- Empty limits = no restrictions (unlimited)

### 2. **Rate Limit Enforcement**
Rate checks happen BEFORE API calls in:
- **Apollo Search** (`reasoningLeadAgent.js` line ~1888)
- **Apollo Enrichment** (`reasoningLeadAgent.js` line ~1468)
- **OpenAI Completion** (`reasoningLeadAgent.js` line ~447)

If limit exceeded:
- Request blocked with clear error message
- Shows current usage and reset time
- Logs warning to console

### 3. **Backend API**

#### Get Rate Limits
```
GET /api/lead-agent/rate-limits
Authorization: Bearer {token}

Response:
{
  "success": true,
  "rateLimits": {
    "apollo": { "monthly": 1000, "daily": 100, "hourly": 20 },
    "openai": { "monthly": 100000, "daily": 10000, "hourly": 2000 },
    "mailgun": { "monthly": 5000, "daily": 500, "hourly": 100 },
    "zerobounce": { "monthly": 1000, "daily": 100, "hourly": 20 }
  }
}
```

#### Update Rate Limits
```
POST /api/lead-agent/rate-limits
Authorization: Bearer {token}
Content-Type: application/json

{
  "rateLimits": {
    "apollo": { "monthly": 1000, "daily": 100, "hourly": 20 }
  }
}
```

### 4. **UI Component**
New **Rate Limits** tab in monitoring sidebar (shield icon):
- Displays all 4 services with color coding
- Separate inputs for hourly/daily/monthly limits
- "Set Defaults" button for recommended limits
- "Clear" button to remove all limits
- Real-time save with success/error feedback

### 5. **Rate Check Logic**

```javascript
// awsManager.js
async checkApiRateLimit(userId, service, requestedUsage)
```

Returns:
```javascript
{
  allowed: true,
  remaining: {
    hourly: 15,    // credits remaining this hour
    daily: 85,     // credits remaining today
    monthly: 950   // credits remaining this month
  }
}
```

Or if exceeded:
```javascript
{
  allowed: false,
  reason: 'daily',           // which limit was exceeded
  limit: 100,                // the limit value
  current: 102,              // current usage
  resetTime: Date            // when limit resets
}
```

### 6. **Usage Period Queries**

```javascript
// awsManager.js
async getApiUsageForPeriod(userId, service, startDate)
```

Queries DynamoDB for usage since `startDate`:
- Hourly: last hour start
- Daily: today at midnight
- Monthly: 1st of current month

### 7. **Warnings**

Console warnings when approaching limits:
- OpenAI: < 1000 tokens remaining
- Apollo: < 10 credits remaining
- Logged for hourly, daily, and monthly separately

Example:
```
⚠️ Apollo daily limit approaching: 8 credits remaining
```

### 8. **Error Messages**

Clear user-facing errors when blocked:
```
Apollo daily rate limit exceeded. 
Current usage: 102/100 credits. 
Resets at: 12/25/2024, 12:00:00 AM
```

## Default Limits (Recommended)

| Service | Hourly | Daily | Monthly | Unit |
|---------|--------|-------|---------|------|
| Apollo | 20 | 100 | 1,000 | credits |
| OpenAI | 2,000 | 10,000 | 100,000 | tokens |
| Mailgun | 100 | 500 | 5,000 | emails |
| ZeroBounce | 20 | 100 | 1,000 | validations |

## Files Modified

### Backend
- `utils/awsManager.js` - Added `checkApiRateLimit()` and `getApiUsageForPeriod()`
- `routes/leadAgent.js` - Added GET/POST `/rate-limits` endpoints
- `agent/reasoningLeadAgent.js` - Added rate checks before Apollo/OpenAI calls

### Frontend
- `frontend/src/components/agents/RateLimitSettings.tsx` - New UI component
- `frontend/src/components/agents/MonitoringSidebar.tsx` - Added Rate Limits tab
- `frontend/src/components/agents/MonitoringContent.tsx` - Integrated RateLimitSettings

## Architecture

```
User sets limits in UI
  ↓
POST /api/lead-agent/rate-limits
  ↓
Saved to DynamoDB meridian-user-settings
  ↓
Agent loads settings on start
  ↓
Before API call: checkApiRateLimit()
  ↓
Query usage from meridian-api-usage table
  ↓
Compare current + requested vs limit
  ↓
Allow or block with error
```

## Future Enhancements

1. **Auto-alerts** - Email/SMS when approaching 80% of limit
2. **Usage projections** - Predict when limits will be hit
3. **Soft limits** - Warn but don't block at 90%
4. **Per-agent limits** - Different quotas for different agents
5. **Cost budgets** - Limit by $ spent instead of usage count
6. **Rollover credits** - Unused daily credits carry to next day (up to monthly max)
