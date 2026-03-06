// auth.js - Versione con flusso intelligente
let _utenteCorrente = null;

// ============================================
// FUNZIONE DI DEBUG
// ============================================
function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
}

// ============================================
// INIZIALIZZAZIONE AUTH
// ============================================
function initAuth() {
    const userJson = sessionStorage.getItem('utenteCorrente');
    if (userJson) {
        try {
            _utenteCorrente = JSON.parse(userJson);
            addDebugLog(`Utente ripristinato: ${_utenteCorrente.nome_completo}`, 'info');
        } catch (e) {
            _logout();
        }
    }
    return _utenteCorrente;
}

function getUtenteCorrente() {
    return _utenteCorrente;
}

function isLoggedIn() {
    return !!_utenteCorrente;
}

// ============================================
// FUNZIONE PRINCIPALE LOGIN
// ============================================
async function _accedi(email, pin) {
    if (!email || !pin) {
        mostraMessaggio("Email e PIN sono obbligatori", "error");
        return false;
    }

    addDebugLog(`Tentativo login per: ${email}`);

    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            mostraMessaggio("Database non configurato. Vai in Configurazione.", "error");
            return false;
        }

        // ============================================
        // PASSO 1: Verifica nella tabella tecnici
        // ============================================
        const { data: tecnico, error } = await supabase
            .from('tecnici')
            .select('*')
            .eq('Mail', email)
            .maybeSingle();

        if (error) throw error;
        
        if (!tecnico) {
            mostraMessaggio("❌ Email non registrata", "error");
            addDebugLog(`Email non trovata: ${email}`, 'error');
            return false;
        }

        // Controlla se account è attivo
        if (tecnico.attivo === false) {
            mostraMessaggio("⏳ Account in attesa di approvazione", "warning");
            addDebugLog(`Account inattivo: ${email}`, 'warning');
            return false;
        }

        // Verifica PIN
        if (tecnico.pin !== pin) {
            mostraMessaggio("❌ PIN errato", "error");
            addDebugLog(`PIN errato per: ${email}`, 'error');
            return false;
        }

        addDebugLog(`✅ Passo 1: Tecnico verificato in tabella`, 'success');

        // ============================================
        // PASSO 2: Verifica dispositivo conosciuto
        // ============================================
        const dispositiviConosciuti = JSON.parse(localStorage.getItem(`dispositivi_${email}`) || '[]');
        const dispositivoId = getDeviceId();
        const isDispositivoConosciuto = dispositiviConosciuti.includes(dispositivoId);
        
        addDebugLog(`📱 Dispositivo ${isDispositivoConosciuto ? 'conosciuto' : 'nuovo'}`, 'info');

        // ============================================
        // PASSO 3: Gestione Auth Supabase
        // ============================================
        let authSuccess = false;
        let passwordUtente = null;
        const PASSWORD_STANDARD = 'Esa123!';

        // CASO B: Dispositivo conosciuto → login con password salvata
        if (isDispositivoConosciuto) {
            addDebugLog(`🔄 Dispositivo conosciuto, recupero password dal localStorage`, 'info');
            passwordUtente = localStorage.getItem(`password_${email}`);
            
            if (passwordUtente) {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: passwordUtente
                });
                
                if (!signInError) {
                    authSuccess = true;
                    addDebugLog(`✅ Login Auth con password salvata`, 'success');
                } else {
                    addDebugLog(`⚠️ Password salvata non valida, rimuovo dispositivo`, 'warning');
                    // Rimuovi dispositivo se la password non funziona più
                    const nuoviDispositivi = dispositiviConosciuti.filter(id => id !== dispositivoId);
                    localStorage.setItem(`dispositivi_${email}`, JSON.stringify(nuoviDispositivi));
                    localStorage.removeItem(`password_${email}`);
                }
            }
        }

        // Se non ancora autenticato, tenta con password standard
        if (!authSuccess) {
            addDebugLog(`🔑 Tentativo con password standard`, 'info');
            const { error: standardError } = await supabase.auth.signInWithPassword({
                email: email,
                password: PASSWORD_STANDARD
            });
            
            if (!standardError) {
                authSuccess = true;
                addDebugLog(`✅ Login con password standard`, 'success');
                
                // Salva dispositivo e password
                salvaDispositivo(email, dispositivoId, PASSWORD_STANDARD);
                
                // PRIMO ACCESSO: salva dati e redirect a profilo
                _utenteCorrente = tecnico;
                sessionStorage.setItem('utenteCorrente', JSON.stringify(tecnico));
                localStorage.setItem('primo_accesso', 'true');
                localStorage.setItem('tecnico_loggato', tecnico.nome_completo);
                localStorage.setItem('tecnico_id', tecnico.id);
                localStorage.setItem('tecnico_email', email);
                
                mostraMessaggio("⚠️ Prima di continuare, cambia la tua password", "warning");
                window.location.href = 'profilo.html?primo_accesso=true';
                return true;
            }
        }

        // Se non ancora autenticato, chiedi password
        if (!authSuccess) {
            addDebugLog(`🔐 Richiesta password all'utente`, 'info');
            
            // Salva i dati in sessione per dopo
            sessionStorage.setItem('login_temp_email', email);
            sessionStorage.setItem('login_temp_tecnico', JSON.stringify(tecnico));
            
            // Mostra modale password
            mostraModalePassword(email);
            return false; // Aspettiamo la password dal modale
        }

        // ============================================
        // PASSO 4: Login completato
        // ============================================
        _utenteCorrente = tecnico;
        sessionStorage.setItem('utenteCorrente', JSON.stringify(tecnico));
        localStorage.setItem('tecnico_loggato', tecnico.nome_completo);
        localStorage.setItem('tecnico_id', tecnico.id);
        localStorage.setItem('tecnico_email', email);
        localStorage.setItem('tecnico_ruolo', tecnico.ruolo || 'tecnico');

        salvaUtenteLocale(email, tecnico.nome_completo);
        addDebugLog(`✅ Login completo: ${tecnico.nome_completo}`, 'success');
        
        mostraMessaggio(`✅ Benvenuto ${tecnico.nome_completo}!`, 'success');
        
        return true;

    } catch (err) {
        addDebugLog(`❌ Errore login: ${err.message}`, 'error');
        mostraMessaggio("Errore di connessione al database", "error");
        return false;
    }
}

// ============================================
// FUNZIONI AUSILIARIE
// ============================================

// Genera ID univoco per il dispositivo
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Salva dispositivo e password
function salvaDispositivo(email, dispositivoId, password) {
    const dispositivi = JSON.parse(localStorage.getItem(`dispositivi_${email}`) || '[]');
    if (!dispositivi.includes(dispositivoId)) {
        dispositivi.push(dispositivoId);
        localStorage.setItem(`dispositivi_${email}`, JSON.stringify(dispositivi));
    }
    localStorage.setItem(`password_${email}`, password);
}

// Mostra modale per inserire password
function mostraModalePassword(email) {
    // Crea overlay
    const overlay = document.createElement('div');
    overlay.id = 'password-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 24px;
            padding: 2rem;
            max-width: 350px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
        ">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--primary);">password</span>
                <h3 style="margin: 1rem 0 0.5rem;">Password Richiesta</h3>
                <p style="color: var(--text-muted);">Inserisci la password Auth per ${email}</p>
            </div>
            
            <input type="password" id="modal-password" placeholder="Password Auth" 
                   style="
                       width: 100%;
                       padding: 1rem;
                       border: 2px solid var(--border);
                       border-radius: 12px;
                       font-size: 1rem;
                       margin-bottom: 1rem;
                       outline: none;
                   ">
            
            <button onclick="inviaPasswordModale()" 
                    style="
                        width: 100%;
                        padding: 1rem;
                        background: var(--primary);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: 700;
                        cursor: pointer;
                    ">
                Continua
            </button>
            
            <button onclick="chiudiModale()" 
                    style="
                        width: 100%;
                        padding: 0.5rem;
                        background: none;
                        border: none;
                        color: var(--text-muted);
                        margin-top: 1rem;
                        cursor: pointer;
                    ">
                Annulla
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus sull'input
    setTimeout(() => document.getElementById('modal-password').focus(), 100);
}

// Funzione globale per inviare password dal modale
window.inviaPasswordModale = async function() {
    const password = document.getElementById('modal-password').value;
    if (!password) {
        alert('Inserisci la password');
        return;
    }
    
    const email = sessionStorage.getItem('login_temp_email');
    const tecnicoJson = sessionStorage.getItem('login_temp_tecnico');
    
    if (!email || !tecnicoJson) {
        alert('Errore: sessione scaduta');
        window.location.href = 'index.html';
        return;
    }
    
    const tecnico = JSON.parse(tecnicoJson);
    const supabase = getSupabaseClient();
    
    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            alert('Password errata');
            return;
        }
        
        // Login riuscito
        const dispositivoId = getDeviceId();
        salvaDispositivo(email, dispositivoId, password);
        
        // Pulisci sessione
        sessionStorage.removeItem('login_temp_email');
        sessionStorage.removeItem('login_temp_tecnico');
        
        // Chiudi modale
        chiudiModale();
        
        // Completa login
        _utenteCorrente = tecnico;
        sessionStorage.setItem('utenteCorrente', JSON.stringify(tecnico));
        localStorage.setItem('tecnico_loggato', tecnico.nome_completo);
        localStorage.setItem('tecnico_id', tecnico.id);
        localStorage.setItem('tecnico_email', email);
        
        window.location.href = 'menu.html';
        
    } catch (error) {
        alert('Errore di connessione');
    }
};

window.chiudiModale = function() {
    const modale = document.getElementById('password-modal');
    if (modale) modale.remove();
    sessionStorage.removeItem('login_temp_email');
    sessionStorage.removeItem('login_temp_tecnico');
};

// ============================================
// FUNZIONI ESISTENTI (invariate)
// ============================================
function _logout() {
    const nome = _utenteCorrente?.nome_completo || 'Utente';
    _utenteCorrente = null;
    sessionStorage.removeItem('utenteCorrente');
    localStorage.removeItem('tecnico_loggato');
    localStorage.removeItem('tecnico_id');
    localStorage.removeItem('tecnico_email');
    addDebugLog(`Logout: ${nome}`, 'info');
}

function salvaUtenteLocale(email, nome) {
    try {
        const utentiSalvati = JSON.parse(localStorage.getItem('utenti_recenti') || '[]');
        const nuovoUtente = { email, nome, ultimoAccesso: new Date().toISOString() };
        
        const index = utentiSalvati.findIndex(u => u.email === email);
        if (index !== -1) utentiSalvati.splice(index, 1);
        
        utentiSalvati.unshift(nuovoUtente);
        
        while (utentiSalvati.length > 5) utentiSalvati.pop();
        
        localStorage.setItem('utenti_recenti', JSON.stringify(utentiSalvati));
    } catch (e) {
        console.error('Errore salvataggio utente locale:', e);
    }
}

async function _cambiaPin(email, vecchioPin, nuovoPin) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("DB non configurato");

        if (!/^\d{4}$/.test(nuovoPin)) {
            return { success: false, error: "PIN deve essere di 4 cifre" };
        }

        const { data: tecnico, error: selectError } = await supabase
            .from('tecnici')
            .select('pin')
            .eq('Mail', email)
            .single();

        if (selectError) throw selectError;
        
        if (tecnico.pin !== vecchioPin) {
            return { success: false, error: "PIN attuale errato" };
        }

        const { error } = await supabase
            .from('tecnici')
            .update({ pin: nuovoPin })
            .eq('Mail', email);

        if (error) throw error;
        
        addDebugLog(`PIN cambiato per: ${email}`, 'success');
        return { success: true };
        
    } catch (err) {
        addDebugLog(`Errore cambio PIN: ${err.message}`, 'error');
        return { success: false, error: err.message };
    }
}

// ============================================
// FUNZIONE MESSAGGI
// ============================================
function mostraMessaggio(testo, tipo = 'info') {
    const container = document.getElementById('message-container');
    if (container) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${tipo}`;
        msgDiv.textContent = testo;
        container.innerHTML = '';
        container.appendChild(msgDiv);
        
        setTimeout(() => {
            if (container.contains(msgDiv)) {
                msgDiv.remove();
            }
        }, 5000);
    } else {
        alert(testo);
    }
}

// ============================================
// INIZIALIZZAZIONE
// ============================================
initAuth();

// ============================================
// ESPORTAZIONE FUNZIONI
// ============================================
window.authAccedi = _accedi;
window.authLogout = _logout;
window.authCambiaPin = _cambiaPin;
window.authGetUtente = getUtenteCorrente;
window.authIsLoggedIn = isLoggedIn;
window.addDebugLog = addDebugLog;

console.log('✅ Auth.js caricato correttamente');