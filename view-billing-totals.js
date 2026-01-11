import awsManager from './utils/awsManager.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * View all billing data - total revenue, outstanding amounts, per-user breakdown
 */
async function viewBillingTotals() {
  console.log('\n💰 ═══════════════════════════════════════════════════════════');
  console.log('💰 MERIDIAN BILLING TOTALS');
  console.log('💰 ═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Get all users
    const usersCommand = new ScanCommand({ TableName: awsManager.tables.users });
    const { Items: users } = await awsManager.dynamodb.send(usersCommand);
    
    // 2. Get all payment history
    const paymentsCommand = new ScanCommand({ TableName: awsManager.tables.paymentHistory });
    const { Items: payments } = await awsManager.dynamodb.send(paymentsCommand);
    
    // 3. Get all API usage summaries
    const summaryCommand = new ScanCommand({ TableName: awsManager.tables.apiUsageSummary });
    const { Items: apiUsageSummary } = await awsManager.dynamodb.send(summaryCommand);
    
    // Calculate totals
    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const successfulPayments = payments?.filter(p => p.status === 'success') || [];
    const failedPayments = payments?.filter(p => p.status === 'failed') || [];
    
    console.log('📊 OVERALL TOTALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Revenue:           $${totalRevenue.toFixed(2)}`);
    console.log(`   Successful Payments:     ${successfulPayments.length}`);
    console.log(`   Failed Payments:         ${failedPayments.length}`);
    console.log(`   Total Users:             ${users?.length || 0}`);
    console.log('');
    
    // Calculate outstanding for all users
    let totalOutstanding = 0;
    const userBreakdown = [];
    
    for (const user of users || []) {
      if (!user.email) continue;
      
      const userPayments = payments?.filter(p => p.userId === user.userId) || [];
      const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      // Get paid months
      const paidMonths = new Set(
        userPayments
          .filter(p => p.status === 'success' && p.billingPeriod)
          .map(p => {
            const date = new Date(p.billingPeriod);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })
      );
      
      // Calculate outstanding (unpaid months only)
      const userSummaries = apiUsageSummary?.filter(s => s.userId === user.userId) || [];
      let outstanding = 0;
      
      userSummaries.forEach(summary => {
        if (paidMonths.has(summary.monthKey)) return; // Skip paid months
        
        ['apollo', 'openai', 'serper', 'zerobounce', 'mailgun', 'gmail'].forEach(service => {
          if (summary[service]) {
            outstanding += summary[service].cost || 0;
          }
        });
      });
      
      totalOutstanding += outstanding;
      
      userBreakdown.push({
        email: user.email,
        totalPaid,
        outstanding,
        paymentCount: userPayments.length,
        unpaidMonths: userSummaries.filter(s => !paidMonths.has(s.monthKey)).length
      });
    }
    
    console.log('💵 FINANCIAL SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Charged (Paid):    $${totalRevenue.toFixed(2)}`);
    console.log(`   Total Outstanding:       $${totalOutstanding.toFixed(2)}`);
    console.log(`   Expected Revenue:        $${(totalRevenue + totalOutstanding).toFixed(2)}`);
    console.log('');
    
    // Sort by outstanding (highest first)
    userBreakdown.sort((a, b) => b.outstanding - a.outstanding);
    
    console.log('👥 PER-USER BREAKDOWN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Email                              │ Paid      │ Outstanding │ Payments │ Unpaid Months');
    console.log('   ──────────────────────────────────────────────────────────────────────────────────────');
    
    userBreakdown.forEach(user => {
      const email = user.email.padEnd(35);
      const paid = `$${user.totalPaid.toFixed(2)}`.padStart(9);
      const outstanding = `$${user.outstanding.toFixed(2)}`.padStart(11);
      const payments = String(user.paymentCount).padStart(8);
      const unpaid = String(user.unpaidMonths).padStart(13);
      
      console.log(`   ${email} │ ${paid} │ ${outstanding} │ ${payments} │ ${unpaid}`);
    });
    
    console.log('');
    console.log('💰 ═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error viewing billing totals:', error);
    throw error;
  }
}

// Run the function
viewBillingTotals()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
