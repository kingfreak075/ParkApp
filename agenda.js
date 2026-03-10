// ============================================
// AGENDA LAVORI - PARKAPP
// ============================================

// ✅ CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    // Non possiamo usare mostraNotifica qui perché il DOM non è ancora caricato
}

// ✅ UTENTE CORRENTE
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;
const ruolo = utenteCorrente ? utenteCorrente.ruolo : null;

// ✅ VARIABILI GLOBALI
let lavoriList = [];
let filtroStato = 'tutti';
let ricercaTesto = '';
let lavoroCorrenteId = null;
let impiantiList = [];


// ✅ CARICAMENTO IMPIANTI DA PARCO_APP
async function caricaImpianti() {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('Parco_app')
            .select('impianto, Indirizzo, localit, prov');
        
        if (error) throw error;
        
        impiantiList = data || [];
        console.log(`✅ Impianti caricati: ${impiantiList.length}`);
        
    } catch (error) {
        console.error('❌ Errore caricamento impianti:', error);
    }
}


// ✅ NOTIFICHE
function mostraNotifica(messaggio, tipo = 'info') {
    const notificaEsistente = document.querySelector('.notifica');
    if (notificaEsistente) notificaEsistente.remove();
    
    const notifica = document.createElement('div');
    notifica.className = `notifica ${tipo}`;
    
    let icona = 'info';
    if (tipo === 'successo') icona = 'check_circle';
    if (tipo === 'errore') icona = 'error';
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 14px;">${icona}</span>
        <span>${messaggio}</span>
    `;
    
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.opacity = '0';
            notifica.style.transform = 'translateX(-50%) translateY(-5px)';
            notifica.style.transition = 'all 0.15s ease';
            
            setTimeout(() => {
                if (notifica.parentNode) notifica.remove();
            }, 150);
        }
    }, 2000);
}

// ✅ FUNZIONI AUSILIARIE (definite una sola volta)
function getBadgeStato(stato) {
    const stati = {
        'Aperto': { colore: '#f59e0b', emoji: '🆕', testo: 'APERTO' },
        'Accettata': { colore: '#3b82f6', emoji: '✅', testo: 'ACCETTATA' },
        'Lavorazione': { colore: '#8b5cf6', emoji: '⚙️', testo: 'LAVORAZIONE' },
        'Sospesa': { colore: '#64748b', emoji: '⏸️', testo: 'SOSPESA' },
        'Chiusa': { colore: '#22c55e', emoji: '🔒', testo: 'CHIUSA' },
        'Terminata': { colore: '#10b981', emoji: '🏁', testo: 'TERMINATA' }
    };
    return stati[stato] || { colore: '#94a3b8', emoji: '❓', testo: stato };
}

function getPulsantiStatoTecnico(statoCorrente, lavoroId) {
    const statiSuccessivi = {
        'Aperto': ['Accettata'],
        'Accettata': ['Lavorazione', 'Sospesa'],
        'Lavorazione': ['Sospesa', 'Chiusa'],
        'Sospesa': ['Lavorazione', 'Chiusa']
    };
    
    const prossimi = statiSuccessivi[statoCorrente] || [];
    
    return prossimi.map(stato => {
        const badge = getBadgeStato(stato);
        return `
            <button class="btn-stato-rapido" onclick="cambiaStato(${lavoroId}, '${stato}')" 
                    style="background: ${badge.colore}20; color: ${badge.colore};">
                ${badge.emoji} ${badge.testo}
            </button>
        `;
    }).join('');
}

// ✅ RENDER LISTA TECNICO
// ✅ RENDER LISTA TECNICO
function renderListaTecnico() {
    const container = document.getElementById('lista-lavori-tecnico');
    if (!container) return;
    
    if (lavoriList.length === 0) {
        container.innerHTML = `
            <div class="vuoto-state">
                <span class="material-symbols-rounded">assignment</span>
                <h3>Nessun lavoro assegnato</h3>
                <p>Al momento non hai lavori in agenda.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    lavoriList.forEach(lavoro => {
        const prioritaColore = lavoro.priorita === 'ALTA' ? '#ef4444' : '#3b82f6';
        const badgeStato = getBadgeStato(lavoro.stato);
        const badgeTipo = getBadgeTipo(lavoro.tipo_lavoro);
        
        // Cerca l'impianto nella lista
        const impianto = impiantiList.find(i => i.impianto === lavoro.impianto_id);
        
        html += `
            <div class="lavoro-card" data-id="${lavoro.id}">
                <div class="lavoro-header">
                    <div class="lavoro-titolo">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="lavoro-impianto">${lavoro.impianto_id}</span>
                            <span style="background: ${badgeTipo.colore}20; color: ${badgeTipo.colore}; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.65rem; font-weight: 700;">
                                ${badgeTipo.testo}
                            </span>
                        </div>
                        
                        <!-- INDIRIZZO O MESSAGGIO -->
                        <div style="font-size: 0.85rem; margin-top: 0.25rem; ${!impianto ? 'color: #ef4444;' : ''}">
                            ${impianto ? 
                                `<strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>` : 
                                '<span style="color: #ef4444;">⚠️ NON PRESENTE NEL PARCO</span>'}
                        </div>
                    </div>
                    <div class="lavoro-stato" style="background: ${badgeStato.colore}20; color: ${badgeStato.colore};">
                        ${badgeStato.emoji} ${badgeStato.testo}
                    </div>
                </div>
                
                <div class="lavoro-body">
                    <div class="lavoro-info">
                        <div>
                            <span class="material-symbols-rounded">person</span>
                            <span>${lavoro.tecnico_id}</span>
                        </div>
                        <div>
                            <span class="material-symbols-rounded">priority</span>
                            <span style="color: ${prioritaColore}; font-weight: 800;">${lavoro.priorita}</span>
                        </div>
                        <div>
                            <span class="material-symbols-rounded">calendar_today</span>
                            <span>${new Date(lavoro.data_apertura).toLocaleDateString('it-IT')}</span>
                        </div>
                    </div>
                    
                    ${lavoro.note_lavoro ? `
                        <div class="lavoro-note">
                            <strong>Note lavoro:</strong> ${lavoro.note_lavoro}
                        </div>
                    ` : ''}
                </div>
                
                <div class="lavoro-footer">
                    <div class="lavoro-stats">
                        <span class="lavoro-badge">
                            <span class="material-symbols-rounded">description</span>
                            ${lavoro.allegati?.[0]?.count || 0}
                        </span>
                        <span class="lavoro-badge">
                            <span class="material-symbols-rounded">notes</span>
                            ${lavoro.note_lavorazione?.[0]?.count || 0}
                        </span>
                    </div>
                    
                    <div class="lavoro-azioni">
                        <button class="btn-icona" onclick="apriDettaglioLavoro(${lavoro.id})" title="Dettaglio">
                            <span class="material-symbols-rounded">visibility</span>
                        </button>
                        <button class="btn-icona" onclick="apriNoteLavorazione(${lavoro.id})" title="Note lavorazione">
                            <span class="material-symbols-rounded">note_add</span>
                        </button>
                        <button class="btn-icona" onclick="window.location.href='allegati_lavoro.html?id=${lavoro.id}'" title="Allegati">
                            <span class="material-symbols-rounded">attach_file</span>
                        </button>
                    </div>
                </div>
                
                ${lavoro.stato !== 'Terminata' ? `
                    <div class="lavoro-stati-rapidi">
                        ${getPulsantiStatoTecnico(lavoro.stato, lavoro.id)}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ✅ CARICAMENTO LAVORI
async function caricaLavori() {
    try {
        if (!supabaseClient) {
            mostraNotifica('Database non configurato', 'errore');
            return;
        }
        
        mostraLoading();
        
        // Carica impianti se non sono già stati caricati
        if (impiantiList.length === 0) {
            await caricaImpianti();
        }
        
        let query = supabaseClient
            .from('lavori')
            .select(`
                *,
                allegati(count),
                note_lavorazione(count)
            `);
        
        // Filtro per ruolo
        if (ruolo === 'tecnico') {
            query = query.eq('tecnico_id', tecnicoLoggato);
        }
        
        // Filtri aggiuntivi
        if (filtroStato !== 'tutti') {
            query = query.eq('stato', filtroStato);
        }
        
        if (ricercaTesto) {
            query = query.or(`impianto_id.ilike.%${ricercaTesto}%,note_lavoro.ilike.%${ricercaTesto}%`);
        }
        
        // Ordinamento
        query = query.order('data_apertura', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        lavoriList = data || [];
        
        // Aggiorna UI
        if (document.getElementById('lista-lavori-tecnico')) {
            renderListaTecnico();
        }
        
        nascondiLoading();
        console.log(`✅ Lavori caricati: ${lavoriList.length}`);
        
    } catch (error) {
        console.error('❌ Errore caricamento lavori:', error);
        mostraNotifica('Errore nel caricamento dei lavori', 'errore');
        nascondiLoading();
    }
}

// ✅ APRI MODALE DETTAGLIO (modifica la parte dell'indirizzo)
function apriDettaglioLavoro(id) {
    lavoroCorrenteId = id;
    const lavoro = lavoriList.find(l => l.id == id);
    if (!lavoro) return;
    
    const prioritaColore = lavoro.priorita === 'ALTA' ? '#ef4444' : '#3b82f6';
    const badgeStato = getBadgeStato(lavoro.stato);
    const badgeTipo = getBadgeTipo(lavoro.tipo_lavoro);
    const impianto = impiantiList.find(i => i.impianto === lavoro.impianto_id);
    
    const html = `
        <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <h4 style="font-size: 1.3rem; font-weight: 800; color: var(--primary); margin: 0;">${lavoro.impianto_id}</h4>
                        <span style="background: ${badgeTipo.colore}20; color: ${badgeTipo.colore}; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                            ${badgeTipo.testo}
                        </span>
                    </div>
                    
                    <!-- INDIRIZZO NEL DETTAGLIO -->
                    <div style="font-size: 0.9rem; margin-top: 0.25rem; ${!impianto ? 'color: #ef4444;' : ''}">
                        ${impianto ? 
                            `<strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>` : 
                            '⚠️ IMPIANTO NON PRESENTE NEL PARCO'}
                    </div>
                </div>
                <span style="background: ${badgeStato.colore}20; color: ${badgeStato.colore}; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 800;">
                    ${badgeStato.emoji} ${badgeStato.testo}
                </span>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-weight: 700; color: var(--text-muted);">Tipo lavoro:</span>
                    <span style="font-weight: 800;">${lavoro.tipo_lavoro}${lavoro.tipo_altro_testo ? ' - ' + lavoro.tipo_altro_testo : ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-weight: 700; color: var(--text-muted);">Priorità:</span>
                    <span style="font-weight: 800; color: ${prioritaColore};">${lavoro.priorita}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-weight: 700; color: var(--text-muted);">Tecnico:</span>
                    <span style="font-weight: 800;">${lavoro.tecnico_id}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 700; color: var(--text-muted);">Data apertura:</span>
                    <span style="font-weight: 800;">${new Date(lavoro.data_apertura).toLocaleDateString('it-IT')}</span>
                </div>
            </div>
            
            ${lavoro.note_lavoro ? `
                <div style="background: #fff3cd; border-radius: 12px; padding: 1rem; border-left: 4px solid #ffc107;">
                    <strong style="color: #856404;">Note lavoro:</strong>
                    <p style="margin: 0.5rem 0 0 0; color: #856404;">${lavoro.note_lavoro}</p>
                </div>
            ` : ''}
            
            <div style="margin-top: 1rem;">
                <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem;">Timeline:</h4>
                ${getTimelineHTMLCompact(lavoro)}
            </div>
        </div>
    `;
    
    document.getElementById('dettaglio-content').innerHTML = html;
    document.getElementById('modale-dettaglio').style.display = 'flex';
}

function getTimelineHTMLCompact(lavoro) {
    const stati = ['Aperto', 'Accettata', 'Lavorazione', 'Sospesa', 'Chiusa', 'Terminata'];
    let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
    
    stati.forEach(stato => {
        const data = lavoro[`data_${stato.toLowerCase()}`];
        if (data) {
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded" style="color: #22c55e; font-size: 1.2rem;">check_circle</span>
                    <span style="flex: 1;"><strong>${stato}:</strong> ${new Date(data).toLocaleDateString('it-IT')}</span>
                </div>
            `;
        } else if (lavoro.stato === stato) {
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded" style="color: var(--primary); font-size: 1.2rem;">pending</span>
                    <span style="flex: 1;"><strong>${stato}:</strong> In corso</span>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}

function chiudiModaleDettaglio() {
    document.getElementById('modale-dettaglio').style.display = 'none';
}

// ✅ APRI MODALE NOTE
async function apriNoteLavorazione(id) {
    lavoroCorrenteId = id;
    await caricaNote(id);
    document.getElementById('modale-note').style.display = 'flex';
}

// ✅ FUNZIONE PER BADGE TIPOLOGIA
function getBadgeTipo(tipo) {
    const colori = {
        'Ordine a Consuntivo': '#3b82f6',
        'Lavoro da Verbale': '#8b5cf6',
        'Commessa': '#10b981',
        'Riparazione': '#f59e0b',
        'Altro': '#64748b'
    };
    return { colore: colori[tipo] || '#64748b', testo: tipo };
}



async function caricaNote(lavoroId) {
    try {
        const { data, error } = await supabaseClient
            .from('note_lavorazione')
            .select('*')
            .eq('lavoro_id', lavoroId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('note-list');
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Nessuna nota presente</p>';
            return;
        }
        
        let html = '';
        data.forEach(nota => {
            html += `
                <div class="nota-item" data-id="${nota.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="nota-testo">${nota.nota}</div>
                        <button class="btn-icona elimina" onclick="eliminaNota(${nota.id})" style="width: 30px; height: 30px; margin-left: 8px;">
                            <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                        </button>
                    </div>
                    <div class="nota-meta">
                        <span>${nota.tecnico_id}</span>
                        <span>${new Date(nota.created_at).toLocaleString('it-IT')}</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Errore caricamento note:', error);
        mostraNotifica('Errore nel caricamento delle note', 'errore');
    }
}

// ✅ FUNZIONE PER ELIMINARE NOTA
async function eliminaNota(notaId) {
    if (!confirm('Eliminare questa nota?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('note_lavorazione')
            .delete()
            .eq('id', notaId);
        
        if (error) throw error;
        
        mostraNotifica('Nota eliminata', 'successo');
        await caricaNote(lavoroCorrenteId);
        
    } catch (error) {
        console.error('❌ Errore eliminazione nota:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
    }
}

async function salvaNota() {
    const nota = document.getElementById('nuova-nota').value.trim();
    if (!nota) {
        mostraNotifica('Inserisci una nota', 'errore');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('note_lavorazione')
            .insert([{
                lavoro_id: lavoroCorrenteId,
                tecnico_id: tecnicoLoggato,
                nota: nota
            }]);
        
        if (error) throw error;
        
        mostraNotifica('Nota salvata', 'successo');
        document.getElementById('nuova-nota').value = '';
        await caricaNote(lavoroCorrenteId);
        await caricaLavori();
        
    } catch (error) {
        console.error('❌ Errore salvataggio nota:', error);
        mostraNotifica('Errore nel salvataggio', 'errore');
    }
}

function chiudiModaleNote() {
    document.getElementById('modale-note').style.display = 'none';
    document.getElementById('nuova-nota').value = '';
}

// ✅ CAMBIO STATO
async function cambiaStato(id, nuovoStato) {
    console.log('🔄 Cambio stato:', id, nuovoStato);
    
    try {
        if (!supabaseClient) throw new Error('DB non configurato');
        
        const lavoro = lavoriList.find(l => l.id == id);
        if (!lavoro) {
            console.error('❌ Lavoro non trovato. ID cercato:', id);
            mostraNotifica('Lavoro non trovato', 'errore');
            return;
        }
        
        const campoData = `data_${nuovoStato.toLowerCase()}`;
        const updateData = { 
            stato: nuovoStato,
            [campoData]: new Date().toISOString()
        };
        
        console.log('📤 Invio aggiornamento:', updateData);
        
        const { error } = await supabaseClient
            .from('lavori')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica(`Stato aggiornato a ${nuovoStato}`, 'successo');
        await caricaLavori();
        
    } catch (error) {
        console.error('❌ Errore cambio stato:', error);
        mostraNotifica('Errore nel cambio stato: ' + error.message, 'errore');
    }
}

// ✅ UTILITY
function mostraLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.style.display = 'flex';
}

function nascondiLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.style.display = 'none';
}

// ✅ INIZIALIZZAZIONE (da chiamare dopo il caricamento del DOM)
function initAgenda() {
    // Gestione click filtri
    document.querySelectorAll('.filtro-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('attivo'));
            this.classList.add('attivo');
            filtroStato = this.dataset.stato;
            caricaLavori();
        });
    });
    
    // Ricerca in tempo reale
    const ricercaInput = document.getElementById('ricerca-testo');
    if (ricercaInput) {
        ricercaInput.addEventListener('input', function() {
            ricercaTesto = this.value;
            caricaLavori();
        });
    }
    
    // Carica lavori iniziali
    caricaLavori();
    caricaImpianti();
}

// ✅ ESPORTA FUNZIONI GLOBALI
window.caricaLavori = caricaLavori;
window.cambiaStato = cambiaStato;
window.apriDettaglioLavoro = apriDettaglioLavoro;
window.chiudiModaleDettaglio = chiudiModaleDettaglio;
window.apriNoteLavorazione = apriNoteLavorazione;
window.chiudiModaleNote = chiudiModaleNote;
window.salvaNota = salvaNota;
window.eliminaNota = eliminaNota;

// Avvia inizializzazione quando il DOM è caricato
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgenda);
} else {
    initAgenda();
}