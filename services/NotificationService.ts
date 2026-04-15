import { toast } from 'react-hot-toast';

export const NotificationService = {
  requestPermission: async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications.');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  sendNotification: (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      // Send message to Service Worker for background notification
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body
        });
      } else {
        // Fallback to Foreground Notification
        new Notification(title, { body });
      }
    } else {
      // Fallback to Toast if notifications not granted but app is open
      toast(body, {
        icon: '🔔',
        duration: 6000,
        position: 'top-center'
      });
    }
  },

  checkReminders: (user: any, status: 'CLOCKED_IN' | 'CLOCKED_OUT' | 'COMPLETED') => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 10:10 AM - Clock In Reminder
    if (hours === 10 && minutes === 10 && status === 'CLOCKED_OUT') {
      NotificationService.sendNotification(
        'Clock In Reminder ⏰',
        'It is 10:10 AM. Don\'t forget to clock in for today!'
      );
    }

    // 5:00 PM - Clock Out & Report Reminder
    if (hours === 17 && minutes === 0 && status === 'CLOCKED_IN') {
      NotificationService.sendNotification(
        'Shift Ending 🔔',
        'It is 5:00 PM. Remember to update your work logs and clock out!'
      );
    }
  }
};
