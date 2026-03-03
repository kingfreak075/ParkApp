// ============================================
// admin_users.js - VERSIONE DEFINITIVA
// Basata su test_utenti.html - FUNZIONANTE
// ============================================
console.log('✅ admin_users.js caricato - funzioni disponibili:', Object.keys(window).filter(k => k.includes('Utente') || k.includes('carica')));


// Variabili globali (DICHIARATE UNA SOLA VOLTA)
let usersList = [];
let usersFiltered = [];

let tecniciSenzaAccount = [];
let supervisoriSenzaAccount = [];

// ============================================
// UTILITY
// ============================================
function formattaData(dataString) {
    if (!dataString) return '-';
    const date = new Date(dataString);
    return date.toLocaleDateString('it-IT') + ' ' + 
           date.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
}

function log(msg, data = null) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`, data || '');
}

// ============================================
// OTTIENI CLIENT ADMIN (SERVICE KEY)
// ============================================
function getAdminClient() {
    const config = JSON.parse(localStorage.getItem('db_config') || '{}');
    const url = localStorage.getItem('supabase_url');
    
    if (!url || !config.serviceKey) {
        console.error('❌ Service key non configurata');
        return null;
    }
    
    return supabase.createClient(url, config.serviceKey, {
        auth: { persistSession: false }
    });
}

// ============================================
// CARICAMENTO UTENTI (CON SERVICE KEY)
// ============================================
window.caricaUtenti = async function() {
    console.log('📥 Caricamento utenti...');
    
    try {
        const supabaseService = getAdminClient();
        if (!supabaseService) {
            alert('Service key non configurata. Vai in Configurazione e inserisci la SERVICE ROLE KEY');
            return;
        }
        
        // 1. Prendi TUTTI gli utenti da Auth (ignora RLS)
        const { data: authData, error: authError } = await supabaseService.auth.admin.listUsers();
        if (authError) throw authError;
        
        // 2. Prendi TUTTI i profili (ignora RLS)
        const { data: profiles, error: profilesError } = await supabaseService
            .from('profiles')
            .select('*');
        if (profilesError) throw profilesError;
        
        // 3. Unisci i dati usando l'ID
        usersList = authData.users.map(authUser => {
            // Cerca il profilo corrispondente
            const profile = profiles.find(p => p.id === authUser.id) || {};
            
            return {
                id: authUser.id,
                email: authUser.email,
                last_sign_in_at: authUser.last_sign_in_at,
                email_confirmed_at: authUser.email_confirmed_at,
                created_at: authUser.created_at,
                nome_completo: profile.nome_completo || authUser.user_metadata?.nome_completo || '',
                ruolo: profile.ruolo || authUser.user_metadata?.ruolo || 'utente',
                telefono: profile.telefono || ''
            };
        });
        
        usersFiltered = [...usersList];
        
        console.log(`✅ Caricati ${usersList.length} utenti`);
        
        aggiornaStatistiche();
        renderizzaTabella(usersFiltered);
        
    } catch (error) {
        console.error('❌ Errore caricamento:', error);
        alert('Errore caricamento utenti: ' + error.message);
    }
};

// ============================================
// RENDERING TABELLA (COME TEST)
// ============================================
function renderizzaTabella(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    const userCountEl = document.getElementById('user-count');
    if (userCountEl) userCountEl.textContent = `(Totale: ${users.length})`;
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">people_off</span>
                        <p style="margin-top: 0.5rem;">Nessun utente trovato</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    users.forEach(user => {
        // Controllo se l'utente non ha mai fatto il login
        const maiLoggato = !user.last_sign_in_at;
        
        // Formattazione Ultimo Accesso
        const ultimoAccesso = maiLoggato 
            ? '<span class="badge badge-warning">⚠️ Mai effettuato</span>'
            : new Date(user.last_sign_in_at).toLocaleString('it-IT');
        
        // Formattazione Email Confermata
        const emailConfermata = user.email_confirmed_at
            ? '<span class="badge badge-success">✅ Confermata</span>'
            : '<span class="badge badge-danger">⏳ In attesa</span>';
        
        // Colori in base al ruolo
        let ruoloBadge = '';
        let iconaRuolo = '';
        if (user.ruolo === 'admin') { 
            ruoloBadge = 'badge-danger'; 
            iconaRuolo = '👑 '; 
        } else if (user.ruolo === 'supervisore') { 
            ruoloBadge = 'badge-warning'; 
            iconaRuolo = '👁️ '; 
        } else if (user.ruolo === 'tecnico') { 
            ruoloBadge = 'badge-info'; 
            iconaRuolo = '🔧 '; 
        } else { 
            ruoloBadge = 'badge-success'; 
            iconaRuolo = '👤 '; 
        }
        
        // Stile visivo speciale per gli utenti che non sono mai entrati
        const rowStyle = maiLoggato ? 'background-color: #fffbeb;' : '';
        const etichettaNuovo = maiLoggato ? '<span style="color: #ef4444; font-size: 11px; font-weight: bold; margin-left: 8px;">(NUOVO)</span>' : '';
        const nomeUtente = user.nome_completo 
            ? user.nome_completo 
            : '<span style="color: #999; font-style: italic;">Nessun nome</span>';
        
        // Data creazione formattata
        const dataCreazione = formattaData(user.created_at);

        html += `
            <tr style="${rowStyle}">
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded">account_circle</span>
                        <div>
                            <div style="font-weight: 600;">${nomeUtente}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Creato: ${dataCreazione}</div>
                            ${etichettaNuovo}
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${ruoloBadge}" style="display: inline-flex; align-items: center; gap: 4px;">
                        <span>${iconaRuolo}</span>
                        <span>${user.ruolo || 'utente'}</span>
                    </span>
                </td>
                <td style="font-size: 0.9em;">${ultimoAccesso}</td>
                <td>${emailConfermata}</td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-small" onclick="modificaUtente('${user.id}')" title="Modifica">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-icon-small" onclick="resettaPassword('${user.email}')" title="Reset password">
                            <span class="material-symbols-rounded">key</span>
                        </button>
                        <button class="btn-icon-small" onclick="eliminaUtente('${user.id}')" title="Elimina" style="color: #ef4444;">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ============================================
// STATISTICHE
// ============================================
function aggiornaStatistiche() {
    const admin = usersList.filter(u => u.ruolo === 'admin').length;
    const supervisori = usersList.filter(u => u.ruolo === 'supervisore').length;
    const tecnici = usersList.filter(u => u.ruolo === 'tecnico').length;
    const maiLoggati = usersList.filter(u => !u.last_sign_in_at).length;
    const emailConfermate = usersList.filter(u => u.email_confirmed_at).length;
    
    document.getElementById('stats-admin').textContent = admin;
    document.getElementById('stats-supervisori').textContent = supervisori;
    document.getElementById('stats-tecnici').textContent = tecnici;
    
    // Aggiungi statistiche extra se esistono gli elementi
    const statsMaiLoggati = document.getElementById('stats-mai-loggati');
    if (statsMaiLoggati) statsMaiLoggati.textContent = maiLoggati;
    
    const statsConfermate = document.getElementById('stats-confermate');
    if (statsConfermate) statsConfermate.textContent = emailConfermate;
    
    document.getElementById('stats-ultimo-accesso').textContent = new Date().toLocaleDateString('it-IT');
}

// ============================================
// FILTRI
// ============================================
window.filtraUtenti = function() {
    const search = document.getElementById('search-users')?.value.toLowerCase() || '';
    const role = document.getElementById('filter-user-role')?.value || '';
    const status = document.getElementById('filter-user-status')?.value || '';
    
    usersFiltered = usersList.filter(user => {
        const matchSearch = search === '' || 
            (user.nome_completo?.toLowerCase() || '').includes(search) ||
            (user.email?.toLowerCase() || '').includes(search);
        
        const matchRole = role === '' || user.ruolo === role;
        
        let matchStatus = true;
        if (status === 'active') matchStatus = !!user.last_sign_in_at;
        if (status === 'never') matchStatus = !user.last_sign_in_at;
        
        return matchSearch && matchRole && matchStatus;
    });
    
    renderizzaTabella(usersFiltered);
};

// ============================================
// MODIFICA UTENTE
// ============================================
window.modificaUtente = async function(id) {
    console.log('✏️ Modifica utente:', id);
    
    try {
        const supabaseService = getAdminClient();
        if (!supabaseService) {
            alert('Service key non configurata');
            return;
        }
        
        const user = usersList.find(u => u.id === id);
        if (!user) throw new Error('Utente non trovato');
        
        const nuovoNome = prompt('Modifica nome completo:', user.nome_completo || '');
        if (nuovoNome === null) return;
        
        const nuovoRuolo = prompt('Modifica ruolo (admin/supervisore/tecnico):', user.ruolo || '');
        if (!nuovoRuolo || !['admin','supervisore','tecnico'].includes(nuovoRuolo)) {
            alert('Ruolo non valido');
            return;
        }
        
        // 1. Aggiorna profiles
        const { error: profileError } = await supabaseService
            .from('profiles')
            .update({ nome_completo: nuovoNome.trim(), ruolo: nuovoRuolo })
            .eq('id', id);
        
        if (profileError) throw profileError;
        
        // 2. Aggiorna auth metadata
        const { error: authError } = await supabaseService.auth.admin.updateUserById(id, {
            user_metadata: { nome_completo: nuovoNome.trim(), ruolo: nuovoRuolo }
        });
        
        if (authError) throw authError;
        
        alert('✅ Utente modificato con successo!');
        caricaUtenti();
        
    } catch (error) {
        console.error('❌ Errore modifica:', error);
        alert('Errore: ' + error.message);
    }
};

// ============================================
// ELIMINA UTENTE
// ============================================
window.eliminaUtente = async function(id) {
    console.log('🗑️ Elimina utente:', id);
    
    if (!confirm('⚠️ Sei sicuro di voler eliminare questo utente?')) return;
    if (!confirm('❗ CONFERMA FINALE: Questa azione è irreversibile!')) return;
    
    try {
        const supabaseService = getAdminClient();
        if (!supabaseService) {
            alert('Service key non configurata');
            return;
        }
        
        // 1. Elimina profilo (evita errori foreign key)
        const { error: profileError } = await supabaseService
            .from('profiles')
            .delete()
            .eq('id', id);
        
        if (profileError) {
            console.warn('⚠️ Errore eliminazione profilo (forse già assente)', profileError);
        }
        
        // 2. Elimina da auth
        const { error: authError } = await supabaseService.auth.admin.deleteUser(id);
        if (authError) throw authError;
        
        alert('✅ Utente eliminato con successo!');
        caricaUtenti();
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        alert('Errore: ' + error.message);
    }
};

// ============================================
// RESET PASSWORD
// ============================================
window.resettaPassword = async function(email) {
    console.log('🔑 Reset password per:', email);
    
    if (!confirm(`Inviare email di reset a ${email}?`)) return;
    
    try {
        const supabase = window.getSupabaseClient();
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });
        
        if (error) throw error;
        
        alert(`✅ Email di reset inviata a ${email}`);
        
    } catch (error) {
        console.error('❌ Errore reset:', error);
        alert('Errore: ' + error.message);
    }
};

// ============================================
// CREAZIONE NUOVO UTENTE
// ============================================
window.salvaNuovoUtente = async function() {
    const nome = document.getElementById('nuovo-nome').value.trim();
    const email = document.getElementById('nuovo-email').value.trim();
    const ruolo = document.getElementById('nuovo-ruolo').value;
    const password = document.getElementById('nuovo-password').value;
    
    if (!nome || !email || !ruolo) {
        alert('Compila tutti i campi obbligatori');
        return;
    }
    
    const saveBtn = document.querySelector('#modal-nuovo-utente .btn-primary');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Creazione...';
    
    try {
        const supabaseService = getAdminClient();
        if (!supabaseService) {
            throw new Error('Service key non configurata');
        }
        
        // 1. Crea utente in auth
        const { data, error } = await supabaseService.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                nome_completo: nome,
                ruolo: ruolo
            }
        });
        
        if (error) throw error;
        
        const newUserId = data.user.id;
        
        // 2. Aggiorna profilo (il trigger dovrebbe aver creato riga vuota)
        const { error: updateError } = await supabaseService
            .from('profiles')
            .update({ nome_completo: nome, ruolo: ruolo })
            .eq('id', newUserId);
        
        if (updateError) throw updateError;
        
        alert(`✅ Utente ${nome} creato con successo!`);
        chiudiModalNuovoUtente();
        caricaUtenti();
        
    } catch (error) {
        console.error('❌ Errore creazione:', error);
        
        if (error.message.includes('already registered')) {
            alert('❌ Email già registrata');
        } else {
            alert('❌ Errore: ' + error.message);
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-symbols-rounded">save</span> Crea Utente';
    }
};

// ============================================
// CARICAMENTO PERSONE SENZA ACCOUNT (PER IMPORT)
// ============================================
window.caricaPersoneSenzaAccount = async function() {
    try {
        const supabase = window.getSupabaseClient();
        const supabaseService = getAdminClient();
        
        if (!supabaseService) return;
        
        // Ottieni tutte le email già in auth (con service key)
        const { data: authData } = await supabaseService.auth.admin.listUsers();
        const emailEsistenti = new Set(authData.users.map(u => u.email?.toLowerCase()) || []);
        
        // Carica tecnici
        const { data: tecnici } = await supabase
            .from('tecnici')
            .select('nome_completo, Mail')
            .not('Mail', 'is', null)
            .neq('Mail', '');
        
        tecniciSenzaAccount = (tecnici || []).filter(t => 
            !emailEsistenti.has(t.Mail?.toLowerCase())
        ).map(t => ({
            nome_completo: t.nome_completo,
            email: t.Mail
        }));
        
        // Carica supervisori
        const { data: supervisori } = await supabase
            .from('supervisori')
            .select('Nome, Mail')
            .not('Mail', 'is', null)
            .neq('Mail', '');
        
        supervisoriSenzaAccount = (supervisori || []).filter(s => 
            !emailEsistenti.has(s.Mail?.toLowerCase())
        ).map(s => ({
            nome_completo: s.Nome,
            email: s.Mail
        }));
        
        renderizzaListeImport();
        
    } catch (error) {
        console.error('❌ Errore caricamento persone:', error);
    }
};

// ============================================
// IMPORTA SELEZIONATI
// ============================================
window.importaSelezionati = async function() {
    const selezionati = [];
    
    document.querySelectorAll('.check-tecnico:checked').forEach(cb => {
        const idx = cb.id.split('-')[1];
        if (tecniciSenzaAccount[idx]) {
            selezionati.push({
                ...tecniciSenzaAccount[idx],
                ruolo: 'tecnico'
            });
        }
    });
    
    document.querySelectorAll('.check-supervisore:checked').forEach(cb => {
        const idx = cb.id.split('-')[1];
        if (supervisoriSenzaAccount[idx]) {
            selezionati.push({
                ...supervisoriSenzaAccount[idx],
                ruolo: 'supervisore'
            });
        }
    });
    
    if (selezionati.length === 0) {
        alert('Nessun utente selezionato');
        return;
    }
    
    if (!confirm(`Creare ${selezionati.length} nuovi utenti?`)) return;
    
    const importBtn = document.querySelector('#user-tab-import .btn-primary');
    importBtn.disabled = true;
    importBtn.innerHTML = `⏳ 0/${selezionati.length}`;
    
    const supabaseService = getAdminClient();
    if (!supabaseService) {
        alert('Service key non configurata');
        return;
    }
    
    let creati = 0;
    let errori = [];
    
    for (let i = 0; i < selezionati.length; i++) {
        const utente = selezionati[i];
        
        try {
            // Crea in auth
            const { data } = await supabaseService.auth.admin.createUser({
                email: utente.email,
                password: 'Esa123!',
                email_confirm: true,
                user_metadata: {
                    nome_completo: utente.nome_completo,
                    ruolo: utente.ruolo
                }
            });
            
            // Aggiorna profilo
            await supabaseService
                .from('profiles')
                .update({ 
                    nome_completo: utente.nome_completo, 
                    ruolo: utente.ruolo 
                })
                .eq('id', data.user.id);
            
            creati++;
            importBtn.innerHTML = `⏳ ${creati}/${selezionati.length}`;
            
        } catch (err) {
            errori.push(`${utente.email}: ${err.message}`);
        }
    }
    
    alert(`✅ Creati: ${creati}\n❌ Errori: ${errori.length}`);
    chiudiModalNuovoUtente();
    caricaUtenti();
};

// ============================================
// MODALE NUOVO UTENTE
// ============================================
window.mostraModalNuovoUtente = async function() {
    console.log('📂 Apertura modale nuovo utente');
    
    switchUserTab('manual');
    
    document.getElementById('nuovo-nome').value = '';
    document.getElementById('nuovo-email').value = '';
    document.getElementById('nuovo-ruolo').value = '';
    document.getElementById('nuovo-password').value = 'Esa123!';
    
    await caricaPersoneSenzaAccount();
    
    document.getElementById('modal-nuovo-utente').style.display = 'flex';
};

window.chiudiModalNuovoUtente = function() {
    document.getElementById('modal-nuovo-utente').style.display = 'none';
};

window.switchUserTab = function(tab) {
    console.log('🔄 Cambio tab:', tab);
    
    const tabManual = document.getElementById('tab-manual-btn');
    const tabImport = document.getElementById('tab-import-btn');
    const contentManual = document.getElementById('user-tab-manual');
    const contentImport = document.getElementById('user-tab-import');
    const btnSalva = document.getElementById('btn-salva-utente');
    const btnImporta = document.getElementById('btn-importa-utenti');
    
    if (tab === 'manual') {
        tabManual.classList.add('active');
        tabImport.classList.remove('active');
        contentManual.style.display = 'block';
        contentImport.style.display = 'none';
        if (btnSalva) btnSalva.style.display = 'inline-flex';
        if (btnImporta) btnImporta.style.display = 'none';
    } else {
        tabManual.classList.remove('active');
        tabImport.classList.add('active');
        contentManual.style.display = 'none';
        contentImport.style.display = 'block';
        if (btnSalva) btnSalva.style.display = 'none';
        if (btnImporta) btnImporta.style.display = 'inline-flex';
    }
};

window.generaPassword = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('nuovo-password').value = password;
};

window.selezionaTuttiTecnici = function() {
    document.querySelectorAll('.check-tecnico, .check-supervisore').forEach(cb => cb.checked = true);
};

window.deselezionaTutti = function() {
    document.querySelectorAll('.check-tecnico, .check-supervisore').forEach(cb => cb.checked = false);
};

function renderizzaListeImport() {
    const containerTecnici = document.getElementById('lista-tecnici-import');
    const countTecnici = document.getElementById('tecnici-count');
    
    if (containerTecnici) {
        if (tecniciSenzaAccount.length === 0) {
            containerTecnici.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                    <span class="material-symbols-rounded">check_circle</span>
                    <p>Tutti i tecnici hanno già un account</p>
                </div>
            `;
        } else {
            let html = '<div style="max-height: 200px; overflow-y: auto;">';
            tecniciSenzaAccount.forEach((t, idx) => {
                html += `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                        <input type="checkbox" id="tecnico-${idx}" class="check-tecnico" value="${t.email}" checked>
                        <div style="flex: 1;">
                            <div><strong>${t.nome_completo}</strong></div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${t.email}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            containerTecnici.innerHTML = html;
        }
    }
    
    if (countTecnici) countTecnici.textContent = tecniciSenzaAccount.length;
    
    const containerSuper = document.getElementById('lista-supervisori-import');
    const countSuper = document.getElementById('supervisori-count');
    
    if (containerSuper) {
        if (supervisoriSenzaAccount.length === 0) {
            containerSuper.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                    <span class="material-symbols-rounded">check_circle</span>
                    <p>Tutti i supervisori hanno già un account</p>
                </div>
            `;
        } else {
            let html = '<div style="max-height: 200px; overflow-y: auto;">';
            supervisoriSenzaAccount.forEach((s, idx) => {
                html += `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                        <input type="checkbox" id="supervisore-${idx}" class="check-supervisore" value="${s.email}" checked>
                        <div style="flex: 1;">
                            <div><strong>${s.nome_completo}</strong></div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${s.email}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            containerSuper.innerHTML = html;
        }
    }
    
    if (countSuper) countSuper.textContent = supervisoriSenzaAccount.length;
}

// ============================================
// INIZIALIZZAZIONE
// ============================================
if (document.getElementById('tab-users')?.classList.contains('active')) {
    caricaUtenti();
}

document.addEventListener('click', function(e) {
    if (e.target.closest('[data-tab="users"]')) {
        setTimeout(caricaUtenti, 200);
    }
});