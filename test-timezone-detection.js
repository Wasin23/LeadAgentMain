#!/usr/bin/env node

/**
 * Test enhanced time zone detection and confirmation
 */

import 'dotenv/config';

async function testTimeZoneDetection() {
  console.log('🌍 Testing Enhanced Time Zone Detection\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ No OpenAI API key found');
    return;
  }
  
  const testCases = [
    {
      name: "Meeting with explicit EST",
      email: "Perfect! I can confirm our meeting for tomorrow at 2pm EST for 30 minutes.",
      expectedTimeZone: "America/New_York",
      expectedTimeZoneSpecified: true,
      expectedSuggestConfirmation: false
    },
    {
      name: "Meeting with PST",
      email: "How about Friday at 3pm PST for 1 hour?",
      expectedTimeZone: "America/Los_Angeles", 
      expectedTimeZoneSpecified: true,
      expectedSuggestConfirmation: false
    },
    {
      name: "Meeting with Central time",
      email: "Let's meet Monday at 10am Central for a quick call",
      expectedTimeZone: "America/Chicago",
      expectedTimeZoneSpecified: true,
      expectedSuggestConfirmation: false
    },
    {
      name: "Meeting without time zone (should suggest confirmation)",
      email: "Tomorrow at 2pm works great for me!",
      expectedTimeZone: "America/New_York",
      expectedTimeZoneSpecified: false,
      expectedSuggestConfirmation: true
    },
    {
      name: "Meeting without time zone - complex",
      email: "I could do Friday at 9am for a 45 minute session if that works",
      expectedTimeZone: "America/New_York",
      expectedTimeZoneSpecified: false, 
      expectedSuggestConfirmation: true
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`🌐 Test ${i + 1}: ${testCase.name}`);
    console.log(`   Email: "${testCase.email}"`);
    
    const prompt = `
Current date and time: ${new Date().toISOString()} (it's currently ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})

Analyze this email to extract any confirmed meeting times. Pay special attention to meeting duration and time zone.

Email: "${testCase.email}"

Your task: Extract any confirmed meeting times and return JSON in this exact format:
{
  "found": true/false,
  "dateTime": "2024-01-15T14:00:00.000Z",
  "timeZone": "America/New_York", 
  "duration": 30,
  "confidence": "high/medium/low",
  "originalText": "the exact text that mentioned the time",
  "timeZoneSpecified": true/false,
  "suggestTimeZoneConfirmation": true/false
}

Time Zone Detection Rules:
- Look for explicit time zones: "2pm EST", "3pm PST", "10am UTC", "9am Central", "4pm GMT"
- Common abbreviations: EST/EDT, PST/PDT, CST/CDT, MST/MDT, UTC, GMT
- If NO time zone specified, set "timeZoneSpecified": false and "suggestTimeZoneConfirmation": true
- If time zone IS specified, set "timeZoneSpecified": true and "suggestTimeZoneConfirmation": false
- Default to "America/New_York" but flag when uncertain

Time Zone Mappings:
- EST/EDT → "America/New_York"
- PST/PDT → "America/Los_Angeles"  
- CST/CDT → "America/Chicago"
- MST/MDT → "America/Denver"
- UTC/GMT → "UTC"

Important rules:
1. Calculate the actual date based on current date: ${new Date().toLocaleDateString()}
2. If someone says "Friday" assume they mean the next upcoming Friday
3. If someone says "tomorrow" calculate tomorrow's date
4. If no year specified, assume current year: ${new Date().getFullYear()}
5. Parse duration carefully from the text
6. Parse time zone carefully - look for common abbreviations and zone names
7. When time zone is uncertain, flag for confirmation

Return only the JSON object, no other text.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        try {
          const parsed = JSON.parse(content);
          
          if (parsed.found) {
            console.log(`   ✅ MEETING DETECTED`);
            console.log(`   📅 Time: ${new Date(parsed.dateTime).toLocaleString()}`);
            console.log(`   🌍 Time Zone: ${parsed.timeZone}`);
            console.log(`   ⏰ Duration: ${parsed.duration} minutes`);
            console.log(`   🎯 Confidence: ${parsed.confidence}`);
            
            // Validate time zone detection
            const timeZoneCorrect = parsed.timeZone === testCase.expectedTimeZone;
            const timeZoneSpecifiedCorrect = parsed.timeZoneSpecified === testCase.expectedTimeZoneSpecified;
            const confirmationSuggestionCorrect = parsed.suggestTimeZoneConfirmation === testCase.expectedSuggestConfirmation;
            
            console.log(`   🔍 Time Zone Specified: ${parsed.timeZoneSpecified} ${timeZoneSpecifiedCorrect ? '✅' : '❌'}`);
            console.log(`   ⚠️  Suggest Confirmation: ${parsed.suggestTimeZoneConfirmation} ${confirmationSuggestionCorrect ? '✅' : '❌'}`);
            console.log(`   📍 Detected Zone: ${parsed.timeZone} ${timeZoneCorrect ? '✅' : '❌'}`);
            
            if (parsed.suggestTimeZoneConfirmation) {
              console.log(`   💡 AI Response should ask: "Just to confirm, is this ${parsed.timeZone.replace('America/', '').replace('_', ' ')} time?"`);
            }
            
          } else {
            console.log(`   ❌ No meeting detected`);
          }
        } catch (parseError) {
          console.log(`   ❌ Parse error: ${content}`);
        }
      } else {
        console.log(`   ❌ API Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testTimeZoneDetection();
