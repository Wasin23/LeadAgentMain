#!/usr/bin/env node

// Quick script to check all user credit balances
import dotenv from 'dotenv';
dotenv.config();

import AWSManager from './utils/awsManager.js';

const awsManager = new AWSManager();

async function checkAllUserCredits() {
  try {
    console.log('🔍 [CREDITS] Scanning all user credit balances...\n');
    
    // Get all users
    const users = await awsManager.getAllUsers();
    
    if (!users || users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    console.log(`📊 Found ${users.length} users\n`);
    console.log('UserID'.padEnd(20), 'Email'.padEnd(30), 'Credits Used'.padEnd(15), 'Credit Limit'.padEnd(15), 'Payment Method'.padEnd(15), 'Remaining');
    console.log('-'.repeat(120));
    
    for (const user of users) {
      const userId = (user.userId || 'unknown').substring(0, 18);
      const email = (user.email || 'no-email').substring(0, 28);
      const creditsUsed = (user.trialCreditsUsed || 0).toFixed(2);
      const creditsLimit = user.trialCreditsLimit || 25;
      const hasPayment = user.paymentMethodAdded ? 'Yes' : 'No';
      const remaining = hasPayment ? 'Unlimited' : (creditsLimit - (user.trialCreditsUsed || 0)).toFixed(2);
      
      console.log(
        userId.padEnd(20),
        email.padEnd(30), 
        creditsUsed.padEnd(15),
        creditsLimit.toString().padEnd(15),
        hasPayment.padEnd(15),
        remaining
      );
    }
    
    // Summary stats
    const totalUsers = users.length;
    const usersWithPayment = users.filter(u => u.paymentMethodAdded).length;
    const usersOnTrial = totalUsers - usersWithPayment;
    const totalCreditsUsed = users.reduce((sum, u) => sum + (u.trialCreditsUsed || 0), 0);
    
    console.log('\n' + '='.repeat(120));
    console.log(`📈 SUMMARY:`);
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Users with Payment: ${usersWithPayment}`);
    console.log(`   Users on Trial: ${usersOnTrial}`);
    console.log(`   Total Trial Credits Used: $${totalCreditsUsed.toFixed(2)}`);
    console.log(`   Revenue from Credits: $${(totalCreditsUsed * 1.0).toFixed(2)}`); // 1:1 ratio, credits = dollars
    
  } catch (error) {
    console.error('❌ Error checking credits:', error);
  }
}

checkAllUserCredits();