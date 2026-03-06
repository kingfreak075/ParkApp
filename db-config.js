// db-config.js - Versione corretta
let _supabaseClientInstance = null;

function hasDbConfig() {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');
    return !!(url && key && url !== '' && key !== '');
}

function getSupabaseUrl() {
    return localStorage.getItem('supabase_url') || '';
}

function getSupabaseKey() {
    return localStorage.getItem('supabase_key') || '';
}

function getSupabaseClient() {
    if (_supabaseClientInstance) {
        return _supabaseClientInstance;
    }
    
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    
    if (!url || !key) {
        console.warn('Database non configurato');
        return null;
    }
    
    _supabaseClientInstance = supabase.createClient(url, key);
    return _supabaseClientInstance;
}

function getDbConfigInfo() {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    const timestamp = localStorage.getItem('config_timestamp');
    
    return {
        configured: hasDbConfig(),
        url: url,
        urlShort: url ? url.replace('https://', '').substring(0, 20) + '...' : '',
        keyPresent: !!key,
        timestamp: timestamp ? new Date(timestamp).toLocaleString('it-IT') : null
    };
}

async function testDbConnection() {
    if (!hasDbConfig()) {
        return { success: false, error: 'Configurazione non presente' };
    }
    
    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('tecnici')
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        return { success: true, message: 'Connesso a Supabase' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function saveDbConfig(url, anonKey) {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', anonKey);
    localStorage.setItem('config_timestamp', new Date().toISOString());
    _supabaseClientInstance = null;
    return true;
}

function importDbConfig(content) {
    let url = '';
    let key = '';
    
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim() && !line.trim().startsWith('#')) {
            if (line.includes('=')) {
                const [k, v] = line.split('=').map(s => s.trim());
                if (k.toUpperCase().includes('URL')) url = v;
                if (k.toUpperCase().includes('KEY') && !k.toUpperCase().includes('SERVICE')) key = v;
            }
        }
    }
    
    if (!url || !key) throw new Error('Formato file non valido');
    return saveDbConfig(url, key);
}
function resetDbConfig() {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    localStorage.removeItem('config_timestamp');
    _supabaseClientInstance = null;
    return true;
}

// Aggiungi in db-config.js
let _adminClientInstance = null;

function getAdminClient() {
    if (_adminClientInstance) {
        return _adminClientInstance;
    }
    
    const url = getSupabaseUrl();
    // IMPORTANTE: Devi usare la SERVICE_ROLE KEY, non la anon key
    // La service_role key la trovi in Supabase Dashboard > Project Settings > API > service_role key
    const serviceRoleKey = localStorage.getItem('supabase_service_key');
    
    if (!url || !serviceRoleKey) {
        console.warn('Admin client non configurato');
        return null;
    }
    
    _adminClientInstance = supabase.createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return _adminClientInstance;
}

// Funzione per salvare anche la service key (opzionale, solo per admin)
function saveAdminConfig(url, anonKey, serviceKey) {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', anonKey);
    if (serviceKey) {
        localStorage.setItem('supabase_service_key', serviceKey);
    }
    localStorage.setItem('config_timestamp', new Date().toISOString());
    _supabaseClientInstance = null;
    _adminClientInstance = null;
    return true;
}

window.getAdminClient = getAdminClient;
window.saveAdminConfig = saveAdminConfig;



// Aggiungi anche all'export
window.resetDbConfig = resetDbConfig;
window.hasDbConfig = hasDbConfig;
window.getSupabaseUrl = getSupabaseUrl;
window.getSupabaseKey = getSupabaseKey;
window.getSupabaseClient = getSupabaseClient;
window.getDbConfigInfo = getDbConfigInfo;
window.testDbConnection = testDbConnection;
window.saveDbConfig = saveDbConfig;
window.importDbConfig = importDbConfig;
window.resetDbConfig = resetDbConfig;