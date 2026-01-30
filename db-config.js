// db-config.js - VERSIONE CORRETTA CON SINGLETON
// Gestione centralizzata della configurazione Supabase per FloX
// ==============================================================

// VARIABILE GLOBALE PER IL CLIENT SINGLETON
let _supabaseClientInstance = null;

/**
 * Controlla se la configurazione del database è presente
 * @returns {boolean} True se entrambe URL e KEY sono configurate
 */
function hasDbConfig() {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');
    
    // Verifica che non siano stringhe vuote o placeholder
    const isValidUrl = url && url !== '' && !url.includes('INSERISCI_URL');
    const isValidKey = key && key !== '' && !key.includes('INSERISCI_KEY');
    
    return isValidUrl && isValidKey;
}

/**
 * Ottiene l'URL di Supabase dalla configurazione
 * @returns {string} L'URL di Supabase o stringa vuota se non configurato
 */
function getSupabaseUrl() {
    const url = localStorage.getItem('supabase_url');
    return url && !url.includes('INSERISCI_URL') ? url : '';
}

/**
 * Ottiene la chiave di Supabase dalla configurazione
 * @returns {string} La chiave di Supabase o stringa vuota se non configurato
 */
function getSupabaseKey() {
    const key = localStorage.getItem('supabase_key');
    return key && !key.includes('INSERISCI_KEY') ? key : '';
}

/**
 * Crea e restituisce un client Supabase configurato (SINGLETON)
 * @returns {object} Client Supabase
 * @throws {Error} Se la configurazione non è presente
 */
function getSupabaseClient() {
    // Se esiste già, restituisci l'istanza esistente
    if (_supabaseClientInstance) {
        console.log('✓ Client Supabase riutilizzato (singleton)');
        return _supabaseClientInstance;
    }
    
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    
    if (!url || !key) {
        throw new Error('Configurazione database non trovata. Vai in Configurazione → Database per configurarlo.');
    }
    
    console.log('✓ Nuovo client Supabase creato (singleton)');
    
    // Crea il client Supabase (una sola volta)
    _supabaseClientInstance = supabase.createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        global: {
            headers: {
                'apikey': key
            }
        }
    });
    
    return _supabaseClientInstance;
}

/**
 * Resetta il client Supabase (utile per riconnessione)
 */
function resetSupabaseClient() {
    _supabaseClientInstance = null;
    console.log('✓ Client Supabase resettato');
}

/**
 * Ottiene informazioni sulla configurazione corrente
 * @returns {object} Oggetto con informazioni di configurazione
 */
function getDbConfigInfo() {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    const timestamp = localStorage.getItem('config_timestamp');
    const tabellaSelezionata = localStorage.getItem('sync_tabella');
    
    return {
        configured: hasDbConfig(),
        url: url,
        urlShort: url ? url.replace('https://', '').substring(0, 20) + '...' : '',
        keyPresent: !!key,
        keyLength: key ? key.length : 0,
        timestamp: timestamp ? new Date(timestamp).toLocaleString('it-IT') : null,
        table: tabellaSelezionata,
        daysSinceConfig: timestamp ? Math.floor((new Date() - new Date(timestamp)) / (1000 * 60 * 60 * 24)) : null,
        clientInstance: _supabaseClientInstance ? 'Creata' : 'Non creata'
    };
}

/**
 * Testa la connessione con le credenziali correnti
 * @returns {Promise<object>} Risultato del test
 */
async function testDbConnection() {
    if (!hasDbConfig()) {
        return {
            success: false,
            error: 'Configurazione non presente'
        };
    }
    
    try {
        const client = getSupabaseClient();
        
        // Usa una query semplice e veloce
        const { data, error } = await client
            .from('tecnici')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            // Prova con una query più semplice
            const { error: simpleError } = await client
                .from('tecnici')
                .select('id')
                .limit(1);
            
            if (simpleError) throw simpleError;
            
            return {
                success: true,
                message: 'Connesso a Supabase (query semplice)'
            };
        }
        
        return {
            success: true,
            message: `Connesso a Supabase (${data || 'OK'})`,
            count: data
        };
        
    } catch (error) {
        console.error('Test connessione fallito:', error);
        
        let messaggioErrore = 'Errore di connessione';
        if (error.message.includes('JWT')) {
            messaggioErrore = 'Chiave API non valida';
        } else if (error.message.includes('fetch')) {
            messaggioErrore = 'URL non raggiungibile';
        } else if (error.code === '42501') {
            messaggioErrore = 'Permessi insufficienti (RLS)';
        } else if (error.code === '42P01') {
            messaggioErrore = 'Tabella non trovata';
        } else if (error.code === 'PGRST116') {
            messaggioErrore = 'Tabella non esiste nello schema';
        }
        
        return {
            success: false,
            error: messaggioErrore,
            details: error.message,
            code: error.code
        };
    }
}

/**
 * Resetta la configurazione del database
 */
function resetDbConfig() {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    localStorage.removeItem('config_caricata');
    localStorage.removeItem('config_timestamp');
    localStorage.removeItem('sync_tabella');
    localStorage.removeItem('sync_timestamp');
    
    // Resetta anche il client
    resetSupabaseClient();
    
    console.log('Configurazione database resettata');
}

/**
 * Salva una nuova configurazione
 * @param {string} url - URL di Supabase
 * @param {string} key - Chiave anonima di Supabase
 * @returns {boolean} True se salvato con successo
 */
function saveDbConfig(url, key) {
    if (!url || !url.startsWith('https://')) {
        throw new Error('URL non valido. Deve iniziare con https://');
    }
    
    if (!key || key.length < 20) {
        throw new Error('Chiave API non valida');
    }
    
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    localStorage.setItem('config_caricata', 'true');
    localStorage.setItem('config_timestamp', new Date().toISOString());
    
    // Resetta il client quando cambia la configurazione
    resetSupabaseClient();
    
    console.log('Configurazione database salvata:', url.substring(0, 30) + '...');
    return true;
}

/**
 * Esporta la configurazione corrente in formato .kf
 * @returns {string} Contenuto del file .kf
 */
function exportDbConfig() {
    if (!hasDbConfig()) {
        throw new Error('Nessuna configurazione da esportare');
    }
    
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    const timestamp = new Date().toISOString();
    
    return `# FloX Database Configuration
# Generated: ${timestamp}
# Format: KEY=VALUE

SUPABASE_URL=${url}
SUPABASE_KEY=${key}

# End of configuration`;
}

/**
 * Importa configurazione da stringa
 * @param {string} content - Contenuto del file .kf o .json
 * @returns {boolean} True se importato con successo
 */
function importDbConfig(content) {
    let url = '';
    let key = '';
    
    // Prova a parsare come JSON
    try {
        const json = JSON.parse(content);
        url = json.supabase_url || json.SUPABASE_URL || json.url;
        key = json.supabase_key || json.SUPABASE_KEY || json.key;
    } catch (e) {
        // Non è JSON, prova formato key=value
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.trim() && !line.trim().startsWith('#')) {
                if (line.includes('=')) {
                    const [chiave, valore] = line.split('=').map(s => s.trim());
                    if (chiave.toUpperCase().includes('URL')) {
                        url = valore;
                    } else if (chiave.toUpperCase().includes('KEY')) {
                        key = valore;
                    }
                }
            }
        }
    }
    
    if (!url || !key) {
        throw new Error('Formato file non valido. Assicurati di avere SUPABASE_URL e SUPABASE_KEY');
    }
    
    return saveDbConfig(url, key);
}

// ==============================================================
// FUNZIONI AGGIUNTIVE PER MIGLIORARE LE PERFORMANCE
// ==============================================================

/**
 * Ottiene tutti i tecnici (con caching opzionale)
 * @param {boolean} useCache - Usa cache locale se disponibile
 * @returns {Promise<Array>} Lista di tecnici
 */
async function getTecnici(useCache = true) {
    const CACHE_KEY = 'tecnici_cache';
    const CACHE_TIMESTAMP = 'tecnici_cache_timestamp';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
    
    // Controlla cache se richiesto
    if (useCache) {
        const cached = localStorage.getItem(CACHE_KEY);
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP);
        
        if (cached && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < CACHE_DURATION) {
                console.log('✓ Tecnici caricati dalla cache');
                return JSON.parse(cached);
            }
        }
    }
    
    // Carica dal database
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('tecnici')
        .select('id, nome_completo, ruolo, pin')
        .order('nome_completo', { ascending: true });
    
    if (error) throw error;
    
    // Salva in cache
    if (data && useCache) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIMESTAMP, Date.now().toString());
        console.log('✓ Tecnici salvati in cache');
    }
    
    return data || [];
}

/**
 * Pulisce la cache dei tecnici
 */
function clearTecniciCache() {
    localStorage.removeItem('tecnici_cache');
    localStorage.removeItem('tecnici_cache_timestamp');
    console.log('✓ Cache tecnici pulita');
}