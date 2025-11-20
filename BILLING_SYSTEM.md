# Meridian Billing System

Complete token-based billing system with automatic charging, grace periods, and account suspension.

## Features

✅ **Stripe Integration**: Credit card management with saved payment methods  
✅ **Monthly Billing**: Automatic charging based on API usage  
✅ **Grace Periods**: 7-day grace period after payment failure  
✅ **Account Suspension**: Automatic suspension after grace period expires  
✅ **Payment Blocking**: Middleware blocks agent operations for non-paying users  
✅ **Email Notifications**: Automated emails for all billing events  
✅ **Automatic Reactivation**: Account reactivates when payment succeeds  
✅ **Admin Tools**: Manual triggers for testing and monitoring  

---

## Payment Flow

### 1. Normal Payment Cycle

```
User Uses API → Usage Tracked → Monthly Billing Job Runs → 
Card Charged → paymentStatus='active' → Success Email Sent
```

### 2. Payment Failure Flow

```
Card Charge Fails → paymentStatus='payment_failed' → 
7-Day Grace Period Starts → Failure Email Sent → 
User Can Still Use API (with warnings)
```

### 3. Grace Period Expiration

```
Grace Period Expires → paymentStatus='suspended' → 
All Agent Operations Blocked → Suspension Email Sent →
User Must Update Payment Method
```

### 4. Account Reactivation

```
User Adds New Card → Automatic Charge Retry → 
Charge Succeeds → paymentStatus='active' → 
Reactivation Email Sent → Full Access Restored
```

---

## API Endpoints

### User Endpoints

**Get Payment Status**
```
GET /api/billing/payment-status
Authorization: Bearer <token>

Response:
{
  "paymentStatus": "active",
  "gracePeriodEnd": null,
  "lastFailedCharge": null
}
```

**Add Payment Method**
```
POST /api/billing/payment-methods
Authorization: Bearer <token>

Body: {
  "paymentMethodId": "pm_xxx" // from Stripe Elements
}
```

**Set Default Payment Method**
```
POST /api/billing/set-default-payment
Authorization: Bearer <token>

Body: {
  "paymentMethodId": "pm_xxx"
}

Note: Automatically retries failed charge if account was payment_failed
```

**Create Setup Intent**
```
GET /api/billing/setup-intent
Authorization: Bearer <token>

Response: {
  "clientSecret": "seti_xxx"
}
```

### Admin Endpoints

**Trigger Monthly Billing (Manual)**
```
POST /api/admin/trigger-billing
Authorization: Bearer <token>

Note: Charges all users with usage for current month
```

**Trigger Grace Period Check (Manual)**
```
POST /api/admin/trigger-grace-check
Authorization: Bearer <token>

Note: Checks for expired grace periods and sends warnings
```

**Get Payment Overview**
```
GET /api/admin/payment-overview
Authorization: Bearer <token>

Response: {
  "total": 10,
  "active": 7,
  "payment_failed": 2,
  "suspended": 1,
  "users": [...]
}
```

---

## Database Schema

### User Settings (DynamoDB)

```javascript
{
  userId: "user123",
  email: "user@example.com",
  stripeCustomerId: "cus_xxx",
  defaultPaymentMethodId: "pm_xxx",
  
  // Payment Status
  paymentStatus: "active" | "payment_failed" | "suspended",
  
  // Grace Period
  gracePeriodEnd: "2025-02-01T00:00:00.000Z", // null if not in grace period
  gracePeriodWarningSent: false, // true after 2-day warning sent
  
  // Charge History
  lastChargeDate: "2025-01-15T00:00:00.000Z",
  lastChargeAmount: 25.50,
  lastFailedCharge: {
    date: "2025-01-15T00:00:00.000Z",
    amount: 25.50,
    error: "card_declined"
  }
}
```

### API Usage (DynamoDB)

```javascript
{
  userId: "user123",
  timestamp: "2025-01-15T12:00:00.000Z",
  endpoint: "/api/lead-agent/run",
  cost: 0.05, // dollars
  tokens: 1000,
  model: "gpt-4"
}
```

---

## Email Notifications

### 1. Payment Failed
- **Subject**: ⚠️ Payment Failed - Action Required
- **Sent**: Immediately when monthly charge fails
- **Contains**: 
  - Amount due
  - Error message
  - 7-day grace period notice
  - "Update Payment Method" CTA

### 2. Payment Successful
- **Subject**: ✅ Payment Successful
- **Sent**: After successful monthly charge
- **Contains**:
  - Amount charged
  - Date of charge
  - "View Billing Details" CTA

### 3. Grace Period Warning
- **Subject**: ⚠️ Account Suspension Warning - X Days Remaining
- **Sent**: 2 days before grace period expires
- **Contains**:
  - Days remaining
  - Amount due
  - Suspension date
  - "Update Payment Method Now" CTA

### 4. Account Suspended
- **Subject**: 🚫 Account Suspended - Immediate Action Required
- **Sent**: When grace period expires
- **Contains**:
  - Suspension notice
  - Amount due
  - "Restore Account Access" CTA

### 5. Account Reactivated
- **Subject**: ✅ Account Reactivated
- **Sent**: When payment succeeds after failure
- **Contains**:
  - Reactivation confirmation
  - "Go to Dashboard" CTA

---

## Frontend Components

### PaymentStatusBanner.tsx

Shows at top of app when payment issues occur:

**Payment Failed (In Grace Period)**
```
⚠️ Payment failed. Your account will be suspended in 5 days.
[Update Payment Method]
```

**Account Suspended**
```
🚫 Account Suspended. Update your payment method to restore access.
[Update Payment Method]
```

### BillingContent.tsx

Payment method management page:
- Add new cards via Stripe Elements
- Set default payment method
- View saved cards
- Remove payment methods

---

## Middleware

### checkPaymentStatus.js

Applied to all agent routes (e.g., `/api/lead-agent/*`):

```javascript
// Active users - pass through
if (paymentStatus === 'active') {
  return next();
}

// Payment failed - check grace period
if (paymentStatus === 'payment_failed') {
  if (now < gracePeriodEnd) {
    // Allow with warning
    res.locals.paymentWarning = "Payment failed - update method soon";
    return next();
  } else {
    // Grace period expired - suspend
    await updateStatus(userId, 'suspended');
    return res.status(402).json({ 
      error: "Account suspended",
      requiresPayment: true 
    });
  }
}

// Suspended - block completely
if (paymentStatus === 'suspended') {
  return res.status(402).json({ 
    error: "Account suspended",
    requiresPayment: true 
  });
}
```

---

## Automated Jobs

### Monthly Billing Job

**Schedule**: Runs 1st of every month at 2:00 AM  
**Function**: `POST /api/billing/charge-monthly`  
**Process**:

1. Scan all users with Stripe customers
2. Query `api-usage` table for current month
3. Calculate total cost per user
4. Skip users with $0 usage
5. Skip users already charged this month
6. Charge card via Stripe Payment Intent
7. On success:
   - Set paymentStatus='active'
   - Record lastChargeDate
   - Send success email
8. On failure:
   - Set paymentStatus='payment_failed'
   - Set 7-day grace period
   - Send failure email

**Setup** (add to app.js or use cron job):
```javascript
import cron from 'node-cron';

// Run on 1st of month at 2am
cron.schedule('0 2 1 * *', async () => {
  await axios.post('http://localhost:8080/api/billing/charge-monthly');
});
```

### Grace Period Checker

**Schedule**: Runs every hour  
**Function**: `checkGracePeriods()` in gracePeriodChecker.js  
**Process**:

1. Scan all users with payment_failed status
2. For each user:
   - If grace period expired → suspend + email
   - If 2 days remaining → warning email (once)
3. Log results

**Setup**: Automatically starts when server boots (in app.js)

---

## Testing

### Manual Testing Commands

```bash
# Trigger monthly billing manually
curl -X POST http://localhost:8080/api/admin/trigger-billing \
  -H "Authorization: Bearer <token>"

# Check grace periods manually
curl -X POST http://localhost:8080/api/admin/trigger-grace-check \
  -H "Authorization: Bearer <token>"

# Get payment overview
curl http://localhost:8080/api/admin/payment-overview \
  -H "Authorization: Bearer <token>"
```

### Test Scenarios

**1. Test Payment Failure**
- Use Stripe test card: `4000000000000002` (decline)
- Trigger monthly billing
- Verify email sent
- Verify 7-day grace period set
- Verify agent still works with warning

**2. Test Grace Period Expiration**
- Set `gracePeriodEnd` to past date manually
- Run grace period checker
- Verify account suspended
- Verify agent blocked (402 response)

**3. Test Account Reactivation**
- Add new payment method while payment_failed
- Verify automatic charge retry
- Verify account reactivated
- Verify email sent

**4. Test Successful Payment**
- Use Stripe test card: `4242424242424242` (success)
- Add API usage records to DynamoDB
- Trigger monthly billing
- Verify charge succeeded
- Verify success email sent

---

## Environment Variables

```env
# Stripe Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Email Configuration
NOTIFICATION_EMAIL=noreply@examarkchat.com
AWS_SES_FROM_EMAIL=noreply@examarkchat.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

---

## Monitoring

### Logs to Watch

```bash
# Monthly billing
✅ [BILLING] Monthly billing complete: { successful: 5, failed: 1 }

# Grace period checks
✅ [GRACE] Check complete: 2 suspended, 1 warned

# Payment status middleware
🚫 [PAYMENT] Blocked suspended user: user123
⚠️ [PAYMENT] Warning for user in grace period: user456

# Emails
✅ [EMAIL] Payment failed notification sent to user@example.com
✅ [EMAIL] Account reactivated notification sent to user@example.com
```

### Admin Dashboard Queries

```javascript
// Count users by status
const { active, payment_failed, suspended } = await fetch('/api/admin/payment-overview');

// Monitor failed charges
const failedUsers = users.filter(u => u.status === 'payment_failed');

// Check grace period expirations
const expiringSoon = users.filter(u => 
  u.gracePeriodEnd && 
  new Date(u.gracePeriodEnd) - Date.now() < 2 * 24 * 60 * 60 * 1000
);
```

---

## Security Considerations

1. **Admin Routes**: Add role-based authentication before production
2. **Rate Limiting**: Already applied to billing endpoints via express-rate-limit
3. **Webhook Verification**: Stripe webhooks should verify signatures (not yet implemented)
4. **PCI Compliance**: Never store card numbers - use Stripe tokens only
5. **JWT Tokens**: Already secured with JWT middleware on all billing routes

---

## Production Deployment

### Pre-Launch Checklist

- [ ] Replace Stripe test keys with live keys
- [ ] Set up monthly billing cron job
- [ ] Verify grace period checker is running
- [ ] Test all email templates
- [ ] Add admin role checks to admin endpoints
- [ ] Set up Stripe webhook endpoint (for real-time payment updates)
- [ ] Configure AWS SES production access
- [ ] Update FRONTEND_URL to production domain
- [ ] Test payment flow end-to-end with test cards
- [ ] Set up monitoring/alerting for failed charges
- [ ] Document customer support procedures for suspended accounts

### Stripe Live Mode

```env
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### Cron Job Setup (Production)

**Option 1: Node-cron (in app.js)**
```javascript
import cron from 'node-cron';
cron.schedule('0 2 1 * *', async () => {
  await axios.post('http://localhost:8080/api/billing/charge-monthly');
});
```

**Option 2: AWS EventBridge**
- Create scheduled rule: `cron(0 2 1 * ? *)`
- Target: Lambda function calling `/api/billing/charge-monthly`

**Option 3: External Cron Service**
- Use cron-job.org or similar
- Schedule: `0 2 1 * *`
- URL: `https://yourdomain.com/api/admin/trigger-billing`
- Header: `Authorization: Bearer <admin_token>`

---

## Troubleshooting

### Issue: Monthly billing not charging users

**Check**:
1. Are there records in `api-usage` table?
2. Is Stripe customer ID set in user settings?
3. Is default payment method set?
4. Check logs for error messages

### Issue: Emails not sending

**Check**:
1. Is AWS SES configured correctly?
2. Is email verified in AWS SES (sandbox mode requires verification)?
3. Is NOTIFICATION_EMAIL set in .env?
4. Check CloudWatch logs for SES errors

### Issue: Grace period not expiring

**Check**:
1. Is grace period checker running? (Should log every hour)
2. Is `gracePeriodEnd` date in future or past?
3. Run manual check: `POST /api/admin/trigger-grace-check`

### Issue: Account not reactivating after payment

**Check**:
1. Did charge actually succeed in Stripe dashboard?
2. Is `paymentStatus` still `payment_failed`?
3. Check billing route logs for errors
4. Manually update: `paymentStatus='active', gracePeriodEnd=null`

---

## Support Contact

For billing issues, users can:
1. Update payment method in Settings → Billing
2. Contact support at: support@examarkchat.com
3. Check payment status in dashboard banner

---

## Files Modified/Created

### New Files
- `utils/billingEmails.js` - Email notification templates
- `utils/gracePeriodChecker.js` - Grace period monitoring job
- `routes/admin.js` - Admin utilities for testing
- `middleware/paymentStatus.js` - Payment blocking middleware
- `frontend/src/components/PaymentStatusBanner.tsx` - UI warning banner
- `BILLING_SYSTEM.md` - This documentation

### Modified Files
- `routes/billing.js` - Added monthly billing, charge retry, emails
- `routes/leadAgent.js` - Added payment status middleware
- `app.js` - Started grace period checker on boot
- `.env` - Added NOTIFICATION_EMAIL and FRONTEND_URL
- `frontend/src/app/globals.css` - Fixed button styling
- `frontend/src/components/BillingContent.tsx` - Fixed Stripe Elements

---

**Built**: January 2025  
**Status**: ✅ Complete and functional  
**Version**: 1.0
