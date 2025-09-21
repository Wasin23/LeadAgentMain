# Google Calendar Integration Setup Guide

## 🎯 Overview

Your ExaMark AI email responder now has **automatic Google Calendar event creation** functionality! When prospects reply with confirmed meeting times, the AI will:

1. **Detect the meeting time** using AI analysis
2. **Automatically create a calendar event** 
3. **Send calendar invites** to both parties
4. **Include Google Meet links** for virtual meetings

## 🔧 Setup Instructions

### Step 1: Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create API Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy your API key
4. **Optional**: Restrict the key to Google Calendar API for security

### Step 3: Find Your Calendar ID

1. Open Google Calendar
2. Go to Settings (gear icon) > Settings
3. Click on your calendar name in the left sidebar
4. Scroll down to "Calendar ID"
5. Copy the calendar ID (usually looks like: `yourname@gmail.com`)

### Step 4: Update Environment Variables

Edit your `.env` file and add:

```env
# Google Calendar API Configuration
GOOGLE_CALENDAR_API_KEY=your_actual_api_key_here
GOOGLE_CALENDAR_ID=your_calendar_id@gmail.com
```

### Step 5: Test the Integration

Run the test script:

```bash
node test-calendar-integration.js
```

This will:
- ✅ Verify your API credentials
- ✅ Test calendar event creation
- ✅ Test email time detection
- ✅ Create a sample calendar event

## 🧪 Testing the Live System

### Test Email Examples

Send test emails to your AI responder with these messages:

**✅ WILL Create Calendar Events:**
- "Thanks! How about tomorrow at 2pm for a quick call?"
- "Let's meet Tuesday at 10:30am"
- "I'm available Monday morning at 9am"
- "Can we schedule for Friday at 3pm?"

**❌ Will NOT Create Calendar Events:**
- "Can we chat sometime next week?" (too vague)
- "I'm interested in learning more" (no time specified)
- "What's your availability?" (asking, not confirming)

### Monitoring

Check your logs for:

```
📅 [CALENDAR] Confirmed meeting detected: {...}
✅ [CALENDAR] Calendar event created successfully
📧 [NETLIFY WEBHOOK] Calendar event created successfully
```

## 🎯 How It Works

1. **Email Received** → AI analyzes content
2. **Time Detection** → Checks for confirmed meeting times
3. **AI Analysis** → OpenAI parses specific dates/times
4. **Event Creation** → Automatically creates Google Calendar event
5. **Invites Sent** → Both parties receive calendar invitations

## 🔧 Advanced Configuration

### Calendar Event Details

Events are automatically created with:

- **Title**: "Sales Discussion - [Prospect Name]"
- **Duration**: 30 minutes (default)
- **Location**: Google Meet link (auto-generated)
- **Description**: Includes lead info and original message
- **Attendees**: You + the prospect

### Customization Options

You can modify the calendar event creation in:
`netlify-deploy/functions/mailgun-webhook.js`

Look for the `handleCalendarEventCreation` function to customize:
- Event titles
- Default duration
- Time zone handling
- Event descriptions

## 📊 Analytics & Tracking

Calendar events are tracked in your Zilliz database with:
- Tracking ID correlation
- Event creation timestamps
- Lead information
- Meeting details

Query the `email_tracking_events` collection for analytics.

## 🚨 Troubleshooting

### Common Issues

**❌ "Google Calendar API not configured"**
- Check your `.env` file has the correct API key and Calendar ID
- Verify the API key has Calendar API access enabled

**❌ "Failed to create calendar event: forbidden"**
- Your API key may not have permission to access the calendar
- Try creating a new API key with proper Calendar API scope

**❌ "No confirmed meeting time detected"**
- The AI didn't find a specific date/time in the email
- Check logs for detection details
- Test with more explicit time phrases

### Debug Mode

Enable detailed logging by checking the Netlify function logs:
1. Go to your Netlify dashboard
2. Navigate to Functions
3. Click on "mailgun-webhook"
4. View the real-time logs

### Manual Testing

You can manually test calendar event creation:

```javascript
// Test in Node.js console
import { calendarManager } from './utils/calendarIntegrationManager.js';

const eventDetails = {
  title: 'Test Meeting',
  startTime: new Date(Date.now() + 24*60*60*1000).toISOString(),
  endTime: new Date(Date.now() + 24*60*60*1000 + 30*60*1000).toISOString(),
  attendees: [{ email: 'test@example.com' }]
};

const result = await calendarManager.createGoogleCalendarEvent(eventDetails);
console.log(result);
```

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Test script passes all checks
2. ✅ Calendar events appear in your Google Calendar
3. ✅ Prospects receive calendar invitations
4. ✅ Logs show successful event creation
5. ✅ Google Meet links are generated automatically

## 🔮 Next Steps

Once this is working, you can enhance it further by:

- Adding timezone detection for international prospects
- Customizing event templates based on prospect type
- Integrating with other calendar systems (Outlook, Calendly)
- Adding automatic follow-up reminders
- Building calendar analytics dashboard

Happy automating! 🚀

Open Google Calendar: https://calendar.google.com
Find your main calendar in the left sidebar (usually your email)
Click the 3 dots next to your calendar name
Click "Settings and sharing"
Scroll to "Share with specific people"
Click "Add people"
Enter this email: examark@examarkmain.iam.gserviceaccount.com
Set permission to: "Make changes to events"
Click "Send"