// Test tracking pixel functionality
import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function testTrackingPixel() {
  console.log('🧪 [TEST] Starting tracking pixel test...\n');
  
  // Test tracking ID (format: tracking-{userId}_{agentId}_{timestamp})
  const testTrackingId = 'tracking-5781c511-2307-4fcf-a763-33e8ec64a638_211052_1765140101571';
  
  try {
    // Test 1: Query existing events for this tracking ID
    console.log('📝 [TEST 1] Querying existing events...');
    const existingEvents = await awsManager.getEmailTrackingByTracking(testTrackingId);
    console.log(`✅ [TEST 1] Found ${existingEvents.length} existing events`);
    
    if (existingEvents.length > 0) {
      console.log('📊 [TEST 1] First event:', {
        eventType: existingEvents[0].eventType,
        timestamp: existingEvents[0].timestamp,
        trackingId: existingEvents[0].trackingId,
        recipientEmail: existingEvents[0].recipientEmail
      });
    }
    
    // Test 2: Check for open events
    console.log('\n📝 [TEST 2] Checking for open events...');
    const hasBeenOpened = existingEvents.some(e => e.eventType === 'open');
    console.log(`✅ [TEST 2] Has been opened before: ${hasBeenOpened}`);
    
    // Test 3: Simulate logging a new open event (if none exist)
    if (!hasBeenOpened) {
      console.log('\n📝 [TEST 3] Logging test open event...');
      const result = await awsManager.logEmailTracking(
        '5781c511-2307-4fcf-a763-33e8ec64a638',
        '211052',
        testTrackingId,
        {
          eventType: 'open',
          recipientEmail: 'test@example.com',
          leadName: 'Test Lead',
          subject: 'Test Email',
          userAgent: 'Test User Agent',
          ipAddress: '127.0.0.1'
        }
      );
      console.log('✅ [TEST 3] Event logged:', result);
      
      // Verify it was recorded
      console.log('\n📝 [TEST 4] Verifying event was recorded...');
      const updatedEvents = await awsManager.getEmailTrackingByTracking(testTrackingId);
      console.log(`✅ [TEST 4] Now have ${updatedEvents.length} events`);
      const openEvents = updatedEvents.filter(e => e.eventType === 'open');
      console.log(`✅ [TEST 4] Open events: ${openEvents.length}`);
    } else {
      console.log('⏭️  [TEST 3] Skipping - already has open events');
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    console.error('Stack:', error.stack);
  }
}

testTrackingPixel();
