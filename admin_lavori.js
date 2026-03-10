// ============================================
// ADMIN LAVORI - GESTIONE LAVORI (INTEGRATO)
// ============================================

// VARIABILI GLOBALI
let lavoriListAdmin = [];
let tecniciListAdmin = [];
let impiantiList = [];
let lavoroCorrenteId = null;
let lavoroNoteCorrenteId = null;
let allegatiList = [];

// FILTRI
let filtroStato = 'tutti';
let filtroTecnico = 'tutti';
let filtroPriorita = 'tutti';
let ricercaTesto = '';

// MAPPATURA COLORI PER TIPOLOGIA
const TIPI_COLORI = {
    'Ordine a Consuntivo': '#3b82f6',
    'Lavoro da Verbale': '#8b5cf6',
    'Commessa': '#10b981',
    'Riparazione': '#f59e0b',
    'Altro': '#64748b'
};

// ✅ FUNZIONI AUSILIARIE
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

function getBadgeTipo(tipo) {
    const colore = TIPI_COLORI[tipo] || '#64748b';
    return { colore, testo: tipo };
}

// ✅ NOTIFICHE
function mostraNotifica(messaggio, tipo = 'info') {
    const notifica = document.createElement('div');
    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${tipo === 'successo' ? '#22c55e' : tipo === 'errore' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    notifica.textContent = messaggio;
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        notifica.style.opacity = '0';
        notifica.style.transition = 'opacity 0.3s';
        setTimeout(() => notifica.remove(), 300);
    }, 3000);
}

// ✅ CARICAMENTO TECNICI
// ✅ CARICAMENTO TECNICI (CORRETTO - usa tabella tecnici)
async function caricaTecniciAdmin() {
    try {
        console.log('🔄 Caricamento tecnici...');
        const supabase = getSupabaseClient();
        
        // Usa la tabella tecnici (quella usata per il login)
        const { data, error } = await supabase
            .from('tecnici')
            .select('nome_completo')
            .order('nome_completo', { ascending: true });
        
        if (error) {
            console.error('❌ Errore query tecnici:', error);
            throw error;
        }
        
        tecniciListAdmin = data || [];
        console.log(`✅ Tecnici caricati: ${tecniciListAdmin.length}`);
        
        // Popola select filtro
        const selectFiltro = document.getElementById('filtro-tecnico-lavori');
        const selectModale = document.getElementById('lavoro-tecnico');
        
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="tutti">Tutti i tecnici</option>';
            tecniciListAdmin.forEach(t => {
                selectFiltro.innerHTML += `<option value="${t.nome_completo}">${t.nome_completo}</option>`;
            });
        }
        
        if (selectModale) {
            selectModale.innerHTML = '<option value="">Seleziona tecnico...</option>';
            tecniciListAdmin.forEach(t => {
                selectModale.innerHTML += `<option value="${t.nome_completo}">${t.nome_completo}</option>`;
            });
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici:', error);
        
        // Fallback: prova con manutentori se tecnici non esiste
        try {
            console.log('🔄 Tentativo con tabella manutentori...');
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('manutentori')
                .select('Manutentore')
                .order('Manutentore', { ascending: true });
            
            if (error) throw error;
            
            tecniciListAdmin = data.map(m => ({ nome_completo: m.Manutentore }));
            console.log(`✅ Tecnici caricati da manutentori: ${tecniciListAdmin.length}`);
            
            // Popola select filtro
            const selectFiltro = document.getElementById('filtro-tecnico-lavori');
            const selectModale = document.getElementById('lavoro-tecnico');
            
            if (selectFiltro) {
                selectFiltro.innerHTML = '<option value="tutti">Tutti i tecnici</option>';
                tecniciListAdmin.forEach(t => {
                    selectFiltro.innerHTML += `<option value="${t.nome_completo}">${t.nome_completo}</option>`;
                });
            }
            
            if (selectModale) {
                selectModale.innerHTML = '<option value="">Seleziona tecnico...</option>';
                tecniciListAdmin.forEach(t => {
                    selectModale.innerHTML += `<option value="${t.nome_completo}">${t.nome_completo}</option>`;
                });
            }
            
        } catch (fallbackError) {
            console.error('❌ Anche manutentori fallito:', fallbackError);
            mostraNotifica('Errore nel caricamento dei tecnici', 'errore');
        }
    }
}

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
        
        // Popola datalist per autocomplete
        const datalist = document.getElementById('lista-impianti-admin');
        if (datalist) {
            datalist.innerHTML = impiantiList.map(imp => 
                `<option value="${imp.impianto}">${imp.Indirizzo} ${imp.localit || ''}`).join('');
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento impianti:', error);
    }
}

// ✅ RICERCA INDIRIZZO IMPIANTO
async function cercaIndirizzoImpianto(impiantoId, elementoId) {
    if (!impiantoId) return null;
    
    const impianto = impiantiList.find(i => i.impianto === impiantoId);
    const elemento = document.getElementById(elementoId);
    
    if (elemento) {
        if (impianto) {
            elemento.innerHTML = `<strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>`;
            elemento.style.color = '#1e293b';
            elemento.style.fontSize = '0.9rem';
        } else {
            elemento.innerHTML = '⚠️ IMPIANTO NON PRESENTE NEL PARCO';
            elemento.style.color = '#ef4444';
            elemento.style.fontSize = '0.8rem';
            elemento.style.fontWeight = '600';
        }
    }
    
    return impianto;
}

// ✅ CARICAMENTO LAVORI
async function caricaLavoriAdmin() {
    try {
        const supabase = getSupabaseClient();
        
        let query = supabase
            .from('lavori')
            .select(`
                *,
                allegati(count),
                note_lavorazione(count)
            `);
        
        // Filtri
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
        
        query = query.order('data_apertura', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        lavoriListAdmin = data || [];
        
        renderListaLavoriAdmin();
        aggiornaStatisticheAdmin();
        
    } catch (error) {
        console.error('❌ Errore caricamento lavori:', error);
        mostraNotifica('Errore nel caricamento dei lavori', 'errore');
    }
}

// ✅ RENDER LISTA LAVORI
function renderListaLavoriAdmin() {
    const container = document.getElementById('lista-lavori-admin-container');
    if (!container) return;
    
    if (lavoriListAdmin.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 3rem;">assignment</span>
                <h3>Nessun lavoro trovato</h3>
                <p>Prova a modificare i filtri o crea un nuovo lavoro.</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
    
    lavoriListAdmin.forEach(async lavoro => {
        const prioritaColore = lavoro.priorita === 'ALTA' ? '#ef4444' : '#3b82f6';
        const badgeStato = getBadgeStato(lavoro.stato);
        const badgeTipo = getBadgeTipo(lavoro.tipo_lavoro);
        const impianto = impiantiList.find(i => i.impianto === lavoro.impianto_id);
        
        html += `
            <div style="background: white; border-radius: 12px; padding: 1rem; border: 1px solid var(--border); border-left: 6px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <strong style="font-size: 1.2rem;">${lavoro.impianto_id}</strong>
                            <span style="background: ${badgeTipo.colore}20; color: ${badgeTipo.colore}; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                                ${badgeTipo.testo}
                            </span>
                        </div>
                        
                        <div id="indirizzo-${lavoro.id}" style="font-size: 0.9rem; margin: 0.25rem 0;">
                            ${impianto ? `<strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>` : 
                            '<span style="color: #ef4444; font-size: 0.8rem; font-weight: 600;">⚠️ IMPIANTO NON PRESENTE NEL PARCO</span>'}
                        </div>
                    </div>
                    
                    <span style="background: ${badgeStato.colore}20; color: ${badgeStato.colore}; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; font-weight: 800;">
                        ${badgeStato.emoji} ${badgeStato.testo}
                    </span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem;">
                    <div><span class="material-symbols-rounded" style="font-size: 1rem;">person</span> ${lavoro.tecnico_id}</div>
                    <div><span class="material-symbols-rounded" style="font-size: 1rem;">priority</span> <span style="color: ${prioritaColore};">${lavoro.priorita}</span></div>
                    <div><span class="material-symbols-rounded" style="font-size: 1rem;">calendar_today</span> ${new Date(lavoro.data_apertura).toLocaleDateString('it-IT')}</div>
                </div>
                
                ${lavoro.note_lavoro ? `
                    <div style="background: #f8fafc; padding: 0.5rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 0.5rem;">
                        <strong>Note:</strong> ${lavoro.note_lavoro}
                    </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border);">
                    <div style="display: flex; gap: 0.5rem;">
                        <span class="lavoro-badge">
                            <span class="material-symbols-rounded" style="font-size: 0.9rem;">description</span> ${lavoro.allegati?.[0]?.count || 0}
                        </span>
                        <span class="lavoro-badge">
                            <span class="material-symbols-rounded" style="font-size: 0.9rem;">notes</span> ${lavoro.note_lavorazione?.[0]?.count || 0}
                        </span>
                    </div>
                    
                  <div style="display: flex; gap: 0.25rem;">
    <button class="btn-icon-small" onclick="apriDettaglioLavoroAdmin('${lavoro.id}')" title="Dettaglio">
        <span class="material-symbols-rounded">visibility</span>
    </button>
    <button class="btn-icon-small" onclick="modificaLavoroAdmin('${lavoro.id}')" title="Modifica">
        <span class="material-symbols-rounded">edit</span>
    </button>
    <button class="btn-icon-small" onclick="apriModaleCambioStato('${lavoro.id}')" title="Cambia stato">
        <span class="material-symbols-rounded">sync_alt</span>
    </button>
    <button class="btn-icon-small" onclick="apriNoteLavoroAdmin('${lavoro.id}')" title="Note">
        <span class="material-symbols-rounded">note_add</span>
    </button>
    <button class="btn-icon-small" onclick="apriModaleAllegati('${lavoro.id}')" title="Allegati">
        <span class="material-symbols-rounded">attach_file</span>
    </button>
    <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaLavoroAdmin('${lavoro.id}')" title="Elimina">
        <span class="material-symbols-rounded">delete</span>
    </button>
</div>
                </div>
                
                ${lavoro.stato === 'Chiusa' ? `
                    <button class="btn btn-success" style="width: 100%; margin-top: 0.5rem;" onclick="terminaLavoroAdmin('${lavoro.id}')">
                        <span class="material-symbols-rounded">check_circle</span> TERMINA LAVORO
                    </button>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ✅ STATISTICHE
function aggiornaStatisticheAdmin() {
    const stats = {
        totale: lavoriListAdmin.length,
        aperti: lavoriListAdmin.filter(l => l.stato === 'Aperto').length,
        lavorazione: lavoriListAdmin.filter(l => l.stato === 'Lavorazione').length,
        chiusi: lavoriListAdmin.filter(l => l.stato === 'Chiusa').length,
        terminati: lavoriListAdmin.filter(l => l.stato === 'Terminata').length,
        alta: lavoriListAdmin.filter(l => l.priorita === 'ALTA').length
    };
    
    document.getElementById('stat-lavori-totali').textContent = stats.totale;
    document.getElementById('stat-lavori-aperti').textContent = stats.aperti;
    document.getElementById('stat-lavori-lavorazione').textContent = stats.lavorazione;
    document.getElementById('stat-lavori-chiusi').textContent = stats.chiusi;
    document.getElementById('stat-lavori-terminati').textContent = stats.terminati;
    document.getElementById('stat-lavori-alta').textContent = stats.alta;
}

// ============================================
// MODALE ALLEGATI (NUOVO)
// ============================================

async function apriModaleAllegati(lavoroId) {
    lavoroCorrenteId = lavoroId;
    await caricaAllegati(lavoroId);
    
    document.getElementById('modal-allegati-lavoro').style.display = 'flex';
    document.getElementById('allegati-lavoro-id').textContent = `Lavoro: ${lavoroId}`;
}

async function caricaAllegati(lavoroId) {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('allegati')
            .select('*')
            .eq('lavoro_id', lavoroId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allegatiList = data || [];
        renderListaAllegati();
        
    } catch (error) {
        console.error('❌ Errore caricamento allegati:', error);
        mostraNotifica('Errore nel caricamento allegati', 'errore');
    }
}

function renderListaAllegati() {
    const container = document.getElementById('lista-allegati-container');
    
    if (allegatiList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #64748b;">
                <span class="material-symbols-rounded" style="font-size: 3rem;">attach_file</span>
                <p>Nessun allegato presente</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    allegatiList.forEach(allegato => {
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span class="material-symbols-rounded" style="color: #ef4444;">picture_as_pdf</span>
                    <div>
                        <div style="font-weight: 600;">${allegato.nome_file}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">${new Date(allegato.created_at).toLocaleDateString('it-IT')} - ${allegato.caricato_da}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-icon-small" onclick="visualizzaPDF('${allegato.url_file}')" title="Visualizza">
                        <span class="material-symbols-rounded">visibility</span>
                    </button>
                    <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaAllegato('${allegato.id}')" title="Elimina">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function uploadAllegato() {
    const fileInput = document.getElementById('file-allegato-upload');
    const file = fileInput.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        mostraNotifica('Solo file PDF sono accettati', 'errore');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        mostraNotifica('File troppo grande (max 5MB)', 'errore');
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        const utente = authGetUtente();
        
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `lavoro_${lavoroCorrenteId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
            .from('lavori_allegati')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
            .from('lavori_allegati')
            .getPublicUrl(filePath);
        
        const { error: dbError } = await supabase
            .from('allegati')
            .insert([{
                lavoro_id: lavoroCorrenteId,
                nome_file: file.name,
                url_file: urlData.publicUrl,
                caricato_da: utente?.nome_completo || 'Admin'
            }]);
        
        if (dbError) throw dbError;
        
        mostraNotifica('File caricato con successo', 'successo');
        fileInput.value = '';
        await caricaAllegati(lavoroCorrenteId);
        
    } catch (error) {
        console.error('❌ Errore upload:', error);
        mostraNotifica('Errore nel caricamento', 'errore');
    }
}

async function eliminaAllegato(id) {
    if (!confirm('Eliminare definitivamente questo allegato?')) return;
    
    try {
        const supabase = getSupabaseClient();
        const allegato = allegatiList.find(a => a.id == id);
        if (!allegato) return;
        
        const fileName = allegato.url_file.split('/').pop();
        const filePath = `lavoro_${lavoroCorrenteId}/${fileName}`;
        
        await supabase.storage
            .from('lavori_allegati')
            .remove([filePath]);
        
        const { error } = await supabase
            .from('allegati')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Allegato eliminato', 'successo');
        await caricaAllegati(lavoroCorrenteId);
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
    }
}

function visualizzaPDF(url) {
    document.getElementById('pdf-frame').src = url;
    document.getElementById('pdf-viewer-modal').style.display = 'flex';
}

function chiudiPDF() {
    document.getElementById('pdf-viewer-modal').style.display = 'none';
    document.getElementById('pdf-frame').src = '';
}

function chiudiModaleAllegati() {
    document.getElementById('modal-allegati-lavoro').style.display = 'none';
}

// ============================================
// MODALE DETTAGLIO LAVORO (VERSIONE GRANDE)
// ============================================

async function apriDettaglioLavoroAdmin(id) {
    const lavoro = lavoriListAdmin.find(l => l.id == id);
    if (!lavoro) return;
    
    const prioritaColore = lavoro.priorita === 'ALTA' ? '#ef4444' : '#3b82f6';
    const badgeStato = getBadgeStato(lavoro.stato);
    const badgeTipo = getBadgeTipo(lavoro.tipo_lavoro);
    const impianto = impiantiList.find(i => i.impianto === lavoro.impianto_id);
    
    // Carica allegati e note per il dettaglio
    const supabase = getSupabaseClient();
    const [allegatiRes, noteRes] = await Promise.all([
        supabase.from('allegati').select('*').eq('lavoro_id', id),
        supabase.from('note_lavorazione').select('*').eq('lavoro_id', id).order('created_at', { ascending: false })
    ]);
    
    const allegati = allegatiRes.data || [];
    const note = noteRes.data || [];
    
    let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- COLONNA SINISTRA - INFO LAVORO -->
            <div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                <span style="font-size: 1.5rem; font-weight: 800;">${lavoro.impianto_id}</span>
                                <span style="background: ${badgeTipo.colore}20; color: ${badgeTipo.colore}; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                                    ${badgeTipo.testo}
                                </span>
                            </div>
                            <div style="font-size: 0.9rem; color: #64748b;">
                                ${impianto ? `${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}` : 
                                '<span style="color: #ef4444;">IMPIANTO NON PRESENTE NEL PARCO</span>'}
                            </div>
                        </div>
                        <span style="background: ${badgeStato.colore}20; color: ${badgeStato.colore}; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 800;">
                            ${badgeStato.emoji} ${badgeStato.testo}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div><strong>Priorità:</strong> <span style="color: ${prioritaColore};">${lavoro.priorita}</span></div>
                        <div><strong>Tecnico:</strong> ${lavoro.tecnico_id}</div>
                        <div><strong>Apertura:</strong> ${new Date(lavoro.data_apertura).toLocaleDateString('it-IT')}</div>
                        <div><strong>Creato da:</strong> ${lavoro.created_by || '-'}</div>
                    </div>
                    
                    ${lavoro.note_lavoro ? `
                        <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 8px;">
                            <strong style="color: #856404;">📝 Note lavoro:</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #856404;">${lavoro.note_lavoro}</p>
                        </div>
                    ` : ''}
                </div>
                
                <!-- TIMELINE -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                    <h4 style="margin: 0 0 1rem 0;">📅 Timeline</h4>
                    ${getTimelineHTML(lavoro)}
                </div>
            </div>
            
            <!-- COLONNA DESTRA - ALLEGATI E NOTE -->
            <div>
                <!-- ALLEGATI -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">📎 Allegati (${allegati.length})</h4>
                        <button class="btn-icon-small" onclick="uploadAllegatoDaDettaglio()" title="Carica allegato">
                            <span class="material-symbols-rounded">upload</span>
                        </button>
                    </div>
                    
                    <div id="allegati-dettaglio-container" style="max-height: 200px; overflow-y: auto;">
                        ${allegati.length === 0 ? 
                            '<p style="color: #64748b; text-align: center;">Nessun allegato</p>' : 
                            allegati.map(a => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: white; border-radius: 8px; margin-bottom: 0.5rem;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span class="material-symbols-rounded" style="color: #ef4444;">picture_as_pdf</span>
                                        <span style="font-size: 0.85rem;">${a.nome_file}</span>
                                    </div>
                                    <div>
                                        <button class="btn-icon-small" onclick="visualizzaPDF('${a.url_file}')">
                                            <span class="material-symbols-rounded">visibility</span>
                                        </button>
                                        <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaAllegatoDaDettaglio('${a.id}')">
                                            <span class="material-symbols-rounded">delete</span>
                                        </button>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
                
                <!-- NOTE LAVORAZIONE -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">💬 Note lavorazione (${note.length})</h4>
                        <button class="btn-icon-small" onclick="apriNoteLavoroAdmin('${lavoro.id}')" title="Aggiungi nota">
                            <span class="material-symbols-rounded">note_add</span>
                        </button>
                    </div>
                    
                    <div id="note-dettaglio-container" style="max-height: 200px; overflow-y: auto;">
                        ${note.length === 0 ? 
                            '<p style="color: #64748b; text-align: center;">Nessuna nota</p>' : 
                            note.map(n => `
                                <div style="background: white; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem;">
                                    <div style="font-size: 0.9rem;">${n.nota}</div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                        <span style="font-size: 0.7rem; color: #64748b;">${n.tecnico_id} • ${new Date(n.created_at).toLocaleString('it-IT')}</span>
                                        <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaNotaAdmin('${n.id}')">
                                            <span class="material-symbols-rounded">delete</span>
                                        </button>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('dettaglio-lavoro-content').innerHTML = html;
    document.getElementById('modal-dettaglio-lavoro-admin').style.display = 'flex';
}

function chiudiModaleDettaglioLavoro() {
    document.getElementById('modal-dettaglio-lavoro-admin').style.display = 'none';
}

// Funzioni per gestire allegati dal dettaglio
function uploadAllegatoDaDettaglio() {
    document.getElementById('file-allegato-dettaglio').click();
}

async function eliminaAllegatoDaDettaglio(id) {
    await eliminaAllegato(id);
    if (lavoroCorrenteId) {
        apriDettaglioLavoroAdmin(lavoroCorrenteId);
    }
}

// ============================================
// MODALE NOTE LAVORAZIONE (VERSIONE GRANDE)
// ============================================

async function apriNoteLavoroAdmin(id) {
    lavoroNoteCorrenteId = id;
    await caricaNoteLavoroAdmin(id);
    document.getElementById('modal-note-lavoro-admin').style.display = 'flex';
}

async function caricaNoteLavoroAdmin(lavoroId) {
    try {
        const supabase = getSupabaseClient();
        const utente = authGetUtente();
        const isAdmin = utente?.ruolo === 'admin' || utente?.ruolo === 'supervisore';
        
        const { data, error } = await supabase
            .from('note_lavorazione')
            .select('*')
            .eq('lavoro_id', lavoroId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('note-lavoro-list');
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;">Nessuna nota presente</p>';
            return;
        }
        
        let html = '';
        data.forEach(nota => {
            html += `
                <div style="background: white; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.95rem; margin-bottom: 0.5rem;">${nota.nota}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.75rem; color: #64748b;">
                            <span class="material-symbols-rounded" style="font-size: 0.8rem;">person</span> ${nota.tecnico_id} • 
                            ${new Date(nota.created_at).toLocaleString('it-IT')}
                        </div>
                        ${isAdmin ? `
                            <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaNotaAdmin('${nota.id}')" title="Elimina nota">
                                <span class="material-symbols-rounded">delete</span>
                            </button>
                        ` : ''}
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

async function salvaNotaLavoroAdmin() {
    const nota = document.getElementById('nuova-nota-lavoro').value.trim();
    if (!nota) {
        mostraNotifica('Inserisci una nota', 'errore');
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        const utente = authGetUtente();
        
        const { error } = await supabase
            .from('note_lavorazione')
            .insert([{
                lavoro_id: lavoroNoteCorrenteId,
                tecnico_id: utente?.nome_completo || 'Admin',
                nota: nota
            }]);
        
        if (error) throw error;
        
        mostraNotifica('Nota salvata', 'successo');
        document.getElementById('nuova-nota-lavoro').value = '';
        await caricaNoteLavoroAdmin(lavoroNoteCorrenteId);
        
    } catch (error) {
        console.error('❌ Errore salvataggio nota:', error);
        mostraNotifica('Errore nel salvataggio', 'errore');
    }
}

async function eliminaNotaAdmin(notaId) {
    if (!confirm('Eliminare questa nota?')) return;
    
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('note_lavorazione')
            .delete()
            .eq('id', notaId);
        
        if (error) throw error;
        
        mostraNotifica('Nota eliminata', 'successo');
        await caricaNoteLavoroAdmin(lavoroNoteCorrenteId);
        
    } catch (error) {
        console.error('❌ Errore eliminazione nota:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
    }
}

function chiudiModaleNoteLavoro() {
    document.getElementById('modal-note-lavoro-admin').style.display = 'none';
    document.getElementById('nuova-nota-lavoro').value = '';
}

// ============================================
// MODALE NUOVO/MODIFICA LAVORO (CON INDIRIZZO)
// ============================================

function apriModaleNuovoLavoro() {
    document.getElementById('modal-lavoro-titolo').textContent = 'Nuovo Lavoro';
    document.getElementById('lavoro-id').value = '';
    document.getElementById('lavoro-impianto').value = '';
    document.getElementById('indirizzo-ricerca').innerHTML = '';
    document.getElementById('lavoro-tecnico').value = '';
    document.getElementById('lavoro-tipo').value = '';
    document.getElementById('lavoro-tipo-altro').value = '';
    document.getElementById('container-tipo-altro-admin').style.display = 'none';
    document.querySelector('input[name="lavoro-priorita"][value="ALTA"]').checked = true;
    document.getElementById('lavoro-note').value = '';
    
    document.getElementById('modal-lavoro-admin').style.display = 'flex';
}

function chiudiModaleLavoro() {
    document.getElementById('modal-lavoro-admin').style.display = 'none';
}

function gestisciTipoAltroAdmin() {
    const tipo = document.getElementById('lavoro-tipo').value;
    document.getElementById('container-tipo-altro-admin').style.display = tipo === 'Altro' ? 'block' : 'none';
}

async function cercaIndirizzoInModale() {
    const impiantoId = document.getElementById('lavoro-impianto').value.trim();
    if (!impiantoId) return;
    
    const impianto = impiantiList.find(i => i.impianto === impiantoId);
    const container = document.getElementById('indirizzo-ricerca');
    
    if (impianto) {
        container.innerHTML = `
            <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                <span class="material-symbols-rounded" style="color: #22c55e; vertical-align: middle;">check_circle</span>
                <span style="font-weight: 600; margin-left: 0.5rem;">Impianto trovato:</span>
                <div style="margin-top: 0.25rem; color: #1e293b;">
                    <strong>${impianto.Indirizzo || ''} ${impianto.localit || ''} ${impianto.prov || ''}</strong>
                </div>
               
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="background: #fef2f2; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                <span class="material-symbols-rounded" style="color: #ef4444; vertical-align: middle;">warning</span>
                <span style="font-weight: 600; margin-left: 0.5rem; color: #991b1b;">IMPIANTO NON PRESENTE NEL PARCO</span>
            </div>
        `;
    }
}

// ============================================
// MODALE CAMBIO STATO
// ============================================

function apriModaleCambioStato(id) {
    const lavoro = lavoriListAdmin.find(l => l.id == id);
    if (!lavoro) return;
    
    document.getElementById('cambio-stato-lavoro-id').value = id;
    document.getElementById('cambio-stato-impianto').textContent = lavoro.impianto_id;
    document.getElementById('cambio-stato-attuale').innerHTML = `
        <span style="background: ${getBadgeStato(lavoro.stato).colore}20; color: ${getBadgeStato(lavoro.stato).colore}; padding: 0.25rem 0.5rem; border-radius: 12px;">
            ${lavoro.stato}
        </span>
    `;
    
    // Genera opzioni disponibili in base allo stato attuale
    const select = document.getElementById('cambio-stato-select');
    select.innerHTML = '';
    
    const statiDisponibili = getStatiDisponibili(lavoro.stato);
    
    statiDisponibili.forEach(stato => {
        const badge = getBadgeStato(stato);
        const option = document.createElement('option');
        option.value = stato;
        option.innerHTML = `${badge.emoji} ${stato}`;
        select.appendChild(option);
    });
    
    document.getElementById('modal-cambio-stato').style.display = 'flex';
}

function getStatiDisponibili(statoCorrente) {
    // Stati disponibili per admin/supervisori
    const tuttiStati = ['Aperto', 'Accettata', 'Lavorazione', 'Sospesa', 'Chiusa', 'Terminata'];
    
    switch(statoCorrente) {
        case 'Aperto':
            return ['Accettata', 'Sospesa', 'Chiusa']; // Puoi saltare a stati avanzati
        case 'Accettata':
            return ['Lavorazione', 'Sospesa', 'Chiusa'];
        case 'Lavorazione':
            return ['Sospesa', 'Chiusa'];
        case 'Sospesa':
            return ['Lavorazione', 'Chiusa'];
        case 'Chiusa':
            return ['Terminata']; // Solo terminata è disponibile
        case 'Terminata':
            return []; // Non si può più cambiare
        default:
            return [];
    }
}

function chiudiModaleCambioStato() {
    document.getElementById('modal-cambio-stato').style.display = 'none';
    document.getElementById('cambio-stato-note').value = '';
}

async function confermaCambioStato() {
    const id = document.getElementById('cambio-stato-lavoro-id').value;
    const nuovoStato = document.getElementById('cambio-stato-select').value;
    const note = document.getElementById('cambio-stato-note').value.trim();
    
    if (!nuovoStato) {
        mostraNotifica('Seleziona un nuovo stato', 'errore');
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        const utente = authGetUtente();
        
        const campoData = `data_${nuovoStato.toLowerCase()}`;
        const updateData = { 
            stato: nuovoStato,
            [campoData]: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('lavori')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
        
        // Se ci sono note, aggiungile come nota di lavorazione
        if (note) {
            await supabase
                .from('note_lavorazione')
                .insert([{
                    lavoro_id: id,
                    tecnico_id: utente?.nome_completo || 'Admin',
                    nota: `🔁 Cambio stato a ${nuovoStato}: ${note}`
                }]);
        }
        
        mostraNotifica(`Stato aggiornato a ${nuovoStato}`, 'successo');
        chiudiModaleCambioStato();
        await caricaLavoriAdmin();
        
    } catch (error) {
        console.error('❌ Errore cambio stato:', error);
        mostraNotifica('Errore nel cambio stato', 'errore');
    }
}


function apriModaleAllegatiDaNuovo() {
    const impiantoId = document.getElementById('lavoro-impianto').value.trim();
    if (!impiantoId) return;
    
    // Qui potresti creare un lavoro temporaneo o usare un ID placeholder
    // Per ora, mostriamo il modale allegati con un avviso
    alert('Il lavoro deve prima essere salvato per poter aggiungere allegati');
}

async function modificaLavoroAdmin(id) {
    const lavoro = lavoriListAdmin.find(l => l.id == id);
    if (!lavoro) return;
    
    document.getElementById('modal-lavoro-titolo').textContent = 'Modifica Lavoro';
    document.getElementById('lavoro-id').value = id;
    document.getElementById('lavoro-impianto').value = lavoro.impianto_id;
    
    // Mostra indirizzo impianto
    await cercaIndirizzoInModale();
    
    document.getElementById('lavoro-tecnico').value = lavoro.tecnico_id;
    document.getElementById('lavoro-tipo').value = lavoro.tipo_lavoro;
    
    if (lavoro.tipo_lavoro === 'Altro') {
        document.getElementById('container-tipo-altro-admin').style.display = 'block';
        document.getElementById('lavoro-tipo-altro').value = lavoro.tipo_altro_testo || '';
    } else {
        document.getElementById('container-tipo-altro-admin').style.display = 'none';
    }
    
    document.querySelector(`input[name="lavoro-priorita"][value="${lavoro.priorita}"]`).checked = true;
    document.getElementById('lavoro-note').value = lavoro.note_lavoro || '';
    
    document.getElementById('modal-lavoro-admin').style.display = 'flex';
}

async function salvaLavoroAdmin() {
    const id = document.getElementById('lavoro-id').value;
    const impianto = document.getElementById('lavoro-impianto').value.trim();
    const tecnico = document.getElementById('lavoro-tecnico').value;
    const tipo = document.getElementById('lavoro-tipo').value;
    const tipoAltro = document.getElementById('lavoro-tipo-altro').value.trim();
    const priorita = document.querySelector('input[name="lavoro-priorita"]:checked').value;
    const note = document.getElementById('lavoro-note').value.trim();
    
    if (!impianto || !tecnico || !tipo) {
        mostraNotifica('Compila tutti i campi obbligatori', 'errore');
        return;
    }
    
    if (tipo === 'Altro' && !tipoAltro) {
        mostraNotifica('Specifica il tipo di lavoro', 'errore');
        return;
    }
    
    const supabase = getSupabaseClient();
    const utente = authGetUtente();
    
    const datiLavoro = {
        impianto_id: impianto,
        tecnico_id: tecnico,
        tipo_lavoro: tipo,
        tipo_altro_testo: tipo === 'Altro' ? tipoAltro : null,
        priorita: priorita,
        note_lavoro: note || null,
        created_by: utente?.nome_completo || 'Admin'
    };
    
    try {
        if (id) {
            // Modifica
            const { error } = await supabase
                .from('lavori')
                .update(datiLavoro)
                .eq('id', id);
            if (error) throw error;
            mostraNotifica('Lavoro aggiornato', 'successo');
        } else {
            // Nuovo
            const { error } = await supabase
                .from('lavori')
                .insert([{
                    ...datiLavoro,
                    stato: 'Aperto',
                    data_apertura: new Date().toISOString()
                }]);
            if (error) throw error;
            mostraNotifica('Lavoro creato', 'successo');
        }
        
        chiudiModaleLavoro();
        await caricaLavoriAdmin();
        
    } catch (error) {
        console.error('Errore:', error);
        mostraNotifica('Errore nel salvataggio', 'errore');
    }
}

// ============================================
// ALTRE FUNZIONI CRUD
// ============================================

async function eliminaLavoroAdmin(id) {
    if (!confirm('Eliminare definitivamente questo lavoro?\nTutti gli allegati e le note verranno eliminati.')) return;
    
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('lavori')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Lavoro eliminato', 'successo');
        await caricaLavoriAdmin();
        
    } catch (error) {
        console.error('Errore:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
    }
}

async function terminaLavoroAdmin(id) {
    if (!confirm('Confermi la terminazione di questo lavoro?')) return;
    
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('lavori')
            .update({ 
                stato: 'Terminata',
                data_terminata: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Lavoro terminato', 'successo');
        await caricaLavoriAdmin();
        
    } catch (error) {
        console.error('Errore:', error);
        mostraNotifica('Errore nella terminazione', 'errore');
    }
}

// Aggiungi event listener per drag & drop allegati
function setupDragDropAllegati() {
    const dropZone = document.getElementById('drop-zone-allegati');
    const fileInput = document.getElementById('file-allegato-upload');
    
    if (!dropZone || !fileInput) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    });
}

// Chiama la funzione dopo il caricamento del DOM
document.addEventListener('DOMContentLoaded', function() {
    setupDragDropAllegati();
});


function getTimelineHTML(lavoro) {
    const stati = ['Aperto', 'Accettata', 'Lavorazione', 'Sospesa', 'Chiusa', 'Terminata'];
    let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
    
    stati.forEach(stato => {
        const data = lavoro[`data_${stato.toLowerCase()}`];
        if (data) {
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded" style="color: #22c55e;">check_circle</span>
                    <span><strong>${stato}:</strong> ${new Date(data).toLocaleDateString('it-IT')}</span>
                </div>
            `;
        } else if (lavoro.stato === stato) {
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded" style="color: var(--primary);">pending</span>
                    <span><strong>${stato}:</strong> In corso</span>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Event listeners per filtri
    document.getElementById('filtro-ricerca-lavori')?.addEventListener('input', function() {
        ricercaTesto = this.value;
        caricaLavoriAdmin();
    });
    
    document.getElementById('filtro-stato-lavori')?.addEventListener('change', function() {
        filtroStato = this.value;
        caricaLavoriAdmin();
    });
    
    document.getElementById('filtro-tecnico-lavori')?.addEventListener('change', function() {
        filtroTecnico = this.value;
        caricaLavoriAdmin();
    });
    
    document.getElementById('filtro-priorita-lavori')?.addEventListener('change', function() {
        filtroPriorita = this.value;
        caricaLavoriAdmin();
    });
    
    document.getElementById('lavoro-impianto')?.addEventListener('input', function() {
        cercaIndirizzoInModale();
    });
    
    document.getElementById('file-allegato-upload')?.addEventListener('change', uploadAllegato);
    document.getElementById('file-allegato-dettaglio')?.addEventListener('change', uploadAllegato);
    
    // Carica dati iniziali
    caricaImpianti();
    caricaTecniciAdmin();
    caricaLavoriAdmin();
});

// ✅ ESPORTA FUNZIONI
window.caricaLavoriAdmin = caricaLavoriAdmin;
window.caricaTecniciAdmin = caricaTecniciAdmin;
window.apriModaleNuovoLavoro = apriModaleNuovoLavoro;
window.chiudiModaleLavoro = chiudiModaleLavoro;
window.gestisciTipoAltroAdmin = gestisciTipoAltroAdmin;
window.modificaLavoroAdmin = modificaLavoroAdmin;
window.salvaLavoroAdmin = salvaLavoroAdmin;
window.eliminaLavoroAdmin = eliminaLavoroAdmin;
window.terminaLavoroAdmin = terminaLavoroAdmin;
window.apriDettaglioLavoroAdmin = apriDettaglioLavoroAdmin;
window.chiudiModaleDettaglioLavoro = chiudiModaleDettaglioLavoro;
window.apriNoteLavoroAdmin = apriNoteLavoroAdmin;
window.chiudiModaleNoteLavoro = chiudiModaleNoteLavoro;
window.salvaNotaLavoroAdmin = salvaNotaLavoroAdmin;
window.eliminaNotaAdmin = eliminaNotaAdmin;
window.apriModaleAllegati = apriModaleAllegati;
window.chiudiModaleAllegati = chiudiModaleAllegati;
window.visualizzaPDF = visualizzaPDF;
window.chiudiPDF = chiudiPDF;
window.uploadAllegatoDaDettaglio = uploadAllegatoDaDettaglio;
window.eliminaAllegatoDaDettaglio = eliminaAllegatoDaDettaglio;
window.cercaIndirizzoInModale = cercaIndirizzoInModale;
// Alla fine del file, aggiungi:
window.apriModaleCambioStato = apriModaleCambioStato;
window.chiudiModaleCambioStato = chiudiModaleCambioStato;
window.confermaCambioStato = confermaCambioStato;