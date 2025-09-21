#!/usr/bin/env node

/**
 * Create a realistic test with proper tracking ID and simulate meeting confirmation
 */

import 'dotenv/config';
import crypto from 'crypto';

async function testRealisticMeetingConfirmation() {
  console.log('🗓️ Testing Realistic Meeting Confirmation → Calendar Event\n');
  
  // Check required environment variables
  const requiredEnvs = ['OPENAI_API_KEY', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CALENDAR_ID'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  if (missingEnvs.length > 0) {
    console.log('❌ Missing required environment variables:', missingEnvs);
    return;
  }
  
  // Generate a realistic tracking ID (32-char hex like the system uses)
  const trackingId = crypto.randomBytes(16).toString('hex');
  console.log('🔗 Generated tracking ID:', trackingId);
  
  // Test case with proper tracking ID in subject
  const testCase = {
    name: "Meeting Confirmation with Real Tracking ID",
    email: "Perfect! I can confirm our meeting for tomorrow at 2pm for 30 minutes. Looking forward to discussing the project details!",
    from: "john.doe@example.com",
    subject: `Re: ExaMark Demo Discussion [${trackingId}]`,
    trackingId: trackingId
  };
  
  console.log('📧 Simulating tracked email reply...');
  console.log(`   From: ${testCase.from}`);
  console.log(`   Subject: ${testCase.subject}`);
  console.log(`   Message: "${testCase.email}"`);
  console.log(`   Tracking ID: ${testCase.trackingId}`);
  
  // Simulate webhook payload with proper tracking ID
  const webhookPayload = {
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'timestamp': Math.floor(Date.now() / 1000).toString(),
      'token': 'webhook-token',
      'signature': 'valid-signature',
      'From': testCase.from,
      'To': 'ai@examark.us',
      'Subject': testCase.subject,
      'body-plain': testCase.email,
      'stripped-text': testCase.email,
      'recipient': 'ai@examark.us',
      // Add some additional headers that might contain tracking info
      'In-Reply-To': `<ai-response-${trackingId}-1726844400@examark.us>`,
      'References': `<tracking-${trackingId}@examark.us> <ai-response-${trackingId}-1726844400@examark.us>`
    }).toString()
  };
  
  try {
    console.log('\n🔄 Processing webhook with enhanced tracking detection...');
    
    // Import the webhook handler
    const webhook = await import('./netlify-deploy/functions/mailgun-webhook.js');
    
    // Process the webhook
    const result = await webhook.handler(webhookPayload, {});
    
    if (result.statusCode === 200) {
      const response = JSON.parse(result.body);
      console.log('✅ Webhook processed successfully');
      
      // Check tracking ID detection
      if (response.trackingId) {
        console.log(`🔗 Tracking ID detected: ${response.trackingId}`);
      } else {
        console.log('❌ Tracking ID NOT detected');
      }
      
      // Check if calendar event was created
      if (response.calendarEvent && response.calendarEvent.eventCreated) {
        console.log('\n🎉 CALENDAR EVENT SUCCESSFULLY CREATED!');
        console.log('📅 Event Details:');
        console.log(`   - Event ID: ${response.calendarEvent.eventDetails?.id || 'N/A'}`);
        console.log(`   - Title: ${response.calendarEvent.eventDetails?.title || 'N/A'}`);
        console.log(`   - Start: ${response.calendarEvent.meetingTime?.startTime || 'N/A'}`);
        console.log(`   - Duration: ${response.calendarEvent.meetingTime?.duration || 'N/A'} minutes`);
        console.log(`   - End: ${response.calendarEvent.meetingTime?.endTime || 'N/A'}`);
        console.log(`   - Confidence: ${response.calendarEvent.meetingTime?.confidence || 'N/A'}`);
        console.log(`   - Original Text: "${response.calendarEvent.meetingTime?.originalText || 'N/A'}"`);
        console.log(`   - Google Calendar Link: ${response.calendarEvent.eventDetails?.htmlLink || 'N/A'}`);
        
        console.log('\n👥 Lead Information:');
        console.log(`   - Name: ${response.calendarEvent.leadInfo?.name || 'N/A'}`);
        console.log(`   - Email: ${response.calendarEvent.leadInfo?.email || 'N/A'}`);
        console.log(`   - Company: ${response.calendarEvent.leadInfo?.company || 'N/A'}`);
        
      } else if (response.calendarEvent) {
        console.log('\n❌ Calendar event NOT created');
        console.log(`   Reason: ${response.calendarEvent.reason || response.calendarEvent.error || 'Unknown'}`);
      } else {
        console.log('\n⚠️  No calendar event info in response');
      }
      
      // Check conversation state
      if (response.conversation_state) {
        console.log(`\n📊 Conversation State: ${response.conversation_state.state}`);
        if (response.conversation_state.state === 'meeting_booked') {
          console.log('✅ Conversation correctly marked as meeting_booked');
        }
      }
      
      // Check AI response
      if (response.ai_response && response.ai_response.response) {
        console.log(`\n🤖 AI Response Generated (preview): ${response.ai_response.response.substring(0, 150)}...`);
      }
      
      // Check Zilliz storage
      if (response.zillizStorage && response.zillizStorage.success) {
        console.log('\n💾 Successfully stored in Zilliz database');
      }
      
    } else {
      console.log(`❌ Webhook failed with status: ${result.statusCode}`);
      if (result.body) {
        console.log(`Error details: ${result.body}`);
      }
    }
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
  
  console.log('\n🏁 Realistic meeting confirmation calendar test complete!');
}

testRealisticMeetingConfirmation();
