import { sendEmailMailgun } from './tools/emailMailgun.js';

async function testEmailLogging() {
  console.log('Testing email logging...');
  
  try {
    const result = await sendEmailMailgun('test@example.com', 'Test Subject', 'This is a test email body');
    console.log('Email result:', result);
  } catch (error) {
    console.error('Email test failed:', error);
  }
}

testEmailLogging();
