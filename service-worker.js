// service-worker.js
const CACHE_NAME = 'parkapp-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker installato');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker attivato');
    event.waitUntil(clients.claim());
});

// Ricezione notifiche push
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        console.log('Notifica ricevuta:', data);
        
        const options = {
            body: data.body || 'Nuova notifica da ParkApp',
            icon: data.icon || '/icon-192.png',
            badge: data.badge || '/badge-72.png',
            vibrate: data.vibrate || [200, 100, 200],
            data: {
                url: data.url || '/',
                ...data.data
            },
            actions: data.actions || [
                { action: 'open', title: 'Apri ParkApp' },
                { action: 'close', title: 'Chiudi' }
            ],
            tag: data.tag || 'parkapp-notification',
            renotify: true,
            requireInteraction: true,
            silent: false
        };

        event.waitUntil(
            self.registration.showNotification(
                data.title || 'ParkApp',
                options
            )
        );
    } catch (error) {
        console.error('Errore elaborazione push:', error);
    }
});

// Click sulla notifica
self.addEventListener('notificationclick', (event) => {
    console.log('Notifica cliccata:', event.notification);
    event.notification.close();

    // Se azione "close", esci
    if (event.action === 'close') return;

    // URL da aprire (default: home)
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Cerca una finestra già aperta
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Altrimenti apri nuova finestra
                return clients.openWindow(urlToOpen);
            })
    );
});

// Gestione errore
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});