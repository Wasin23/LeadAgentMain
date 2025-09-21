import crypto from 'crypto';

// Test qualifying questions before calendar discussion
async function testQualifyingQuestions() {
  console.log('🔍 Testing Qualifying Questions Before Calendar Discussion\n');

  // Generate a unique tracking ID for this test
  const trackingId = crypto.randomBytes(16).toString('hex');
  console.log('🔗 Generated tracking ID:', trackingId);

  const testCases = [
    {
      title: "Initial qualifying question - pricing inquiry",
      from: "sarah.jones@startup.io",
      message: "Hi! I'm interested in ExaMark but wanted to understand your pricing structure first. We're a small team of about 15 people.",
      expectedBehavior: "Should provide helpful info, no calendar/timezone logic triggered"
    },
    {
      title: "Follow-up question about features",
      from: "sarah.jones@startup.io", 
      message: "Thanks for the info! How does your solution integrate with Salesforce? We use that for our CRM.",
      expectedBehavior: "Should answer question, still no calendar logic"
    },
    {
      title: "Moving toward meeting after qualifying",
      from: "sarah.jones@startup.io",
      message: "This sounds perfect for our needs! I'd like to schedule a demo. Are you available tomorrow afternoon?",
      expectedBehavior: "Should detect meeting intent but no specific time yet, no timezone confirmation"
    },
    {
      title: "Confirming specific time after qualification",
      from: "sarah.jones@startup.io",
      message: "Perfect! Let's do 2pm tomorrow then. Looking forward to the demo!",
      expectedBehavior: "Should ask for timezone confirmation since time specified without timezone"
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🌐 Test ${i + 1}: ${testCase.title}`);
    console.log(`   From: ${testCase.from}`);
    console.log(`   Message: "${testCase.message}"`);
    console.log(`   Expected: ${testCase.expectedBehavior}`);
    console.log('   🔄 Processing webhook...');

    try {
      // Simulate the webhook payload
      const webhookPayload = {
        timestamp: Math.floor(Date.now() / 1000),
        token: 'webhook-token',
        signature: 'valid-signature',
        From: testCase.from,
        To: 'ai@examark.us',
        Subject: `Re: ExaMark Inquiry [${trackingId}]`,
        'body-plain': testCase.message,
        'stripped-text': testCase.message,
        recipient: 'ai@examark.us',
        'In-Reply-To': `<ai-response-${trackingId}-1726844400@examark.us>`,
        References: `<tracking-${trackingId}@examark.us> <ai-response-${trackingId}-1726844400@examark.us>`
      };

      // Convert to URL-encoded format like Mailgun sends
      const formData = new URLSearchParams(webhookPayload).toString();

      // Call the webhook function
      const webhookModule = await import('./netlify-deploy/functions/mailgun-webhook.js');
      const { handler } = webhookModule;
      
      const event = {
        httpMethod: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formData
      };

      const result = await handler(event, {});
      const response = JSON.parse(result.body);

      if (response.success) {
        console.log('   ✅ Webhook processed successfully');
        
        // Analyze the AI response for calendar/timezone logic
        if (response.aiResponse) {
          const aiText = response.aiResponse.response || '';
          const intent = response.aiResponse.intent || 'unknown';
          const hasTimeZoneQuestion = aiText.toLowerCase().includes('time zone') || aiText.toLowerCase().includes('timezone');
          const hasCalendarEvent = response.aiResponse.calendarEvent;
          
          console.log(`   📊 Intent detected: ${intent}`);
          console.log(`   🕰️ Timezone question included: ${hasTimeZoneQuestion}`);
          console.log(`   📅 Calendar event created: ${hasCalendarEvent ? 'Yes' : 'No'}`);
          
          if (hasTimeZoneQuestion) {
            console.log('   🎯 AI Response includes timezone confirmation (as expected for time-specific messages)');
          }
          
          if (hasCalendarEvent && hasCalendarEvent.eventCreated) {
            console.log(`   📅 Calendar event ID: ${hasCalendarEvent.eventDetails?.event_id}`);
          }
        }
      } else {
        console.log('   ❌ Webhook processing failed:', response.error);
      }
    } catch (error) {
      console.log('   ❌ Test failed:', error.message);
    }
    
    console.log('   ────────────────────────────────────────────────────────────');
  }

  console.log('\n🏁 Qualifying questions flow testing complete!');
  console.log('\nKey insights:');
  console.log('• Early qualifying questions should NOT trigger calendar/timezone logic');
  console.log('• Only when specific meeting times are mentioned should timezone confirmation activate');
  console.log('• The system should handle the natural sales conversation flow gracefully');
}

// Run the test
testQualifyingQuestions().catch(console.error);
