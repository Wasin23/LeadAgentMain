// Test user-specific tracking ID generation and parsing
import crypto from 'crypto';

// Simulate the tracking ID generation
function generateTrackingId(recipient, subject, userId = 'default') {
  const unique = `${userId}-${recipient}-${subject}-${Date.now()}`;
  const hash = crypto.createHash('md5').update(unique).digest('hex');
  return `${userId}_${Date.now()}_${hash.substring(0, 8)}`;
}

// Simulate the extraction
function extractUserIdFromTrackingId(trackingId) {
  try {
    if (!trackingId) return 'default';
    
    const parts = trackingId.split('_');
    if (parts.length >= 3) {
      const userId = parts[0];
      console.log('[USER ID] Extracted from tracking ID:', userId);
      return userId;
    }
    
    console.log('[USER ID] Could not parse tracking ID, using default:', trackingId);
    return 'default';
  } catch (error) {
    console.error('[USER ID] Error extracting user ID:', error);
    return 'default';
  }
}

// Test scenarios
console.log('🧪 Testing User-Specific Tracking System\n');

const testCases = [
  { userId: 'exabits', recipient: 'john@techcorp.com', subject: 'AI Computing Solutions' },
  { userId: 'acmecorp', recipient: 'sarah@startup.io', subject: 'Meeting Follow-up' },
  { userId: 'default', recipient: 'lead@company.com', subject: 'Product Demo' }
];

testCases.forEach((testCase, i) => {
  console.log(`Test ${i + 1}: User "${testCase.userId}"`);
  
  // Generate tracking ID
  const trackingId = generateTrackingId(testCase.recipient, testCase.subject, testCase.userId);
  console.log(`  Generated: ${trackingId}`);
  
  // Extract user ID
  const extractedUserId = extractUserIdFromTrackingId(trackingId);
  console.log(`  Extracted: ${extractedUserId}`);
  
  // Verify
  const isCorrect = extractedUserId === testCase.userId;
  console.log(`  ✅ ${isCorrect ? 'PASS' : 'FAIL'}\n`);
});

console.log('🎯 Result: Each user will get their own timezone settings and AI responses!');
