import fs from 'fs';

try {
  const queue = JSON.parse(fs.readFileSync('./email_queue_76e84c79-9b13-4c55-be86-d0bd9baa9411.json', 'utf8'));
  
  console.log(`📧 Emails in queue: ${queue.length}`);
  console.log('\nQueue contents:');
  
  queue.forEach((email, i) => {
    const company = email.leadInfo?.company || email.company || 'Unknown';
    const name = email.leadInfo?.name || email.name || 'Unknown';
    const recipient = email.to || email.recipient || 'Unknown';
    
    console.log(`${i+1}. ${name} at ${company} (${recipient})`);
  });
  
} catch(e) {
  console.log('❌ Error reading queue file:', e.message);
}