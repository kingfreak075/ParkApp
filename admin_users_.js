// ============================================
// admin_users.js - VERSIONE SEMPLICE E FUNZIONANTE
// ============================================
console.log('✅ admin_users.js caricato');

let usersList = [];
let usersFiltered = [];

// ============================================
// CARICAMENTO UTENTI (SOLO DA PROFILES)
// ============================================
window.caricaUtenti = async function() {
    console.log('📥 Caricamento utenti...');
    
    try {
        const supabase = window.getSupabaseClient();
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('nome_completo');
        
        if (error) throw error;
        
        usersList = data || [];
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
// RENDERING TABELLA
// ============================================
function renderizzaTabella(lista) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    if (lista.length === 0) {
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
    lista.forEach(user => {
        // Data creazione
        const dataCreazione = user.created_at ? 
            new Date(user.created_at).toLocaleDateString('it-IT') : '-';
        
        // Ruolo con icona
        let ruoloIcon = '';
        let ruoloClass = '';
        let ruoloTesto = '';
        
        switch(user.ruolo) {
            case 'admin':
                ruoloIcon = '👑';
                ruoloClass = 'badge-danger';
                ruoloTesto = 'ADMIN';
                break;
            case 'supervisore':
                ruoloIcon = '👁️';
                ruoloClass = 'badge-warning';
                ruoloTesto = 'SUPERVISORE';
                break;
            case 'tecnico':
                ruoloIcon = '🔧';
                ruoloClass = 'badge-info';
                ruoloTesto = 'TECNICO';
                break;
            default:
                ruoloIcon = '👤';
                ruoloClass = 'badge-secondary';
                ruoloTesto = (user.ruolo || 'UTENTE').toUpperCase();
        }
        
        // Stato (sempre "Confermata" perché non possiamo saperlo)
        const stato = '<span class="badge badge-success">✅ Confermata</span>';
        
        // Ultimo accesso (non disponibile)
        const ultimoAccesso = '-';
        
        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded" style="color: ${user.ruolo === 'admin' ? '#ef4444' : '#64748b'}">account_circle</span>
                        <div>
                            <div style="font-weight: 600;">${user.nome_completo || '—'}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">${dataCreazione}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-family: monospace;">${user.email}</div>
                </td>
                <td>
                    <span class="badge ${ruoloClass}" style="display: inline-flex; align-items: center; gap: 4px;">
                        <span>${ruoloIcon}</span>
                        <span>${ruoloTesto}</span>
                    </span>
                </td>
                <td>
                    <div style="font-size: 0.9rem; color: #64748b;">${ultimoAccesso}</div>
                </td>
                <td>
                    ${stato}
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-small" onclick="modificaUtente('${user.id}')" title="Modifica utente" style="padding: 6px;">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-icon-small" onclick="resettaPassword('${user.email}')" title="Reset password" style="padding: 6px;">
                            <span class="material-symbols-rounded">key</span>
                        </button>
                        <button class="btn-icon-small" onclick="eliminaUtente('${user.id}')" title="Elimina utente" style="padding: 6px; color: #ef4444;">
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
    const totale = usersList.length;
    
    document.getElementById('stats-admin').textContent = admin;
    document.getElementById('stats-supervisori').textContent = supervisori;
    document.getElementById('stats-tecnici').textContent = tecnici;
    document.getElementById('stats-ultimo-accesso').textContent = new Date().toLocaleDateString('it-IT');
    
    // Se esiste un elemento per il totale
    const statsTotal = document.getElementById('stats-totale');
    if (statsTotal) statsTotal.textContent = totale;
}

// ============================================
// FILTRI
// ============================================
window.filtraUtenti = function() {
    const search = document.getElementById('search-users')?.value.toLowerCase() || '';
    const role = document.getElementById('filter-user-role')?.value || '';
    
    usersFiltered = usersList.filter(user => {
        const matchSearch = search === '' || 
            (user.nome_completo?.toLowerCase() || '').includes(search) ||
            (user.email?.toLowerCase() || '').includes(search);
        const matchRole = role === '' || user.ruolo === role;
        return matchSearch && matchRole;
    });
    
    renderizzaTabella(usersFiltered);
};

// ============================================
// MODIFICA UTENTE
// ============================================
window.modificaUtente = async function(id) {
    console.log('✏️ Modifica utente:', id);
    
    try {
        const supabase = window.getSupabaseClient();
        
        const { data: user } = await supabase
            .from('profiles')
            .select('nome_completo, ruolo')
            .eq('id', id)
            .single();
        
        const nuovoNome = prompt('Modifica nome completo:', user?.nome_completo || '');
        if (nuovoNome === null) return;
        
        const nuovoRuolo = prompt('Modifica ruolo (admin/supervisore/tecnico):', user?.ruolo || '');
        if (nuovoRuolo === null) return;
        
        if (!['admin', 'supervisore', 'tecnico'].includes(nuovoRuolo)) {
            alert('Ruolo non valido. Usa: admin, supervisore, tecnico');
            return;
        }
        
        const { error } = await supabase
            .from('profiles')
            .update({ 
                nome_completo: nuovoNome.trim(), 
                ruolo: nuovoRuolo 
            })
            .eq('id', id);
        
        if (error) throw error;
        
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
        const supabase = window.getSupabaseClient();
        
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
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
// CREAZIONE NUOVO UTENTE (VIA SIGNUP)
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
        const supabase = window.getSupabaseClient();
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nome_completo: nome,
                    ruolo: ruolo
                }
            }
        });
        
        if (error) throw error;
        
        alert(`✅ Utente ${nome} creato con successo! (Conferma email richiesta)`);
        chiudiModalNuovoUtente();
        caricaUtenti();
        
    } catch (error) {
        console.error('❌ Errore creazione:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-symbols-rounded">save</span> Crea Utente';
    }
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
    
    if (tab === 'manual') {
        tabManual.classList.add('active');
        tabImport.classList.remove('active');
        contentManual.style.display = 'block';
        contentImport.style.display = 'none';
    } else {
        tabManual.classList.remove('active');
        tabImport.classList.add('active');
        contentManual.style.display = 'none';
        contentImport.style.display = 'block';
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

// ============================================
// INIZIALIZZAZIONE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('tab-users')?.classList.contains('active')) {
        caricaUtenti();
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-tab="users"]');
    if (btn) {
        setTimeout(caricaUtenti, 200);
    }
});