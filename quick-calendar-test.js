#!/usr/bin/env node

/**
 * Quick 30-second test to check if your Google Calendar API is working
 */

import 'dotenv/config';

async function quickTest() {
  console.log('🔍 Quick Calendar API Test\n');
  
  // Check if credentials exist
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  
  console.log(`📋 Service Account Email: ${serviceAccountEmail ? '✅ Set' : '❌ Missing'}`);
  console.log(`📋 Private Key: ${privateKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`📋 Calendar ID: ${calendarId ? '✅ Set' : '❌ Missing'}`);
  
  if (!serviceAccountEmail || !privateKey || !calendarId) {
    console.log('\n❌ Missing credentials! Update your .env file first.\n');
    return;
  }
  
  // Quick API test - just try to read calendar info
  console.log('\n🧪 Testing Service Account authentication...');
  
  try {
    // Simple JWT creation for testing
    const jwt = await createSimpleJWT(serviceAccountEmail, privateKey);
    console.log('✅ JWT token created successfully');
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}`,
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Your Service Account is working!');
      console.log(`📅 Calendar: ${data.summary}`);
      console.log(`🕐 Timezone: ${data.timeZone}`);
      console.log('\n🎉 Calendar integration is ready!');
      console.log('\n📧 Now when prospects reply with meeting times like:');
      console.log('   "How about tomorrow at 2pm?"');
      console.log('   The AI will automatically create calendar events!');
    } else {
      const error = await response.text();
      console.log('❌ API Error:', error);
      console.log('\n💡 Common fixes:');
      console.log('   - Make sure you shared your calendar with the service account');
      console.log('   - Share with: examark@examarkmain.iam.gserviceaccount.com');
      console.log('   - Give it "Make changes to events" permission');
    }
  } catch (error) {
    console.log('❌ Connection Error:', error.message);
  }
}

// Simple JWT creation for testing
async function createSimpleJWT(serviceAccountEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const crypto = await import('crypto');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), privateKey);
  const encodedSignature = signature.toString('base64url');
  
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

quickTest();
