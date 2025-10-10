// Desktop notification system for Meridian
import { EventEmitter } from 'events';

class DesktopNotificationManager extends EventEmitter {
  constructor() {
    super();
    this.isElectron = process.env.ELECTRON_MODE === 'true';
    this.notifications = [];
  }

  // Send notification for email events
  notifyEmailEvent(type, data) {
    const notification = {
      id: `email-${Date.now()}`,
      type,
      data,
      timestamp: new Date().toISOString()
    };

    switch (type) {
      case 'email_sent':
        this.showNotification({
          title: '📧 Email Sent',
          body: `Email sent to ${data.recipient} at ${data.company}`,
          icon: 'email-sent'
        });
        break;

      case 'email_replied':
        this.showNotification({
          title: '💬 Email Reply Received',
          body: `${data.sender} replied to your email`,
          icon: 'email-reply',
          urgent: true
        });
        break;

      case 'email_clicked':
        this.showNotification({
          title: '🔗 Email Link Clicked',
          body: `${data.recipient} clicked a link in your email`,
          icon: 'email-click'
        });
        break;

      case 'email_opened':
        this.showNotification({
          title: '👀 Email Opened',
          body: `${data.recipient} opened your email`,
          icon: 'email-open'
        });
        break;

      case 'lead_cycle_complete':
        this.showNotification({
          title: '🎯 Lead Cycle Complete',
          body: `Generated ${data.emailCount} emails for ${data.leadCount} prospects`,
          icon: 'cycle-complete'
        });
        break;

      case 'error':
        this.showNotification({
          title: '❌ Meridian Error',
          body: data.message || 'An error occurred',
          icon: 'error',
          urgent: true
        });
        break;
    }

    this.notifications.push(notification);
    this.emit('notification', notification);
  }

  // Show desktop notification
  showNotification({ title, body, icon, urgent = false }) {
    if (this.isElectron) {
      // In Electron, we'll send this to the main process
      console.log('[DESKTOP] Notification:', { title, body, icon, urgent });
      
      // You can implement IPC communication here to show native notifications
      // For now, we'll log to console and could trigger browser notifications
    }

    // Fallback to browser notification API if available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: `/icons/notification-${icon}.png`,
          requireInteraction: urgent
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: `/icons/notification-${icon}.png` });
          }
        });
      }
    }
  }

  // Get recent notifications
  getRecentNotifications(limit = 10) {
    return this.notifications
      .slice(-limit)
      .reverse(); // Most recent first
  }

  // Clear old notifications
  cleanup(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    this.notifications = this.notifications.filter(
      notification => new Date(notification.timestamp) > cutoff
    );
  }
}

// Create singleton instance
export const desktopNotifications = new DesktopNotificationManager();

// Auto-cleanup every hour
setInterval(() => {
  desktopNotifications.cleanup();
}, 60 * 60 * 1000);

export default DesktopNotificationManager;
