import 'dotenv/config';

// Exact replication of the working PowerShell command
async function testExactPowerShellFormat() {
  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  const auth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
  
  // Use URLSearchParams just like PowerShell form data
  const formData = new URLSearchParams();
  formData.append('from', 'ExaMark <exa.mark@mg.examarkchat.com>');
  formData.append('to', 'colton.fidd@gmail.com');
  formData.append('subject', 'Node.js Exact PowerShell Replication Test');
  formData.append('text', `This is a Node.js test using the EXACT same format as your working PowerShell command. If you receive this, we've found the solution! Sent at: ${new Date()}`);

  try {
    console.log('Sending with exact PowerShell format...');
    console.log('From:', 'ExaMark <exa.mark@mg.examarkchat.com>');
    console.log('Auth:', `Basic ${auth.substring(0, 20)}...`);
    
    const response = await fetch('https://api.mailgun.net/v3/mg.examarkchat.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response result:', result);
    
    if (response.ok) {
      console.log('✅ SUCCESS! Email sent with exact PowerShell format');
    } else {
      console.log('❌ FAILED with PowerShell format');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testExactPowerShellFormat();
