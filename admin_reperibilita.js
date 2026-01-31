// ============================================
// ADMIN REPERIBILITÀ - PARKAPP
// ============================================

// VARIABILI GLOBALI
let zoneList = [];
let festivitaList = [];
let turniList = [];
let richiesteList = [];
let caricamentiList = [];

// ============================================
// INIZIALIZZAZIONE PAGINA
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🔄 Inizializzazione Admin Reperibilità...');
        
        // Controlla connessione DB
        const configInfo = getDbConfigInfo();
        const indicator = document.getElementById('db-status-indicator');
        
        if (configInfo.configured) {
            indicator.style.background = '#22c55e';
            indicator.title = `DB configurato • ${configInfo.urlShort || 'N/A'}`;
        } else {
            indicator.style.background = '#f59e0b';
            indicator.title = 'Database non configurato';
            mostraMessaggio('Database non configurato', 'error');
        }
        
        // Inizializza le tab
        inizializzaTabs();
        
        // Setup event listeners per CSV
        setupCSVUpload();
        
        // Setup event listeners per festività
        document.getElementById('tipo-festivita').addEventListener('change', function() {
            const mostraZona = this.value === 'locale';
            document.getElementById('zona-festivita-container').style.display = mostraZona ? 'block' : 'none';
            if (mostraZona) caricaZonePerSelect();
        });
        
        // Carica dati iniziali per la tab attiva (Zone)
        await caricaZone();
         await caricaTecnici(); // <-- AGGIUNGI QUESTA LINEA
        
        console.log('✅ Admin Reperibilità inizializzato');
        
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
        mostraMessaggio('Errore inizializzazione pagina', 'error');
    }
});

// ============================================
// FUNZIONI GESTIONE TAB
// ============================================

function inizializzaTabs() {
    console.log('🔄 Inizializzo tab system...');
    
    const tabs = document.querySelectorAll('.admin-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            const targetId = this.getAttribute('data-target');
            console.log(`📱 Tab cliccata: ${targetId}`);
            
            // Rimuovi classe active da tutte le tab
            tabs.forEach(t => t.classList.remove('active'));
            // Aggiungi classe active alla tab cliccata
            this.classList.add('active');
            
            // Nascondi tutti i contenuti
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Mostra il contenuto selezionato
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Carica i dati specifici se necessario
                switch(targetId) {
                    case 'zone-tab':
                        console.log('📍 Carico zone...');
                        await caricaZone();
                        break;
                    case 'csv-tab':
                        console.log('📂 Carico storico CSV...');
                        await caricaStoricoCSV();
                        await caricaZonePerSelect(); // Per validazioni
                        break;
                    case 'festivita-tab':
                        console.log('🎉 Carico festività...');
                        await caricaFestivita();
                        await caricaZonePerSelect();
                        break;
                    case 'turni-tab':
                        console.log('📅 Carico turni...');
                        await caricaZonePerSelect();
                        await caricaTurni();
                        break;
                    case 'approvazioni-tab':
                        console.log('✅ Carico richieste...');
                        await caricaRichiestePending();
                        break;
                }
            }
        });
    });
    
    console.log('✅ Tab system inizializzato');
}

// ============================================
// FUNZIONI GESTIONE ZONE (TAB 1)
// ============================================

async function caricaZone() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        console.log('📍 Caricamento zone reperibilità...');
        
        const { data: zone, error } = await supabase
            .from('zone_reperibilita')
            .select('*')
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        zoneList = zone || [];
        aggiornaUI_Zone();
        
    } catch (error) {
        console.error('❌ Errore caricamento zone:', error);
        mostraMessaggio('Errore nel caricamento delle zone', 'error');
    }
}

async function caricaZonePerSelect() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        // CARICA le zone dal database (non usare la variabile zone che potrebbe non essere definita)
        const { data: zoneData, error } = await supabase
            .from('zone_reperibilita')
            .select('id, nome')
            .eq('attivo', true)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        // Usa zoneData invece di zone
        if (!zoneData || zoneData.length === 0) {
            console.warn('⚠️ Nessuna zona attiva trovata');
            return;
        }
        
        // Popola select per festività locali
        const selectZonaFestivita = document.getElementById('zona-festivita');
        if (selectZonaFestivita) {
            let html = '<option value="">Seleziona zona...</option>';
            zoneData.forEach(z => {
                html += `<option value="${z.id}">${z.nome}</option>`;
            });
            selectZonaFestivita.innerHTML = html;
        }
        
        // Popola filtro zone per turni
        const selectFiltroZona = document.getElementById('filtro-zona-turni');
        if (selectFiltroZona) {
            let html = '<option value="">Tutte le zone</option>';
            zoneData.forEach(z => {
                html += `<option value="${z.id}">${z.nome}</option>`;
            });
            selectFiltroZona.innerHTML = html;
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento zone per select:', error);
        // Non mostrare messaggio per evitare spam
    }
}

function aggiornaUI_Zone() {
    const container = document.getElementById('lista-zone');
    if (!container) return;
    
    if (zoneList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">location_off</span>
                <p style="margin-top: 0.5rem;">Nessuna zona configurata</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    zoneList.forEach(zona => {
        html += `
            <div class="elemento-item">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 20px; height: 20px; border-radius: 4px; background: ${zona.colore_hex}; border: 2px solid var(--border);"></div>
                    <div>
                        <h4 style="margin: 0 0 0.25rem 0; color: var(--text-main); font-weight: 800;">${zona.nome}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${zona.descrizione || 'Nessuna descrizione'}</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: ${zona.attivo ? '#22c55e' : '#ef4444'};">
                            ${zona.attivo ? '● Attiva' : '● Disattiva'}
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="modificaZona('${zona.id}')" 
                            style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button onclick="cambiaStatoZona('${zona.id}', ${!zona.attivo})" 
                            style="background: none; border: none; color: ${zona.attivo ? '#ef4444' : '#22c55e'}; cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                        <span class="material-symbols-rounded">${zona.attivo ? 'toggle_off' : 'toggle_on'}</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function salvaZona() {
    try {
        const nome = document.getElementById('nome-zona').value.trim();
        const descrizione = document.getElementById('descrizione-zona').value.trim();
        const colore = document.getElementById('colore-zona').value;
        
        if (!nome) {
            mostraMessaggio('Inserisci il nome della zona', 'error');
            return;
        }
        
        if (!/^#[0-9A-F]{6}$/i.test(colore)) {
            mostraMessaggio('Colore non valido', 'error');
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('zone_reperibilita')
            .insert([{
                nome: nome,
                descrizione: descrizione || null,
                colore_hex: colore,
                attivo: true
            }]);
        
        if (error) {
            if (error.code === '23505') { // Violazione unique constraint
                mostraMessaggio(`La zona "${nome}" esiste già`, 'error');
                return;
            }
            throw error;
        }
        
        // Reset form
        document.getElementById('nome-zona').value = '';
        document.getElementById('descrizione-zona').value = '';
        
        mostraMessaggio(`Zona "${nome}" creata con successo!`, 'success');
        
        // Ricarica lista
        await caricaZone();
        await caricaZonePerSelect(); // Aggiorna anche le select
        
    } catch (error) {
        console.error('❌ Errore creazione zona:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

async function modificaZona(id) {
    // Implementazione semplificata: per ora solo toggle stato
    const zona = zoneList.find(z => z.id === id);
    if (!zona) return;
    
    const nuovoNome = prompt('Modifica nome zona:', zona.nome);
    if (!nuovoNome || nuovoNome.trim() === '') return;
    
    const nuovaDescrizione = prompt('Modifica descrizione:', zona.descrizione || '');
    const nuovoColore = prompt('Modifica colore (esadecimale):', zona.colore_hex);
    
    if (!nuovoColore || !/^#[0-9A-F]{6}$/i.test(nuovoColore)) {
        mostraMessaggio('Colore non valido', 'error');
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('zone_reperibilita')
            .update({
                nome: nuovoNome.trim(),
                descrizione: nuovaDescrizione.trim() || null,
                colore_hex: nuovoColore
            })
            .eq('id', id);
        
        if (error) throw error;
        
        mostraMessaggio(`Zona aggiornata`, 'success');
        await caricaZone();
        await caricaZonePerSelect();
        
    } catch (error) {
        console.error('❌ Errore modifica zona:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

async function cambiaStatoZona(id, nuovoStato) {
    try {
        if (!confirm(`Sei sicuro di voler ${nuovoStato ? 'attivare' : 'disattivare'} questa zona?`)) {
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('zone_reperibilita')
            .update({ attivo: nuovoStato })
            .eq('id', id);
        
        if (error) throw error;
        
        mostraMessaggio(`Zona ${nuovoStato ? 'attivata' : 'disattivata'}`, 'success');
        await caricaZone();
        
    } catch (error) {
        console.error('❌ Errore cambio stato zona:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI CARICAMENTO CSV (TAB 2)
// ============================================

function setupCSVUpload() {
    const dropArea = document.getElementById('csv-drop-area');
    const fileInput = document.getElementById('file-csv');
    
    if (!dropArea || !fileInput) return;
    
    // Click sull'area
    dropArea.addEventListener('click', () => fileInput.click());
    
    // Cambio file selezionato
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.style.borderColor = 'var(--primary)';
        dropArea.style.background = 'rgba(37, 99, 235, 0.05)';
    }
    
    function unhighlight() {
        dropArea.style.borderColor = 'var(--border)';
        dropArea.style.background = '';
    }
    
    // Gestione drop
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect({ target: { files: files } });
        }
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Controlla estensione
    if (!file.name.toLowerCase().endsWith('.csv')) {
        mostraMessaggio('Seleziona un file CSV', 'error');
        rimuoviFile();
        return;
    }
    
    // Mostra info file
    document.getElementById('file-info').style.display = 'block';
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = `Dimensione: ${(file.size / 1024).toFixed(1)} KB`;
    
    // Abilita pulsante caricamento
    document.getElementById('btn-carica-csv').disabled = false;
}

function rimuoviFile() {
    document.getElementById('file-csv').value = '';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('btn-carica-csv').disabled = true;
    document.getElementById('anteprima-csv').style.display = 'none';
    document.getElementById('anteprima-csv').innerHTML = '';
}

async function scaricaTemplateCSV() {
    const template = `DataInizio;Zona;Tecnico
2025-01-03;BO EST;Mario Rossi
2025-01-03;BO CENTRO;Luigi Verdi
2025-01-03;BO OVEST;Giuseppe Bianchi
2025-01-03;FERRARA;Anna Russo
2025-01-03;RAVENNA;Laura Ferrari
2025-01-10;BO EST;Luigi Verdi
2025-01-10;BO CENTRO;Mario Rossi
2025-01-10;BO OVEST;Anna Russo
2025-01-10;FERRARA;Giuseppe Bianchi
2025-01-10;RAVENNA;Laura Ferrari`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = 'Template_Reperibilita.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function validaECaricaCSV() {
    try {
        const fileInput = document.getElementById('file-csv');
        const file = fileInput.files[0];
        
        if (!file) {
            mostraMessaggio('Seleziona un file CSV', 'error');
            return;
        }
        
        mostraLoading('Validazione CSV in corso...');
        
        // Leggi il file
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            mostraMessaggio('File CSV vuoto o formato non valido', 'error');
            nascondiLoading();
            return;
        }
        
        // Estrai header
        const header = lines[0].split(';');
        if (header.length !== 3 || 
            header[0].toLowerCase() !== 'datainizio' || 
            header[1].toLowerCase() !== 'zona' || 
            header[2].toLowerCase() !== 'tecnico') {
            mostraMessaggio('Formato CSV non valido. Usa il template.', 'error');
            nascondiLoading();
            return;
        }
        
        // Valida ogni riga
        const errori = [];
        const righeValide = [];
        const turniDaImportare = [];
        
        // Carica zone esistenti per validazione
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data: zoneEsistenti, error: errorZone } = await supabase
            .from('zone_reperibilita')
            .select('nome')
            .eq('attivo', true);
        
        if (errorZone) throw errorZone;
        
        const nomiZoneValide = zoneEsistenti.map(z => z.nome);
        
        for (let i = 1; i < lines.length; i++) {
            const riga = lines[i];
            const parti = riga.split(';');
            
            if (parti.length !== 3) {
                errori.push({ riga: i + 1, errore: 'Numero di colonne non valido', dati: riga });
                continue;
            }
            
            const [dataStr, zona, tecnico] = parti.map(p => p.trim());
            
            // Valida data
            const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dataRegex.test(dataStr)) {
                errori.push({ riga: i + 1, errore: 'Formato data non valido (usare YYYY-MM-DD)', dati: riga });
                continue;
            }
            
            const dataInizio = new Date(dataStr + 'T08:00:00'); // Venerdì 8:00
            if (isNaN(dataInizio.getTime())) {
                errori.push({ riga: i + 1, errore: 'Data non valida', dati: riga });
                continue;
            }
            
            // Controlla che sia un venerdì
            if (dataInizio.getDay() !== 5) {
                errori.push({ riga: i + 1, errore: 'La data deve essere un venerdì', dati: riga });
                continue;
            }
            
            // Valida zona
            if (!nomiZoneValide.includes(zona)) {
                errori.push({ riga: i + 1, errore: `Zona "${zona}" non esistente o disattiva`, dati: riga });
                continue;
            }
            
            // Valida tecnico (almeno un nome)
            if (!tecnico || tecnico.length < 2) {
                errori.push({ riga: i + 1, errore: 'Nome tecnico non valido', dati: riga });
                continue;
            }
            
            // Calcola data fine (venerdì successivo 8:00)
            const dataFine = new Date(dataInizio);
            dataFine.setDate(dataFine.getDate() + 7);
            
            righeValide.push({
                riga: i + 1,
                dataInizio: dataInizio.toISOString(),
                dataFine: dataFine.toISOString(),
                zona: zona,
                tecnico: tecnico,
                rigaOriginale: riga
            });
            
            // Prepara turno per l'import
            const zonaObj = zoneEsistenti.find(z => z.nome === zona);
            turniDaImportare.push({
                zona_id: zonaObj.id,
                tecnico_id: tecnico,
                data_inizio: dataInizio.toISOString(),
                data_fine: dataFine.toISOString(),
                stato: 'originale'
            });
        }
        
        // Mostra anteprima
        mostraAnteprimaCSV(righeValide, errori, turniDaImportare.length);
        
        nascondiLoading();
        
    } catch (error) {
        console.error('❌ Errore validazione CSV:', error);
        mostraMessaggio(`Errore nella validazione: ${error.message}`, 'error');
        nascondiLoading();
    }
}

function mostraAnteprimaCSV(righeValide, errori, numTurni) {
    const container = document.getElementById('anteprima-csv');
    const backupCheck = document.getElementById('backup-csv').checked;
    const sovrascriviCheck = document.getElementById('sovrascrivi-csv').checked;
    
    let html = `
        <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid var(--border);">
            <h3 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-symbols-rounded">preview</span>
                Anteprima Importazione
            </h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${righeValide.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Righe valide</div>
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 800; color: ${errori.length > 0 ? '#ef4444' : '#22c55e'}">${errori.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Errori</div>
                </div>
            </div>
    `;
    
    if (errori.length > 0) {
        html += `
            <div style="background: #fef2f2; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #ef4444;">
                <h4 style="margin: 0 0 0.5rem 0; color: #991b1b; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">error</span>
                    Errori riscontrati
                </h4>
                <div style="max-height: 200px; overflow-y: auto;">
        `;
        
        errori.slice(0, 10).forEach(err => {
            html += `
                <div style="padding: 0.5rem; border-bottom: 1px solid #fecaca; font-size: 0.85rem;">
                    <strong style="color: #991b1b;">Riga ${err.riga}:</strong> ${err.errore}
                    <div style="font-family: monospace; color: #64748b; font-size: 0.8rem; margin-top: 0.25rem;">${err.dati}</div>
                </div>
            `;
        });
        
        if (errori.length > 10) {
            html += `<div style="padding: 0.5rem; color: #92400e;">... e altri ${errori.length - 10} errori</div>`;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += `
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid var(--primary);">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">info</span>
                    Riepilogo operazione
                </h4>
                <ul style="margin: 0; padding-left: 1.5rem; color: #1e293b;">
                    <li>Turni da importare: <strong>${numTurni}</strong></li>
                    <li>Backup automatico: <strong>${backupCheck ? 'SÌ' : 'NO'}</strong></li>
                    <li>Sovrascrivi esistenti: <strong>${sovrascriviCheck ? 'SÌ' : 'NO'}</strong></li>
                </ul>
            </div>
            
            <div style="display: flex; gap: 1rem;">
                <button onclick="importaCSV()" class="btn-action btn-primary" style="margin-top: 0; flex: 2;">
                    <span class="material-symbols-rounded">cloud_upload</span>
                    Procedi con l'importazione
                </button>
                <button onclick="document.getElementById('anteprima-csv').style.display = 'none'" 
                        class="btn-action btn-secondary" style="margin-top: 0; flex: 1;">
                    <span class="material-symbols-rounded">close</span>
                    Annulla
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}

async function importaCSV() {
    try {
        const fileInput = document.getElementById('file-csv');
        const file = fileInput.files[0];
        
        if (!file) {
            mostraMessaggio('Nessun file selezionato', 'error');
            return;
        }
        
        // Leggi di nuovo il file per avere i dati
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            mostraMessaggio('File CSV vuoto', 'error');
            return;
        }
        
        const backupCheck = document.getElementById('backup-csv').checked;
        const sovrascriviCheck = document.getElementById('sovrascrivi-csv').checked;
        
        mostraLoading('Importazione CSV in corso...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
        // ========================
        // 1. VALIDAZIONE E PREPARAZIONE
        // ========================
        console.log('📋 Validazione CSV in corso...');
        
        const { righeValide, errori, turniDaImportare, zoneEsistenti } = await validazioneCSVCompleta(lines);
        
        if (righeValide.length === 0) {
            mostraMessaggio('Nessuna riga valida da importare', 'error');
            nascondiLoading();
            return;
        }
        
        // ========================
        // 2. CREA LOG INIZIALE
        // ========================
        console.log('📝 Creazione log operazione...');
        
        const { data: log, error: logError } = await supabase
            .from('log_caricamenti_csv')
            .insert([{
                nome_file: file.name,
                righe_totali: lines.length - 1, // escludi header
                righe_importate: 0,
                righe_errate: errori.length,
                errori_json: errori,
                caricato_da: adminName,
                sovrascrivi_esistenti: sovrascriviCheck,
                backup_eseguito: false
            }])
            .select()
            .single();
        
        if (logError) throw logError;
        
        // ========================
        // 3. BACKUP (SE RICHIESTO)
        // ========================
        if (backupCheck) {
            console.log('💾 Creazione backup...');
            await creaBackupTurni(supabase, log.id, zoneEsistenti);
            
            // Aggiorna log con info backup
            await supabase
                .from('log_caricamenti_csv')
                .update({ backup_eseguito: true })
                .eq('id', log.id);
        }
        
        // ========================
        // 4. IMPORT TURNI
        // ========================
        console.log('🚀 Importazione turni...');
        
        let turniImportati = 0;
        const erroriImport = [];
        
        for (const turno of turniDaImportare) {
            try {
                if (sovrascriviCheck) {
                    // Cerca turno esistente per questa zona e periodo
                    const { data: esistente, error: checkError } = await supabase
                        .from('turni_reperibilita')
                        .select('id')
                        .eq('zona_id', turno.zona_id)
                        .eq('data_inizio', turno.data_inizio)
                        .eq('data_fine', turno.data_fine)
                        .maybeSingle();
                    
                    if (checkError) throw checkError;
                    
                    if (esistente) {
                        // Aggiorna turno esistente
                        const { error: updateError } = await supabase
                            .from('turni_reperibilita')
                            .update({
                                tecnico_id: turno.tecnico_id,
                                stato: 'originale',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', esistente.id);
                        
                        if (updateError) throw updateError;
                    } else {
                        // Inserisci nuovo turno
                        const { error: insertError } = await supabase
                            .from('turni_reperibilita')
                            .insert([turno]);
                        
                        if (insertError) throw insertError;
                    }
                } else {
                    // Solo inserimento (no sovrascrittura)
                    const { error: insertError } = await supabase
                        .from('turni_reperibilita')
                        .insert([turno]);
                    
                    if (insertError) {
                        if (insertError.code === '23505') {
                            // Violazione unique constraint - turno già esiste
                            erroriImport.push({
                                turno: turno,
                                errore: 'Turno già esistente (non sovrascritto)'
                            });
                            continue;
                        }
                        throw insertError;
                    }
                }
                
                turniImportati++;
                
            } catch (turnoError) {
                console.error('❌ Errore import turno:', turnoError);
                erroriImport.push({
                    turno: turno,
                    errore: turnoError.message
                });
            }
        }
        
        // ========================
        // 5. AGGIORNA LOG FINALE
        // ========================
        console.log('📊 Aggiornamento log finale...');
        
        const erroriFinali = [...errori, ...erroriImport.map(e => ({
            riga: 'N/A',
            errore: e.errore,
            dati: JSON.stringify(e.turno)
        }))];
        
        await supabase
            .from('log_caricamenti_csv')
            .update({
                righe_importate: turniImportati,
                righe_errate: erroriFinali.length,
                errori_json: erroriFinali
            })
            .eq('id', log.id);
        
        // ========================
        // 6. PULIZIA E NOTIFICA
        // ========================
        nascondiLoading();
        
        // Reset form
        rimuoviFile();
        document.getElementById('anteprima-csv').style.display = 'none';
        
        // Mostra risultato
        const messaggio = `
            Importazione completata!<br>
            • Turni importati: <strong>${turniImportati}</strong><br>
            • Errori totali: <strong>${erroriFinali.length}</strong><br>
            • Backup: <strong>${backupCheck ? 'Eseguito' : 'Non eseguito'}</strong>
        `;
        
        mostraMessaggio(messaggio, turniImportati > 0 ? 'success' : 'warning');
        
        // Ricarica storico
        await caricaStoricoCSV();
        
        console.log(`✅ Importazione completata: ${turniImportati} turni importati`);
        
    } catch (error) {
        console.error('❌ Errore importazione CSV:', error);
        nascondiLoading();
        mostraMessaggio(`Errore nell'importazione: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI DI SUPPORTO PER IMPORT CSV
// ============================================

async function validazioneCSVCompleta(lines) {
    const errori = [];
    const righeValide = [];
    const turniDaImportare = [];
    
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('DB non configurato');
    
    // Carica zone esistenti
    const { data: zoneEsistenti, error: errorZone } = await supabase
        .from('zone_reperibilita')
        .select('id, nome')
        .eq('attivo', true);
    
    if (errorZone) throw errorZone;
    
    const nomiZoneValide = zoneEsistenti.map(z => z.nome);
    
    // Valida ogni riga (escludi header)
    for (let i = 1; i < lines.length; i++) {
        const riga = lines[i];
        const parti = riga.split(';');
        
        if (parti.length !== 3) {
            errori.push({ riga: i + 1, errore: 'Numero di colonne non valido', dati: riga });
            continue;
        }
        
        const [dataStr, zona, tecnico] = parti.map(p => p.trim());
        
        // Valida data
        const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dataRegex.test(dataStr)) {
            errori.push({ riga: i + 1, errore: 'Formato data non valido (usare YYYY-MM-DD)', dati: riga });
            continue;
        }
        
        const dataInizio = new Date(dataStr + 'T08:00:00');
        if (isNaN(dataInizio.getTime())) {
            errori.push({ riga: i + 1, errore: 'Data non valida', dati: riga });
            continue;
        }
        
        // Controlla che sia un venerdì
        if (dataInizio.getDay() !== 5) {
            errori.push({ riga: i + 1, errore: 'La data deve essere un venerdì', dati: riga });
            continue;
        }
        
        // Valida zona
        if (!nomiZoneValide.includes(zona)) {
            errori.push({ riga: i + 1, errore: `Zona "${zona}" non esistente o disattiva`, dati: riga });
            continue;
        }
        
        // Valida tecnico
        if (!tecnico || tecnico.length < 2) {
            errori.push({ riga: i + 1, errore: 'Nome tecnico non valido', dati: riga });
            continue;
        }
        
        // Calcola data fine (venerdì successivo 8:00)
        const dataFine = new Date(dataInizio);
        dataFine.setDate(dataFine.getDate() + 7);
        
        const zonaObj = zoneEsistenti.find(z => z.nome === zona);
        
        righeValide.push({
            riga: i + 1,
            dataInizio: dataInizio.toISOString(),
            dataFine: dataFine.toISOString(),
            zona: zona,
            tecnico: tecnico,
            rigaOriginale: riga
        });
        
        turniDaImportare.push({
            zona_id: zonaObj.id,
            tecnico_id: tecnico,
            data_inizio: dataInizio.toISOString(),
            data_fine: dataFine.toISOString(),
            stato: 'originale',
            peso_turno: 0 // Sarà calcolato dopo dal trigger/funzione
        });
    }
    
    return { righeValide, errori, turniDaImportare, zoneEsistenti };
}

async function creaBackupTurni(supabase, logId, zoneEsistenti) {
    try {
        // Ottieni tutti i turni esistenti per le zone che stiamo modificando
        const zoneIds = zoneEsistenti.map(z => z.id);
        
        const { data: turniEsistenti, error } = await supabase
            .from('turni_reperibilita')
            .select('*')
            .in('zona_id', zoneIds);
        
        if (error) throw error;
        
        // Crea backup per ogni turno
        const backupPromises = turniEsistenti.map(turno => 
            supabase
                .from('backup_turni')
                .insert([{
                    log_caricamento_id: logId,
                    turno_id: turno.id,
                    dati_turno_json: turno
                }])
        );
        
        await Promise.all(backupPromises);
        
        console.log(`💾 Backup creato: ${turniEsistenti.length} turni salvati`);
        
    } catch (error) {
        console.error('❌ Errore creazione backup:', error);
        throw error;
    }
}

async function caricaStoricoCSV() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data: storico, error } = await supabase
            .from('log_caricamenti_csv')
            .select('*')
            .order('data_caricamento', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        caricamentiList = storico || [];
        aggiornaUI_StoricoCSV();
        
    } catch (error) {
        console.error('❌ Errore caricamento storico CSV:', error);
        mostraMessaggio('Errore nel caricamento storico', 'error');
    }
}

function aggiornaUI_StoricoCSV() {
    const container = document.getElementById('storico-caricamenti');
    if (!container) return;
    
    if (caricamentiList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">history</span>
                <p style="margin-top: 0.5rem;">Nessun caricamento effettuato</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    caricamentiList.forEach(log => {
        const data = new Date(log.data_caricamento).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="elemento-item">
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; color: var(--text-main); font-weight: 800;">${log.nome_file}</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${data} • da ${log.caricato_da}</p>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: ${log.righe_errate > 0 ? '#f59e0b' : '#22c55e'};">
                        ${log.righe_importate}/${log.righe_totali} righe importate • ${log.righe_errate} errori
                    </p>
                </div>
                <button onclick="visualizzaDettaglioCaricamento('${log.id}')" 
                        style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                    <span class="material-symbols-rounded">visibility</span>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function visualizzaDettaglioCaricamento(id) {
    // Da implementare
    mostraMessaggio('Visualizzazione dettaglio in sviluppo', 'warning');
}

// ============================================
// FUNZIONI GESTIONE FESTIVITÀ (TAB 3)
// ============================================

async function caricaFestivita() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const filtroAnno = document.getElementById('filtro-anno-festivita').value;
        
        // PRIMA: otteniamo tutte le festività
        let query = supabase
            .from('festivita_italiane')
            .select('*')
            .order('data', { ascending: true });
        
        const { data: festivita, error } = await query;
        
        if (error) throw error;
        
        // DOPO: filtriamo lato client per anno e facciamo join con zone
        let festivitaFiltrate = festivita || [];
        
        if (filtroAnno !== 'tutti') {
            festivitaFiltrate = festivitaFiltrate.filter(f => {
                const annoFestivita = new Date(f.data).getFullYear();
                return annoFestivita.toString() === filtroAnno;
            });
        }
        
        // Ora otteniamo i nomi delle zone per le festività locali
        const festivitaConZone = await Promise.all(
            festivitaFiltrate.map(async (fest) => {
                if (fest.tipo === 'locale' && fest.zona_id) {
                    try {
                        const { data: zona, error: zonaError } = await supabase
                            .from('zone_reperibilita')
                            .select('nome')
                            .eq('id', fest.zona_id)
                            .single();
                        
                        if (!zonaError && zona) {
                            return { ...fest, zona_nome: zona.nome };
                        }
                    } catch (error) {
                        console.warn('❌ Errore recupero zona:', error);
                    }
                }
                return { ...fest, zona_nome: null };
            })
        );
        
        festivitaList = festivitaConZone;
        aggiornaUI_Festivita();
        
    } catch (error) {
        console.error('❌ Errore caricamento festività:', error);
        mostraMessaggio('Errore nel caricamento delle festività', 'error');
    }
}

function aggiornaUI_Festivita() {
    const container = document.getElementById('lista-festivita');
    if (!container) return;
    
    if (festivitaList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">event_busy</span>
                <p style="margin-top: 0.5rem;">Nessuna festività configurata</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    festivitaList.forEach(fest => {
        const data = new Date(fest.data + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
});
        
        let tipoBadge = '';
        switch(fest.tipo) {
            case 'nazionale':
                tipoBadge = '<span style="background: #3B82F6; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">NAZIONALE</span>';
                break;
            case 'regionale':
                tipoBadge = '<span style="background: #8B5CF6; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">REGIONALE</span>';
                break;
            case 'locale':
                tipoBadge = `<span style="background: #10B981; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">LOCALE: ${fest.zona_nome || 'N/D'}</span>`;
                break;
        }
        
        html += `
            <div class="elemento-item">
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; color: var(--text-main); font-weight: 800;">${fest.nome}</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${data}</p>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        ${tipoBadge}
                    </div>
                </div>
                <button onclick="eliminaFestivita('${fest.id}')" 
                        style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function salvaFestivita() {
    try {
        const dataInput = document.getElementById('data-festivita').value;
        const nome = document.getElementById('nome-festivita').value.trim();
        const tipo = document.getElementById('tipo-festivita').value;
        const zonaId = tipo === 'locale' ? document.getElementById('zona-festivita').value : null;
        const note = document.getElementById('note-festivita').value.trim();
        
        if (!dataInput || !nome) {
            mostraMessaggio('Compila tutti i campi obbligatori', 'error');
            return;
        }
        
        if (tipo === 'locale' && !zonaId) {
            mostraMessaggio('Seleziona una zona per le festività locali', 'error');
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('festivita_italiane')
            .insert([{
                data: dataInput, // Già in formato YYYY-MM-DD dall'input date
                nome: nome,
                tipo: tipo,
                zona_id: zonaId || null,
                note: note || null
            }]);
        
        if (error) {
            if (error.code === '23505') {
                mostraMessaggio('Questa festività è già registrata per questa data/zona', 'error');
                return;
            }
            throw error;
        }
        
        // Reset form
        document.getElementById('data-festivita').value = '';
        document.getElementById('nome-festivita').value = '';
        document.getElementById('tipo-festivita').value = 'nazionale';
        document.getElementById('zona-festivita-container').style.display = 'none';
        document.getElementById('zona-festivita').value = '';
        document.getElementById('note-festivita').value = '';
        
        mostraMessaggio(`Festività "${nome}" aggiunta con successo!`, 'success');
        
        // Ricarica lista
        await caricaFestivita();
        
    } catch (error) {
        console.error('❌ Errore aggiunta festività:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}
async function eliminaFestivita(id) {
    try {
        if (!confirm('Sei sicuro di voler eliminare questa festività?')) {
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('festivita_italiane')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        mostraMessaggio('Festività eliminata', 'success');
        await caricaFestivita();
        
    } catch (error) {
        console.error('❌ Errore eliminazione festività:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI TURNI E APPROVAZIONI (TAB 4-5)
// ============================================

async function caricaTurni() {
    try {
        console.log('📅 Caricamento turni per visualizzazione...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const filtroZona = document.getElementById('filtro-zona-turni')?.value || '';
        const filtroMese = document.getElementById('filtro-mese-turni')?.value || '';
        
        // Costruisci query base
        let query = supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(nome, colore_hex),
                richieste_cambio!left(id, stato)
            `)
            .order('data_inizio', { ascending: true });
        
        // Applica filtro zona se selezionato
        if (filtroZona) {
            query = query.eq('zona_id', filtroZona);
        }
        
        // Applica filtro mese se selezionato
        if (filtroMese) {
            const annoCorrente = new Date().getFullYear();
            const inizioMese = new Date(annoCorrente, filtroMese - 1, 1);
            const fineMese = new Date(annoCorrente, filtroMese, 0);
            
            query = query
                .gte('data_inizio', inizioMese.toISOString())
                .lte('data_inizio', fineMese.toISOString());
        }
        
        const { data: turni, error } = await query;
        
        if (error) throw error;
        
        turniList = turni || [];
        console.log(`✅ Turni caricati: ${turniList.length}`);
        aggiornaUI_Turni();
        
    } catch (error) {
        console.error('❌ Errore caricamento turni:', error);
        mostraMessaggio('Errore nel caricamento dei turni', 'error');
    }
}

async function caricaRichiestePending() {
    // Implementazione base
    const container = document.getElementById('lista-richieste-pending');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">check_circle</span>
                <p style="margin-top: 0.5rem;">Nessuna richiesta in attesa</p>
            </div>
        `;
    }
}

// ============================================
// FUNZIONI APPROVAZIONI RICHIESTE (TAB 5)
// ============================================

let richiestePendingList = [];
let richiestaSelezionata = null;

async function caricaRichiestePending() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const filtroStato = document.getElementById('filtro-stato-approvazioni').value;
        
        console.log('📋 Caricamento richieste pending...');
        
        // Query base per richieste da approvare
        let query = supabase
            .from('richieste_cambio')
            .select(`
                *,
                turni_reperibilita!inner(
                    *,
                    zone_reperibilita!inner(nome, colore_hex)
                )
            `)
            .in('stato', ['pending', 'peer_approval', 'admin_approval'])
            .order('data_richiesta', { ascending: true });
        
        // Applica filtro se non "tutti"
        if (filtroStato !== 'tutti') {
            query = query.eq('stato', filtroStato);
        }
        
        const { data: richieste, error } = await query;
        
        if (error) throw error;
        
        richiestePendingList = richieste || [];
        aggiornaUI_RichiestePending();
        
    } catch (error) {
        console.error('❌ Errore caricamento richieste:', error);
        mostraMessaggio('Errore nel caricamento delle richieste', 'error');
    }
}

function aggiornaUI_RichiestePending() {
    const container = document.getElementById('lista-richieste-pending');
    if (!container) return;
    
    if (richiestePendingList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">check_circle</span>
                <p style="margin-top: 0.5rem; font-weight: 800; color: var(--primary);">Tutto in ordine!</p>
                <p style="font-size: 0.9rem;">Nessuna richiesta in attesa di approvazione</p>
            </div>
        `;
        return;
    }
    
    // Raggruppa richieste per turno
    const richiestePerTurno = {};
    
    richiestePendingList.forEach(richiesta => {
        const turnoId = richiesta.turno_originale_id;
        
        if (!richiestePerTurno[turnoId]) {
            richiestePerTurno[turnoId] = {
                turno: richiesta.turni_reperibilita,
                richieste: []
            };
        }
        
        richiestePerTurno[turnoId].richieste.push(richiesta);
    });
    
    let html = '';
    
    Object.values(richiestePerTurno).forEach((gruppo, index) => {
        const turno = gruppo.turno;
        const richiesteTurno = gruppo.richieste;
        const zona = turno.zone_reperibilita;
        
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        
        const dataInizio = inizio.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const dataFine = fine.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Conta richieste per tipo
        const conteggioTipi = {
            scambio: richiesteTurno.filter(r => r.tipo === 'scambio').length,
            sostituzione: richiesteTurno.filter(r => r.tipo === 'sostituzione').length,
            cessione: richiesteTurno.filter(r => r.tipo === 'cessione_parziale').length
        };
        
        const haConflitti = richiesteTurno.length > 1;
        
        html += `
            <div class="elemento-item" style="flex-direction: column; align-items: stretch; border-left: 4px solid ${zona?.colore_hex || '#3B82F6'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <div class="turno-zona" style="background: ${zona?.colore_hex}20; color: ${zona?.colore_hex};">${zona?.nome || 'Zona'}</div>
                            ${haConflitti ? '<span class="stato-badge stato-pending">⚠️ ' + richiesteTurno.length + ' richieste</span>' : ''}
                        </div>
                        <h4 style="margin: 0 0 0.25rem 0; color: var(--text-main); font-weight: 800;">${dataInizio} → ${dataFine}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
                            Tecnico attuale: <strong>${turno.tecnico_id}</strong>
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Tipi richieste:</div>
                        <div style="display: flex; gap: 0.5rem;">
                            ${conteggioTipi.scambio > 0 ? `<span style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">${conteggioTipi.scambio} scambi</span>` : ''}
                            ${conteggioTipi.sostituzione > 0 ? `<span style="background: #d1fae5; color: #065f46; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">${conteggioTipi.sostituzione} sost.</span>` : ''}
                            ${conteggioTipi.cessione > 0 ? `<span style="background: #f3e8ff; color: #6b21a8; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">${conteggioTipi.cessione} cessioni</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Lista richieste per questo turno -->
                <div style="margin-bottom: 1rem;">
                    ${richiesteTurno.map((richiesta, idx) => `
                        <div style="background: ${idx % 2 === 0 ? '#f8fafc' : 'white'}; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                        <span class="material-symbols-rounded" style="color: ${getColoreTipo(richiesta.tipo)}; font-size: 1rem;">
                                            ${getIconaTipo(richiesta.tipo)}
                                        </span>
                                        <span style="font-weight: 800; color: var(--text-main);">${getTestoTipo(richiesta.tipo)}</span>
                                        <span class="stato-badge ${getClasseStato(richiesta.stato)}">${getTestoStato(richiesta.stato)}</span>
                                    </div>
                                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
                                        <strong>Da:</strong> ${richiesta.tecnico_richiedente_id}
                                        ${richiesta.tecnico_destinatario_id ? `<br><strong>A:</strong> ${richiesta.tecnico_destinatario_id}` : ''}
                                        ${richiesta.nuovo_tecnico_id ? `<br><strong>Sostituto:</strong> ${richiesta.nuovo_tecnico_id}` : ''}
                                    </p>
                                </div>
                                <div style="display: flex; gap: 0.25rem;">
                                    <button onclick="mostraDettaglioRichiesta('${richiesta.id}')" 
                                            style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                                        <span class="material-symbols-rounded">visibility</span>
                                    </button>
                                    ${haConflitti ? `
                                    <button onclick="mostraConflitti('${turno.id}')" 
                                            style="background: none; border: none; color: #f59e0b; cursor: pointer; padding: 0.5rem; border-radius: 8px;">
                                        <span class="material-symbols-rounded">warning</span>
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                            ${richiesta.motivo ? `
                            <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--text-main); font-style: italic;">
                                "${richiesta.motivo}"
                            </p>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Pulsanti azione di gruppo -->
                ${!haConflitti ? `
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="rifiutaRichiesta('${richiesteTurno[0].id}')" 
                            class="btn-action btn-danger" style="flex: 1; padding: 0.75rem; margin-top: 0;">
                        <span class="material-symbols-rounded">close</span>
                        Rifiuta
                    </button>
                    <button onclick="approvaRichiesta('${richiesteTurno[0].id}')" 
                            class="btn-action btn-success" style="flex: 1; padding: 0.75rem; margin-top: 0;">
                        <span class="material-symbols-rounded">check</span>
                        Approva
                    </button>
                </div>
                ` : `
                <div style="display: flex; justify-content: center;">
                    <button onclick="mostraConflitti('${turno.id}')" 
                            class="btn-action" style="background: #f59e0b; color: white; padding: 0.75rem; margin-top: 0;">
                        <span class="material-symbols-rounded">warning</span>
                        Gestisci ${richiesteTurno.length} richieste in conflitto
                    </button>
                </div>
                `}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Funzioni helper per tipi e stati
function getIconaTipo(tipo) {
    switch(tipo) {
        case 'scambio': return 'swap_horiz';
        case 'sostituzione': return 'person_add';
        case 'cessione_parziale': return 'call_split';
        default: return 'swap_horiz';
    }
}

function getColoreTipo(tipo) {
    switch(tipo) {
        case 'scambio': return '#3B82F6';
        case 'sostituzione': return '#10B981';
        case 'cessione_parziale': return '#8B5CF6';
        default: return '#6B7280';
    }
}

function getTestoTipo(tipo) {
    switch(tipo) {
        case 'scambio': return 'Scambio';
        case 'sostituzione': return 'Sostituzione';
        case 'cessione_parziale': return 'Cessione Parziale';
        default: return tipo;
    }
}

function getClasseStato(stato) {
    switch(stato) {
        case 'pending': return 'stato-pending';
        case 'peer_approval': return 'stato-peer';
        case 'admin_approval': return 'stato-pending';
        default: return 'stato-pending';
    }
}

function getTestoStato(stato) {
    switch(stato) {
        case 'pending': return 'In attesa';
        case 'peer_approval': return 'Attesa collega';
        case 'admin_approval': return 'Da approvare';
        default: return stato;
    }
}

async function mostraDettaglioRichiesta(richiestaId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data: richiesta, error } = await supabase
            .from('richieste_cambio')
            .select(`
                *,
                turni_reperibilita!inner(
                    *,
                    zone_reperibilita!inner(*)
                )
            `)
            .eq('id', richiestaId)
            .single();
        
        if (error) throw error;
        
        richiestaSelezionata = richiesta;
        
        const turno = richiesta.turni_reperibilita;
        const zona = turno.zone_reperibilita;
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        
        const dataInizio = inizio.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dataFine = fine.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let dettagliSpecifici = '';
        
        switch(richiesta.tipo) {
            case 'scambio':
                dettagliSpecifici = `
                    <div style="background: #dbeafe; border-radius: 8px; padding: 1rem; margin: 1rem 0; border-left: 4px solid #3B82F6;">
                        <div style="font-weight: 800; color: #1e40af; margin-bottom: 0.5rem;">Scambio proposto:</div>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${richiesta.tecnico_richiedente_id}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Richiedente</div>
                            </div>
                            <span class="material-symbols-rounded" style="color: #3B82F6; font-size: 2rem;">swap_horiz</span>
                            <div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${richiesta.tecnico_destinatario_id}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Destinatario</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'sostituzione':
                dettagliSpecifici = `
                    <div style="background: #d1fae5; border-radius: 8px; padding: 1rem; margin: 1rem 0; border-left: 4px solid #10B981;">
                        <div style="font-weight: 800; color: #065f46; margin-bottom: 0.5rem;">Sostituzione proposta:</div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Attuale</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${richiesta.tecnico_richiedente_id}</div>
                            </div>
                            <span class="material-symbols-rounded" style="color: #10B981;">arrow_forward</span>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Nuovo</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${richiesta.nuovo_tecnico_id}</div>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'cessione_parziale':
                if (richiesta.dettagli_parziale_json) {
                    const dettagli = richiesta.dettagli_parziale_json;
                    const dataInizioCess = new Date(dettagli.data_inizio_cessione).toLocaleDateString('it-IT');
                    const dataFineCess = new Date(dettagli.data_fine_cessione).toLocaleDateString('it-IT');
                    
                    dettagliSpecifici = `
                        <div style="background: #f3e8ff; border-radius: 8px; padding: 1rem; margin: 1rem 0; border-left: 4px solid #8B5CF6;">
                            <div style="font-weight: 800; color: #6b21a8; margin-bottom: 0.5rem;">Cessione parziale:</div>
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                                <div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">Titolare</div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${richiesta.tecnico_richiedente_id}</div>
                                </div>
                                <span class="material-symbols-rounded" style="color: #8B5CF6;">arrow_forward</span>
                                <div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">Cessionario</div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${dettagli.tecnico_cessionario}</div>
                                </div>
                            </div>
                            <div style="font-size: 0.85rem; color: #6b21a8;">
                                Periodo ceduto: <strong>${dataInizioCess} → ${dataFineCess}</strong>
                            </div>
                        </div>
                    `;
                }
                break;
        }
        
        const content = `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <div class="turno-zona" style="background: ${zona?.colore_hex}20; color: ${zona?.colore_hex};">${zona?.nome || 'Zona'}</div>
                    <span class="stato-badge ${getClasseStato(richiesta.stato)}">${getTestoStato(richiesta.stato)}</span>
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span class="material-symbols-rounded" style="color: var(--primary);">calendar_today</span>
                        <div>
                            <div style="font-weight: 800; color: var(--text-main);">Turno originale</div>
                            <div style="color: var(--text-muted);">${dataInizio} → ${dataFine}</div>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                                Tecnico attuale: <strong>${turno.tecnico_id}</strong>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${dettagliSpecifici}
                
                <div style="background: #fffbeb; border-radius: 8px; padding: 1rem; margin: 1rem 0; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 800; color: #92400e; margin-bottom: 0.5rem;">Motivo della richiesta:</div>
                    <div style="color: #92400e;">${richiesta.motivo || 'Nessun motivo specificato'}</div>
                </div>
                
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                    <div>Richiesta inviata: ${new Date(richiesta.data_richiesta).toLocaleString('it-IT')}</div>
                    ${richiesta.data_approvazione_peer ? `<div>Approvato da collega: ${new Date(richiesta.data_approvazione_peer).toLocaleString('it-IT')}</div>` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('dettaglio-richiesta-content').innerHTML = content;
        document.getElementById('modale-dettaglio-richiesta').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore caricamento dettaglio richiesta:', error);
        mostraMessaggio('Errore nel caricamento dei dettagli', 'error');
    }
}

function chiudiModaleDettaglioRichiesta() {
    document.getElementById('modale-dettaglio-richiesta').style.display = 'none';
    richiestaSelezionata = null;
}

async function mostraConflitti(turnoId) {
    const richiesteConflitto = richiestePendingList.filter(r => r.turno_originale_id === turnoId);
    
    if (richiesteConflitto.length <= 1) {
        mostraMessaggio('Nessun conflitto trovato', 'warning');
        return;
    }
    
    const turno = richiesteConflitto[0].turni_reperibilita;
    const zona = turno.zone_reperibilita;
    const inizio = new Date(turno.data_inizio);
    const fine = new Date(turno.data_fine);
    
    let html = `
        <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem;">
            <div style="font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">Turno in conflitto:</div>
            <div style="color: var(--text-muted);">
                ${zona?.nome || 'Zona'} • ${inizio.toLocaleDateString('it-IT')} → ${fine.toLocaleDateString('it-IT')}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                Tecnico attuale: <strong>${turno.tecnico_id}</strong>
            </div>
        </div>
        
        <div style="font-weight: 800; color: var(--text-main); margin-bottom: 1rem;">Richieste in conflitto:</div>
    `;
    
    richiesteConflitto.forEach((richiesta, index) => {
        html += `
            <div style="background: ${index % 2 === 0 ? 'white' : '#f8fafc'}; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <span class="material-symbols-rounded" style="color: ${getColoreTipo(richiesta.tipo)};">${getIconaTipo(richiesta.tipo)}</span>
                            <span style="font-weight: 800; color: var(--text-main);">${getTestoTipo(richiesta.tipo)}</span>
                            <span class="stato-badge ${getClasseStato(richiesta.stato)}">${getTestoStato(richiesta.stato)}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            Da: <strong>${richiesta.tecnico_richiedente_id}</strong>
                            ${richiesta.tecnico_destinatario_id ? ` • A: <strong>${richiesta.tecnico_destinatario_id}</strong>` : ''}
                            ${richiesta.nuovo_tecnico_id ? ` • Sostituto: <strong>${richiesta.nuovo_tecnico_id}</strong>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.25rem;">
                        <button onclick="mostraDettaglioRichiesta('${richiesta.id}')" 
                                style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 0.5rem; border-radius: 8px; cursor: pointer;">
                            Dettagli
                        </button>
                        <button onclick="approvaRichiesta('${richiesta.id}')" 
                                style="background: #22c55e; border: none; color: white; padding: 0.5rem; border-radius: 8px; cursor: pointer;">
                            Approva
                        </button>
                    </div>
                </div>
                ${richiesta.motivo ? `
                <div style="font-size: 0.85rem; color: var(--text-main); font-style: italic; margin-top: 0.5rem;">
                    "${richiesta.motivo.substring(0, 100)}${richiesta.motivo.length > 100 ? '...' : ''}"
                </div>
                ` : ''}
            </div>
        `;
    });
    
    html += `
        <div style="background: #fef2f2; border-radius: 8px; padding: 1rem; margin-top: 1rem; border-left: 4px solid #ef4444;">
            <div style="font-weight: 800; color: #991b1b; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-symbols-rounded">info</span>
                Importante
            </div>
            <div style="color: #991b1b; font-size: 0.9rem; margin-top: 0.25rem;">
                Puoi approvare solo UNA richiesta per turno. Le altre verranno automaticamente rifiutate.
            </div>
        </div>
    `;
    
    document.getElementById('contenuto-conflitti').innerHTML = html;
    document.getElementById('modale-conflitti').style.display = 'flex';
}

function chiudiModaleConflitti() {
    document.getElementById('modale-conflitti').style.display = 'none';
}

async function approvaRichiesta(richiestaId) {
    if (!confirm('Sei sicuro di voler approvare questa richiesta?')) {
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // 1. Ottieni la richiesta completa
        const { data: richiesta, error: fetchError } = await supabase
            .from('richieste_cambio')
            .select('*')
            .eq('id', richiestaId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Rifiuta automaticamente altre richieste per lo stesso turno
        const { error: rifiutaAltriError } = await supabase
            .from('richieste_cambio')
            .update({ 
                stato: 'rejected',
                note_approvazione: 'Rifiutata automaticamente: altra richiesta approvata per lo stesso turno'
            })
            .eq('turno_originale_id', richiesta.turno_originale_id)
            .neq('id', richiestaId)
            .in('stato', ['pending', 'peer_approval', 'admin_approval']);
        
        if (rifiutaAltriError) throw rifiutaAltriError;
        
        // 3. Applica la modifica al turno in base al tipo
        let updateTurnoData = {};
        
        switch(richiesta.tipo) {
            case 'scambio':
                // Per scambio, dobbiamo trovare il turno del destinatario
                // (Implementazione semplificata - nella realtà più complessa)
                updateTurnoData.tecnico_id = richiesta.tecnico_destinatario_id;
                updateTurnoData.stato = 'modificato';
                break;
                
            case 'sostituzione':
                updateTurnoData.tecnico_id = richiesta.nuovo_tecnico_id;
                updateTurnoData.stato = 'modificato';
                break;
                
            case 'cessione_parziale':
                // Per cessioni parziali, crea record in turni_parziali
                if (richiesta.dettagli_parziale_json) {
                    const dettagli = richiesta.dettagli_parziale_json;
                    
                    const { error: creaCessioneError } = await supabase
                        .from('turni_parziali')
                        .insert([{
                            turno_originale_id: richiesta.turno_originale_id,
                            tecnico_titolare_id: richiesta.tecnico_richiedente_id,
                            tecnico_cessionario_id: dettagli.tecnico_cessionario,
                            data_inizio_cessione: dettagli.data_inizio_cessione,
                            data_fine_cessione: dettagli.data_fine_cessione,
                            stato: 'attivo'
                        }]);
                    
                    if (creaCessioneError) throw creaCessioneError;
                    
                    // Aggiorna anche il turno originale
                    updateTurnoData.stato = 'parziale';
                }
                break;
        }
        
        // 4. Aggiorna il turno se necessario
        if (Object.keys(updateTurnoData).length > 0) {
            const { error: updateTurnoError } = await supabase
                .from('turni_reperibilita')
                .update(updateTurnoData)
                .eq('id', richiesta.turno_originale_id);
            
            if (updateTurnoError) throw updateTurnoError;
        }
        
        // 5. Aggiorna lo stato della richiesta
        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
        const { error: updateRichiestaError } = await supabase
            .from('richieste_cambio')
            .update({
                stato: 'approved',
                approvato_da_admin_id: adminName,
                data_approvazione: new Date().toISOString(),
                note_approvazione: `Approvata da ${adminName}`
            })
            .eq('id', richiestaId);
        
        if (updateRichiestaError) throw updateRichiestaError;
        
        // 6. Crea record storico
        const { error: storicoError } = await supabase
            .from('storico_turni')
            .insert([{
                turno_id: richiesta.turno_originale_id,
                operazione: 'modifica',
                dati_precedenti_json: { richiesta_id: richiestaId, stato_precedente: richiesta.stato },
                dati_nuovi_json: { stato_nuovo: 'approved', approvato_da: adminName },
                operato_da: adminName,
                ruolo_operatore: 'admin',
                richiesta_cambio_id: richiestaId
            }]);
        
        if (storicoError) throw storicoError;
        
        // 7. Chiudi modali e aggiorna UI
        chiudiModaleDettaglioRichiesta();
        chiudiModaleConflitti();
        
        mostraMessaggio('Richiesta approvata con successo!', 'success');
        
        // 8. Ricarica la lista
        await caricaRichiestePending();
        
    } catch (error) {
        console.error('❌ Errore approvazione richiesta:', error);
        mostraMessaggio(`Errore nell'approvazione: ${error.message}`, 'error');
    }
}

async function rifiutaRichiesta(richiestaId) {
    const motivo = prompt("Motivo del rifiuto (opzionale):");
    
    if (motivo === null) return; // Utente ha cancellato
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
        // Aggiorna lo stato della richiesta
        const { error } = await supabase
            .from('richieste_cambio')
            .update({
                stato: 'rejected',
                approvato_da_admin_id: adminName,
                data_approvazione: new Date().toISOString(),
                note_approvazione: motivo ? `Rifiutata: ${motivo}` : 'Rifiutata senza motivo specificato'
            })
            .eq('id', richiestaId);
        
        if (error) throw error;
        
        // Crea record storico
        await supabase
            .from('storico_turni')
            .insert([{
                turno_id: richiestaId,
                operazione: 'modifica',
                dati_nuovi_json: { stato: 'rejected', motivazione: motivo },
                operato_da: adminName,
                ruolo_operatore: 'admin',
                richiesta_cambio_id: richiestaId
            }]);
        
        // Chiudi modali e aggiorna UI
        chiudiModaleDettaglioRichiesta();
        
        mostraMessaggio('Richiesta rifiutata', 'success');
        
        // Ricarica la lista
        await caricaRichiestePending();
        
    } catch (error) {
        console.error('❌ Errore rifiuto richiesta:', error);
        mostraMessaggio(`Errore nel rifiuto: ${error.message}`, 'error');
    }
}

// Funzioni wrapper per i pulsanti nel modale
function approvaRichiestaSelezionata() {
    if (richiestaSelezionata) {
        approvaRichiesta(richiestaSelezionata.id);
    }
}

function rifiutaRichiestaSelezionata() {
    if (richiestaSelezionata) {
        rifiutaRichiesta(richiestaSelezionata.id);
    }
}

async function caricaStoricoApprovazioni() {
    // Implementazione base
    const container = document.getElementById('storico-approvazioni');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">construction</span>
                <p style="margin-top: 0.5rem;">Funzionalità in sviluppo</p>
            </div>
        `;
    }
}

// ============================================
// FUNZIONI UTILITY
// ============================================

function mostraMessaggio(testo, tipo = 'info') {
    const messaggioDiv = document.getElementById('messaggio-admin');
    if (!messaggioDiv) return;
    
    messaggioDiv.textContent = testo;
    messaggioDiv.className = 'message';
    
    switch(tipo) {
        case 'success': 
            messaggioDiv.classList.add('message-success'); 
            break;
        case 'error': 
            messaggioDiv.classList.add('message-error'); 
            break;
        case 'warning': 
            messaggioDiv.classList.add('message-warning'); 
            break;
        default: 
            messaggioDiv.classList.add('message-info');
    }
    
    messaggioDiv.style.display = 'block';
    
    setTimeout(() => {
        messaggioDiv.style.display = 'none';
    }, 5000);
}

function mostraLoading(testo = 'Caricamento...') {
    let loading = document.getElementById('loading-overlay-admin');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay-admin';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 1rem;
        `;
        loading.innerHTML = `
            <div style="width: 50px; height: 50px; border: 4px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-weight: 800; color: var(--primary);">${testo}</div>
        `;
        document.body.appendChild(loading);
    }
    
    loading.style.display = 'flex';
}

function nascondiLoading() {
    const loading = document.getElementById('loading-overlay-admin');
    if (loading) loading.style.display = 'none';
}
// ============================================
// FUNZIONI VISUALIZZAZIONE TURNI (TAB 4)
// ============================================

async function caricaTurni() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        console.log('📅 Caricamento turni per visualizzazione...');
        
        const filtroZona = document.getElementById('filtro-zona-turni').value;
        const filtroMese = document.getElementById('filtro-mese-turni').value;
        
        // Costruisci query base
        let query = supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(nome, colore_hex),
                richieste_cambio!left(id, stato)
            `)
            .order('data_inizio', { ascending: true });
        
        // Applica filtri
        if (filtroZona) {
            query = query.eq('zona_id', filtroZona);
        }
        
        if (filtroMese) {
            const annoCorrente = new Date().getFullYear();
            const inizioMese = new Date(annoCorrente, filtroMese - 1, 1);
            const fineMese = new Date(annoCorrente, filtroMese, 0);
            
            query = query
                .gte('data_inizio', inizioMese.toISOString())
                .lte('data_inizio', fineMese.toISOString());
        }
        
        const { data: turni, error } = await query;
        
        if (error) throw error;
        
        turniList = turni || [];
        aggiornaUI_Turni();
        
    } catch (error) {
        console.error('❌ Errore caricamento turni:', error);
        mostraMessaggio('Errore nel caricamento dei turni', 'error');
    }
}

function aggiornaUI_Turni() {
    const container = document.getElementById('calendario-turni');
    if (!container) {
        console.error('❌ Container calendario-turni non trovato');
        return;
    }
    
    if (!turniList || turniList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">calendar_today</span>
                <p style="margin-top: 0.5rem;">Nessun turno trovato con i filtri selezionati</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Prova a modificare i filtri</p>
            </div>
        `;
        return;
    }
    
    // Raggruppa turni per mese
    const turniPerMese = {};
    
    turniList.forEach(turno => {
        const dataInizio = new Date(turno.data_inizio);
        const meseAnno = dataInizio.toLocaleDateString('it-IT', { 
            month: 'long', 
            year: 'numeric' 
        }).toUpperCase();
        
        if (!turniPerMese[meseAnno]) {
            turniPerMese[meseAnno] = [];
        }
        
        turniPerMese[meseAnno].push(turno);
    });
    
    let html = '';
    
    // Calcola totali per riepilogo
    const tecniciUnici = [...new Set(turniList.map(t => t.tecnico_id))];
    const zoneUniche = [...new Set(turniList.map(t => t.zona_id))];
    const pesoTotale = turniList.reduce((sum, t) => sum + (t.peso_turno || 2), 0);
    
    // Riepilogo
    html += `
        <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--border);">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${turniList.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Turni totali</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: #10B981;">${zoneUniche.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Zone coperte</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: #8B5CF6;">${tecniciUnici.length}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Tecnici</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: #F59E0B;">${pesoTotale}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Peso totale</div>
                </div>
            </div>
        </div>
    `;
    
    // Per ogni mese, crea sezione
    Object.entries(turniPerMese).forEach(([mese, turniDelMese]) => {
        html += `
            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--primary); 
                           padding: 0.75rem; background: #eff6ff; 
                           border-radius: 8px; margin-bottom: 1rem;">
                    <span class="material-symbols-rounded" style="vertical-align: middle; font-size: 1.2rem;">calendar_month</span>
                    ${mese}
                </h3>
        `;
        
        // Turni del mese
        turniDelMese.forEach(turno => {
            const inizio = new Date(turno.data_inizio);
            const fine = new Date(turno.data_fine);
            const zona = turno.zone_reperibilita || {};
            
            const dataInizio = inizio.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const dataFine = fine.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            // Stato turno (semplificato)
            let statoBadge = '';
            if (turno.stato === 'modificato' || turno.stato === 'parziale') {
                statoBadge = '<span style="background: #f59e0b; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800; margin-left: 0.5rem;">MODIFICATO</span>';
            }
            
            html += `
                <div class="elemento-item" style="border-left: 4px solid ${zona.colore_hex || '#3B82F6'}; margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 2;">
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                                <div style="width: 16px; height: 16px; border-radius: 4px; background: ${zona.colore_hex || '#3B82F6'};"></div>
                                <h4 style="margin: 0; color: var(--text-main); font-weight: 800;">${zona.nome || 'Zona'}</h4>
                                ${statoBadge}
                            </div>
                            
                            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                                ${dataInizio} → ${dataFine}
                            </div>
                            
                            <div style="font-size: 0.85rem; color: var(--text-main);">
                                <strong>Tecnico:</strong> ${turno.tecnico_id}
                            </div>
                        </div>
                        
                        <div style="flex: 1; text-align: right;">
                            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">Peso</div>
                            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">
                                ${turno.peso_turno || 2}
                            </div>
                            
                            <div style="margin-top: 1rem;">
                                <button onclick="apriModaleModificaTurno('${turno.id}')" 
                                        style="background: none; border: 1px solid var(--primary); 
                                               color: var(--primary); padding: 0.5rem 1rem; 
                                               border-radius: 8px; cursor: pointer; 
                                               font-weight: 600; font-size: 0.85rem;">
                                    <span class="material-symbols-rounded" style="font-size: 0.9rem;">edit</span>
                                    Modifica
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function calcolaTotaliTurni() {
    const tecniciUnici = [...new Set(turniList.map(t => t.tecnico_id))];
    const zoneUniche = [...new Set(turniList.map(t => t.zona_id))];
    const pesoTotale = turniList.reduce((sum, t) => sum + (t.peso_turno || 2), 0);
    
    return {
        turniTotali: turniList.length,
        tecniciCoinvolti: tecniciUnici.length,
        zoneCoperte: zoneUniche.length,
        pesoTotale: pesoTotale
    };
}



function chiudiModaleModificaTurno() {
    document.getElementById('modale-modifica-turno').style.display = 'none';
}

async function salvaModificaTurno() {
    let isSaving = false;
    
    // Previeni doppio click
    if (isSaving) {
        console.log('⚠️ Salvataggio già in corso...');
        return;
    }
    
    try {
        isSaving = true;
        
        console.log('=== DEBUG salvaModificaTurno START ===');
        
        // 1. Controlla se il contenuto esiste
        const contenuto = document.getElementById('modifica-turno-content');
        if (!contenuto) {
            console.error('❌ Elemento modifica-turno-content non trovato');
            mostraErroreModifica('Errore: form non trovato');
            return;
        }
        
        const turnoId = contenuto.dataset.turnoId;
        console.log('Turno ID:', turnoId);
        
        if (!turnoId) {
            mostraErroreModifica('ID turno non trovato');
            return;
        }
        
        // 2. Ottieni TUTTI gli elementi con controllo null
        const elementi = {
            tecnico: document.getElementById('modifica-tecnico'),
            dataInizio: document.getElementById('modifica-data-inizio'),
            oraInizio: document.getElementById('modifica-ora-inizio'),
            dataFine: document.getElementById('modifica-data-fine'),
            oraFine: document.getElementById('modifica-ora-fine'),
            note: document.getElementById('note-modifica-turno')
        };
        
        // DEBUG: mostra tutti gli elementi
        console.log('Elementi trovati:');
        Object.entries(elementi).forEach(([nome, elem]) => {
            console.log(`  ${nome}:`, elem, 'value:', elem?.value);
        });
        
        // 3. Verifica che tutti gli elementi obbligatori esistano
        const { tecnico, dataInizio, oraInizio, dataFine, oraFine } = elementi;
        
        if (!tecnico || !dataInizio || !oraInizio || !dataFine || !oraFine) {
            console.error('❌ Elementi mancanti:', { tecnico, dataInizio, oraInizio, dataFine, oraFine });
            mostraErroreModifica('Errore: alcuni campi del form non sono stati caricati correttamente');
            return;
        }
        
        // 4. Ottieni i valori
        const tecnicoValore = tecnico.value.trim();
        const dataInizioValore = dataInizio.value;
        const oraInizioValore = oraInizio.value;
        const dataFineValore = dataFine.value;
        const oraFineValore = oraFine.value;
        const noteValore = elementi.note ? elementi.note.value.trim() : '';
        
        console.log('Valori ottenuti:', {
            tecnico: tecnicoValore,
            dataInizio: dataInizioValore,
            oraInizio: oraInizioValore,
            dataFine: dataFineValore,
            oraFine: oraFineValore
        });
        
        // 5. Validazione base
        if (!tecnicoValore) {
            mostraErroreModifica('Inserisci il nome del tecnico');
            return;
        }
        
        if (!dataInizioValore || !oraInizioValore || !dataFineValore || !oraFineValore) {
            mostraErroreModifica('Compila tutti i campi obbligatori');
            return;
        }
        
        // ... continua con il resto della tua logica (validazione tecnico, date, ecc.)
        
        // 6. Validazione tecnico
        const tecnicoEsistente = tecniciList.some(t => 
            t.toLowerCase() === tecnicoValore.toLowerCase()
        );
        
        if (!tecnicoEsistente) {
            const conferma = confirm(
                `⚠ ATTENZIONE\n\n` +
                `Il tecnico "${tecnicoValore}" non è nella lista dei tecnici esistenti.\n` +
                `Vuoi procedere comunque? (Potrebbe essere un nuovo tecnico)`
            );
            
            if (!conferma) {
                return;
            }
        }
        
        // 7. Crea oggetti Date
        const inizio = new Date(`${dataInizioValore}T${oraInizioValore}`);
        const fine = new Date(`${dataFineValore}T${oraFineValore}`);
        
        if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
            mostraErroreModifica('Date o orari non validi');
            return;
        }
        
        // 8. Verifica che sia venerdì
        if (inizio.getDay() !== 5) {
            mostraErroreModifica('La data di inizio deve essere un venerdì');
            return;
        }
        
        if (fine.getDay() !== 5) {
            mostraErroreModifica('La data di fine deve essere un venerdì');
            return;
        }
        
        // 9. Verifica intervallo (7 giorni)
        const giorniDiff = Math.round((fine - inizio) / (1000 * 60 * 60 * 24));
        if (giorniDiff !== 7) {
            mostraErroreModifica('Il turno deve durare esattamente 7 giorni (venerdì → venerdì)');
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // 10. Aggiorna turno
        const updateData = {
            tecnico_id: tecnicoValore,
            data_inizio: inizio.toISOString(),
            data_fine: fine.toISOString(),
            updated_at: new Date().toISOString()
        };
        
        console.log('Dati da aggiornare:', updateData);
        
        const { error: updateError } = await supabase
            .from('turni_reperibilita')
            .update(updateData)
            .eq('id', turnoId);
        
        if (updateError) throw updateError;
        
        // 11. Gestione storico
        try {
            const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
            
            const storicoData = {
                turno_id: turnoId,
                operazione: 'modifica',
                dati_nuovi_json: updateData,
                operato_da: adminName,
                ruolo_operatore: 'admin',
                nota: `Turno modificato - Tecnico: ${tecnicoValore}${!tecnicoEsistente ? ' (NUOVO)' : ''}`
            };
            
            await supabase
                .from('storico_turni')
                .insert([storicoData]);
                
        } catch (storicoError) {
            console.warn('⚠️ Storico non salvato:', storicoError.message);
        }
        
        // 12. Chiudi modale e aggiorna
        chiudiModaleModificaTurno();
        mostraMessaggio(`Turno modificato! Tecnico: ${tecnicoValore}${!tecnicoEsistente ? ' (nuovo)' : ''}`, 'success');
        
        // 13. Ricarica lista turni
        await caricaTurni();
        
        console.log('✅ Salvataggio completato con successo');
        
    } catch (error) {
        console.error('❌ Errore modifica turno:', error);
        mostraErroreModifica(`Errore: ${error.message}`);
    } finally {
        isSaving = false;
    }
}

function mostraErroreModifica(messaggio) {
    const errorDiv = document.getElementById('modifica-turno-error');
    errorDiv.textContent = messaggio;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// ============================================
// FUNZIONI ESPORT TURNI
// ============================================

async function esportaTurniCSV() {
    try {
        if (turniList.length === 0) {
            mostraMessaggio('Nessun turno da esportare', 'warning');
            return;
        }
        
        mostraLoading('Preparazione esportazione...');
        
        // Crea header CSV
        let csvContent = 'DataInizio;OraInizio;DataFine;OraFine;Zona;Tecnico;Peso;Stato\n';
        
        // Aggiungi ogni turno
        turniList.forEach(turno => {
            const inizio = new Date(turno.data_inizio);
            const fine = new Date(turno.data_fine);
            const zona = turno.zone_reperibilita?.nome || 'N/D';
            const stato = (turno.richieste_cambio && turno.richieste_cambio.length > 0) ? 'Modificato' : 'Originale';
            
            csvContent += `"${inizio.toLocaleDateString('it-IT')}";"${inizio.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}";"${fine.toLocaleDateString('it-IT')}";"${fine.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}";"${zona}";"${turno.tecnico_id}";${turno.peso_turno || 2};"${stato}"\n`;
        });
        
        // Crea blob e download
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `Turni_Reperibilita_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        nascondiLoading();
        mostraMessaggio(`Esportati ${turniList.length} turni in CSV`, 'success');
        
    } catch (error) {
        console.error('❌ Errore esportazione CSV:', error);
        nascondiLoading();
        mostraMessaggio('Errore nell\'esportazione', 'error');
    }
}

// ============================================
// FUNZIONI MODIFICA TURNI (DA AGGIUNGERE)
// ============================================

async function apriModaleModificaTurno(turnoId) {
    try {
        console.log('📝 Apertura modifica turno:', turnoId);
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // Carica dettagli turno
        const { data: turno, error } = await supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(*)
            `)
            .eq('id', turnoId)
            .single();
        
        if (error) throw error;
        
        // Carica lista tecnici (se non già caricata)
        if (tecniciList.length === 0) {
            await caricaTecnici();
        }
        
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        
        // Formatta date per input
        const dataInizioStr = inizio.toISOString().split('T')[0];
        const dataFineStr = fine.toISOString().split('T')[0];
        const oraInizioStr = inizio.toTimeString().slice(0, 5); // HH:MM
        const oraFineStr = fine.toTimeString().slice(0, 5);
        
        // GENERA IL FORM CON GLI ID CORRETTI
        const content = `
            <div class="input-group">
                <label class="input-label">Tecnico *</label>
                <input type="text" 
                       id="modifica-tecnico" 
                       class="input-field" 
                       value="${turno.tecnico_id || ''}" 
                       placeholder="Nome Cognome"
                       list="tecnici-lista">
                <datalist id="tecnici-lista">
                    ${tecniciList.map(t => `<option value="${t}">`).join('')}
                </datalist>
            </div>
            
            <div class="input-group">
                <label class="input-label">Data Inizio (venerdì) *</label>
                <input type="date" 
                       id="modifica-data-inizio" 
                       class="input-field" 
                       value="${dataInizioStr}">
            </div>
            
            <div class="input-group">
                <label class="input-label">Ora Inizio *</label>
                <input type="time" 
                       id="modifica-ora-inizio" 
                       class="input-field" 
                       value="${oraInizioStr}">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Turno inizia alle 8:00
                </div>
            </div>
            
            <div class="input-group">
                <label class="input-label">Data Fine (venerdì successivo) *</label>
                <input type="date" 
                       id="modifica-data-fine" 
                       class="input-field" 
                       value="${dataFineStr}">
            </div>
            
            <div class="input-group">
                <label class="input-label">Ora Fine *</label>
                <input type="time" 
                       id="modifica-ora-fine" 
                       class="input-field" 
                       value="${oraFineStr}">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Turno finisce alle 8:00
                </div>
            </div>
            
            <div class="input-group">
                <label class="input-label">Note (opzionali)</label>
                <textarea id="note-modifica-turno" 
                          class="input-field" 
                          rows="2" 
                          placeholder="Note sulla modifica..."></textarea>
            </div>
            
           
        `;
        
        document.getElementById('modifica-turno-content').innerHTML = content;
        document.getElementById('modifica-turno-content').dataset.turnoId = turnoId;
        
        // Mostra il modal
        document.getElementById('modale-modifica-turno').style.display = 'flex';
        
        // Focus sul primo campo
        setTimeout(() => {
            const inputTecnico = document.getElementById('modifica-tecnico');
            if (inputTecnico) inputTecnico.focus();
        }, 100);
        
    } catch (error) {
        console.error('❌ Errore apertura modifica turno:', error);
        mostraMessaggio('Errore nel caricamento dei dettagli del turno', 'error');
    }
}

function chiudiModaleModificaTurno() {
    document.getElementById('modale-modifica-turno').style.display = 'none';
}

async function salvaModificaTurno() {
    try {
        // 1. Recupera valori dai campi
        const turnoId = document.getElementById('modifica-turno-content').dataset.turnoId;
        const tecnico = document.getElementById('modifica-tecnico').value.trim();
        const dataInizio = document.getElementById('modifica-data-inizio').value;
        const oraInizio = document.getElementById('modifica-ora-inizio').value;
        const dataFine = document.getElementById('modifica-data-fine').value;
        const oraFine = document.getElementById('modifica-ora-fine').value;
        const noteModifica = document.getElementById('note-modifica-turno').value.trim();

        // 2. Validazione
        if (!tecnico || !dataInizio || !oraInizio || !dataFine || !oraFine) {
            mostraErrore('Compila tutti i campi obbligatori', 'modifica-errore-message');
            return;
        }
        
        const inizio = new Date(`${dataInizio}T${oraInizio}`);
        const fine = new Date(`${dataFine}T${oraFine}`);
        
        if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
            mostraErrore('Date o orari non validi', 'modifica-errore-message');
            return;
        }
        
        // Verifica venerdì
        if (inizio.getDay() !== 5 || fine.getDay() !== 5) {
            mostraErrore('Le date devono essere venerdì', 'modifica-errore-message');
            return;
        }
        
        // Verifica 7 giorni
        const giorniDiff = Math.round((fine - inizio) / (1000 * 60 * 60 * 24));
        if (giorniDiff !== 7) {
            mostraErrore('Il turno deve durare esattamente 7 giorni', 'modifica-errore-message');
            return;
        }

        // 3. Aggiornamento DB
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');

        // Carica originale per storico
        const { data: turnoOriginale } = await supabase
            .from('turni_reperibilita')
            .select('*')
            .eq('id', turnoId)
            .single();

        // Aggiorna turno
        const datiAggiornamento = {
            tecnico_id: tecnico,
            data_inizio: inizio.toISOString(),
            data_fine: fine.toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (noteModifica) datiAggiornamento.note = noteModifica;

        await supabase
            .from('turni_reperibilita')
            .update(datiAggiornamento)
            .eq('id', turnoId);

        // 4. Storico (opzionale - se funziona)
        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
        const datiStorico = {
            turno_id: turnoId,
            operazione: 'modifica', // VALORE CORRETTO
            dati_precedenti_json: {
                tecnico_id: turnoOriginale.tecnico_id,
                data_inizio: turnoOriginale.data_inizio,
                data_fine: turnoOriginale.data_fine,
                note: turnoOriginale.note
            },
            dati_nuovi_json: {
                tecnico_id: tecnico,
                data_inizio: inizio.toISOString(),
                data_fine: fine.toISOString(),
                note: noteModifica
            },
            operato_da: adminName,
            ruolo_operatore: 'admin',
            data_operazione: new Date().toISOString()
        };

        // Inserisci storico (ignora errori)
        try {
            await supabase.from('storico_turni').insert([datiStorico]);
        } catch (e) {
            console.warn('⚠️ Storico non salvato:', e.message);
        }

        // 5. UI feedback
        chiudiModaleModifica();
        mostraMessaggio('Turno modificato con successo!', 'success');
        await caricaTurni();

    } catch (error) {
        console.error('❌ Errore modifica turno:', error);
        mostraErrore(`Errore: ${error.message}`, 'modifica-errore-message');
    }
}
// ============================================
// FUNZIONI CARICAMENTO TECNICI
// ============================================

let tecniciList = []; // Variabile globale per memorizzare i tecnici

// Modifica caricaTecnici() per loggare meglio
async function caricaTecnici() {
    try {
        console.log('👷 [DEBUG] Inizio caricamento tecnici...');
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.log('👷 [DEBUG] Supabase non disponibile');
            return [];
        }
        
        // PRIMA prova a cercare nella tabella 'tecnici'
        console.log('👷 [DEBUG] Cerco nella tabella tecnici...');
        const { data: tecnici, error } = await supabase
            .from('tecnici')
            .select('nome_completo')
            .order('nome_completo', { ascending: true });
        
        if (error) {
            console.log('👷 [DEBUG] Errore tabella tecnici:', error.message);
            console.warn('❌ Tabella tecnici non trovata, cerco nei turni');
            // FALLBACK: estrai tecnici unici dai turni
            return caricaTecniciDaTurni();
        }
        
        console.log('👷 [DEBUG] Risultato query tecnici:', tecnici);
        
        if (tecnici && tecnici.length > 0) {
            tecniciList = tecnici.map(t => t.nome_completo);
            console.log(`✅ Tecnici caricati da tabella: ${tecniciList.length}`);
            console.log('👷 [DEBUG] Lista tecnici:', tecniciList);
            return tecniciList;
        } else {
            console.log('👷 [DEBUG] Tabella tecnici vuota, cerco nei turni');
            // Se tabella esiste ma è vuota
            return caricaTecniciDaTurni();
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici:', error);
        return caricaTecniciDaTurni(); // Fallback
    }
}

async function caricaTecniciDaTurni() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return [];
        
        const { data: turni, error } = await supabase
            .from('turni_reperibilita')
            .select('tecnico_id')
            .order('tecnico_id', { ascending: true });
        
        if (error) throw error;
        
        // Estrai nomi unici
        const tecniciUnici = [...new Set(turni.map(t => t.tecnico_id))].filter(Boolean);
        tecniciList = tecniciUnici;
        
        console.log(`✅ Tecnici estratti da turni: ${tecniciList.length}`);
        return tecniciList;
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici da turni:', error);
        return [];
    }
}

async function cercaTecnicoNelDatabase(nomeTecnico) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;
        
        // Cerca nella tabella tecnici
        const { data: tecnici, error } = await supabase
            .from('tecnici')
            .select('nome_completo')
            .ilike('nome_completo', `%${nomeTecnico}%`)
            .limit(5);
        
        if (error) return false;
        
        return tecnici && tecnici.length > 0;
        
    } catch (error) {
        console.error('❌ Errore ricerca tecnico DB:', error);
        return false;
    }
}
function mostraErroreModifica(messaggio) {
    const erroreDiv = document.getElementById('modifica-errore-message');
    if (erroreDiv) {
        erroreDiv.textContent = messaggio;
        erroreDiv.style.display = 'block';
        
        // Nascondi automaticamente dopo 5 secondi
        setTimeout(() => {
            erroreDiv.style.display = 'none';
        }, 5000);
    }
}

function chiudiModaleModificaTurno() {
    document.getElementById('modale-modifica-turno').style.display = 'none';
    
    // Pulisci eventuali errori
    const erroreDiv = document.getElementById('modifica-errore-message');
    if (erroreDiv) {
        erroreDiv.style.display = 'none';
        erroreDiv.textContent = '';
    }
}
// Funzione per chiudere il modale
function chiudiModaleModifica() {
    document.getElementById('modale-modifica-turno').style.display = 'none';
    const erroreEl = document.getElementById('modifica-errore-message');
    if (erroreEl) erroreEl.style.display = 'none';
}

// ============================================
// FUNZIONI ELIMINAZIONE TURNO
// ============================================

/**
 * Mostra conferma eliminazione turno
 */
function confermaEliminazioneTurno(turnoId, tecnicoNome, dataTurno) {
    if (!turnoId) {
        mostraMessaggio('ID turno non valido', 'error');
        return;
    }
    
    // Crea modale di conferma personalizzato
    const modaleConfermaHTML = `
        <div class="modale-overlay" id="modale-conferma-eliminazione" style="display: flex;">
            <div class="modale-content" style="max-width: 450px;">
                <div class="modale-header">
                    <h3 class="modale-title" style="color: #dc2626;">
                        <span class="material-symbols-rounded" style="vertical-align: middle; margin-right: 8px;">
                            warning
                        </span>
                        Conferma Eliminazione
                    </h3>
                </div>
                <div class="modale-body">
                    <div style="text-align: center; padding: 1rem;">
                        <div style="font-size: 4rem; color: #dc2626; margin-bottom: 1rem;">
                            <span class="material-symbols-rounded" style="font-size: inherit;">
                                delete_forever
                            </span>
                        </div>
                        <h4 style="margin-bottom: 1rem; color: #1f2937;">Sei sicuro di voler eliminare questo turno?</h4>
                        
                        <div style="background: #fef2f2; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: left;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="color: #6b7280;">Tecnico:</span>
                                <strong>${tecnicoNome || 'N/D'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="color: #6b7280;">Data:</span>
                                <strong>${dataTurno || 'N/D'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #6b7280;">ID:</span>
                                <code style="font-size: 0.8rem; color: #dc2626;">${turnoId}</code>
                            </div>
                        </div>
                        
                        <p style="color: #ef4444; font-size: 0.9rem; font-style: italic;">
                            ⚠️ Questa azione è irreversibile! Il turno sarà permanentemente eliminato.
                        </p>
                    </div>
                </div>
                <div class="modale-footer">
                    <button onclick="chiudiModaleConfermaEliminazione()" 
                            class="btn-action btn-secondary" 
                            style="flex: 1;">
                        <span class="material-symbols-rounded">close</span>
                        Annulla
                    </button>
                    <button onclick="eseguiEliminazioneTurno('${turnoId}')" 
                            class="btn-action btn-danger" 
                            style="flex: 1;">
                        <span class="material-symbols-rounded">delete</span>
                        Elimina
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Aggiungi il modale al body
    const modaleEsistente = document.getElementById('modale-conferma-eliminazione');
    if (modaleEsistente) {
        modaleEsistente.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modaleConfermaHTML);
}


/**
 * Chiude il modale di conferma eliminazione
 */
function chiudiModaleConfermaEliminazione() {
    const modale = document.getElementById('modale-conferma-eliminazione');
    if (modale) {
        modale.remove();
    }
}

/**
 * Esegue l'eliminazione del turno dopo conferma
 */
async function eseguiEliminazioneTurno(turnoId) {
    try {
        console.log(`🗑️ Inizio eliminazione turno: ${turnoId}`);
        
        chiudiModaleConfermaEliminazione();
        
        // Mostra loader
        mostraLoader();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // 1. PRIMA: Carica i dati del turno per lo storico
        console.log('📋 Caricamento dati turno per storico...');
        const { data: turno, error: erroreCaricamento } = await supabase
            .from('turni_reperibilita')
            .select('*')
            .eq('id', turnoId)
            .single();
        
        if (erroreCaricamento) {
            throw new Error(`Errore caricamento turno: ${erroreCaricamento.message}`);
        }
        
        if (!turno) {
            throw new Error('Turno non trovato');
        }
        
        console.log('📊 Dati turno caricati:', turno);
        
        // 2. ELIMINA il turno dal database
        console.log('🗑️ Eliminazione turno dal DB...');
        const { error: erroreEliminazione } = await supabase
            .from('turni_reperibilita')
            .delete()
            .eq('id', turnoId);
        
        if (erroreEliminazione) {
            throw new Error(`Errore eliminazione: ${erroreEliminazione.message}`);
        }
        
        console.log('✅ Turno eliminato dal DB');
        
        // 3. REGISTRA NELLO STORICO (se la tabella esiste)
        try {
            const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
            
            // Prova diversi valori per 'operazione' per superare il vincolo CHECK
            const valoriOperazione = ['eliminazione', 'cancellazione', 'delete', 'rimozione'];
            
            let storicoSalvato = false;
            
            for (const operazioneVal of valoriOperazione) {
                try {
                    const datiStorico = {
                        turno_id: turnoId,
                        operazione: operazioneVal,
                        dati_precedenti_json: {
                            tecnico_id: turno.tecnico_id,
                            data_inizio: turno.data_inizio,
                            data_fine: turno.data_fine,
                            zona_id: turno.zona_id,
                            stato: turno.stato,
                            peso_turno: turno.peso_turno,
                            note: turno.note
                        },
                        dati_nuovi_json: null,
                        operato_da: adminName,
                        ruolo_operatore: 'admin',
                        data_operazione: new Date().toISOString(),
                        note_operazione: `Turno eliminato definitivamente`
                    };
                    
                    const { error: erroreStorico } = await supabase
                        .from('storico_turni')
                        .insert([datiStorico]);
                    
                    if (!erroreStorico) {
                        console.log(`✅ Storico salvato con operazione: "${operazioneVal}"`);
                        storicoSalvato = true;
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Tentativo con "${operazioneVal}" fallito:`, e.message);
                }
            }
            
            if (!storicoSalvato) {
                console.warn('⚠️ Storico eliminazione non salvato - problema vincolo CHECK o tabella');
            }
            
        } catch (erroreStorico) {
            console.warn('⚠️ Errore nel salvataggio storico:', erroreStorico.message);
            // Non bloccare il flusso se lo storico fallisce
        }
        
        // 4. AGGIORNA UI - Rimuovi la riga dalla tabella
        const rigaTurno = document.querySelector(`tr[data-turno-id="${turnoId}"]`);
        if (rigaTurno) {
            rigaTurno.style.backgroundColor = '#fee2e2';
            rigaTurno.style.transition = 'opacity 0.5s';
            
            setTimeout(() => {
                rigaTurno.style.opacity = '0';
                setTimeout(() => {
                    rigaTurno.remove();
                    console.log('✅ Riga rimossa dalla tabella');
                }, 500);
            }, 300);
        }
        
        // 5. MOSTRA MESSAGGIO DI SUCCESSO
        nascondiLoader();
        mostraMessaggio(`Turno eliminato con successo!`, 'success');
        
        // 6. Ricarica la lista dopo un breve delay (opzionale)
        setTimeout(() => {
            caricaTurni();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Errore eliminazione turno:', error);
        nascondiLoader();
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

/**
 * Funzione helper per mostrare loader
 */
function mostraLoader() {
    let loader = document.getElementById('loader-globale');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader-globale';
        loader.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.5); z-index: 9999; display: flex; 
                        align-items: center; justify-content: center;">
                <div style="background: white; padding: 2rem; border-radius: 12px; 
                            box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center;">
                    <div class="spinner" style="width: 50px; height: 50px; border: 5px solid #f3f3f3; 
                            border-top: 5px solid #3b82f6; border-radius: 50%; 
                            animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                    <p style="color: #1f2937; font-weight: 600;">Eliminazione in corso...</p>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loader);
    }
}

/**
 * Funzione helper per nascondere loader
 */
function nascondiLoader() {
    const loader = document.getElementById('loader-globale');
    if (loader) {
        loader.remove();
    }
}

// Cerca questa funzione nel tuo codice e modificala:
function generaRigaTurno(turno) {
    // Formatta la data
    const dataInizio = new Date(turno.data_inizio);
    const dataFormattata = dataInizio.toLocaleDateString('it-IT', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    return `
        <tr class="turno-row" data-turno-id="${turno.id}">
            <td>${dataFormattata}</td>
            <td><strong>${turno.tecnico_id || 'N/D'}</strong></td>
            <td>${turno.zone_reperibilita?.nome || 'N/D'}</td>
            <td>
                <span class="badge ${turno.stato === 'originale' ? 'badge-success' : 'badge-warning'}">
                    ${turno.stato || 'originale'}
                </span>
            </td>
            <td>${turno.peso_turno || 0}</td>
            <td class="azioni-cell" style="white-space: nowrap;">
                <button onclick="apriModaleModificaTurno('${turno.id}')" 
                        class="btn-icon btn-secondary" 
                        title="Modifica turno"
                        style="margin-right: 8px;">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button onclick="confermaEliminazioneTurno('${turno.id}', '${turno.tecnico_id || 'N/D'}', '${dataFormattata}')" 
                        class="btn-icon btn-danger" 
                        title="Elimina turno">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </td>
        </tr>
    `;
}
// ============================================
// ESPORTA FUNZIONI GLOBALI
// ============================================
window.salvaZona = salvaZona;
window.caricaZone = caricaZone;
window.modificaZona = modificaZona;
window.cambiaStatoZona = cambiaStatoZona;
window.scaricaTemplateCSV = scaricaTemplateCSV;
window.rimuoviFile = rimuoviFile;
window.validaECaricaCSV = validaECaricaCSV;
window.importaCSV = importaCSV;
window.caricaStoricoCSV = caricaStoricoCSV;
window.visualizzaDettaglioCaricamento = visualizzaDettaglioCaricamento;
window.salvaFestivita = salvaFestivita;
window.caricaFestivita = caricaFestivita;
window.eliminaFestivita = eliminaFestivita;
window.caricaTurni = caricaTurni;
window.caricaRichiestePending = caricaRichiestePending;
// ============================================
// ESPORTA FUNZIONI GLOBALI AGGIUNTIVE
// ============================================
window.caricaRichiestePending = caricaRichiestePending;
window.mostraDettaglioRichiesta = mostraDettaglioRichiesta;
window.chiudiModaleDettaglioRichiesta = chiudiModaleDettaglioRichiesta;
window.mostraConflitti = mostraConflitti;
window.chiudiModaleConflitti = chiudiModaleConflitti;
window.approvaRichiesta = approvaRichiesta;
window.rifiutaRichiesta = rifiutaRichiesta;
window.approvaRichiestaSelezionata = approvaRichiestaSelezionata;
window.rifiutaRichiestaSelezionata = rifiutaRichiestaSelezionata;
window.caricaStoricoApprovazioni = caricaStoricoApprovazioni;

// ============================================
// ESPORTA FUNZIONI GLOBALI AGGIUNTIVE (Turni)
// ============================================
window.caricaTurni = caricaTurni;
window.apriModaleModificaTurno = apriModaleModificaTurno;
window.chiudiModaleModificaTurno = chiudiModaleModificaTurno;
window.salvaModificaTurno = salvaModificaTurno;
window.esportaTurniCSV = esportaTurniCSV;


// ============================================
// ESPORTA FUNZIONI GLOBALI AGGIUNTIVE (Turni)
// ============================================
window.caricaTurni = caricaTurni;
window.apriModaleModificaTurno = apriModaleModificaTurno;
window.chiudiModaleModificaTurno = chiudiModaleModificaTurno;
window.salvaModificaTurno = salvaModificaTurno;
window.esportaTurniCSV = esportaTurniCSV;
window.caricaTecnici = caricaTecnici;


// Debug: verifica se la funzione viene chiamata
console.log('=== DEBUG PULSANTE MODIFICA ===');
console.log('Funzione apriModaleModificaTurno esiste?', typeof apriModaleModificaTurno);
console.log('Window.apriModaleModificaTurno esiste?', typeof window.apriModaleModificaTurno);

// Test: verifica se gli elementi HTML esistono
console.log('Elemento modale-modifica-turno esiste?', document.getElementById('modale-modifica-turno'));
console.log('Elemento modifica-turno-content esiste?', document.getElementById('modifica-turno-content'));