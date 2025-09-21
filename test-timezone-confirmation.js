#!/usr/bin/env node

/**
 * Test full meeting confirmation with time zone confirmation suggestion
 */

import 'dotenv/config';
import crypto from 'crypto';

async function testMeetingWithTimeZoneConfirmation() {
  console.log('🌍 Testing Meeting Confirmation with Time Zone Confirmation\n');
  
  // Check required environment variables
  const requiredEnvs = ['OPENAI_API_KEY', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CALENDAR_ID'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  if (missingEnvs.length > 0) {
    console.log('❌ Missing required environment variables:', missingEnvs);
    return;
  }
  
  // Generate a realistic tracking ID
  const trackingId = crypto.randomBytes(16).toString('hex');
  console.log('🔗 Generated tracking ID:', trackingId);
  
  // Test cases with different time zone scenarios
  const testCases = [
    {
      name: "Meeting with explicit PST - should NOT ask for confirmation",
      email: "Perfect! I can confirm our meeting for tomorrow at 2pm PST for 30 minutes. Looking forward to it!",
      from: "jane.doe@company.com",
      subject: `Re: ExaMark Demo [${trackingId}]`,
      shouldAskTimeZone: false
    },
    {
      name: "Meeting without time zone - should ASK for confirmation", 
      email: "Yes, tomorrow at 2pm works perfectly for me!",
      from: "john.smith@business.org",
      subject: `Re: ExaMark Discussion [${trackingId}]`,
      shouldAskTimeZone: true
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🌐 Test ${i + 1}: ${testCase.name}`);
    console.log(`   From: ${testCase.from}`);
    console.log(`   Message: "${testCase.email}"`);
    console.log(`   Should ask time zone: ${testCase.shouldAskTimeZone}`);
    
    // Simulate webhook payload
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
        'In-Reply-To': `<ai-response-${trackingId}-1726844400@examark.us>`,
        'References': `<tracking-${trackingId}@examark.us> <ai-response-${trackingId}-1726844400@examark.us>`
      }).toString()
    };
    
    try {
      console.log('   🔄 Processing webhook...');
      
      // Import the webhook handler
      const webhook = await import('./netlify-deploy/functions/mailgun-webhook.js');
      
      // Process the webhook
      const result = await webhook.handler(webhookPayload, {});
      
      if (result.statusCode === 200) {
        const response = JSON.parse(result.body);
        console.log('   ✅ Webhook processed successfully');
        
        // Check calendar event creation
        if (response.calendarEvent && response.calendarEvent.eventCreated) {
          console.log('   🎉 CALENDAR EVENT CREATED!');
          const meetingTime = response.calendarEvent.meetingTime;
          console.log(`      - Time Zone: ${meetingTime.timeZone}`);
          console.log(`      - Time Zone Specified: ${meetingTime.timeZoneSpecified || 'not available'}`);
          console.log(`      - Should Confirm TZ: ${meetingTime.suggestTimeZoneConfirmation || 'not available'}`);
          console.log(`      - Event Time: ${new Date(meetingTime.startTime).toLocaleString()}`);
          console.log(`      - Duration: ${meetingTime.duration} minutes`);
        }
        
        // Check AI response for time zone confirmation
        if (response.ai_response && response.ai_response.response) {
          const aiResponseText = response.ai_response.response.toLowerCase();
          console.log(`\n   🤖 AI Response Preview:`);
          console.log(`      ${response.ai_response.response.substring(0, 200)}...`);
          
          // Check if AI response includes time zone confirmation
          const hasTimeZoneConfirmation = aiResponseText.includes('time zone') || 
                                        aiResponseText.includes('est') || 
                                        aiResponseText.includes('pst') || 
                                        aiResponseText.includes('central') || 
                                        aiResponseText.includes('eastern') || 
                                        aiResponseText.includes('pacific') ||
                                        aiResponseText.includes('confirm') ||
                                        aiResponseText.includes('what time zone');
          
          if (testCase.shouldAskTimeZone) {
            if (hasTimeZoneConfirmation) {
              console.log('   ✅ AI correctly asks for time zone confirmation');
            } else {
              console.log('   ⚠️  AI should ask for time zone confirmation but didn\'t');
            }
          } else {
            if (hasTimeZoneConfirmation) {
              console.log('   ⚠️  AI asks for time zone confirmation but shouldn\'t need to');
            } else {
              console.log('   ✅ AI correctly doesn\'t ask for time zone (already specified)');
            }
          }
        }
        
      } else {
        console.log(`   ❌ Webhook failed with status: ${result.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
    
    console.log('   ' + '─'.repeat(60));
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Time zone confirmation testing complete!');
}

testMeetingWithTimeZoneConfirmation();
