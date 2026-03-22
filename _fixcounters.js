import dotenv from 'dotenv';
dotenv.config();
import AWSEmailQueue from './utils/awsEmailQueue.js';
const q = new AWSEmailQueue();
const counts = await q.reconcileCounters('efbb02d8-3a6c-45f9-82f9-a5c21e857913');
console.log('✅ Reconciled:', counts);
process.exit(0);
