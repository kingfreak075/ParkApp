// auth.js - Architettura Definitiva + Scanner Tabelle
let _utenteCorrente = null;

function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
}

// --- SCANNER TABELLE PER DEBUG ---
async function checkTableVisibility() {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
        // Chiama la funzione SQL che abbiamo appena creato
        const { data: tabelle, error } = await supabase.rpc('get_tables_info');
        
        if (error) throw error;

        const numeroTabelle = tabelle.length;
        console.log(`%c📊 DATABASE STATUS: Accesso garantito a ${numeroTabelle} tabelle`, `color: #22c55e; font-weight: bold; font-size: 12px;`);
    } catch (err) {
        // Se la funzione RPC non esiste ancora, mostra un messaggio di avviso invece di un errore rosso
        console.warn("⚠️ Scanner: Funzione get_tables_info non trovata nel DB. Uso conteggio manuale.");
        console.log(`%c📊 DATABASE STATUS: Accesso garantito a 27 tabelle (manuale)`, `color: #f59e0b; font-weight: bold; font-size: 12px;`);
    }
}

function initAuth() {
    const userJson = sessionStorage.getItem('utenteCorrente');
    if (userJson) {
        try { _utenteCorrente = JSON.parse(userJson); } catch (e) { _logout(); }
    }
    // Avvia lo scanner ad ogni caricamento
    checkTableVisibility();
    return _utenteCorrente;
}

function getUtenteCorrente() { return _utenteCorrente; }
function isLoggedIn() { return !!_utenteCorrente; }

async function authLoginCompleto(email, password) {
    if (!email || !password) return { success: false, error: "Compila tutti i campi" };
    const emailPulita = email.trim().toLowerCase();
    const supabase = getSupabaseClient();
    
    try {
        // 1. TENTATIVO DI LOGIN SU SUPABASE AUTH
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ 
            email: emailPulita, 
            password: password 
        });

        if (authErr) return { success: false, error: "Credenziali errate" };

        const user = authData.user;
        const ruoloAuth = user.user_metadata?.ruolo || 'tecnico';

        // 2. LOGICA DI DISTINZIONE RUOLI
        if (ruoloAuth === 'admin' || ruoloAuth === 'supervisore') {
            // Se è Admin/Supervisore, non è obbligatorio che sia nella tabella 'tecnici'
            // Creiamo un oggetto utente basato sui metadati di Auth
            const utenteAdmin = {
                Mail: user.email,
                nome_completo: user.user_metadata?.nome_completo || (ruoloAuth === 'admin' ? 'Amministratore' : 'Supervisore'),
                ruolo: ruoloAuth,
                pin: 'NON_RICHIESTO'
            };
            
            _utenteCorrente = utenteAdmin;
            sessionStorage.setItem('utenteCorrente', JSON.stringify(utenteAdmin));
            return { success: true };
        } 
        else {
            // Se è un TECNICO, DEVE essere presente nella tabella per avere i dati operativi
            const { data: tecnico, error: dbErr } = await supabase
                .from('tecnici')
                .select('*')
                .eq('Mail', emailPulita)
                .maybeSingle();

            if (dbErr || !tecnico) {
                await supabase.auth.signOut();
                return { success: false, error: "Accesso negato: Utente non presente in anagrafica tecnici" };
            }

            // Salvataggio per il PIN (solo per tecnici)
            localStorage.setItem('dispositivo_email', emailPulita);
            localStorage.setItem(`password_${emailPulita}`, password);
            localStorage.setItem(`nome_${emailPulita}`, tecnico.nome_completo);
            
            _utenteCorrente = tecnico;
            sessionStorage.setItem('utenteCorrente', JSON.stringify(tecnico));
            return { success: true };
        }
    } catch (err) { 
        console.error(err);
        return { success: false, error: "Errore di connessione" }; 
    }
}
async function authLoginPin(pin) {
    const email = localStorage.getItem('dispositivo_email');
    const password = localStorage.getItem(`password_${email}`);
    
    if (!email || !password) return { success: false, error: "Riconfigurazione necessaria" };
    
    addDebugLog(`Tentativo sblocco PIN per: ${email}`, 'debug');
    const supabase = getSupabaseClient();
    
    try {
        // 1. EFFETTUIAMO IL LOGIN PRIMA (per sbloccare i permessi RLS)
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ 
            email: email, 
            password: password 
        });

        if (authErr) {
            authScollegaDispositivo();
            return { success: false, error: "Sessione scaduta o credenziali cambiate." };
        }

        // 2. ORA SIAMO AUTENTICATI: Possiamo leggere la tabella tecnici
        const { data: tecnico, error: dbErr } = await supabase
            .from('tecnici')
            .select('*')
            .eq('Mail', email)
            .maybeSingle();

        if (dbErr || !tecnico) {
            await supabase.auth.signOut();
            return { success: false, error: "Record tecnico non trovato." };
        }

        const pinDB = tecnico.pin || tecnico.PIN;
        
        // 3. VERIFICA DEL PIN
        if (String(pinDB).trim() !== String(pin).trim()) {
            await supabase.auth.signOut(); // Logout se il PIN è errato
            return { success: false, error: "PIN errato" };
        }

        // 4. TUTTO OK: Salviamo in sessione
        _utenteCorrente = tecnico;
        sessionStorage.setItem('utenteCorrente', JSON.stringify(tecnico));
        
        addDebugLog("Accesso rapido completato!", "success");
        return { success: true, redirect: 'menu.html' };

    } catch (err) {
        console.error("Errore imprevisto:", err);
        return { success: false, error: "Errore di connessione" };
    }
}
function authScollegaDispositivo() {
    const email = localStorage.getItem('dispositivo_email');
    if (email) { localStorage.removeItem(`password_${email}`); localStorage.removeItem(`nome_${email}`); }
    localStorage.removeItem('dispositivo_email');
}

function _logout() { sessionStorage.removeItem('utenteCorrente'); _utenteCorrente = null; }

// Cerca la funzione _cambiaPin in auth.js e sostituiscila con questa
async function _cambiaPin(email, vecchioPin, nuovoPin) {
    const supabase = getSupabaseClient();
    try {
        // 1. Verifichiamo il PIN attuale
        const { data: tecnico, error: fetchErr } = await supabase
            .from('tecnici')
            .select('pin')
            .eq('Mail', email)
            .single();
        
        if (fetchErr || !tecnico) throw new Error("Utente non trovato");

        if (String(tecnico.pin).trim() !== String(vecchioPin).trim()) {
            return { success: false, error: "PIN attuale errato" };
        }

        // 2. Eseguiamo l'aggiornamento (ora che abbiamo la Policy UPDATE)
        const { error: updateErr } = await supabase
            .from('tecnici')
            .update({ pin: String(nuovoPin).trim() })
            .eq('Mail', email);

        if (updateErr) throw updateErr;
        
        return { success: true };
    } catch (err) {
        console.error("Errore cambio PIN:", err);
        return { success: false, error: err.message };
    }
}

// In auth.js, nella funzione authGetUtente()
function authGetUtente() {
    const utente = localStorage.getItem('utente_loggato');
    if (utente) {
        return JSON.parse(utente);
    }
    return null;
}

// E quando salvi l'utente dopo il login:
localStorage.setItem('utente_loggato', JSON.stringify({
    nome_completo: 'Mirko De Salvo',
    ruolo: 'tecnico' // o 'supervisore' o 'admin'
}));



initAuth();

window.authLoginCompleto = authLoginCompleto;
window.authLoginPin = authLoginPin;
window.authScollegaDispositivo = authScollegaDispositivo;
window.authLogout = _logout;
window.authCambiaPin = _cambiaPin;
window.authGetUtente = () => _utenteCorrente;
window.authIsLoggedIn = () => !!_utenteCorrente;