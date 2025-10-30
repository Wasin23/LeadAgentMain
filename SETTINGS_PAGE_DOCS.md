# Settings Page Implementation

## Overview
Created a comprehensive settings page at `/settings` with tabbed navigation for different configuration categories.

## Frontend Components

### Main Settings Page
**Location:** `frontend/src/app/settings/page.tsx`

**Features:**
- 5 tabbed sections: Profile, API Keys, Budget & Limits, Email Configuration, Preferences
- Responsive layout with sidebar navigation
- Success/error message handling
- Loading states
- Auto-save functionality

**Tabs:**

1. **Profile Tab**
   - Username (read-only)
   - Email (read-only)
   - Account creation date
   
2. **API Keys Tab**
   - OpenAI API Key
   - Serper API Key
   - Apollo API Key
   - Mailgun API Key & Domain
   - ZeroBounce API Key
   - Security note about masked values
   - Keys are masked (••••) for security

3. **Budget & Limits Tab**
   - Reuses existing `RateLimitSettings` component
   - Monthly budget tracking
   - API cost monitoring
   - Estimated lead capacity

4. **Email Configuration Tab**
   - From Name
   - From Email
   - Reply-To Email
   - Email Signature

5. **Preferences Tab**
   - Theme selection (Light/Dark/Auto)
   - Default lead limit
   - Auto-save interval

### Navigation
**Updated:** `frontend/src/components/UserMenu.tsx`
- Added "Settings" button that navigates to `/settings`
- Removed redundant menu items
- Closes menu after navigation

## Backend Routes

### Profile Endpoint
**Route:** `GET /api/auth/profile`
**File:** `routes/auth.js`
- Returns user profile (username, email, creation date)
- Excludes sensitive data (password hash, API keys)

### Email Settings
**Route:** `POST /api/auth/settings/email`
**File:** `routes/auth.js`
- Updates email configuration
- Saves to user settings

### API Keys Management
**Routes:**
- `GET /api/system/api-keys` - Fetch API keys (masked)
- `POST /api/system/api-keys` - Update API keys

**File:** `routes/system.js`
**Features:**
- Masks API keys for security (shows last 4 characters only)
- Filters out masked keys on save (prevents overwriting with ••••)
- Stores in AWS DynamoDB via userManager

### Existing Routes (Already Working)
- `GET /api/auth/settings` - Get user settings
- `POST /api/auth/settings/preferences` - Update preferences
- `GET /api/lead-agent/rate-limits` - Get budget settings (used by RateLimitSettings)
- `POST /api/lead-agent/rate-limits` - Save budget settings (used by RateLimitSettings)

## Security Features

1. **JWT Authentication**
   - All endpoints require authentication
   - User ID extracted from JWT token

2. **API Key Masking**
   - Keys displayed as `••••last4chars`
   - Only updated when user enters new value
   - Backend filters masked keys on save

3. **Sensitive Data Filtering**
   - Password hashes never sent to frontend
   - API keys excluded from general settings endpoint
   - Separate secure endpoint for API key management

## Data Flow

### On Page Load:
1. Fetch user profile (`/api/auth/profile`)
2. Fetch user settings (`/api/auth/settings`)
3. Fetch API keys (`/api/system/api-keys`) - masked

### On Save:
- **API Keys:** POST to `/api/system/api-keys` → Updates AWS DynamoDB
- **Email Settings:** POST to `/api/auth/settings/email` → Updates user settings
- **Preferences:** POST to `/api/auth/settings/preferences` → Updates user settings
- **Budget:** Handled by RateLimitSettings component → POST to `/api/lead-agent/rate-limits`

## Storage Locations

- **User Profile:** AWS DynamoDB (users table)
- **API Keys:** AWS DynamoDB (users table, apiKeys field)
- **Email Settings:** User settings file + AWS
- **Preferences:** User settings file + AWS
- **Budget/Rate Limits:** Agent-specific settings in AWS

## Usage

1. Navigate to Settings from User Menu (top right)
2. Select desired tab from sidebar
3. Edit settings as needed
4. Click "Save" button for each section
5. Success/error messages appear at top
6. Navigate back using back arrow or browser back button

## Technical Notes

- Uses Next.js 13+ App Router
- Client-side component (`'use client'`)
- Responsive design (mobile-friendly)
- Heroicons for icons
- Tailwind CSS for styling
- API calls via centralized `api` utility
- State management with React hooks
- TypeScript for type safety

## Future Enhancements

Potential additions:
- Password change functionality
- Two-factor authentication
- Notification preferences
- Agent default templates
- Export/import settings
- API key validation
- Usage analytics in settings view
