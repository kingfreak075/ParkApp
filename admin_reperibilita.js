// ============================================
// ADMIN REPERIBILITÀ - PARKAPP
// VERSIONE COMPLETA CON STORICO APPROVAZIONI
// ============================================

// VARIABILI GLOBALI
let zoneList = [];
let festivitaList = [];
let turniList = [];
let richiesteList = [];
let caricamentiList = [];
let tecniciList = [];
let storicoApprovazioniList = [];
let decisioneSelezionata = null;
let turnoSelezionatoStorico = null;
let richiestaSelezionata = null;

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
        
        // Aggiungi event listener per i filtri dello storico
        document.getElementById('filtro-anno-storico')?.addEventListener('change', caricaStoricoApprovazioni);
        document.getElementById('filtro-tipo-storico')?.addEventListener('change', caricaStoricoApprovazioni);
        document.getElementById('filtro-stato-storico')?.addEventListener('change', caricaStoricoApprovazioni);
        
        // Carica dati iniziali per la tab attiva (Zone)
        await caricaZone();
        await caricaTecnici();
        
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
                        await caricaZonePerSelect();
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
        
        const { data: zoneData, error } = await supabase
            .from('zone_reperibilita')
            .select('id, nome')
            .eq('attivo', true)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
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
            if (error.code === '23505') {
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
        await caricaZonePerSelect();
        
    } catch (error) {
        console.error('❌ Errore creazione zona:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    }
}

async function modificaZona(id) {
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

/// ============================================
// FUNZIONI CARICAMENTO CSV (TAB 2)
// ============================================

function setupCSVUpload() {
    const dropArea = document.getElementById('csv-drop-area');
    const fileInput = document.getElementById('file-csv');
    
    if (!dropArea || !fileInput) return;
    
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
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
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        mostraMessaggio('Seleziona un file CSV', 'error');
        rimuoviFile();
        return;
    }
    
    document.getElementById('file-info').style.display = 'block';
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = `Dimensione: ${(file.size / 1024).toFixed(1)} KB`;
    
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
        
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            mostraMessaggio('File CSV vuoto o formato non valido', 'error');
            nascondiLoading();
            return;
        }
        
        const header = lines[0].split(';');
        if (header.length !== 3 || 
            header[0].toLowerCase() !== 'datainizio' || 
            header[1].toLowerCase() !== 'zona' || 
            header[2].toLowerCase() !== 'tecnico') {
            mostraMessaggio('Formato CSV non valido. Usa il template.', 'error');
            nascondiLoading();
            return;
        }
        
        const errori = [];
        const righeValide = [];
        const turniDaImportare = [];
        
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
            
            if (dataInizio.getDay() !== 5) {
                errori.push({ riga: i + 1, errore: 'La data deve essere un venerdì', dati: riga });
                continue;
            }
            
            if (!nomiZoneValide.includes(zona)) {
                errori.push({ riga: i + 1, errore: `Zona "${zona}" non esistente o disattiva`, dati: riga });
                continue;
            }
            
            if (!tecnico || tecnico.length < 2) {
                errori.push({ riga: i + 1, errore: 'Nome tecnico non valido', dati: riga });
                continue;
            }
            
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
            
            const zonaObj = zoneEsistenti.find(z => z.nome === zona);
            turniDaImportare.push({
                zona_id: zonaObj.id,
                tecnico_id: tecnico,
                data_inizio: dataInizio.toISOString(),
                data_fine: dataFine.toISOString(),
                stato: 'originale'
            });
        }
        
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
        
        console.log('📋 Validazione CSV in corso...');
        
        const { righeValide, errori, turniDaImportare, zoneEsistenti } = await validazioneCSVCompleta(lines);
        
        if (righeValide.length === 0) {
            mostraMessaggio('Nessuna riga valida da importare', 'error');
            nascondiLoading();
            return;
        }
        
        console.log('📝 Creazione log operazione...');
        
        const { data: log, error: logError } = await supabase
            .from('log_caricamenti_csv')
            .insert([{
                nome_file: file.name,
                righe_totali: lines.length - 1,
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
        
        if (backupCheck) {
            console.log('💾 Creazione backup...');
            await creaBackupTurni(supabase, log.id, zoneEsistenti);
            
            await supabase
                .from('log_caricamenti_csv')
                .update({ backup_eseguito: true })
                .eq('id', log.id);
        }
        
        console.log('🚀 Importazione turni...');
        
        let turniImportati = 0;
        const erroriImport = [];
        
        for (const turno of turniDaImportare) {
            try {
                if (sovrascriviCheck) {
                    const { data: esistente, error: checkError } = await supabase
                        .from('turni_reperibilita')
                        .select('id')
                        .eq('zona_id', turno.zona_id)
                        .eq('data_inizio', turno.data_inizio)
                        .eq('data_fine', turno.data_fine)
                        .maybeSingle();
                    
                    if (checkError) throw checkError;
                    
                    if (esistente) {
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
                        const { error: insertError } = await supabase
                            .from('turni_reperibilita')
                            .insert([turno]);
                        
                        if (insertError) throw insertError;
                    }
                } else {
                    const { error: insertError } = await supabase
                        .from('turni_reperibilita')
                        .insert([turno]);
                    
                    if (insertError) {
                        if (insertError.code === '23505') {
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
        
        nascondiLoading();
        
        rimuoviFile();
        document.getElementById('anteprima-csv').style.display = 'none';
        
        const messaggio = `
            Importazione completata!<br>
            • Turni importati: <strong>${turniImportati}</strong><br>
            • Errori totali: <strong>${erroriFinali.length}</strong><br>
            • Backup: <strong>${backupCheck ? 'Eseguito' : 'Non eseguito'}</strong>
        `;
        
        mostraMessaggio(messaggio, turniImportati > 0 ? 'success' : 'warning');
        
        await caricaStoricoCSV();
        
        console.log(`✅ Importazione completata: ${turniImportati} turni importati`);
        
    } catch (error) {
        console.error('❌ Errore importazione CSV:', error);
        nascondiLoading();
        mostraMessaggio(`Errore nell'importazione: ${error.message}`, 'error');
    }
}

async function validazioneCSVCompleta(lines) {
    const errori = [];
    const righeValide = [];
    const turniDaImportare = [];
    
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('DB non configurato');
    
    const { data: zoneEsistenti, error: errorZone } = await supabase
        .from('zone_reperibilita')
        .select('id, nome')
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
        
        if (dataInizio.getDay() !== 5) {
            errori.push({ riga: i + 1, errore: 'La data deve essere un venerdì', dati: riga });
            continue;
        }
        
        if (!nomiZoneValide.includes(zona)) {
            errori.push({ riga: i + 1, errore: `Zona "${zona}" non esistente o disattiva`, dati: riga });
            continue;
        }
        
        if (!tecnico || tecnico.length < 2) {
            errori.push({ riga: i + 1, errore: 'Nome tecnico non valido', dati: riga });
            continue;
        }
        
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
            peso_turno: 0
        });
    }
    
    return { righeValide, errori, turniDaImportare, zoneEsistenti };
}

async function creaBackupTurni(supabase, logId, zoneEsistenti) {
    try {
        const zoneIds = zoneEsistenti.map(z => z.id);
        
        const { data: turniEsistenti, error } = await supabase
            .from('turni_reperibilita')
            .select('*')
            .in('zona_id', zoneIds);
        
        if (error) throw error;
        
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
        
        let query = supabase
            .from('festivita_italiane')
            .select('*')
            .order('data', { ascending: true });
        
        const { data: festivita, error } = await query;
        
        if (error) throw error;
        
        let festivitaFiltrate = festivita || [];
        
        if (filtroAnno !== 'tutti') {
            festivitaFiltrate = festivitaFiltrate.filter(f => {
                const annoFestivita = new Date(f.data).getFullYear();
                return annoFestivita.toString() === filtroAnno;
            });
        }
        
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
                data: dataInput,
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
        
        document.getElementById('data-festivita').value = '';
        document.getElementById('nome-festivita').value = '';
        document.getElementById('tipo-festivita').value = 'nazionale';
        document.getElementById('zona-festivita-container').style.display = 'none';
        document.getElementById('zona-festivita').value = '';
        document.getElementById('note-festivita').value = '';
        
        mostraMessaggio(`Festività "${nome}" aggiunta con successo!`, 'success');
        
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
        
        let query = supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(nome, colore_hex),
                richieste_cambio!left(id, stato)
            `)
            .order('data_inizio', { ascending: true });
        
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

        // Recupera e aggancia le cessioni parziali
        const parzialiMap = await caricaParzialiPerTurni(turniList);
        turniList = (turniList || []).map(t => ({ ...t, parziali: parzialiMap[t.id] || [] }));
        
        console.log(`✅ Turni caricati: ${turniList.length}`);
        aggiornaUI_Turni();
        
    } catch (error) {
        console.error('❌ Errore caricamento turni:', error);
        mostraMessaggio('Errore nel caricamento dei turni', 'error');
    }
}

// Nuova funzione per admin: carica parziali per i turni
async function caricaParzialiPerTurni(turni) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !turni || turni.length === 0) return {};

        const ids = turni.map(t => t.id).filter(Boolean);
        if (ids.length === 0) return {};

        const { data: parziali, error } = await supabase
            .from('turni_parziali')
            .select('*')
            .in('turno_originale_id', ids)
            .eq('stato', 'attivo');

        if (error) {
            console.warn('❌ Errore caricamento parziali:', error);
            return {};
        }

        const mappa = {};
        (parziali || []).forEach(p => {
            if (!mappa[p.turno_originale_id]) mappa[p.turno_originale_id] = [];
            mappa[p.turno_originale_id].push(p);
        });

        return mappa;
    } catch (err) {
        console.error('❌ caricaParzialiPerTurni error:', err);
        return {};
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
    
    const tecniciUnici = [...new Set(turniList.map(t => t.tecnico_id))];
    const zoneUniche = [...new Set(turniList.map(t => t.zona_id))];
    const pesoTotale = turniList.reduce((sum, t) => sum + (t.peso_turno || 2), 0);
    
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
            
            // Controllo se il turno è modificato
            const isModificato = 
                turno.stato === 'modificato' || 
                turno.stato === 'parziale' ||
                (turno.richieste_cambio && turno.richieste_cambio.length > 0);
            
            let statoBadge = '';
            if (isModificato) {
                const modCount = turno.richieste_cambio?.length || 0;
                const badgeText = modCount > 1 ? `MODIFICATO (${modCount}x)` : 'MODIFICATO';
                statoBadge = `<span style="background: #f59e0b; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 800; margin-left: 0.5rem;">${badgeText}</span>`;
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

                            ${(turno.parziali && turno.parziali.length > 0) ? `
                                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
                                    <strong>Cessioni parziali attive:</strong>
                                    ${turno.parziali.map(p => {
                                        const pInizio = new Date(p.data_inizio_cessione).toLocaleDateString('it-IT');
                                        const pFine = new Date(p.data_fine_cessione).toLocaleDateString('it-IT');
                                        const cessionario = p.tecnico_cessionario_id || p.tecnico_cessionario || 'N/D';
                                        return `<div style="margin-top:0.35rem; padding:0.5rem; background:#fff; border-radius:8px; border:1px solid var(--border);">
                                                    <div style="font-weight:800; color:var(--text-main);">${cessionario}</div>
                                                    <div style="font-size:0.8rem; color:#64748b;">Periodo: ${pInizio} → ${pFine}</div>
                                                </div>`;
                                    }).join('')}
                                </div>
                            ` : ''}
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

// ============================================
// FUNZIONI APPROVAZIONI RICHIESTE (TAB 5)
// ============================================

async function caricaRichiestePending() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const filtroStato = document.getElementById('filtro-stato-approvazioni').value;
        
        console.log('📋 Caricamento richieste pending...');
        
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
        
        if (filtroStato !== 'tutti') {
            query = query.eq('stato', filtroStato);
        }
        
        const { data: richieste, error } = await query;
        
        if (error) throw error;
        
        richiesteList = richieste || [];
        aggiornaUI_RichiestePending();
        
    } catch (error) {
        console.error('❌ Errore caricamento richieste:', error);
        mostraMessaggio('Errore nel caricamento delle richieste', 'error');
    }
}

function aggiornaUI_RichiestePending() {
    const container = document.getElementById('lista-richieste-pending');
    if (!container) return;
    
    if (richiesteList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">check_circle</span>
                <p style="margin-top: 0.5rem; font-weight: 800; color: var(--primary);">Tutto in ordine!</p>
                <p style="font-size: 0.9rem;">Nessuna richiesta in attesa di approvazione</p>
            </div>
        `;
        return;
    }
    
    const richiestePerTurno = {};
    
    richiesteList.forEach(richiesta => {
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
    const richiesteConflitto = richiesteList.filter(r => r.turno_originale_id === turnoId);
    
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
        
        const { data: richiesta, error: fetchError } = await supabase
            .from('richieste_cambio')
            .select('*')
            .eq('id', richiestaId)
            .single();
        
        if (fetchError) throw fetchError;
        
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
        
        let updateTurnoData = {
            stato: 'modificato'  // IMPOSTA SEMPRE STATO MODIFICATO
        };
        
        switch(richiesta.tipo) {
            case 'scambio':
                updateTurnoData.tecnico_id = richiesta.tecnico_destinatario_id;
                break;
                
            case 'sostituzione':
                updateTurnoData.tecnico_id = richiesta.nuovo_tecnico_id;
                break;
                
            case 'cessione_parziale':
                updateTurnoData.stato = 'parziale';
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
                }
                break;
        }
        
        const { error: updateTurnoError } = await supabase
            .from('turni_reperibilita')
            .update(updateTurnoData)
            .eq('id', richiesta.turno_originale_id);
        
        if (updateTurnoError) throw updateTurnoError;
        
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
        
        chiudiModaleDettaglioRichiesta();
        chiudiModaleConflitti();
        
        mostraMessaggio('Richiesta approvata con successo!', 'success');
        
        await caricaRichiestePending();
        
    } catch (error) {
        console.error('❌ Errore approvazione richiesta:', error);
        mostraMessaggio(`Errore nell'approvazione: ${error.message}`, 'error');
    }
}

async function rifiutaRichiesta(richiestaId) {
    const motivo = prompt("Motivo del rifiuto (opzionale):");
    
    if (motivo === null) return;
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
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
        
        chiudiModaleDettaglioRichiesta();
        
        mostraMessaggio('Richiesta rifiutata', 'success');
        
        await caricaRichiestePending();
        
    } catch (error) {
        console.error('❌ Errore rifiuto richiesta:', error);
        mostraMessaggio(`Errore nel rifiuto: ${error.message}`, 'error');
    }
}

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

// ============================================
// FUNZIONI STORICO APPROVAZIONI (TAB 5 - COMPLETO)
// ============================================

async function caricaStoricoApprovazioni() {
    try {
        console.log('📊 Caricamento storico approvazioni...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const filtroAnno = document.getElementById('filtro-anno-storico').value;
        const filtroTipo = document.getElementById('filtro-tipo-storico').value;
        const filtroStato = document.getElementById('filtro-stato-storico').value;
        
        const annoCorrente = new Date().getFullYear();
        const annoPrecedente = annoCorrente - 1;
        
        // Costruisci query base
        let query = supabase
            .from('richieste_cambio')
            .select(`
                *,
                turni_reperibilita!inner(
                    *,
                    zone_reperibilita!inner(nome, colore_hex)
                )
            `)
            .in('stato', ['approved', 'rejected'])
            .order('data_approvazione', { ascending: false })
            .limit(20);
        
        // APPLICA FILTRO ANNO - CORRETTO per PostgreSQL
        if (filtroAnno !== 'tutti') {
            if (filtroAnno === '2025') {
                // Filtra per anno 2025 usando extract()
                query = query.filter('data_approvazione', 'gte', '2025-01-01T00:00:00')
                             .filter('data_approvazione', 'lt', '2026-01-01T00:00:00');
            } else if (filtroAnno === '2026') {
                // Filtra per anno 2026
                query = query.filter('data_approvazione', 'gte', '2026-01-01T00:00:00')
                             .filter('data_approvazione', 'lt', '2027-01-01T00:00:00');
            }
        } else {
            // Se "tutti", mostra solo anno corrente e precedente
            // Usiamo OR per includere entrambi gli anni
            const inizioAnnoPrec = `${annoPrecedente}-01-01T00:00:00`;
            const fineAnnoPrec = `${annoPrecedente}-12-31T23:59:59`;
            const inizioAnnoCorr = `${annoCorrente}-01-01T00:00:00`;
            const fineAnnoCorr = `${annoCorrente}-12-31T23:59:59`;
            
            // Query per entrambi gli anni
            query = query.or(`data_approvazione.gte.${inizioAnnoPrec},data_approvazione.lte.${fineAnnoPrec},data_approvazione.gte.${inizioAnnoCorr},data_approvazione.lte.${fineAnnoCorr}`);
        }
        
        // APPLICA FILTRO TIPO
        if (filtroTipo !== 'tutti') {
            query = query.eq('tipo', filtroTipo);
        }
        
        // APPLICA FILTRO STATO
        if (filtroStato !== 'tutti') {
            query = query.eq('stato', filtroStato);
        }
        
        console.log('🔍 Query storico:', {
            filtroAnno,
            filtroTipo,
            filtroStato,
            annoCorrente,
            annoPrecedente
        });
        
        const { data: storico, error } = await query;
        
        if (error) {
            console.error('❌ Errore query storico:', error);
            throw error;
        }
        
        storicoApprovazioniList = storico || [];
        console.log(`✅ Storico caricato: ${storicoApprovazioniList.length} record`);
        
        renderizzaStoricoApprovazioni();
        
    } catch (error) {
        console.error('❌ Errore caricamento storico:', error);
        mostraMessaggio('Errore nel caricamento dello storico', 'error');
        
        // Mostra comunque il container vuoto
        const container = document.getElementById('storico-approvazioni');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <span class="material-symbols-rounded">error</span>
                    <p style="margin-top: 0.5rem; font-weight: 800; color: #ef4444;">Errore nel caricamento</p>
                    <p style="font-size: 0.9rem;">${error.message}</p>
                </div>
            `;
        }
    }
}

function renderizzaStoricoApprovazioni() {
    const container = document.getElementById('storico-approvazioni');
    if (!container) {
        console.error('❌ Container storico-approvazioni non trovato');
        return;
    }
    
    if (!storicoApprovazioniList || storicoApprovazioniList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">history</span>
                <p style="margin-top: 0.5rem; font-weight: 800; color: var(--primary);">Nessuna decisione trovata</p>
                <p style="font-size: 0.9rem;">Prova a modificare i filtri di ricerca</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    storicoApprovazioniList.forEach(decisione => {
        const turno = decisione.turni_reperibilita;
        const zona = turno.zone_reperibilita;
        
        const dataApprov = new Date(decisione.data_approvazione);
        const dataFormattata = dataApprov.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dataInizio = new Date(turno.data_inizio);
        const dataFine = new Date(turno.data_fine);
        const periodo = `${dataInizio.getDate()}/${dataInizio.getMonth()+1} → ${dataFine.getDate()}/${dataFine.getMonth()+1}`;
        
        const isApproved = decisione.stato === 'approved';
        const statoClasse = isApproved ? 'approved' : 'rejected';
        const statoTesto = isApproved ? 'APPROVATO' : 'RIFIUTATO';
        const statoIcona = isApproved ? 'check_circle' : 'cancel';
        const statoColore = isApproved ? '#22c55e' : '#ef4444';
        
        let tipoTesto = '';
        let dettagliTecnici = '';
        
        switch(decisione.tipo) {
            case 'scambio':
                tipoTesto = 'Scambio';
                dettagliTecnici = `${decisione.tecnico_richiedente_id} ↔ ${decisione.tecnico_destinatario_id}`;
                break;
            case 'sostituzione':
                tipoTesto = 'Sostituzione';
                dettagliTecnici = `${decisione.tecnico_richiedente_id} → ${decisione.nuovo_tecnico_id}`;
                break;
            case 'cessione_parziale':
                tipoTesto = 'Cessione Parziale';
                if (decisione.dettagli_parziale_json && decisione.dettagli_parziale_json.tecnico_cessionario) {
                    dettagliTecnici = `${decisione.tecnico_richiedente_id} → ${decisione.dettagli_parziale_json.tecnico_cessionario}`;
                }
                break;
        }
        
        html += `
            <div class="storico-card ${statoClasse}" onclick="mostraDettaglioDecisione('${decisione.id}')" 
                 style="cursor: pointer; border-left-color: ${statoColore};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 2;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span class="material-symbols-rounded" style="color: ${statoColore};">${statoIcona}</span>
                            <span class="stato-badge ${statoClasse}">${statoTesto}</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">• ${dataFormattata}</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.25rem;">
                                <span class="material-symbols-rounded" style="font-size: 1rem; color: ${getColoreTipo(decisione.tipo)};">
                                    ${getIconaTipo(decisione.tipo)}
                                </span>
                                <span style="font-weight: 600; color: var(--text-main);">${tipoTesto}</span>
                            </div>
                            <div style="width: 1px; height: 16px; background: var(--border);"></div>
                            <div style="display: flex; align-items: center; gap: 0.25rem;">
                                <span class="material-symbols-rounded" style="font-size: 1rem; color: ${zona?.colore_hex || '#3B82F6'};">location_on</span>
                                <span style="font-size: 0.9rem; color: var(--text-muted);">${zona?.nome || 'Zona'}</span>
                            </div>
                        </div>
                        
                        <div style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.25rem;">
                            ${dettagliTecnici}
                        </div>
                        
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            ${periodo} • ${decisione.approvato_da_admin_id || 'Admin'}
                        </div>
                    </div>
                    
                    <div style="flex: 0;">
                        <button onclick="event.stopPropagation(); mostraDettaglioDecisione('${decisione.id}')" 
                                style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 0.5rem;">
                            <span class="material-symbols-rounded">visibility</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function mostraDettaglioDecisione(decisioneId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const decisione = storicoApprovazioniList.find(d => d.id === decisioneId);
        if (!decisione) {
            const { data, error } = await supabase
                .from('richieste_cambio')
                .select(`
                    *,
                    turni_reperibilita!inner(
                        *,
                        zone_reperibilita!inner(*)
                    )
                `)
                .eq('id', decisioneId)
                .single();
            
            if (error) throw error;
            decisioneSelezionata = data;
        } else {
            decisioneSelezionata = decisione;
        }
        
        const turno = decisioneSelezionata.turni_reperibilita;
        const zona = turno.zone_reperibilita;
        
        turnoSelezionatoStorico = turno;
        
        const dataApprov = new Date(decisioneSelezionata.data_approvazione);
        const dataRichiesta = new Date(decisioneSelezionata.data_richiesta);
        const dataInizio = new Date(turno.data_inizio);
        const dataFine = new Date(turno.data_fine);
        
        const dataApprovFormattata = dataApprov.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dataRichiestaFormattata = dataRichiesta.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const periodoFormattato = `${dataInizio.toLocaleDateString('it-IT')} → ${dataFine.toLocaleDateString('it-IT')}`;
        
        let dettagliSpecifici = '';
        let tipoTesto = '';
        
        switch(decisioneSelezionata.tipo) {
            case 'scambio':
                tipoTesto = 'Scambio';
                dettagliSpecifici = `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin: 1rem 0;">
                        <div style="text-align: center;">
                            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${decisioneSelezionata.tecnico_richiedente_id}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">Richiedente</div>
                        </div>
                        <span class="material-symbols-rounded" style="color: #3B82F6; font-size: 2rem;">swap_horiz</span>
                        <div style="text-align: center;">
                            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${decisioneSelezionata.tecnico_destinatario_id}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">Destinatario</div>
                        </div>
                    </div>
                `;
                break;
                
            case 'sostituzione':
                tipoTesto = 'Sostituzione';
                dettagliSpecifici = `
                    <div style="display: flex; align-items: center; gap: 1rem; margin: 1rem 0;">
                        <div style="text-align: center;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">Attuale</div>
                            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${decisioneSelezionata.tecnico_richiedente_id}</div>
                        </div>
                        <span class="material-symbols-rounded" style="color: #10B981;">arrow_forward</span>
                        <div style="text-align: center;">
                            <div style="font-size: 0.85rem; color: var(--text-muted);">Nuovo</div>
                            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${decisioneSelezionata.nuovo_tecnico_id}</div>
                        </div>
                    </div>
                `;
                break;
                
            case 'cessione_parziale':
                tipoTesto = 'Cessione Parziale';
                if (decisioneSelezionata.dettagli_parziale_json) {
                    const dettagli = decisioneSelezionata.dettagli_parziale_json;
                    const dataInizioCess = new Date(dettagli.data_inizio_cessione).toLocaleDateString('it-IT');
                    const dataFineCess = new Date(dettagli.data_fine_cessione).toLocaleDateString('it-IT');
                    
                    dettagliSpecifici = `
                        <div style="display: flex; align-items: center; gap: 1rem; margin: 1rem 0;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Titolare</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${decisioneSelezionata.tecnico_richiedente_id}</div>
                            </div>
                            <span class="material-symbols-rounded" style="color: #8B5CF6;">arrow_forward</span>
                            <div style="text-align: center;">
                                <div style="font-size: 0.85rem; color: var(--text-muted);">Cessionario</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${dettagli.tecnico_cessionario}</div>
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: #6b21a8; text-align: center; margin-top: 0.5rem;">
                            Periodo ceduto: <strong>${dataInizioCess} → ${dataFineCess}</strong>
                        </div>
                    `;
                }
                break;
        }
        
        const isApproved = decisioneSelezionata.stato === 'approved';
        const statoTesto = isApproved ? 'APPROVATA' : 'RIFIUTATA';
        const statoColore = isApproved ? '#22c55e' : '#ef4444';
        const statoIcona = isApproved ? 'check_circle' : 'cancel';
        
        const content = `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; background: ${statoColore}10; border-left: 4px solid ${statoColore};">
                    <span class="material-symbols-rounded" style="color: ${statoColore};">${statoIcona}</span>
                    <div>
                        <div style="font-weight: 800; color: ${statoColore};">${statoTesto}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${dataApprovFormattata}</div>
                    </div>
                </div>
                
                <div style="background: #f8fafc; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span class="material-symbols-rounded" style="color: ${getColoreTipo(decisioneSelezionata.tipo)};">${getIconaTipo(decisioneSelezionata.tipo)}</span>
                        <div style="font-weight: 800; color: var(--text-main);">${tipoTesto}</div>
                    </div>
                    ${dettagliSpecifici}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="background: white; border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border);">
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Zona</div>
                        <div style="font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 0.25rem;">
                            <div style="width: 12px; height: 12px; border-radius: 3px; background: ${zona?.colore_hex || '#3B82F6'};"></div>
                            ${zona?.nome || 'N/D'}
                        </div>
                    </div>
                    <div style="background: white; border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border);">
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Periodo</div>
                        <div style="font-weight: 800; color: var(--text-main);">${periodoFormattato}</div>
                    </div>
                </div>
                
                ${decisioneSelezionata.motivo ? `
                <div style="background: #fffbeb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 800; color: #92400e; margin-bottom: 0.5rem;">Motivo della richiesta:</div>
                    <div style="color: #92400e; font-style: italic;">"${decisioneSelezionata.motivo}"</div>
                </div>
                ` : ''}
                
                ${decisioneSelezionata.note_approvazione ? `
                <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid ${statoColore};">
                    <div style="font-weight: 800; color: ${isApproved ? '#166534' : '#991b1b'}; margin-bottom: 0.5rem;">Note decisione:</div>
                    <div style="color: ${isApproved ? '#166534' : '#991b1b'};">${decisioneSelezionata.note_approvazione}</div>
                </div>
                ` : ''}
                
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                    <div><strong>Richiesta inviata:</strong> ${dataRichiestaFormattata}</div>
                    <div><strong>Deciso da:</strong> ${decisioneSelezionata.approvato_da_admin_id || 'Admin'}</div>
                    <div><strong>ID Richiesta:</strong> <code style="font-size: 0.7rem;">${decisioneSelezionata.id}</code></div>
                </div>
            </div>
        `;
        
        document.getElementById('dettaglio-decisione-content').innerHTML = content;
        document.getElementById('decisione-icona').style.color = statoColore;
        document.getElementById('decisione-icona').textContent = statoIcona;
        document.getElementById('modale-dettaglio-decisione').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore caricamento dettaglio decisione:', error);
        mostraMessaggio('Errore nel caricamento dei dettagli', 'error');
    }
}

function chiudiModaleDettaglioDecisione() {
    document.getElementById('modale-dettaglio-decisione').style.display = 'none';
    decisioneSelezionata = null;
    turnoSelezionatoStorico = null;
}

function mostraDettagliTurno() {
    if (!turnoSelezionatoStorico) {
        mostraMessaggio('Nessun turno selezionato', 'error');
        return;
    }
    
    const turno = turnoSelezionatoStorico;
    
    const dataInizio = new Date(turno.data_inizio);
    const dataFine = new Date(turno.data_fine);
    
    const dataInizioFormattata = dataInizio.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const dataFineFormattata = dataFine.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const peso = turno.peso_turno || 2;
    
    const content = `
        <div style="margin-bottom: 1.5rem;">
            <div style="background: #f8fafc; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="font-weight: 800; color: var(--primary); margin-bottom: 0.5rem;">Turno di Reperibilità</div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span class="material-symbols-rounded" style="color: var(--primary);">person</span>
                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">${turno.tecnico_id || 'N/D'}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="background: white; border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border);">
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Inizio</div>
                    <div style="font-weight: 600; color: var(--text-main);">${dataInizioFormattata}</div>
                </div>
                <div style="background: white; border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border);">
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Fine</div>
                    <div style="font-weight: 600; color: var(--text-main);">${dataFineFormattata}</div>
                </div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Stato turno</div>
                        <div style="font-weight: 800; color: ${turno.stato === 'modificato' || turno.stato === 'parziale' ? '#f59e0b' : '#22c55e'};">${turno.stato || 'originale'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Peso</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary); text-align: center;">${peso}</div>
                    </div>
                </div>
            </div>
            
            <div style="font-size: 0.75rem; color: var(--text-muted);">
                <div><strong>ID Turno:</strong> <code style="font-size: 0.7rem;">${turno.id}</code></div>
                <div><strong>Ultimo aggiornamento:</strong> ${turno.updated_at ? new Date(turno.updated_at).toLocaleString('it-IT') : 'N/D'}</div>
            </div>
        </div>
    `;
    
    document.getElementById('dettaglio-turno-storico-content').innerHTML = content;
    
    chiudiModaleDettaglioDecisione();
    document.getElementById('modale-dettaglio-turno-storico').style.display = 'flex';
}

function chiudiModaleDettaglioTurnoStorico() {
    document.getElementById('modale-dettaglio-turno-storico').style.display = 'none';
    turnoSelezionatoStorico = null;
}

// ============================================
// FUNZIONI MODIFICA TURNI
// ============================================

async function apriModaleModificaTurno(turnoId) {
    try {
        console.log('📝 Apertura modifica turno:', turnoId);
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data: turno, error } = await supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(*)
            `)
            .eq('id', turnoId)
            .single();
        
        if (error) throw error;
        
        if (tecniciList.length === 0) {
            await caricaTecnici();
        }
        
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        
        const dataInizioStr = inizio.toISOString().split('T')[0];
        const dataFineStr = fine.toISOString().split('T')[0];
        const oraInizioStr = inizio.toTimeString().slice(0, 5);
        const oraFineStr = fine.toTimeString().slice(0, 5);
        
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
        
        document.getElementById('modale-modifica-turno').style.display = 'flex';
        
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
        const turnoId = document.getElementById('modifica-turno-content').dataset.turnoId;
        const tecnico = document.getElementById('modifica-tecnico').value.trim();
        const dataInizio = document.getElementById('modifica-data-inizio').value;
        const oraInizio = document.getElementById('modifica-ora-inizio').value;
        const dataFine = document.getElementById('modifica-data-fine').value;
        const oraFine = document.getElementById('modifica-ora-fine').value;
        const noteModifica = document.getElementById('note-modifica-turno').value.trim();

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
        
        if (inizio.getDay() !== 5 || fine.getDay() !== 5) {
            mostraErrore('Le date devono essere venerdì', 'modifica-errore-message');
            return;
        }
        
        const giorniDiff = Math.round((fine - inizio) / (1000 * 60 * 60 * 24));
        if (giorniDiff !== 7) {
            mostraErrore('Il turno deve durare esattamente 7 giorni', 'modifica-errore-message');
            return;
        }

        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');

        const { data: turnoOriginale } = await supabase
            .from('turni_reperibilita')
            .select('*')
            .eq('id', turnoId)
            .single();

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

        const adminName = localStorage.getItem('tecnico_loggato') || 'admin';
        
        const datiStorico = {
            turno_id: turnoId,
            operazione: 'modifica',
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

        try {
            await supabase.from('storico_turni').insert([datiStorico]);
        } catch (e) {
            console.warn('⚠️ Storico non salvato:', e.message);
        }

        chiudiModaleModifica();
        mostraMessaggio('Turno modificato con successo!', 'success');
        await caricaTurni();

    } catch (error) {
        console.error('❌ Errore modifica turno:', error);
        mostraErrore(`Errore: ${error.message}`, 'modifica-errore-message');
    }
}

function chiudiModaleModifica() {
    document.getElementById('modale-modifica-turno').style.display = 'none';
    const erroreEl = document.getElementById('modifica-errore-message');
    if (erroreEl) erroreEl.style.display = 'none';
}

// ============================================
// FUNZIONI CARICAMENTO TECNICI
// ============================================

async function caricaTecnici() {
    try {
        console.log('👷 Inizio caricamento tecnici...');
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.log('👷 Supabase non disponibile');
            return [];
        }
        
        console.log('👷 Cerco nella tabella tecnici...');
        const { data: tecnici, error } = await supabase
            .from('tecnici')
            .select('nome_completo')
            .order('nome_completo', { ascending: true });
        
        if (error) {
            console.log('👷 Errore tabella tecnici:', error.message);
            console.warn('❌ Tabella tecnici non trovata, cerco nei turni');
            return caricaTecniciDaTurni();
        }
        
        console.log('👷 Risultato query tecnici:', tecnici);
        
        if (tecnici && tecnici.length > 0) {
            tecniciList = tecnici.map(t => t.nome_completo);
            console.log(`✅ Tecnici caricati da tabella: ${tecniciList.length}`);
            return tecniciList;
        } else {
            console.log('👷 Tabella tecnici vuota, cerco nei turni');
            return caricaTecniciDaTurni();
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici:', error);
        return caricaTecniciDaTurni();
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
        
        const tecniciUnici = [...new Set(turni.map(t => t.tecnico_id))].filter(Boolean);
        tecniciList = tecniciUnici;
        
        console.log(`✅ Tecnici estratti da turni: ${tecniciList.length}`);
        return tecniciList;
        
    } catch (error) {
        console.error('❌ Errore caricamento tecnici da turni:', error);
        return [];
    }
}

function mostraErrore(messaggio, idElemento) {
    const erroreDiv = document.getElementById(idElemento);
    if (erroreDiv) {
        erroreDiv.textContent = messaggio;
        erroreDiv.style.display = 'block';
        
        setTimeout(() => {
            erroreDiv.style.display = 'none';
        }, 5000);
    }
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
        
        let csvContent = 'DataInizio;OraInizio;DataFine;OraFine;Zona;Tecnico;Peso;Stato\n';
        
        turniList.forEach(turno => {
            const inizio = new Date(turno.data_inizio);
            const fine = new Date(turno.data_fine);
            const zona = turno.zone_reperibilita?.nome || 'N/D';
            const stato = (turno.richieste_cambio && turno.richieste_cambio.length > 0) ? 'Modificato' : 'Originale';
            
            csvContent += `"${inizio.toLocaleDateString('it-IT')}";"${inizio.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}";"${fine.toLocaleDateString('it-IT')}";"${fine.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}";"${zona}";"${turno.tecnico_id}";${turno.peso_turno || 2};"${stato}"\n`;
        });
        
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

// ESPORTA FUNZIONI GLOBALI (ripristina/export se presenti)
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
window.mostraDettaglioRichiesta = mostraDettaglioRichiesta;
window.chiudiModaleDettaglioRichiesta = chiudiModaleDettaglioRichiesta;
window.mostraConflitti = mostraConflitti;
window.chiudiModaleConflitti = chiudiModaleConflitti;
window.approvaRichiesta = approvaRichiesta;
window.rifiutaRichiesta = rifiutaRichiesta;
window.approvaRichiestaSelezionata = approvaRichiestaSelezionata;
window.rifiutaRichiestaSelezionata = rifiutaRichiestaSelezionata;
window.caricaStoricoApprovazioni = caricaStoricoApprovazioni;
window.apriModaleModificaTurno = apriModaleModificaTurno;
window.chiudiModaleModificaTurno = chiudiModaleModificaTurno;
window.salvaModificaTurno = salvaModificaTurno;
window.esportaTurniCSV = esportaTurniCSV;
window.caricaTecnici = caricaTecnici;
window.mostraDettaglioDecisione = mostraDettaglioDecisione;
window.chiudiModaleDettaglioDecisione = chiudiModaleDettaglioDecisione;
window.mostraDettagliTurno = mostraDettagliTurno;
window.chiudiModaleDettaglioTurnoStorico = chiudiModaleDettaglioTurnoStorico;

console.log('✅ Admin Reperibilità JS caricato (modificato per parziali)');