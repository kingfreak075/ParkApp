// ============================================
// login.js - Gestione centralizzata login
// ============================================

const LOGIN_CONFIG = {
    admin: {
        redirectUrl: 'admin_database.html',
        allowedRoles: ['admin', 'supervisore'],  // AGGIUNGI supervisore
        appName: 'Pannello Amministratore'
    },
    client: {
        redirectUrl: 'client_dashboard.html',
        allowedRoles: ['tecnico', 'supervisore'],
        appName: 'App Tecnico'
    }
};


// Funzione principale di login
async function login(email, password, appType = 'admin') {
    try {
        console.log(`🔐 Tentativo login per ${appType}...`);
        
        if (!window.getSupabaseClient) {
            throw new Error('Database non configurato');
        }
        
        const supabase = window.getSupabaseClient();
        
        // 1. Login con email/password
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // 2. Recupera profilo con ruolo
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('ruolo, nome_completo, email')
            .eq('id', data.user.id)
            .single();
        
        if (profileError) {
            console.error('Errore profilo:', profileError);
            throw new Error('Profilo utente non trovato');
        }
        
        // 3. Verifica ruolo consentito per questa app
        const config = LOGIN_CONFIG[appType];
        if (!config.allowedRoles.includes(profile.ruolo)) {
            await supabase.auth.signOut();
            throw new Error(`Accesso non autorizzato - Ruolo ${profile.ruolo} non può accedere a ${config.appName}`);
        }
        
        // 4. Salva dati sessione
        const sessionData = {
            user: {
                id: data.user.id,
                email: data.user.email
            },
            profile: profile,
            session: {
                access_token: data.session.access_token,
                expires_at: data.session.expires_at
            },
            appType: appType,
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('flox_session', JSON.stringify(sessionData));
        
        console.log(`✅ Login riuscito come ${profile.ruolo}:`, profile.nome_completo || profile.email);
        
        // 5. Reindirizza
        window.location.href = config.redirectUrl;
        
        return { success: true, data: sessionData };
        
    } catch (error) {
        console.error('❌ Login fallito:', error.message);
        return { success: false, error: error.message };
    }
}

// Funzione di logout
async function logout() {
    try {
        const supabase = window.getSupabaseClient?.();
        if (supabase) {
            await supabase.auth.signOut();
        }
    } catch (e) {
        console.warn('Errore durante logout:', e);
    } finally {
        localStorage.removeItem('flox_session');
        window.location.href = 'login.html';
    }
}

// Verifica autenticazione per pagine protette
async function checkAuth(allowedRoles = ['admin']) {
    try {
        // Recupera sessione dal localStorage
        const sessionData = JSON.parse(localStorage.getItem('flox_session'));
        
        if (!sessionData) {
            console.log('Nessuna sessione trovata');
            // IMPORTANTE: non reindirizzare se siamo già sulla pagina di login
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }
        
        // Verifica con Supabase
        const supabase = window.getSupabaseClient?.();
        if (!supabase) {
            throw new Error('Database non configurato');
        }
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user || user.id !== sessionData.user.id) {
            console.log('Sessione non valida');
            localStorage.removeItem('flox_session');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }
        
        // Verifica ruolo
        if (!allowedRoles.includes(sessionData.profile.ruolo)) {
            console.log(`Ruolo ${sessionData.profile.ruolo} non autorizzato`);
            localStorage.removeItem('flox_session');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }
        
        console.log(`✅ Autenticato come ${sessionData.profile.ruolo}`);
        return sessionData;
        
    } catch (error) {
        console.error('Errore verifica auth:', error);
        return null;
    }
}
// Ottieni utente corrente
function getCurrentUser() {
    const sessionData = JSON.parse(localStorage.getItem('flox_session'));
    return sessionData?.user || null;
}

// Ottieni profilo corrente
function getCurrentProfile() {
    const sessionData = JSON.parse(localStorage.getItem('flox_session'));
    return sessionData?.profile || null;
}

// Esponi funzioni globali
window.login = login;
window.logout = logout;
window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;

console.log('✅ Login JS caricato');