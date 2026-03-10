// ============================================
// AGENDA ADMIN - GESTIONE LAVORI (SUPERVISORE/ADMIN)
// ============================================

// ✅ CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraNotifica('Connessione al database non disponibile', 'errore');
}

// ✅ UTENTE CORRENTE
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const adminLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;
const ruolo = utenteCorrente ? utenteCorrente.ruolo : null;

// ✅ VARIABILI GLOBALI
let lavoriList = [];
let tecniciList = [];
let impiantiList = [];
let filtroStato = 'tutti';
let filtroTecnico = 'tutti';
let filtroPriorita = 'tutti';
let ricercaTesto = '';
let ordinamento = 'data_apertura_desc';
let lavoroCorrenteId = null;


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

// ✅ FUNZIONI AUSILIARIE (condivise con agenda.js)
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

// ✅ CARICAMENTO TECNICI
// ✅ CARICAMENTO TECNICI
async function caricaTecnici() {
    try {
        // Prova prima con la tabella tecnici (nome_completo)
        let { data, error } = await supabaseClient
            .from('tecnici')
            .select('nome_completo')
            .order('nome_completo', { ascending: true });
        
        // Se non funziona, prova con manutentori
        if (error || !data || data.length === 0) {
            console.log('🔄 Tentativo con tabella manutentori...');
            const result = await supabaseClient
                .from('manutentori')
                .select('Manutentore')
                .order('Manutentore', { ascending: true });
            
            data = result.data;
            error = result.error;
            
            if (!error && data) {
                tecniciList = data.map(m => ({ nome_completo: m.Manutentore }));
            }
        } else {
            tecniciList = data || [];
        }
        
        if (error) throw error;
        
        console.log(`✅ Tecnici caricati: ${tecniciList.length}`);
        
        // Popola select filtro
        const selectFiltro = document.getElementById('filtro-tecnico');
        const selectModale = document.getElementById('tecnico-id');
        
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="tutti">Tutti i tecnici</option>';
            tecniciList.forEach(t => {
                const nome = t.nome_completo || t.Manutentore;
                selectFiltro.innerHTML += `<option value="${nome}">${nome}</option>`;
            });
        }
        
        if (selectModale) {
            selectModale.innerHTML = '<option value="">Seleziona tecnico...</option>';
            tecniciList.forEach(t => {
                const nome = t.nome_completo || t.Manutentore;
                selectModale.innerHTML += `<option value="${nome}">${nome}</option>`;
            });
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici:', error);
        
        // Fallback: lista vuota
        tecniciList = [];
        
        const selectFiltro = document.getElementById('filtro-tecnico');
        const selectModale = document.getElementById('tecnico-id');
        
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="tutti">Tutti i tecnici</option>';
        }
        
        if (selectModale) {
            selectModale.innerHTML = '<option value="">Seleziona tecnico...</option>';
        }
    }
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
        
        if (filtroPriorita !== 'tutti') {
            query = query.eq('priorita', filtroPriorita);
        }
        
        if (filtroTecnico !== 'tutti') {
            query = query.eq('tecnico_id', filtroTecnico);
        }
        
        if (ricercaTesto) {
            query = query.or(`impianto_id.ilike.%${ricercaTesto}%,note_lavoro.ilike.%${ricercaTesto}%`);
        }
        
        // Ordinamento
        switch(ordinamento) {
            case 'data_apertura_desc':
                query = query.order('data_apertura', { ascending: false });
                break;
            case 'data_apertura_asc':
                query = query.order('data_apertura', { ascending: true });
                break;
            case 'priorita_desc':
                query = query.order('priorita', { ascending: false });
                break;
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        lavoriList = data || [];
        
        renderListaAdmin();
        aggiornaStatistiche();
        
        nascondiLoading();
        console.log(`✅ Lavori caricati: ${lavoriList.length}`);
        
    } catch (error) {
        console.error('❌ Errore caricamento lavori:', error);
        mostraNotifica('Errore nel caricamento dei lavori', 'errore');
        nascondiLoading();
    }
}

// ✅ RENDER LISTA ADMIN
function renderListaAdmin() {
    const container = document.getElementById('lista-lavori-admin');
    if (!container) return;
    
    if (lavoriList.length === 0) {
        container.innerHTML = `
            <div class="vuoto-state">
                <span class="material-symbols-rounded">assignment</span>
                <h3>Nessun lavoro trovato</h3>
                <p>Prova a modificare i filtri o crea un nuovo lavoro.</p>
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
            <div class="lavoro-card admin" data-id="${lavoro.id}">
                <div class="lavoro-header">
                    <div class="lavoro-titolo">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="lavoro-impianto">${lavoro.impianto_id}</span>
                            <span style="background: ${badgeTipo.colore}20; color: ${badgeTipo.colore}; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                                ${badgeTipo.testo}
                            </span>
                        </div>
                        
                        <!-- INDIRIZZO -->
                        <div style="font-size: 0.9rem; margin-top: 0.25rem; ${!impianto ? 'color: #ef4444;' : ''}">
                            ${impianto ? 
                                `<strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>` : 
                                '<span style="color: #ef4444; font-size: 0.8rem; font-weight: 600;">⚠️ IMPIANTO NON PRESENTE NEL PARCO</span>'}
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
                            <strong>Note:</strong> ${lavoro.note_lavoro}
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
                        <button class="btn-icona modifica" onclick="modificaLavoro(${lavoro.id})" title="Modifica">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-icona" onclick="apriNoteAdmin(${lavoro.id})" title="Note lavorazione">
                            <span class="material-symbols-rounded">note_add</span>
                        </button>
                        <button class="btn-icona" onclick="window.location.href='allegati_lavoro.html?id=${lavoro.id}'" title="Allegati">
                            <span class="material-symbols-rounded">attach_file</span>
                        </button>
                        <button class="btn-icona elimina" onclick="eliminaLavoro(${lavoro.id})" title="Elimina">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </div>
                
                <div class="lavoro-timeline">
                    ${getTimelineCompact(lavoro)}
                </div>
                
                ${lavoro.stato === 'Chiusa' ? `
                    <button class="btn-termina" onclick="terminaLavoro(${lavoro.id})">
                        <span class="material-symbols-rounded">check_circle</span>
                        TERMINA LAVORO
                    </button>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
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


function getTimelineCompact(lavoro) {
    const stati = ['Aperto', 'Accettata', 'Lavorazione', 'Sospesa', 'Chiusa', 'Terminata'];
    let html = '<div class="timeline-compact">';
    
    stati.forEach(stato => {
        const data = lavoro[`data_${stato.toLowerCase()}`];
        if (data) {
            html += `
                <div class="timeline-item">
                    <span class="material-symbols-rounded" style="color: #22c55e; font-size: 1rem;">check_circle</span>
                    <span><strong>${stato}:</strong> ${new Date(data).toLocaleDateString('it-IT')}</span>
                </div>
            `;
        } else if (lavoro.stato === stato) {
            html += `
                <div class="timeline-item">
                    <span class="material-symbols-rounded" style="color: var(--primary); font-size: 1rem;">pending</span>
                    <span><strong>${stato}:</strong> In corso</span>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}

// ✅ STATISTICHE
function aggiornaStatistiche() {
    const stats = {
        totale: lavoriList.length,
        aperti: lavoriList.filter(l => l.stato === 'Aperto').length,
        lavorazione: lavoriList.filter(l => l.stato === 'Lavorazione').length,
        sospesi: lavoriList.filter(l => l.stato === 'Sospesa').length,
        chiusi: lavoriList.filter(l => l.stato === 'Chiusa').length,
        terminati: lavoriList.filter(l => l.stato === 'Terminata').length,
        prioritaAlta: lavoriList.filter(l => l.priorita === 'ALTA').length,
        daTerminare: lavoriList.filter(l => l.stato === 'Chiusa').length
    };
    
    const container = document.getElementById('statistiche-admin');
    if (!container) return;
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-valore">${stats.totale}</div>
            <div class="stat-label">Totale</div>
        </div>
        <div class="stat-card">
            <div class="stat-valore">${stats.aperti}</div>
            <div class="stat-label">Aperti</div>
        </div>
        <div class="stat-card">
            <div class="stat-valore">${stats.lavorazione}</div>
            <div class="stat-label">In corso</div>
        </div>
        <div class="stat-card ${stats.daTerminare > 0 ? 'warning' : ''}">
            <div class="stat-valore">${stats.chiusi}</div>
            <div class="stat-label">Da terminare</div>
        </div>
        <div class="stat-card highlight">
            <div class="stat-valore">${stats.prioritaAlta}</div>
            <div class="stat-label">Priorità ALTA</div>
        </div>
        <div class="stat-card">
            <div class="stat-valore">${stats.terminati}</div>
            <div class="stat-label">Terminati</div>
        </div>
    `;
}

// ✅ GESTIONE MODALI
function apriModaleNuovoLavoro() {
    document.getElementById('modale-lavoro-titolo').textContent = 'Nuovo Lavoro';
    document.getElementById('lavoro-id-modifica').value = '';
    document.getElementById('impianto-id').value = '';
    document.getElementById('tecnico-id').value = '';
    document.getElementById('tipo-lavoro').value = '';
    document.getElementById('tipo-altro').value = '';
    document.getElementById('tipo-altro-container').style.display = 'none';
    document.querySelector('input[name="priorita"][value="ALTA"]').checked = true;
    document.getElementById('note-lavoro').value = '';
    document.getElementById('btn-salva-lavoro').innerHTML = '<span class="material-symbols-rounded">save</span> Salva Lavoro';
    
    document.getElementById('modale-nuovo-lavoro').style.display = 'flex';
}

function chiudiModaleNuovoLavoro() {
    document.getElementById('modale-nuovo-lavoro').style.display = 'none';
}

function gestisciTipoAltro() {
    const tipo = document.getElementById('tipo-lavoro').value;
    const container = document.getElementById('tipo-altro-container');
    container.style.display = tipo === 'Altro' ? 'block' : 'none';
}

async function modificaLavoro(id) {
    lavoroCorrenteId = id;
    const lavoro = lavoriList.find(l => l.id == id);
    if (!lavoro) return;
    
    document.getElementById('modale-lavoro-titolo').textContent = 'Modifica Lavoro';
    document.getElementById('lavoro-id-modifica').value = id;
    document.getElementById('impianto-id').value = lavoro.impianto_id;
    document.getElementById('tecnico-id').value = lavoro.tecnico_id;
    document.getElementById('tipo-lavoro').value = lavoro.tipo_lavoro;
    
    if (lavoro.tipo_lavoro === 'Altro') {
        document.getElementById('tipo-altro-container').style.display = 'block';
        document.getElementById('tipo-altro').value = lavoro.tipo_altro_testo || '';
    } else {
        document.getElementById('tipo-altro-container').style.display = 'none';
    }
    
    document.querySelector(`input[name="priorita"][value="${lavoro.priorita}"]`).checked = true;
    document.getElementById('note-lavoro').value = lavoro.note_lavoro || '';
    document.getElementById('btn-salva-lavoro').innerHTML = '<span class="material-symbols-rounded">update</span> Aggiorna Lavoro';
    
    document.getElementById('modale-nuovo-lavoro').style.display = 'flex';
}

async function salvaLavoro() {
    const id = document.getElementById('lavoro-id-modifica').value;
    const impianto = document.getElementById('impianto-id').value.trim();
    const tecnico = document.getElementById('tecnico-id').value;
    const tipo = document.getElementById('tipo-lavoro').value;
    const tipoAltro = document.getElementById('tipo-altro').value.trim();
    const priorita = document.querySelector('input[name="priorita"]:checked').value;
    const note = document.getElementById('note-lavoro').value.trim();
    
    if (!impianto || !tecnico || !tipo) {
        mostraNotifica('Compila tutti i campi obbligatori', 'errore');
        return;
    }
    
    if (tipo === 'Altro' && !tipoAltro) {
        mostraNotifica('Specifica il tipo di lavoro', 'errore');
        return;
    }
    
    mostraLoading();
    
    const datiLavoro = {
        impianto_id: impianto,
        tecnico_id: tecnico,
        tipo_lavoro: tipo,
        tipo_altro_testo: tipo === 'Altro' ? tipoAltro : null,
        priorita: priorita,
        note_lavoro: note || null,
        created_by: adminLoggato
    };
    
    try {
        let error;
        
        if (id) {
            // Modifica
            ({ error } = await supabaseClient
                .from('lavori')
                .update(datiLavoro)
                .eq('id', id));
        } else {
            // Nuovo
            ({ error } = await supabaseClient
                .from('lavori')
                .insert([{
                    ...datiLavoro,
                    stato: 'Aperto',
                    data_apertura: new Date().toISOString()
                }]));
        }
        
        if (error) throw error;
        
        mostraNotifica(id ? 'Lavoro aggiornato' : 'Lavoro creato', 'successo');
        chiudiModaleNuovoLavoro();
        await caricaLavori();
        
    } catch (error) {
        console.error('❌ Errore salvataggio lavoro:', error);
        mostraNotifica('Errore nel salvataggio', 'errore');
    } finally {
        nascondiLoading();
    }
}

async function eliminaLavoro(id) {
    if (!confirm('Sei sicuro di voler eliminare definitivamente questo lavoro?\nQuesta azione non può essere annullata.')) return;
    
    try {
        mostraLoading();
        
        const { error } = await supabaseClient
            .from('lavori')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Lavoro eliminato', 'successo');
        await caricaLavori();
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
    } finally {
        nascondiLoading();
    }
}

async function terminaLavoro(id) {
    if (!confirm('Confermi la terminazione di questo lavoro?')) return;
    
    try {
        mostraLoading();
        
        const { error } = await supabaseClient
            .from('lavori')
            .update({ 
                stato: 'Terminata',
                data_terminata: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Lavoro terminato', 'successo');
        await caricaLavori();
        
    } catch (error) {
        console.error('❌ Errore terminazione:', error);
        mostraNotifica('Errore nella terminazione', 'errore');
    } finally {
        nascondiLoading();
    }
}

// ✅ APRI MODALE DETTAGLIO (modifica questa funzione in agenda_admin.js)
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
                ${getTimelineCompact(lavoro)}
            </div>
        </div>
    `;
    
    document.getElementById('dettaglio-content').innerHTML = html;
    document.getElementById('modale-dettaglio').style.display = 'flex';
}
function chiudiModaleDettaglio() {
    document.getElementById('modale-dettaglio').style.display = 'none';
}

// ✅ MODALE NOTE (versione admin)
async function apriNoteAdmin(id) {
    lavoroCorrenteId = id;
    await caricaNote(id);
    document.getElementById('modale-note').style.display = 'flex';
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
            const puoEliminare = ruolo === 'admin' || ruolo === 'supervisore' || nota.tecnico_id === adminLoggato;
            
            html += `
                <div class="nota-item" data-id="${nota.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="nota-testo">${nota.nota}</div>
                        ${puoEliminare ? `
                        <button class="btn-icona elimina" onclick="eliminaNota(${nota.id})" style="width: 30px; height: 30px; margin-left: 8px;">
                            <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                        </button>
                        ` : ''}
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

async function salvaNotaAdmin() {
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
                tecnico_id: adminLoggato,
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

function chiudiModaleNote() {
    document.getElementById('modale-note').style.display = 'none';
    document.getElementById('nuova-nota').value = '';
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

// ✅ INIZIALIZZAZIONE
document.addEventListener('DOMContentLoaded', async function() {
    const utente = typeof authGetUtente === 'function' ? authGetUtente() : null;
    const display = document.getElementById('tecnico-display');
    if (utente && utente.nome_completo && display) {
        display.innerText = `${utente.ruolo === 'admin' ? 'Admin' : 'Supervisore'}: ${utente.nome_completo}`;
    }
    
    const footerEl = document.getElementById('footer-text');
    if (footerEl && window.FOOTER_CONFIG) {
        footerEl.innerText = window.FOOTER_CONFIG.testo;
    }
    
    const configInfo = getDbConfigInfo();
    const dot = document.getElementById('db-status-dot');
    if (dot) {
        dot.style.background = configInfo.configured ? '#22c55e' : '#f59e0b';
    }
    
    // Event listeners filtri
    document.getElementById('filtro-stato').addEventListener('change', function() {
        filtroStato = this.value;
        caricaLavori();
    });
    
    document.getElementById('filtro-tecnico').addEventListener('change', function() {
        filtroTecnico = this.value;
        caricaLavori();
    });
    
    document.getElementById('filtro-priorita').addEventListener('change', function() {
        filtroPriorita = this.value;
        caricaLavori();
    });
    
    document.getElementById('ordinamento').addEventListener('change', function() {
        ordinamento = this.value;
        caricaLavori();
    });
    
    document.getElementById('ricerca-testo').addEventListener('input', function() {
        ricercaTesto = this.value;
        caricaLavori();
    });
    
    await caricaTecnici();
    await caricaLavori();
});

// ✅ ESPORTA FUNZIONI GLOBALI
window.apriModaleNuovoLavoro = apriModaleNuovoLavoro;
window.chiudiModaleNuovoLavoro = chiudiModaleNuovoLavoro;
window.gestisciTipoAltro = gestisciTipoAltro;
window.modificaLavoro = modificaLavoro;
window.salvaLavoro = salvaLavoro;
window.eliminaLavoro = eliminaLavoro;
window.terminaLavoro = terminaLavoro;
window.apriDettaglioLavoro = apriDettaglioLavoro;
window.chiudiModaleDettaglio = chiudiModaleDettaglio;
window.apriNoteAdmin = apriNoteAdmin;
window.chiudiModaleNote = chiudiModaleNote;
window.salvaNotaAdmin = salvaNotaAdmin;
window.eliminaNota = eliminaNota;