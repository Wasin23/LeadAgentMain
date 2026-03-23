import AWSManager from './awsManager.js';
import OutlookManager from './outlookManager.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export class OutlookSubscriptionRenewer {
  constructor() {
    this.awsManager = new AWSManager();
    this.outlookManager = new OutlookManager();
    this.intervalId = null;
  }

  async renewExpiringSubscriptions() {
    try {
      console.log('🔄 [OUTLOOK SUBSCRIPTIONS] Checking reply subscriptions');

      const users = await this.awsManager.getAllUsers();
      let renewedCount = 0;

      for (const user of users) {
        const userId = user.userId;
        const userSettings = await this.awsManager.getUserSettings(userId);
        const outlookAccounts = userSettings?.outlookAccounts || [];

        for (let index = 0; index < outlookAccounts.length; index += 1) {
          const account = outlookAccounts[index];
          if (!account?.refreshToken) {
            continue;
          }

          const expiry = account.replySubscription?.expirationDateTime
            ? new Date(account.replySubscription.expirationDateTime).getTime()
            : 0;
          const needsRenewal = !account.replySubscription?.subscriptionId || !expiry || expiry <= Date.now() + RENEWAL_WINDOW_MS;

          if (!needsRenewal) {
            continue;
          }

          try {
            await this.outlookManager.setupReplySubscription(userId, index, true);
            renewedCount += 1;
          } catch (error) {
            console.error(`❌ [OUTLOOK SUBSCRIPTIONS] Failed to renew ${account.email}:`, error.response?.data || error.message);
          }
        }
      }

      console.log(`✅ [OUTLOOK SUBSCRIPTIONS] Renewal sweep complete. Renewed ${renewedCount} subscription(s)`);
    } catch (error) {
      console.error('❌ [OUTLOOK SUBSCRIPTIONS] Renewal sweep failed:', error.message);
    }
  }

  start() {
    this.renewExpiringSubscriptions();
    this.intervalId = setInterval(() => {
      this.renewExpiringSubscriptions();
    }, DAY_IN_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}