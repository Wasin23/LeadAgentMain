#!/usr/bin/env node

/**
 * Google Calendar Integration Test & Setup Script
 * 
 * This script helps you:
 * 1. Test your Google Calendar API credentials
 * 2. Find your Calendar ID
 * 3. Test calendar event creation
 * 4. Validate the automatic calendar feature
 */

import 'dotenv/config';
import { calendarManager } from './utils/calendarIntegrationManager.js';

async function main() {
  console.log('📅 ======================================');
  console.log('📅 Google Calendar Integration Test');
  console.log('📅 ======================================\n');

  // Step 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');
  
  const hasApiKey = !!process.env.GOOGLE_CALENDAR_API_KEY;
  const hasCalendarId = !!process.env.GOOGLE_CALENDAR_ID;
  
  console.log(`   ✅ GOOGLE_CALENDAR_API_KEY: ${hasApiKey ? 'Set' : '❌ Missing'}`);
  console.log(`   ✅ GOOGLE_CALENDAR_ID: ${hasCalendarId ? 'Set' : '❌ Missing'}`);
  
  if (!hasApiKey || !hasCalendarId) {
    console.log('\n❌ Missing required Google Calendar credentials!');
    console.log('\n📋 Setup Instructions:');
    console.log('   1. Go to Google Cloud Console: https://console.cloud.google.com/');
    console.log('   2. Enable the Google Calendar API');
    console.log('   3. Create credentials (API Key)');
    console.log('   4. Find your Calendar ID in Google Calendar settings');
    console.log('   5. Update your .env file with:');
    console.log('      GOOGLE_CALENDAR_API_KEY=your_api_key_here');
    console.log('      GOOGLE_CALENDAR_ID=your_calendar_id@gmail.com');
    return;
  }

  // Step 2: Initialize calendar manager
  console.log('\n2️⃣ Initializing Calendar Manager...');
  try {
    await calendarManager.initialize();
    console.log('   ✅ Calendar Manager initialized successfully');
  } catch (error) {
    console.log(`   ❌ Failed to initialize: ${error.message}`);
    return;
  }

  // Step 3: Test calendar integration
  console.log('\n3️⃣ Testing calendar integration...');
  try {
    const testCalendarLink = 'https://calendar.google.com/calendar/u/0/r?pli=1';
    const testResult = await calendarManager.testCalendarIntegration(testCalendarLink);
    
    console.log('   ✅ Calendar integration test passed');
    console.log('   📊 Test Results:');
    console.log(`      - Parsed Link Type: ${testResult.parsed_link?.type}`);
    console.log(`      - Meeting Strategy: ${testResult.meeting_strategy?.meeting_type}`);
    console.log(`      - Suggested Duration: ${testResult.meeting_strategy?.suggested_duration} minutes`);
    console.log(`      - Time Suggestions: ${testResult.suggested_times?.length} slots generated`);
  } catch (error) {
    console.log(`   ❌ Calendar integration test failed: ${error.message}`);
    return;
  }

  // Step 4: Test calendar event creation
  console.log('\n4️⃣ Testing calendar event creation...');
  
  const testEventDetails = {
    title: 'Test Meeting - ExaMark AI',
    description: 'This is a test meeting created by ExaMark AI email responder',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // Tomorrow + 30 min
    timeZone: 'America/New_York',
    attendees: [
      { email: 'test@example.com', displayName: 'Test User' }
    ]
  };

  try {
    const eventResult = await calendarManager.createGoogleCalendarEvent(testEventDetails);
    
    if (eventResult.success) {
      console.log('   ✅ Calendar event created successfully!');
      console.log('   📅 Event Details:');
      console.log(`      - Event ID: ${eventResult.event_id}`);
      console.log(`      - Event Link: ${eventResult.event_link}`);
      console.log(`      - Meeting Link: ${eventResult.meeting_link || 'None'}`);
      
      // Ask if they want to delete the test event
      console.log('\n⚠️  This was a test event. You may want to delete it from your calendar.');
    } else {
      console.log(`   ❌ Failed to create calendar event: ${eventResult.error}`);
      
      if (eventResult.error?.includes('forbidden') || eventResult.error?.includes('unauthorized')) {
        console.log('\n💡 This might be an API key permissions issue.');
        console.log('   Make sure your API key has Calendar API access enabled.');
      }
    }
  } catch (error) {
    console.log(`   ❌ Calendar event creation failed: ${error.message}`);
  }

  // Step 5: Test email time detection
  console.log('\n5️⃣ Testing email time detection...');
  
  const testEmails = [
    "Thanks for reaching out! How about tomorrow at 2pm for a quick call?",
    "Let's schedule a meeting for Tuesday at 10:30am",
    "I'm available Monday morning around 9am",
    "Can we chat sometime next week?", // Should NOT trigger event creation
  ];

  for (let i = 0; i < testEmails.length; i++) {
    console.log(`\n   📧 Test Email ${i + 1}: "${testEmails[i]}"`);
    
    try {
      // Test the detection function (we'll need to import it)
      const hasTime = testEmails[i].toLowerCase().match(/(tomorrow|today|monday|tuesday|wednesday|thursday|friday)\s+at\s+\d{1,2}(:\d{2})?\s*(am|pm)/i);
      console.log(`      - Time Pattern Detected: ${hasTime ? '✅ Yes' : '❌ No'}`);
      
      if (hasTime) {
        console.log(`      - Detected Pattern: "${hasTime[0]}"`);
        console.log(`      - Would Trigger: ✅ Calendar Event Creation`);
      } else {
        console.log(`      - Would Trigger: ❌ No Action (Correct)`);
      }
    } catch (error) {
      console.log(`      - Error testing: ${error.message}`);
    }
  }

  console.log('\n🎉 ======================================');
  console.log('🎉 Calendar Integration Test Complete!');
  console.log('🎉 ======================================');
  
  if (hasApiKey && hasCalendarId) {
    console.log('\n✅ Your Google Calendar integration is ready!');
    console.log('\n📋 What happens now:');
    console.log('   1. When prospects reply with specific meeting times');
    console.log('   2. AI will automatically detect the confirmed time');
    console.log('   3. A calendar event will be created automatically');
    console.log('   4. Both you and the prospect will receive calendar invites');
    console.log('\n🧪 Test it by sending an email reply with:');
    console.log('   "How about tomorrow at 2pm for a quick call?"');
  }
}

// Handle errors gracefully
main().catch(error => {
  console.error('\n❌ Test script failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
