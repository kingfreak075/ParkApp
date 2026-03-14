// push-service.js - Gestione notifiche push

const pushService = {
    // 🔑 LE TUE CHIAVI VAPID
    vapidPublicKey: 'BHACin7EjHI8184XCN-31sanWA6HC0p1IvYrDSwB1a3eLI4FkXAAR0WnXmR4Od_ke-lPJUKSPxtYLM2Z8G5m408',
    
    // Inizializza il servizio
    async init() {
        if (!this.isSupported()) {
            console.log('Notifiche push non supportate');
            return false;
        }
        
        try {
            // Registra service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registrato');
            
            // Controlla se già abilitato
            const subscription = await registration.pushManager.getSubscription();
            
            // Aggiorna stato UI se necessario
            this.aggiornaStatoUI(!!subscription);
            
            return !!subscription;
        } catch (error) {
            console.error('Errore init push:', error);
            return false;
        }
    },
    
    // Verifica supporto browser
    isSupported() {
        return 'serviceWorker' in navigator && 
               'PushManager' in window && 
               'Notification' in window;
    },
    
    // Aggiorna UI del pulsante
    aggiornaStatoUI(attivo) {
        const btnTesto = document.getElementById('testo-notifiche');
        const icona = document.getElementById('icona-notifiche');
        
        if (btnTesto) {
            btnTesto.textContent = attivo ? 'Notifiche attive' : 'Attiva notifiche';
        }
        
        if (icona) {
            icona.style.color = attivo ? '#22c55e' : '#64748b';
        }
    },
    
    // Converti chiave VAPID
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },
    
    // Attiva notifiche
    async attiva() {
        if (!this.isSupported()) {
            alert('❌ Il tuo browser non supporta le notifiche push.\nUsa Chrome, Edge, Firefox o Safari recenti.');
            return false;
        }
        
        // Richiedi permesso
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('❌ Permesso notifiche negato.\nPer ricevere notifiche devi consentirle dal browser.');
            return false;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Controlla se già sottoscritto
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Crea nuova sottoscrizione
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });
            }
            
            // Salva su Supabase
            const salvato = await this.salvaIscrizione(subscription);
            
            if (salvato) {
                this.aggiornaStatoUI(true);
                alert('✅ Notifiche attivate con successo!\nRiceverai aggiornamenti in tempo reale.');
                return true;
            } else {
                alert('⚠️ Attivazione parziale. Le notifiche funzionano ma non siamo riusciti a salvare le preferenze.');
                return true;
            }
            
        } catch (error) {
            console.error('Errore attivazione:', error);
            
            if (error.message.includes('gcm_sender_id')) {
                alert('❌ Configurazione mancante. Contatta l\'amministratore.');
            } else {
                alert('❌ Errore attivazione notifiche: ' + error.message);
            }
            return false;
        }
    },
    
    // Disattiva notifiche
    async disattiva() {
        if (!confirm('❓ Disattivare le notifiche?')) return false;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                
                // Rimuovi da Supabase
                const supabase = getSupabaseClient();
                await supabase
                    .from('push_iscrizioni')
                    .update({ attivo: false })
                    .eq('endpoint', subscription.endpoint);
                
                this.aggiornaStatoUI(false);
                alert('❌ Notifiche disattivate');
            }
            
            return true;
        } catch (error) {
            console.error('Errore disattivazione:', error);
            alert('Errore durante la disattivazione');
            return false;
        }
    },
    
    // Salva iscrizione su Supabase
    async salvaIscrizione(subscription) {
        const utente = authGetUtente();
        if (!utente) {
            console.warn('Nessun utente loggato');
            return false;
        }
        
        const supabase = getSupabaseClient();
        
        const dati = {
            tecnico_id: utente.id || utente.email || utente.username,
            tecnico_nome: utente.nome_completo || utente.email || 'Tecnico',
            subscription_data: subscription,
            endpoint: subscription.endpoint,
            browser: navigator.userAgent.substring(0, 200), // Limita lunghezza
            attivo: true,
            ultimo_accesso: new Date().toISOString()
        };
        
        try {
            const { error } = await supabase
                .from('push_iscrizioni')
                .upsert(dati, { 
                    onConflict: 'endpoint',
                    ignoreDuplicates: false 
                });
            
            if (error) {
                console.error('Errore salvataggio Supabase:', error);
                return false;
            }
            
            console.log('✅ Iscrizione salvata su Supabase');
            return true;
            
        } catch (error) {
            console.error('Errore salvataggio:', error);
            return false;
        }
    },
    
    // Mostra notifica locale (per test)
    showLocalNotification(title, options = {}) {
        if (Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    icon: '/icon-192.png',
                    badge: '/badge-72.png',
                    vibrate: [200, 100, 200],
                    ...options
                });
            });
        }
    },
    
    // Ottieni lo stato attuale
    async getStato() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            return {
                supportato: this.isSupported(),
                permesso: Notification.permission,
                attivo: !!subscription,
                subscription: subscription
            };
        } catch {
            return { supportato: false, permesso: 'denied', attivo: false };
        }
    }
};

// Esponi globalmente
window.pushService = pushService;