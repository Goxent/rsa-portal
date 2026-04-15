/* RSA System Service Worker */
const CACHE_NAME = 'rsa-system-v1';

self.addEventListener('install', (event) => {
    console.log('[SW] Installed');
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Simple message listener to trigger notifications from foreground
self.addEventListener('message', (event) => {
    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body } = event.data;
        self.registration.showNotification(title, {
            body,
            icon: '/https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
            vibrate: [200, 100, 200]
        });
    }
});
