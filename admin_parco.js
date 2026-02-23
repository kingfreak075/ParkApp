// ============================================
// ADMIN PARCO IMPIANTI - PARKAPP
// GESTIONE COMPLETA PARCO ASCENSORI
// ============================================

// Variabili globali
// A:
let parcoImpiantiList = [];
let parcoImpiantiFiltrati = [];
let parcoGiriList = [];
let parcoTecniciList = [];
let parcoImportAnalisi = null;
let parcoImpiantiSelezionati = new Set();



// All'inizio del file, dopo le variabili globali
if (window.parcoImpiantiInizializzato) {
    console.log('⚠️ Parco Impianti già inizializzato, skip...');
} else {
    window.parcoImpiantiInizializzato = true;
    console.log('🔄 Inizializzazione Parco Impianti...');
    
    // Il resto del codice...
}




// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inizializzazione Parco Impianti...');
    
    // Setup drop zone per CSV
    setupDropZoneParco();
    
    // Event listener per file input
    document.getElementById('file-parco-csv').addEventListener('change', handleFileSelectParco);
    
    console.log('✅ Parco Impianti inizializzato');
});

// ============================================
// CARICAMENTO DATI
// ============================================

async function caricaImpianti() {
    try {
        console.log('📥 Caricamento impianti...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data, error } = await supabase
            .from('Parco_app')
            .select('*')
            .order('impianto', { ascending: true });
        
        if (error) throw error;
        
        parcoImpiantiList = data || [];
        parcoImpiantiFiltrati = [...parcoImpiantiList];
        
        console.log(`✅ Caricati ${parcoImpiantiList.length} impianti`);
        
        // Estrai giri e tecnici unici
        aggiornaListeUniche();
        
        // Aggiorna UI
        aggiornaStatistiche();
        aggiornaFiltri();
        renderizzaTabella();
        
    } catch (error) {
        console.error('❌ Errore caricamento impianti:', error);
        mostraNotifica('Errore nel caricamento degli impianti', 'error');
    }
}

function aggiornaListeUniche() {
    // Estrai giri unici (escludi null e '')
    const giriSet = new Set();
    const tecniciSet = new Set();
    
    parcoImpiantiList.forEach(imp => {
        if (imp.giro && imp.giro.toString().trim() !== '') {
            giriSet.add(imp.giro.toString());
        }
        if (imp.tecnico && imp.tecnico.trim() !== '') {
            tecniciSet.add(imp.tecnico);
        }
    });
    
    parcoGiriList = Array.from(giriSet).sort((a, b) => parseInt(a) - parseInt(b));
    parcoTecniciList = Array.from(tecniciSet).sort();
}

function aggiornaStatistiche() {
    // Totale impianti
    document.getElementById('totale-impianti').textContent = parcoImpiantiList.length;
    
    // Barra giri
    const conteggioGiri = {};
    parcoImpiantiList.forEach(imp => {
        const giro = imp.giro ? imp.giro.toString() : 'Non assegnato';
        conteggioGiri[giro] = (conteggioGiri[giro] || 0) + 1;
    });
    
    let htmlBarra = '';
    
    // Ordina i giri numericamente
    const giriOrdinati = Object.keys(conteggioGiri).sort((a, b) => {
        if (a === 'Non assegnato') return 1;
        if (b === 'Non assegnato') return -1;
        return parseInt(a) - parseInt(b);
    });
    
    giriOrdinati.forEach(giro => {
        const count = conteggioGiri[giro];
        htmlBarra += `
            <div>
                <div>${giro === 'Non assegnato' ? 'N/A' : `Giro ${giro}`}</div>
                <div>${count}</div>
            </div>
        `;
    });
    
    document.getElementById('barra-giri').innerHTML = htmlBarra;
}
function aggiornaFiltri() {
    // Filtro giro
    const selectGiro = document.getElementById('filtro-giro-parco');
    let htmlGiro = '<option value="">Tutti i giri</option>';
    parcoGiriList.forEach(giro => {
        htmlGiro += `<option value="${giro}">Giro ${giro}</option>`;
    });
    selectGiro.innerHTML = htmlGiro;
    
    // Filtro tecnico
    const selectTecnico = document.getElementById('filtro-tecnico-parco');
    let htmlTecnico = '<option value="">Tutti i tecnici</option>';
    parcoTecniciList.forEach(tecnico => {
        htmlTecnico += `<option value="${tecnico}">${tecnico}</option>`;
    });
    selectTecnico.innerHTML = htmlTecnico;
    
    // Datalist tecnici per form
    const datalistTecnici = document.getElementById('tecnici-parco');
    let htmlDatalist = '';
    parcoTecniciList.forEach(tecnico => {
        htmlDatalist += `<option value="${tecnico}">`;
    });
    datalistTecnici.innerHTML = htmlDatalist;
    
    // Select giro per form
    const selectGiroForm = document.getElementById('parco-giro');
    let htmlGiroForm = '<option value="">Seleziona giro</option>';
    parcoGiriList.forEach(giro => {
        htmlGiroForm += `<option value="${giro}">Giro ${giro}</option>`;
    });
    selectGiroForm.innerHTML = htmlGiroForm;
}

function filtraImpianti() {
    const search = document.getElementById('search-parco').value.toLowerCase();
    const filtroGiro = document.getElementById('filtro-giro-parco').value;
    const filtroTecnico = document.getElementById('filtro-tecnico-parco').value;
    
    parcoImpiantiFiltrati = parcoImpiantiList.filter(imp => {
        // Filtro ricerca
        const matchesSearch = search === '' || 
            (imp.impianto && imp.impianto.toLowerCase().includes(search)) ||
            (imp.cliente && imp.cliente.toLowerCase().includes(search)) ||
            (imp.Indirizzo && imp.Indirizzo.toLowerCase().includes(search));
        
        // Filtro giro
        const matchesGiro = filtroGiro === '' || 
            (imp.giro && imp.giro.toString() === filtroGiro);
        
        // Filtro tecnico
        const matchesTecnico = filtroTecnico === '' || 
            (imp.tecnico && imp.tecnico === filtroTecnico);
        
        return matchesSearch && matchesGiro && matchesTecnico;
    });
    
    renderizzaTabella();
}

// ============================================
// RENDERING TABELLA
// ============================================

function renderizzaTabella() {
    const tbody = document.getElementById('tabella-parco-body');
    
    if (parcoImpiantiFiltrati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center">
                    <div style="padding: 3rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded">info</span>
                        <p>Nessun impianto trovato</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    parcoImpiantiFiltrati.forEach(imp => {
        const selezionato = parcoImpiantiSelezionati.has(imp.impianto) ? 'checked' : '';
        
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="select-parco" value="${imp.impianto}" ${selezionato} onchange="toggleSelezionaImpianto('${imp.impianto}')">
                </td>
                <td><strong>${imp.impianto || ''}</strong></td>
                <td>${imp.tipo || ''}</td>
                <td>${imp.zona || ''}</td>
                <td>${imp.giro || ''}</td>
                <td>${imp.tecnico || ''}</td>
                <td>${imp.cliente || ''}</td>
                <td>${imp.Indirizzo || ''} ${imp.localit || ''} ${imp.prov || ''}</td>
                <td>${formattaData(imp.ult_sem)}</td>
                <td>${formattaData(imp.utl_vp)}</td>
                <td>${formattaData(imp.ult_man)}</td>
                <td>
                    ${imp.note ? `<span class="material-symbols-rounded" title="${imp.note}">note</span>` : ''}
                </td>
                <td>
                    <button class="btn-icon-small" onclick="mostraModalModificaParco('${imp.impianto}')" title="Modifica">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-icon-small" onclick="eliminaImpianto('${imp.impianto}')" title="Elimina">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Aggiorna checkbox "seleziona tutti"
    const selectAll = document.getElementById('select-all-parco');
    if (selectAll) {
        const tuttiSelezionati = parcoImpiantiFiltrati.length > 0 && 
            parcoImpiantiFiltrati.every(imp => parcoImpiantiSelezionati.has(imp.impianto));
        selectAll.checked = tuttiSelezionati;
        selectAll.indeterminate = !tuttiSelezionati && 
            parcoImpiantiFiltrati.some(imp => parcoImpiantiSelezionati.has(imp.impianto));
    }
}

function formattaData(data) {
    if (!data) return '';
    
    // Se è già in formato ISO (YYYY-MM-DD)
    if (data.includes('-')) {
        const [anno, mese, giorno] = data.split('T')[0].split('-');
        return `${giorno}/${mese}/${anno}`;
    }
    
    // Se è in formato gg/mm/aaaa
    return data;
}

function convertiDataPerDB(data) {
    if (!data) return null;
    
    // Se è in formato gg/mm/aaaa
    if (data.includes('/')) {
        const [giorno, mese, anno] = data.split('/');
        return `${anno}-${mese}-${giorno}`;
    }
    
    // Se è già in formato ISO
    return data;
}

// ============================================
// SELEZIONE MULTIPLA
// ============================================

function selezionaTuttiParco() {
    const selectAll = document.getElementById('select-all-parco');
    const checkboxes = document.querySelectorAll('.select-parco');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            parcoImpiantiSelezionati.add(cb.value);
        } else {
            parcoImpiantiSelezionati.delete(cb.value);
        }
    });
}

function toggleSelezionaImpianto(impianto) {
    if (parcoImpiantiSelezionati.has(impianto)) {
        parcoImpiantiSelezionati.delete(impianto);
    } else {
        parcoImpiantiSelezionati.add(impianto);
    }
    
    // Aggiorna checkbox "seleziona tutti"
    const selectAll = document.getElementById('select-all-parco');
    if (selectAll) {
        const tuttiSelezionati = parcoImpiantiFiltrati.length > 0 && 
            parcoImpiantiFiltrati.every(imp => parcoImpiantiSelezionati.has(imp.impianto));
        selectAll.checked = tuttiSelezionati;
        selectAll.indeterminate = !tuttiSelezionati && 
            parcoImpiantiFiltrati.some(imp => parcoImpiantiSelezionati.has(imp.impianto));
    }
}

// ============================================
// CRUD OPERATIONS
// ============================================

function mostraModalAggiuntaParco() {
    document.getElementById('modal-parco-titolo').textContent = 'Nuovo Impianto';
    document.getElementById('form-parco').reset();
    document.getElementById('parco-id').value = '';
    document.getElementById('parco-impianto').disabled = false;
    document.getElementById('modal-parco').style.display = 'flex';
}

async function mostraModalModificaParco(impiantoId) {
    try {
        const impianto = parcoImpiantiList.find(i => i.impianto === impiantoId);
        if (!impianto) throw new Error('Impianto non trovato');
        
        document.getElementById('modal-parco-titolo').textContent = 'Modifica Impianto';
        document.getElementById('parco-id').value = impianto.impianto;
        document.getElementById('parco-impianto').value = impianto.impianto || '';
        document.getElementById('parco-impianto').disabled = true; // PK non modificabile
        document.getElementById('parco-tipo').value = impianto.tipo || '';
        document.getElementById('parco-zona').value = impianto.zona || '';
        document.getElementById('parco-giro').value = impianto.giro || '';
        document.getElementById('parco-tecnico').value = impianto.tecnico || '';
        document.getElementById('parco-periodicit').value = impianto.periodicit || '';
        document.getElementById('parco-venditore').value = impianto.venditore || '';
        document.getElementById('parco-manut').value = impianto.manut || '';
        document.getElementById('parco-mese-sem').value = impianto.mese_sem || '';
        document.getElementById('parco-amministratore').value = impianto.amministratore || '';
        document.getElementById('parco-esattore').value = impianto.esattore || '';
        document.getElementById('parco-cliente').value = impianto.cliente || '';
        document.getElementById('parco-indirizzo').value = impianto.Indirizzo || '';
        document.getElementById('parco-localit').value = impianto.localit || '';
        document.getElementById('parco-prov').value = impianto.prov || '';
        document.getElementById('parco-note').value = impianto.note || '';
        
        // Date: converti da gg/mm/aaaa a yyyy-mm-dd per input date
        if (impianto.ult_sem) {
            const [g, m, a] = impianto.ult_sem.split('/');
            document.getElementById('parco-ult-sem').value = `${a}-${m}-${g}`;
        } else {
            document.getElementById('parco-ult-sem').value = '';
        }
        
        if (impianto.utl_vp) {
            const [g, m, a] = impianto.utl_vp.split('/');
            document.getElementById('parco-ult-vp').value = `${a}-${m}-${g}`;
        } else {
            document.getElementById('parco-ult-vp').value = '';
        }
        
        if (impianto.ult_man) {
            const [g, m, a] = impianto.ult_man.split('/');
            document.getElementById('parco-ult-man').value = `${a}-${m}-${g}`;
        } else {
            document.getElementById('parco-ult-man').value = '';
        }
        
        document.getElementById('modal-parco').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore caricamento impianto:', error);
        mostraNotifica('Errore nel caricamento dei dati', 'error');
    }
}

function chiudiModalParco() {
    document.getElementById('modal-parco').style.display = 'none';
}

async function salvaImpianto() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const impianto = document.getElementById('parco-impianto').value.trim();
        if (!impianto) {
            mostraNotifica('Il campo Impianto è obbligatorio', 'error');
            return;
        }
        
        const dati = {
            impianto: impianto,
            tipo: document.getElementById('parco-tipo').value.trim() || null,
            zona: document.getElementById('parco-zona').value.trim() || null,
            giro: document.getElementById('parco-giro').value || null,
            tecnico: document.getElementById('parco-tecnico').value.trim() || null,
            periodicit: document.getElementById('parco-periodicit').value || null,
            venditore: document.getElementById('parco-venditore').value.trim() || null,
            manut: document.getElementById('parco-manut').value.trim() || null,
            mese_sem: document.getElementById('parco-mese-sem').value || null,
            amministratore: document.getElementById('parco-amministratore').value.trim() || null,
            esattore: document.getElementById('parco-esattore').value.trim() || null,
            cliente: document.getElementById('parco-cliente').value.trim() || null,
            Indirizzo: document.getElementById('parco-indirizzo').value.trim() || null,
            localit: document.getElementById('parco-localit').value.trim() || null,
            prov: document.getElementById('parco-prov').value.trim() || null,
            note: document.getElementById('parco-note').value.trim() || null
        };
        
        // Gestione date: converti da ISO a gg/mm/aaaa
        const ultSem = document.getElementById('parco-ult-sem').value;
        const ultVp = document.getElementById('parco-ult-vp').value;
        const ultMan = document.getElementById('parco-ult-man').value;
        
        if (ultSem) {
            const [a, m, g] = ultSem.split('-');
            dati.ult_sem = `${g}/${m}/${a}`;
        } else {
            dati.ult_sem = null;
        }
        
        if (ultVp) {
            const [a, m, g] = ultVp.split('-');
            dati.utl_vp = `${g}/${m}/${a}`;
        } else {
            dati.utl_vp = null;
        }
        
        if (ultMan) {
            const [a, m, g] = ultMan.split('-');
            dati.ult_man = `${g}/${m}/${a}`;
        } else {
            dati.ult_man = null;
        }
        
        const isModifica = document.getElementById('parco-id').value !== '';
        
        if (isModifica) {
            // Modifica
            const { error } = await supabase
                .from('Parco_app')
                .update(dati)
                .eq('impianto', dati.impianto);
            
            if (error) throw error;
            mostraNotifica('Impianto aggiornato con successo', 'success');
            
        } else {
            // Nuovo
            const { error } = await supabase
                .from('Parco_app')
                .insert([dati]);
            
            if (error) {
                if (error.code === '23505') {
                    mostraNotifica('Impianto già esistente', 'error');
                    return;
                }
                throw error;
            }
            mostraNotifica('Impianto creato con successo', 'success');
        }
        
        chiudiModalParco();
        await caricaImpianti();
        
    } catch (error) {
        console.error('❌ Errore salvataggio impianto:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

async function eliminaImpianto(impiantoId) {
    if (!confirm(`Sei sicuro di voler eliminare l'impianto ${impiantoId}?`)) {
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // Soft delete: aggiungiamo campo attivo? Per ora eliminazione fisica
        const { error } = await supabase
            .from('Parco_app')
            .delete()
            .eq('impianto', impiantoId);
        
        if (error) throw error;
        
        mostraNotifica('Impianto eliminato', 'success');
        parcoImpiantiSelezionati.delete(impiantoId);
        await caricaImpianti();
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

async function eliminaSelezionatiParco() {
    if (parcoImpiantiSelezionati.size === 0) {
        mostraNotifica('Nessun impianto selezionato', 'warning');
        return;
    }
    
    if (!confirm(`Eliminare ${parcoImpiantiSelezionati.size} impianti selezionati?`)) {
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const impiantiArray = Array.from(parcoImpiantiSelezionati);
        
        const { error } = await supabase
            .from('Parco_app')
            .delete()
            .in('impianto', impiantiArray);
        
        if (error) throw error;
        
        mostraNotifica(`${parcoImpiantiSelezionati.size} impianti eliminati`, 'success');
        parcoImpiantiSelezionati.clear();
        await caricaImpianti();
        
    } catch (error) {
        console.error('❌ Errore eliminazione multipla:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// IMPORT CSV CON ANALISI
// ============================================

function mostraImportParco() {
    document.getElementById('card-import-parco').style.display = 'block';
    document.getElementById('import-parco-step1').style.display = 'block';
    document.getElementById('import-parco-step2').style.display = 'none';
}

function chiudiImportParco() {
    document.getElementById('card-import-parco').style.display = 'none';
    // Reset
    document.getElementById('file-parco-csv').value = '';
    document.getElementById('btn-analizza-parco').disabled = true;
}

function annullaImportParco() {
    document.getElementById('import-parco-step1').style.display = 'block';
    document.getElementById('import-parco-step2').style.display = 'none';
    document.getElementById('file-parco-csv').value = '';
    document.getElementById('btn-analizza-parco').disabled = true;
}

function setupDropZoneParco() {
    const dropArea = document.getElementById('drop-zone-parco');
    const fileInput = document.getElementById('file-parco-csv');
    
    if (!dropArea || !fileInput) return;
    
    dropArea.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    dropArea.addEventListener('drop', handleDropParco, false);
}

function handleDropParco(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        document.getElementById('file-parco-csv').files = files;
        handleFileSelectParco({ target: { files: files } });
    }
}

function handleFileSelectParco(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        mostraNotifica('Seleziona un file CSV', 'error');
        // Mostra feedback errore
        mostraFeedbackCSVParco('Errore', 'Formato file non valido. Seleziona un file CSV.', 'error');
        return;
    }
    
    // Abilita pulsante analizza
    document.getElementById('btn-analizza-parco').disabled = false;
    
    // Leggi le prime righe per dare un feedback immediato
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const numRighe = lines.length - 1; // Escludi header
        
        // Mostra feedback positivo
        mostraFeedbackCSVParco(
            'File caricato correttamente', 
            `${file.name} - ${numRighe} righe trovate`, 
            'success'
        );
    };
    reader.readAsText(file, 'UTF-8');
}

function mostraFeedbackCSVParco(titolo, dettagli, tipo = 'success') {
    const feedbackDiv = document.getElementById('feedback-csv-parco');
    const titoloEl = document.getElementById('csv-feedback-titolo');
    const nomeEl = document.getElementById('csv-feedback-nome');
    const dettagliEl = document.getElementById('csv-feedback-dettagli');
    const iconaEl = document.getElementById('csv-feedback-icona');
    
    if (!feedbackDiv) return;
    
    titoloEl.textContent = titolo;
    nomeEl.textContent = dettagli.split(' - ')[0] || dettagli;
    dettagliEl.textContent = dettagli;
    
    // Cambia colore in base al tipo
    if (tipo === 'success') {
        feedbackDiv.style.borderLeftColor = '#22c55e';
        iconaEl.innerHTML = '<span class="material-symbols-rounded">check_circle</span>';
        iconaEl.style.color = '#22c55e';
    } else if (tipo === 'error') {
        feedbackDiv.style.borderLeftColor = '#ef4444';
        iconaEl.innerHTML = '<span class="material-symbols-rounded">error</span>';
        iconaEl.style.color = '#ef4444';
    }
    
    feedbackDiv.style.display = 'block';
}

// Modifica anche rimuoviFileParco (se esiste)
function rimuoviFileParco() {
    document.getElementById('file-parco-csv').value = '';
    document.getElementById('btn-analizza-parco').disabled = true;
    document.getElementById('feedback-csv-parco').style.display = 'none';
}

function scaricaTemplateParco() {
    const template = `impianto;tipo;zona;giro;tecnico;periodicit;matricola;venditore;manut;Indirizzo;localit;prov;cliente;amministratore;esattore;mese_sem;ult_sem;utl_vp;ult_man;note
ASC001;Oleodinamico;1;Giro1;Mario Rossi;180;MAT001;901;FI;Via Roma 1;Roma;RM;Condominio Roma;Amministratore1;001;7;15/01/2026;20/12/2025;10/01/2026;Note esempio`;


    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = 'Template_Parco_Impianti.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function analizzaCSVParco() {
    try {
        const fileInput = document.getElementById('file-parco-csv');
        const file = fileInput.files[0];
        
        if (!file) {
            mostraNotifica('Seleziona un file CSV', 'error');
            return;
        }
        
        mostraLoading('Analisi CSV in corso...');
        
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            mostraNotifica('File CSV vuoto', 'error');
            nascondiLoading();
            return;
        }
        
        // Parsing CSV (separatore ;)
        const header = lines[0].split(';').map(h => h.trim());
        const datiCSV = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';').map(v => v.trim());
            if (values.length === header.length) {
                const riga = {};
                header.forEach((h, idx) => {
                    riga[h] = values[idx] || null;
                });
                datiCSV.push(riga);
            }
        }
        
        console.log(`📊 CSV letto: ${datiCSV.length} righe`);
        
        // Esegui analisi comparativa
        const analisi = confrontaCSVconDB(datiCSV);
        parcoImportAnalisi = analisi;
        
        // Mostra risultati
        mostraRisultatiAnalisi(analisi);
        
        nascondiLoading();
        
    } catch (error) {
        console.error('❌ Errore analisi CSV:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
        nascondiLoading();
    }
}

function confrontaCSVconDB(datiCSV) {
    const result = {
        nuovi: [],
        modificati: [],
        dateAggiornate: [],
        eliminati: [],
        mappaDateAggiornate: {}  // Per tenere traccia delle date aggiornate
    };
    
    // Crea mappa DB per lookup veloce
    const mappaDB = {};
    parcoImpiantiList.forEach(imp => {
        mappaDB[imp.impianto] = imp;
    });
    
    // Crea set CSV per trovare eliminati
    const impiantiCSV = new Set(datiCSV.map(d => d.impianto).filter(Boolean));
    
    // Trova nuovi e modificati
    datiCSV.forEach(row => {
        if (!row.impianto) return; // Salta righe senza impianto
        
        const dbRow = mappaDB[row.impianto];
        
        if (!dbRow) {
            // NUOVO
            result.nuovi.push(row);
        } else {
            // Confronta campi (escluse date)
            let hasModifiche = false;
            const modifiche = {};
            
      // Campi da confrontare (tutti tranne le date)
const campi = ['tipo', 'zona', 'giro', 'tecnico', 'periodicit', 'venditore', 
              'manut', 'mese_sem', 'amministratore', 'esattore', 'cliente', 
              'Indirizzo', 'localit', 'prov', 'note'];

campi.forEach(campo => {
    let valCSV = row[campo] || null;
    let valDB = dbRow[campo] || null;
    
    // CONVERSIONE: se entrambi sono numerici, converti in numero per il confronto
    if (!isNaN(valCSV) && !isNaN(valDB)) {
        // Se sono entrambi numerici (o convertibili a numero)
        valCSV = Number(valCSV);
        valDB = Number(valDB);
    } else {
        // Altrimenti converti in stringa e trimma
        valCSV = valCSV !== null ? String(valCSV).trim() : null;
        valDB = valDB !== null ? String(valDB).trim() : null;
    }
    
    if (valCSV !== valDB) {
        hasModifiche = true;
        modifiche[campo] = {
            vecchio: dbRow[campo],  // Mantieni valore originale per visualizzazione
            nuovo: row[campo]
        };
    }
});
            
            // Gestione date (confronto speciale)
            const dateAggiornate = {};
            
            ['ult_sem', 'utl_vp', 'ult_man'].forEach(campo => {
                const dataCSV = row[campo];
                const dataDB = dbRow[campo];
                
                const dataMigliore = confrontaDate(dataCSV, dataDB);
                if (dataMigliore !== dataDB) {
                    dateAggiornate[campo] = {
                        vecchio: dataDB,
                        nuovo: dataCSV
                    };
                }
            });
            
            if (Object.keys(dateAggiornate).length > 0) {
                result.dateAggiornate.push({
                    impianto: row.impianto,
                    date: dateAggiornate
                });
                result.mappaDateAggiornate[row.impianto] = dateAggiornate;
            }
            
            if (hasModifiche) {
                result.modificati.push({
                    impianto: row.impianto,
                    modifiche: modifiche,
                    datiCompleti: row
                });
            }
        }
    });
    
    // Trova eliminati (in DB ma non in CSV)
    parcoImpiantiList.forEach(imp => {
        if (!impiantiCSV.has(imp.impianto)) {
            result.eliminati.push(imp);
        }
    });
    
    return result;
}

function confrontaDate(dataCSV, dataDB) {
    // Se una è vuota, vince l'altra
    if (!dataCSV && !dataDB) return null;
    if (!dataCSV) return dataDB;
    if (!dataDB) return dataCSV;
    
    // Converte in Date per confronto
    const parseData = (data) => {
        if (data.includes('/')) {
            const [g, m, a] = data.split('/');
            return new Date(a, m-1, g);
        }
        return new Date(data); // fallback
    };
    
    const dCSV = parseData(dataCSV);
    const dDB = parseData(dataDB);
    
    // Vinci la più recente
    return dCSV > dDB ? dataCSV : dataDB;
}

// Sostituisci l'intera funzione mostraRisultatiAnalisi in admin_parco.js

function mostraRisultatiAnalisi(analisi) {
    const riepilogo = document.getElementById('riepilogo-analisi-parco');
    const dettaglio = document.getElementById('dettaglio-analisi-parco');
    
    // Riepilogo
    let htmlRiepilogo = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: #eff6ff; border-radius: 12px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem; font-weight: 800; color: #3B82F6;">${analisi.nuovi.length}</div>
                <div style="font-size: 0.9rem; color: #1e40af;">🔵 NUOVI</div>
            </div>
            <div style="background: #fef3c7; border-radius: 12px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem; font-weight: 800; color: #F59E0B;">${analisi.modificati.length}</div>
                <div style="font-size: 0.9rem; color: #92400e;">🟡 MODIFICATI</div>
            </div>
            <div style="background: #d1fae5; border-radius: 12px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem; font-weight: 800; color: #10B981;">${analisi.dateAggiornate.length}</div>
                <div style="font-size: 0.9rem; color: #065f46;">⚪ DATE</div>
            </div>
            <div style="background: #fee2e2; border-radius: 12px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem; font-weight: 800; color: #EF4444;">${analisi.eliminati.length}</div>
                <div style="font-size: 0.9rem; color: #991b1b;">🔴 ELIMINATI</div>
            </div>
        </div>
    `;
    
    // Dettaglio
    let htmlDettaglio = '<div style="margin-top: 1rem;">';
    
    // 🔵 NUOVI
    if (analisi.nuovi.length > 0) {
        htmlDettaglio += `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <input type="checkbox" id="select-nuovi" checked onchange="toggleCategoria('nuovi')">
                    <span style="color: #3B82F6;">🔵 NUOVI (${analisi.nuovi.length})</span>
                </h4>
                <div id="categoria-nuovi" style="margin-left: 2rem;">
        `;
        
        analisi.nuovi.forEach((imp, idx) => {
            const giro = imp.giro ? `Giro ${imp.giro}` : 'Giro N/D';
            const indirizzo = imp.Indirizzo || '';
            const localita = imp.localit || '';
            
            htmlDettaglio += `
                <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px;">
                    <input type="checkbox" id="nuovo-${idx}" class="check-nuovo" value="${imp.impianto}" checked style="margin-top: 2px;">
                    <div style="font-size: 0.9rem;">
                        <span style="font-weight: 800; color: var(--primary);">${imp.impianto}</span>
                        <span style="color: #64748b;"> • ${giro}</span>
                        <div style="color: var(--text-main); margin-top: 2px;">
                            ${indirizzo} ${localita ? `- ${localita}` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        htmlDettaglio += `</div></div>`;
    }
    
 // 🟡 MODIFICATI
if (analisi.modificati.length > 0) {
    htmlDettaglio += `
        <div style="margin-bottom: 1.5rem;">
            <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <input type="checkbox" id="select-modificati" checked onchange="toggleCategoria('modificati')">
                <span style="color: #F59E0B;">🟡 MODIFICATI (${analisi.modificati.length})</span>
            </h4>
            <div id="categoria-modificati" style="margin-left: 2rem;">
    `;
    
    analisi.modificati.forEach((item, idx) => {
        const imp = item.datiCompleti || item;
        const giro = imp.giro ? `Giro ${imp.giro}` : 'Giro N/D';
        const indirizzo = imp.Indirizzo || '';
        const localita = imp.localit || '';
        
        // Genera dettaglio modifiche
        let modificheHtml = '';
        Object.entries(item.modifiche).forEach(([campo, vals]) => {
            modificheHtml += `<div style="font-size: 0.85rem; color: #64748b; margin-left: 1.5rem; margin-top: 2px;">
                • <span style="font-weight: 600;">${campo}:</span> 
                <span style="color: #991b1b; text-decoration: line-through;">${vals.vecchio || 'vuoto'}</span> → 
                <span style="color: #166534; font-weight: 600;">${vals.nuovo || 'vuoto'}</span>
            </div>`;
        });
        
        htmlDettaglio += `
            <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 6px; border-left: 3px solid #F59E0B;">
                <input type="checkbox" id="modificato-${idx}" class="check-modificato" value="${item.impianto}" checked style="margin-top: 2px;">
                <div style="font-size: 0.9rem; width: 100%;">
                    <div>
                        <span style="font-weight: 800; color: var(--primary);">${item.impianto}</span>
                        <span style="color: #64748b;"> • ${giro}</span>
                    </div>
                    <div style="color: var(--text-main); margin: 2px 0 4px 0;">
                        ${indirizzo} ${localita ? `- ${localita}` : ''}
                    </div>
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #cbd5e1;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: #F59E0B; margin-bottom: 0.25rem;">✏️ Elementi modificati:</div>
                        ${modificheHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    htmlDettaglio += `</div></div>`;
}
    
    // ⚪ DATE AGGIORNATE (sempre applicate automaticamente)
    if (analisi.dateAggiornate.length > 0) {
        htmlDettaglio += `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: #10B981; margin-bottom: 0.75rem;">⚪ DATE AGGIORNATE (${analisi.dateAggiornate.length})</h4>
                <div style="margin-left: 1rem; background: #f8fafc; border-radius: 8px; padding: 0.75rem;">
        `;
        
        analisi.dateAggiornate.forEach(item => {
            const imp = item;
            const giro = imp.giro ? `Giro ${imp.giro}` : 'Giro N/D';
            const indirizzo = imp.Indirizzo || '';
            const localita = imp.localit || '';
            
            let dateHtml = '';
            Object.entries(item.date).forEach(([campo, vals]) => {
                dateHtml += `<div style="font-size: 0.85rem;">${campo}: ${vals.vecchio || 'vuoto'} → ${vals.nuovo || 'vuoto'}</div>`;
            });
            
            htmlDettaglio += `
                <div style="margin-bottom: 0.75rem; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                    <div><strong>${item.impianto}</strong> <span style="color: #64748b;">• ${giro}</span></div>
                    <div style="color: var(--text-main); font-size: 0.85rem; margin: 2px 0 4px 0;">
                        ${indirizzo} ${localita ? `- ${localita}` : ''}
                    </div>
                    ${dateHtml}
                </div>
            `;
        });
        
        htmlDettaglio += `</div></div>`;
    }
    
    // 🔴 ELIMINATI
    if (analisi.eliminati.length > 0) {
        htmlDettaglio += `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <input type="checkbox" id="select-eliminati" checked onchange="toggleCategoria('eliminati')">
                    <span style="color: #EF4444;">🔴 ELIMINATI (${analisi.eliminati.length})</span>
                </h4>
                <div id="categoria-eliminati" style="margin-left: 2rem;">
        `;
        
        analisi.eliminati.forEach((imp, idx) => {
            const giro = imp.giro ? `Giro ${imp.giro}` : 'Giro N/D';
            const indirizzo = imp.Indirizzo || '';
            const localita = imp.localit || '';
            
            htmlDettaglio += `
                <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px;">
                    <input type="checkbox" id="eliminato-${idx}" class="check-eliminato" value="${imp.impianto}" checked style="margin-top: 2px;">
                    <div style="font-size: 0.9rem;">
                        <span style="font-weight: 800; color: var(--primary);">${imp.impianto}</span>
                        <span style="color: #64748b;"> • ${giro}</span>
                        <div style="color: var(--text-main); margin-top: 2px;">
                            ${indirizzo} ${localita ? `- ${localita}` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        htmlDettaglio += `</div></div>`;
    }
    
    htmlDettaglio += '</div>';
    
    riepilogo.innerHTML = htmlRiepilogo;
    dettaglio.innerHTML = htmlDettaglio;
    
    // Mostra step2
    document.getElementById('import-parco-step1').style.display = 'none';
    document.getElementById('import-parco-step2').style.display = 'block';
}

function toggleCategoria(categoria) {
    const selectAll = document.getElementById(`select-${categoria}`);
    const checkboxes = document.querySelectorAll(`.check-${categoria}`);
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
}

async function eseguiImportParco() {
    if (!parcoImportAnalisi) {
        mostraNotifica('Nessuna analisi disponibile', 'error');
        return;
    }
    
    try {
        mostraLoading('Importazione in corso...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const risultati = {
            inseriti: 0,
            aggiornati: 0,
            dateAggiornate: 0,
            eliminati: 0
        };
        
        // 1. INSERISCI NUOVI
        const checkNuovi = document.querySelectorAll('.check-nuovo:checked');
        for (const cb of checkNuovi) {
            const idx = cb.id.split('-')[1];
            const impianto = parcoImportAnalisi.nuovi[idx];
            if (!impianto) continue;
            
            // Prepara dati
            const dati = { ...impianto };
            
            // Converti date se presenti
            if (dati.ult_sem && dati.ult_sem.includes('/')) {
                // Mantieni formato gg/mm/aaaa
            }
            
            const { error } = await supabase
                .from('Parco_app')
                .insert([dati]);
            
            if (!error) risultati.inseriti++;
        }
        
        // 2. AGGIORNA MODIFICATI (campi non-data)
        const checkModificati = document.querySelectorAll('.check-modificato:checked');
        for (const cb of checkModificati) {
            const idx = cb.id.split('-')[1];
            const item = parcoImportAnalisi.modificati[idx];
            if (!item) continue;
            
            // Prepara dati aggiornati
            const dati = { ...item.datiCompleti };
            
            const { error } = await supabase
                .from('Parco_app')
                .update(dati)
                .eq('impianto', item.impianto);
            
            if (!error) risultati.aggiornati++;
        }
        
        // 3. APPLICA DATE (sempre, per tutti gli impianti con date aggiornate)
        for (const item of parcoImportAnalisi.dateAggiornate) {
            const aggiornamenti = {};
            Object.entries(item.date).forEach(([campo, vals]) => {
                aggiornamenti[campo] = vals.nuovo;
            });
            
            if (Object.keys(aggiornamenti).length > 0) {
                const { error } = await supabase
                    .from('Parco_app')
                    .update(aggiornamenti)
                    .eq('impianto', item.impianto);
                
                if (!error) risultati.dateAggiornate++;
            }
        }
        
        // 4. ELIMINA SELEZIONATI (soft delete - per ora eliminazione fisica)
        const checkEliminati = document.querySelectorAll('.check-eliminato:checked');
        const impiantiDaEliminare = [];
        for (const cb of checkEliminati) {
            const idx = cb.id.split('-')[1];
            const impianto = parcoImportAnalisi.eliminati[idx];
            if (impianto) impiantiDaEliminare.push(impianto.impianto);
        }
        
        if (impiantiDaEliminare.length > 0) {
            const { error } = await supabase
                .from('Parco_app')
                .delete()
                .in('impianto', impiantiDaEliminare);
            
            if (!error) risultati.eliminati = impiantiDaEliminare.length;
        }
        
        nascondiLoading();
        
        // Genera log
        generaLogParco(risultati);
        
        mostraNotifica(`Import completato! Inseriti: ${risultati.inseriti}, Aggiornati: ${risultati.aggiornati}, Date: ${risultati.dateAggiornate}, Eliminati: ${risultati.eliminati}`, 'success');
        
        // Ricarica dati e chiudi
        await caricaImpianti();
        chiudiImportParco();
        
    } catch (error) {
        console.error('❌ Errore import:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
        nascondiLoading();
    }
}

function generaLogParco(risultati) {
    const data = new Date();
    const fileName = `log_parco_${data.getFullYear()}${(data.getMonth()+1).toString().padStart(2,'0')}${data.getDate().toString().padStart(2,'0')}_${data.getHours().toString().padStart(2,'0')}${data.getMinutes().toString().padStart(2,'0')}${data.getSeconds().toString().padStart(2,'0')}.txt`;
    
    const fileInput = document.getElementById('file-parco-csv');
    const fileNameCSV = fileInput.files[0]?.name || 'sconosciuto';
    
    let logContent = `=== LOG IMPORT PARCO IMPIANTI ===
Data: ${data.toLocaleString('it-IT')}
File sorgente: ${fileNameCSV}

RIEPILOGO OPERAZIONI:
------------------------
🔵 Nuovi inseriti: ${risultati.inseriti}
🟡 Modificati aggiornati: ${risultati.aggiornati}
⚪ Date aggiornate: ${risultati.dateAggiornate}
🔴 Eliminati: ${risultati.eliminati}

DETTAGLIO MODIFICHE:
------------------------
`;

    if (parcoImportAnalisi) {
        if (parcoImportAnalisi.modificati.length > 0) {
            logContent += '\nMODIFICHE APPLICATE:\n';
            parcoImportAnalisi.modificati.forEach(item => {
                logContent += `\n${item.impianto}:\n`;
                Object.entries(item.modifiche).forEach(([campo, vals]) => {
                    logContent += `  ${campo}: ${vals.vecchio || 'vuoto'} → ${vals.nuovo || 'vuoto'}\n`;
                });
            });
        }
        
        if (parcoImportAnalisi.dateAggiornate.length > 0) {
            logContent += '\nDATE AGGIORNATE:\n';
            parcoImportAnalisi.dateAggiornate.forEach(item => {
                logContent += `\n${item.impianto}:\n`;
                Object.entries(item.date).forEach(([campo, vals]) => {
                    logContent += `  ${campo}: ${vals.vecchio || 'vuoto'} → ${vals.nuovo || 'vuoto'}\n`;
                });
            });
        }
    }
    
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================
// EXPORT CSV
// ============================================

function esportaCSVParco() {
    try {
        if (parcoImpiantiFiltrati.length === 0) {
            mostraNotifica('Nessun impianto da esportare', 'warning');
            return;
        }
        
        // Header
        const header = ['impianto', 'tipo', 'zona', 'giro', 'tecnico', 'periodicit', 'venditore', 
                       'manut', 'mese_sem', 'amministratore', 'esattore', 'cliente', 'Indirizzo', 
                       'localit', 'prov', 'ult_sem', 'utl_vp', 'ult_man', 'note'];
        
        let csvContent = header.join(';') + '\n';
        
        parcoImpiantiFiltrati.forEach(imp => {
            const riga = header.map(campo => {
                let val = imp[campo];
                
                // Gestione valori null/undefined
                if (val === null || val === undefined) {
                    return '';
                }
                
                // Converti in stringa se necessario
                val = String(val);
                
                // Escape se necessario
                if (val.includes(';') || val.includes('"') || val.includes('\n')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvContent += riga.join(';') + '\n';
        });
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `Parco_Impianti_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        mostraNotifica(`Esportati ${parcoImpiantiFiltrati.length} impianti`, 'success');
        
    } catch (error) {
        console.error('❌ Errore export CSV:', error);
        mostraNotifica('Errore nell\'esportazione', 'error');
    }
}

// ============================================
// UTILITY
// ============================================

function mostraNotifica(testo, tipo = 'info') {
    // Crea notifica temporanea
    const notifica = document.createElement('div');
    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    `;
    
    switch(tipo) {
        case 'success':
            notifica.style.background = '#22c55e';
            notifica.style.color = 'white';
            break;
        case 'error':
            notifica.style.background = '#ef4444';
            notifica.style.color = 'white';
            break;
        case 'warning':
            notifica.style.background = '#f59e0b';
            notifica.style.color = 'white';
            break;
        default:
            notifica.style.background = '#3B82F6';
            notifica.style.color = 'white';
    }
    
    notifica.textContent = testo;
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        notifica.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notifica.remove(), 300);
    }, 3000);
}

function mostraLoading(testo = 'Caricamento...') {
    let loading = document.getElementById('loading-parco');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-parco';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 1rem;
            z-index: 10000;
        `;
        loading.innerHTML = `
            <div style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-weight: 600; color: #1e293b;" id="loading-parco-testo">${testo}</div>
        `;
        document.body.appendChild(loading);
    } else {
        document.getElementById('loading-parco-testo').textContent = testo;
        loading.style.display = 'flex';
    }
}

function nascondiLoading() {
    const loading = document.getElementById('loading-parco');
    if (loading) loading.style.display = 'none';
}

// Aggiungi animazioni CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Esponi funzioni globali
window.caricaImpianti = caricaImpianti;
window.filtraImpianti = filtraImpianti;
window.mostraModalAggiuntaParco = mostraModalAggiuntaParco;
window.mostraModalModificaParco = mostraModalModificaParco;
window.chiudiModalParco = chiudiModalParco;
window.salvaImpianto = salvaImpianto;
window.eliminaImpianto = eliminaImpianto;
window.eliminaSelezionatiParco = eliminaSelezionatiParco;
window.selezionaTuttiParco = selezionaTuttiParco;
window.toggleSelezionaImpianto = toggleSelezionaImpianto;
window.esportaCSVParco = esportaCSVParco;
window.mostraImportParco = mostraImportParco;
window.chiudiImportParco = chiudiImportParco;
window.annullaImportParco = annullaImportParco;
window.scaricaTemplateParco = scaricaTemplateParco;
window.analizzaCSVParco = analizzaCSVParco;
window.toggleCategoria = toggleCategoria;
window.eseguiImportParco = eseguiImportParco;



console.log('✅ Admin Parco Impianti JS caricato');