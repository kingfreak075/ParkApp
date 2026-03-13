// push-worker.js
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/',
            dateOfArrival: Date.now(),
            id: data.id
        },
        actions: [
            {
                action: 'open',
                title: 'Apri'
            },
            {
                action: 'close',
                title: 'Chiudi'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'close') return;
    
    // Apri l'URL quando si clicca sulla notifica
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});