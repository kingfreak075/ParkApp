// ============================================
// ADMIN ANNOTAZIONI - FLOX ADMIN
// GESTIONE CENTRALIZZATA ANNOTAZIONI IMPIANTI
// ============================================

// Variabili globali
let annotazioniList = [];
let annotazioniFiltrate = [];
let annotazioniSelezionate = new Set();
let annotazioneDaCancellare = null;
let tipiMapping = {
    '0': { testo: 'Manutenzione', icona: 'build', colore: '#3B82F6', bg: '#EFF6FF' },
    '1': { testo: 'Appuntamento', icona: 'calendar_today', colore: '#10B981', bg: '#D1FAE5' },
    '2': { testo: 'Nota', icona: 'note', colore: '#8B5CF6', bg: '#EDE9FE' }
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inizializzazione Admin Annotazioni...');
    
    // Imposta data di default a oggi per i filtri
    const oggi = new Date().toISOString().split('T')[0];
    const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (document.getElementById('filtro-data-da')) {
        document.getElementById('filtro-data-da').value = trentaGiorniFa;
    }
    if (document.getElementById('filtro-data-a')) {
        document.getElementById('filtro-data-a').value = oggi;
    }
    
    console.log('✅ Admin Annotazioni inizializzato');
});

// ============================================
// CARICAMENTO DATI
// ============================================

async function caricaAnnotazioniAdmin() {
    try {
        console.log('📥 Caricamento annotazioni...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data, error } = await supabase
            .from('annotazioni')
            .select('*')
            .order('anno_ann', { ascending: false })
            .order('mese_ann', { ascending: false })
            .order('giorno_ann', { ascending: false });
        
        if (error) throw error;
        
        annotazioniList = data || [];
        annotazioniFiltrate = [...annotazioniList];
        
        console.log(`✅ Caricate ${annotazioniList.length} annotazioni`);
        
        // Aggiorna datalist impianti
        aggiornaDatalistImpianti();
        
        // Aggiorna UI
        aggiornaStatisticheAnnotazioni();
        renderizzaTabellaAnnotazioni();
        
    } catch (error) {
        console.error('❌ Errore caricamento annotazioni:', error);
        mostraNotificaAdmin('Errore nel caricamento delle annotazioni', 'error');
    }
}

async function aggiornaDatalistImpianti() {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('Parco_app')
            .select('impianto')
            .order('impianto', { ascending: true });
        
        if (error) throw error;
        
        const impiantiList = data || [];
        
        // Popola datalist per filtri
        const datalistFiltri = document.getElementById('impianti-annotazioni-list');
        let htmlFiltri = '';
        impiantiList.forEach(imp => {
            htmlFiltri += `<option value="${imp.impianto}">`;
        });
        datalistFiltri.innerHTML = htmlFiltri;
        
        // Popola datalist per modal
        const datalistModal = document.getElementById('impianti-annotazioni-modal-list');
        let htmlModal = '';
        impiantiList.forEach(imp => {
            htmlModal += `<option value="${imp.impianto}">`;
        });
        datalistModal.innerHTML = htmlModal;
        
    } catch (error) {
        console.error('❌ Errore caricamento impianti:', error);
    }
}

// ============================================
// STATISTICHE
// ============================================

function aggiornaStatisticheAnnotazioni() {
    let totale = annotazioniList.length;
    let manutenzioni = annotazioniList.filter(a => a.tipo === '0').length;
    let appuntamenti = annotazioniList.filter(a => a.tipo === '1').length;
    let note = annotazioniList.filter(a => a.tipo === '2').length;
    
    document.getElementById('stat-totale').textContent = totale;
    document.getElementById('stat-manutenzioni').textContent = manutenzioni;
    document.getElementById('stat-appuntamenti').textContent = appuntamenti;
    document.getElementById('stat-note').textContent = note;
}

// ============================================
// FILTRI
// ============================================

function filtraAnnotazioniAdmin() {
    const testo = document.getElementById('filtro-testo-annotazioni').value.toLowerCase();
    const tipo = document.getElementById('filtro-tipo-annotazioni').value;
    const dataDa = document.getElementById('filtro-data-da').value;
    const dataA = document.getElementById('filtro-data-a').value;
    const impianto = document.getElementById('filtro-impianto-annotazioni').value.toLowerCase();
    
    annotazioniFiltrate = annotazioniList.filter(ann => {
        // Filtro testo nelle note
        const matchesTesto = testo === '' || 
            (ann.note && ann.note.toLowerCase().includes(testo));
        
        // Filtro tipo
        const matchesTipo = tipo === 'tutti' || ann.tipo === tipo;
        
        // Filtro impianto
        const matchesImpianto = impianto === '' || 
            (ann.impianto_ann && ann.impianto_ann.toLowerCase().includes(impianto));
        
        // Filtro data
        let matchesData = true;
        if (dataDa || dataA) {
            const dataAnn = `${ann.anno_ann}-${ann.mese_ann.padStart(2,'0')}-${ann.giorno_ann.padStart(2,'0')}`;
            
            if (dataDa && dataA) {
                matchesData = dataAnn >= dataDa && dataAnn <= dataA;
            } else if (dataDa) {
                matchesData = dataAnn >= dataDa;
            } else if (dataA) {
                matchesData = dataAnn <= dataA;
            }
        }
        
        return matchesTesto && matchesTipo && matchesImpianto && matchesData;
    });
    
    renderizzaTabellaAnnotazioni();
}

// ============================================
// RENDERING TABELLA
// ============================================

function renderizzaTabellaAnnotazioni() {
    const tbody = document.getElementById('tabella-annotazioni-body');
    
    if (annotazioniFiltrate.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div style="padding: 3rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded">info</span>
                        <p>Nessuna annotazione trovata</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    annotazioniFiltrate.forEach((ann, index) => {
        const selezionato = annotazioniSelezionate.has(ann.id) ? 'checked' : '';
        const dataFormattata = `${ann.giorno_ann.padStart(2,'0')}/${ann.mese_ann.padStart(2,'0')}/${ann.anno_ann}`;
        const tipo = tipiMapping[ann.tipo] || tipiMapping['2'];
        
        // Preview note (prime 100 caratteri)
        const notePreview = ann.note ? 
            (ann.note.length > 100 ? ann.note.substring(0, 100) + '...' : ann.note) : 
            '<span style="color: #94a3b8; font-style: italic;">Nessuna nota</span>';
        
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="select-annotazione" value="${ann.id}" ${selezionato} onchange="toggleSelezionaAnnotazione('${ann.id}')">
                </td>
                <td><span style="font-weight: 600;">${dataFormattata}</span></td>
                <td>
                    <a href="#" onclick="filtraPerImpianto('${ann.impianto_ann}')" style="color: var(--primary); text-decoration: none; font-weight: 600;">
                        ${ann.impianto_ann}
                    </a>
                </td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 20px; background: ${tipo.bg}; color: ${tipo.colore}; font-size: 0.8rem; font-weight: 600;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">${tipo.icona}</span>
                        ${tipo.testo}
                    </span>
                </td>
                <td style="max-width: 300px;">
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;" 
                         title="${ann.note || ''}">
                        ${notePreview}
                    </div>
                </td>
                <td>${ann.tecnico_ann || 'N/D'}</td>
                <td>
                    <button class="btn-icon-small" onclick="mostraModalModificaAnnotazioneAdmin('${ann.id}')" title="Modifica">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-icon-small" onclick="mostraConfermaCancellazioneAnn('${ann.id}')" title="Elimina">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Aggiorna checkbox "seleziona tutti"
    aggiornaCheckboxSelezionaTutti();
}

function aggiornaCheckboxSelezionaTutti() {
    const selectAll = document.getElementById('select-all-annotazioni');
    if (!selectAll) return;
    
    const tuttiSelezionati = annotazioniFiltrate.length > 0 && 
        annotazioniFiltrate.every(ann => annotazioniSelezionate.has(ann.id));
    const alcuniSelezionati = annotazioniFiltrate.some(ann => annotazioniSelezionate.has(ann.id));
    
    selectAll.checked = tuttiSelezionati;
    selectAll.indeterminate = alcuniSelezionati && !tuttiSelezionati;
}

function filtraPerImpianto(impianto) {
    document.getElementById('filtro-impianto-annotazioni').value = impianto;
    filtraAnnotazioniAdmin();
}

// ============================================
// SELEZIONE MULTIPLA
// ============================================

function selezionaTutteAnnotazioni() {
    const selectAll = document.getElementById('select-all-annotazioni');
    const checkboxes = document.querySelectorAll('.select-annotazione');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            annotazioniSelezionate.add(cb.value);
        } else {
            annotazioniSelezionate.delete(cb.value);
        }
    });
}

function toggleSelezionaAnnotazione(id) {
    if (annotazioniSelezionate.has(id)) {
        annotazioniSelezionate.delete(id);
    } else {
        annotazioniSelezionate.add(id);
    }
    
    aggiornaCheckboxSelezionaTutti();
}

// ============================================
// CRUD OPERATIONS
// ============================================

function mostraModalNuovaAnnotazioneAdmin() {
    document.getElementById('modal-annotazione-titolo').textContent = 'Nuova Annotazione';
    document.getElementById('ann-id').value = '';
    document.getElementById('ann-impianto').value = '';
    document.getElementById('ann-impianto').disabled = false;
    document.getElementById('ann-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('ann-note').value = '';
    document.getElementById('ann-tecnico').value = 'Admin';
    
    // Reset tipo
    document.getElementById('ann-tipo').value = '';
    document.querySelectorAll('.btn-tipo-opzione[data-tipo-admin]').forEach(btn => {
        btn.classList.remove('selezionato');
    });
    
    // Nascondi validazione
    document.getElementById('ann-validazione-note').style.display = 'none';
    document.getElementById('ann-note').placeholder = 'Seleziona un tipo...';
    
    document.getElementById('modal-annotazione-admin').style.display = 'flex';
}

async function mostraModalModificaAnnotazioneAdmin(id) {
    try {
        console.log('🔍 Cerco annotazione con ID:', id);
        
        // Prova a trovare nell'array locale
        let annotazione = annotazioniList.find(a => a.id === id);
        
        // Se non trovata, cerca nel DB direttamente
        if (!annotazione) {
            console.log('⚠️ Annotazione non trovata in cache, cerco nel DB...');
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error('DB non configurato');
            
            const { data, error } = await supabase
                .from('annotazioni')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                console.error('❌ Errore DB:', error);
                throw new Error('Annotazione non trovata nel database');
            }
            
            annotazione = data;
            console.log('✅ Annotazione trovata nel DB:', annotazione);
        }
        
        // Popola il form
        document.getElementById('modal-annotazione-titolo').textContent = 'Modifica Annotazione';
        document.getElementById('ann-id').value = annotazione.id;
        document.getElementById('ann-impianto').value = annotazione.impianto_ann;
        document.getElementById('ann-impianto').disabled = true; // Non modificabile
        
        // Data
        const dataFormattata = `${annotazione.anno_ann}-${annotazione.mese_ann.padStart(2,'0')}-${annotazione.giorno_ann.padStart(2,'0')}`;
        document.getElementById('ann-data').value = dataFormattata;
        
        // Tipo
        selezionaTipoAdmin(annotazione.tipo);
        
        // Note
        document.getElementById('ann-note').value = annotazione.note || '';
        
        // Tecnico
        document.getElementById('ann-tecnico').value = annotazione.tecnico_ann || 'Admin';
        
        // Mostra modal
        document.getElementById('modal-annotazione-admin').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore caricamento annotazione:', error);
        mostraNotificaAdmin('Errore nel caricamento dei dati: ' + error.message, 'error');
    }
}
function chiudiModalAnnotazioneAdmin() {
    document.getElementById('modal-annotazione-admin').style.display = 'none';
}

function selezionaTipoAdmin(tipo) {
    const tipoSelezionato = document.getElementById('ann-tipo');
    
    // Rimuovi selezione precedente
    document.querySelectorAll('.btn-tipo-opzione[data-tipo-admin]').forEach(btn => {
        btn.classList.remove('selezionato');
    });
    
    // Aggiungi selezione corrente
    const btnTipo = document.querySelector(`.btn-tipo-opzione[data-tipo-admin="${tipo}"]`);
    if (btnTipo) {
        btnTipo.classList.add('selezionato');
    }
    
    tipoSelezionato.value = tipo;
    
    // Aggiorna placeholder e validazione
    const textarea = document.getElementById('ann-note');
    const validazioneDiv = document.getElementById('ann-validazione-note');
    const testoValidazione = document.getElementById('ann-testo-validazione');
    const labelNote = document.getElementById('ann-note-label');
    
    switch(tipo) {
        case '0':
            textarea.placeholder = 'Descrizione della manutenzione effettuata (facoltativo)...';
            testoValidazione.textContent = 'Le note sono facoltative per le manutenzioni';
            validazioneDiv.style.color = '#64748b';
            validazioneDiv.style.display = 'block';
            labelNote.textContent = 'Note (facoltative)';
            break;
        case '1':
            textarea.placeholder = 'Dettagli dell\'appuntamento (facoltativo)...';
            testoValidazione.textContent = 'Le note sono facoltative per gli appuntamenti';
            validazioneDiv.style.color = '#64748b';
            validazioneDiv.style.display = 'block';
            labelNote.textContent = 'Note (facoltative)';
            break;
        case '2':
            textarea.placeholder = 'Testo della nota informativa (obbligatorio)...';
            testoValidazione.textContent = 'Le note sono obbligatorie per le note informative';
            validazioneDiv.style.color = '#dc2626';
            validazioneDiv.style.display = 'block';
            labelNote.textContent = 'Note *';
            break;
    }
}

async function salvaAnnotazioneAdmin() {
    const id = document.getElementById('ann-id').value;
    const impianto = document.getElementById('ann-impianto').value.trim();
    const tipo = document.getElementById('ann-tipo').value;
    const dataInput = document.getElementById('ann-data').value;
    const note = document.getElementById('ann-note').value.trim();
    const tecnico = document.getElementById('ann-tecnico').value.trim() || 'Admin';
    
    // Validazioni
    if (!impianto) {
        mostraNotificaAdmin('Seleziona un impianto', 'error');
        return;
    }
    
    if (!tipo) {
        mostraNotificaAdmin('Seleziona un tipo di annotazione', 'error');
        return;
    }
    
    if (!dataInput) {
        mostraNotificaAdmin('Inserisci una data', 'error');
        return;
    }
    
    if (tipo === '2' && !note) {
        mostraNotificaAdmin('Per le note è obbligatorio inserire del testo', 'error');
        return;
    }
    
    // Disabilita pulsante
    const btnSalva = document.getElementById('btn-salva-annotazione-admin');
    btnSalva.disabled = true;
    btnSalva.innerHTML = '<span class="material-symbols-rounded">progress_activity</span> Salvataggio...';
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // Parse data
        const data = new Date(dataInput);
        const giorno = data.getDate().toString();
        const mese = (data.getMonth() + 1).toString();
        const anno = data.getFullYear().toString();
        
        // Formatta data per Parco_app (DD/MM/YYYY)
        const dataFormattata = `${giorno.padStart(2, '0')}/${mese.padStart(2, '0')}/${anno}`;
        
        if (id) {
            // MODIFICA
            const { error } = await supabase
                .from('annotazioni')
                .update({
                    giorno_ann: giorno,
                    mese_ann: mese,
                    anno_ann: anno,
                    tipo: tipo,
                    note: note || null
                })
                .eq('id', id);
            
            if (error) throw error;
            
            mostraNotificaAdmin('Annotazione aggiornata con successo', 'success');
            
        } else {
            // NUOVA
            const { data: nuovaAnnotazione, error } = await supabase
                .from('annotazioni')
                .insert([{
                    impianto_ann: impianto,
                    giorno_ann: giorno,
                    mese_ann: mese,
                    anno_ann: anno,
                    tecnico_ann: tecnico,
                    tipo: tipo,
                    note: note || null
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Se tipo = 0, aggiorna Parco_app
            if (tipo === '0') {
                console.log('🚀 Aggiornamento Parco_app per impianto:', impianto, 'Data:', dataFormattata);
                
                const { error: updateError } = await supabase
                    .from('Parco_app')
                    .update({ ult_sem: dataFormattata })
                    .eq('impianto', impianto);
                
                if (updateError) {
                    console.error('❌ Errore aggiornamento Parco_app:', updateError);
                } else {
                    console.log('✅ Parco_app aggiornato');
                }
            }
            
            mostraNotificaAdmin('Annotazione salvata con successo', 'success');
        }
        
        chiudiModalAnnotazioneAdmin();
        await caricaAnnotazioniAdmin();
        
    } catch (error) {
        console.error('❌ Errore salvataggio annotazione:', error);
        mostraNotificaAdmin(`Errore: ${error.message}`, 'error');
    } finally {
        btnSalva.disabled = false;
        btnSalva.textContent = 'Salva Annotazione';
    }
}

// ============================================
// CANCELLAZIONE
// ============================================

function mostraConfermaCancellazioneAnn(id) {
    annotazioneDaCancellare = id;
    document.getElementById('modal-conferma-cancellazione-ann').style.display = 'flex';
}

function chiudiModalCancellazioneAnn() {
    annotazioneDaCancellare = null;
    document.getElementById('modal-conferma-cancellazione-ann').style.display = 'none';
}

async function confermaCancellazioneAnn() {
    if (!annotazioneDaCancellare) return;
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('annotazioni')
            .delete()
            .eq('id', annotazioneDaCancellare);
        
        if (error) throw error;
        
        // Rimuovi dalla lista locale
        annotazioniList = annotazioniList.filter(a => a.id !== annotazioneDaCancellare);
        annotazioniSelezionate.delete(annotazioneDaCancellare);
        
        chiudiModalCancellazioneAnn();
        aggiornaStatisticheAnnotazioni();
        filtraAnnotazioniAdmin(); // Riapplica filtri
        
        mostraNotificaAdmin('Annotazione cancellata', 'success');
        
    } catch (error) {
        console.error('❌ Errore cancellazione:', error);
        mostraNotificaAdmin(`Errore: ${error.message}`, 'error');
    }
}

async function eliminaSelezionateAnnotazioni() {
    if (annotazioniSelezionate.size === 0) {
        mostraNotificaAdmin('Nessuna annotazione selezionata', 'warning');
        return;
    }
    
    if (!confirm(`Eliminare ${annotazioniSelezionate.size} annotazioni selezionate?`)) {
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const ids = Array.from(annotazioniSelezionate);
        
        const { error } = await supabase
            .from('annotazioni')
            .delete()
            .in('id', ids);
        
        if (error) throw error;
        
        mostraNotificaAdmin(`${annotazioniSelezionate.size} annotazioni eliminate`, 'success');
        annotazioniSelezionate.clear();
        await caricaAnnotazioniAdmin();
        
    } catch (error) {
        console.error('❌ Errore eliminazione multipla:', error);
        mostraNotificaAdmin(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// EXPORT CSV
// ============================================

function esportaCSVAnnotazioni() {
    try {
        if (annotazioniFiltrate.length === 0) {
            mostraNotificaAdmin('Nessuna annotazione da esportare', 'warning');
            return;
        }
        
        const header = ['Data', 'Impianto', 'Tipo', 'Note', 'Tecnico'];
        let csvContent = header.join(';') + '\n';
        
        annotazioniFiltrate.forEach(ann => {
            const data = `${ann.giorno_ann.padStart(2,'0')}/${ann.mese_ann.padStart(2,'0')}/${ann.anno_ann}`;
            const tipo = tipiMapping[ann.tipo]?.testo || 'Sconosciuto';
            const note = (ann.note || '').replace(/;/g, ',').replace(/\n/g, ' ');
            
            const riga = [
                data,
                ann.impianto_ann,
                tipo,
                note,
                ann.tecnico_ann || ''
            ];
            
            csvContent += riga.join(';') + '\n';
        });
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `Annotazioni_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        mostraNotificaAdmin(`Esportate ${annotazioniFiltrate.length} annotazioni`, 'success');
        
    } catch (error) {
        console.error('❌ Errore export CSV:', error);
        mostraNotificaAdmin('Errore nell\'esportazione', 'error');
    }
}

// ============================================
// NOTIFICHE
// ============================================

function mostraNotificaAdmin(messaggio, tipo = 'info') {
    // Usa la funzione esistente o creane una
    if (typeof mostraNotifica === 'function') {
        mostraNotifica(messaggio, tipo);
    } else {
        alert(messaggio);
    }
}

// Esponi funzioni globali
window.caricaAnnotazioniAdmin = caricaAnnotazioniAdmin;
window.filtraAnnotazioniAdmin = filtraAnnotazioniAdmin;
window.filtraPerImpianto = filtraPerImpianto;
window.selezionaTutteAnnotazioni = selezionaTutteAnnotazioni;
window.toggleSelezionaAnnotazione = toggleSelezionaAnnotazione;
window.mostraModalNuovaAnnotazioneAdmin = mostraModalNuovaAnnotazioneAdmin;
window.mostraModalModificaAnnotazioneAdmin = mostraModalModificaAnnotazioneAdmin;
window.chiudiModalAnnotazioneAdmin = chiudiModalAnnotazioneAdmin;
window.selezionaTipoAdmin = selezionaTipoAdmin;
window.salvaAnnotazioneAdmin = salvaAnnotazioneAdmin;
window.mostraConfermaCancellazioneAnn = mostraConfermaCancellazioneAnn;
window.chiudiModalCancellazioneAnn = chiudiModalCancellazioneAnn;
window.confermaCancellazioneAnn = confermaCancellazioneAnn;
window.eliminaSelezionateAnnotazioni = eliminaSelezionateAnnotazioni;
window.esportaCSVAnnotazioni = esportaCSVAnnotazioni;

// Carica dati all'avvio
setTimeout(() => {
    if (document.getElementById('tab-annotazioni').classList.contains('active')) {
        caricaAnnotazioniAdmin();
    }
}, 500);

console.log('✅ Admin Annotazioni JS caricato');