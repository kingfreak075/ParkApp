// admin_database.js
// Gestione interfaccia admin unificata per FloX
// Versione 2.0 - Con gestione errori migliorata per Supabase
// ==========================================================

// VARIABILI GLOBALI
let currentTab = 'config';
let currentTable = null;
let tableStructure = null;
let currentKey = null;
let csvData = null;
let csvColumns = [];
let csvFile = null;
// RIMUOVI questa riga: let comparisonResults = null;
let syncResults = null;
let isInitialized = false;

// Inizializza la variabile globale una sola volta
window.comparisonResults = null;



// INIZIALIZZAZIONE
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FLOX ADMIN INIT ===');
    
    // Setup notifiche CSS
    setupNotifications();
    
    // Setup navigazione tabs
    setupTabNavigation();
    
    // Carica configurazione iniziale
    loadInitialConfig();
    
    // Setup drag & drop
    setupDragAndDrop();
    
    // Setup file inputs
    setupFileInputs();
    
    // Setup event listeners
    setupEventListeners();
    
    // Aggiorna stato database
    updateDbStatus();
    
    isInitialized = true;
    console.log('Admin inizializzato con successo');
});

// SETUP NOTIFICHE CSS
function setupNotifications() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
            max-width: 400px;
        }
        
        .notification-success {
            background: #d1fae5;
            border: 1px solid #10b981;
            color: #065f46;
        }
        
        .notification-error {
            background: #fee2e2;
            border: 1px solid #ef4444;
            color: #991b1b;
        }
        
        .notification-warning {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
        }
        
        .notification-info {
            background: #dbeafe;
            border: 1px solid #3b82f6;
            color: #1e40af;
        }
        
        .notification .material-symbols-rounded {
            font-size: 20px;
        }
        
        .notification button {
            margin-left: auto;
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            opacity: 0.7;
            padding: 4px;
        }
        
        .notification button:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
}

// SOSTITUISCI CON:
document.addEventListener('DOMContentLoaded', function() {
    // Inizializza lo stato analisi se la funzione esiste
    if (typeof initializeAnalysisStatus === 'function') {
        initializeAnalysisStatus();
    }
    
    // Assicurati che window.comparisonResults esista
    if (!window.comparisonResults) {
        window.comparisonResults = null;
    }
});

// Chiama questa funzione all'inizializzazione della pagina
function initializeAnalysisStatus() {
    console.log('initializeAnalysisStatus chiamato');
    
    // Usa la variabile globale comparisonResults se esiste
    const hasResults = window.comparisonResults && 
                      (window.comparisonResults.new?.length > 0 || 
                       window.comparisonResults.update?.length > 0 ||
                       window.comparisonResults.delete?.length > 0);
    
    updateAnalysisStatus(hasResults, window.comparisonResults || null);
}

// SETUP NAVIGAZIONE TABS
function setupTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Rimuovi classe active da tutti i bottoni
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            // Aggiungi classe active al bottone cliccato
            this.classList.add('active');
            
            // Nascondi tutti i tab
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Mostra il tab corrispondente
            currentTab = this.dataset.tab;
            const tabId = `tab-${currentTab}`;
            const tabElement = document.getElementById(tabId);
            
            if (tabElement) {
                tabElement.classList.add('active');
                
                // Aggiorna titolo pagina
                updatePageTitle();
                
                // Azioni specifiche per tab
                switch(currentTab) {
                    case 'tables':
                        loadTables();
                        break;
                    case 'analyze':
                        populateTableSelect();
                        break;
                    case 'sync':
                        updateSyncInfo();
                        break;
                }
            } else {
                console.error(`Tab ${tabId} non trovato`);
            }
        });
    });
}

// SETUP FILE INPUTS
function setupFileInputs() {
    const configFileInput = document.getElementById('file-kf');
    const csvFileInput = document.getElementById('file-csv');
    
    if (configFileInput) {
        configFileInput.addEventListener('change', handleConfigFile);
    }
    
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCSVFile);
    }
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
    // Metodi configurazione
    const methodTabs = document.querySelectorAll('[data-method]');
    methodTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            methodTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const method = this.dataset.method;
            document.querySelectorAll('.method-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const methodElement = document.getElementById(`method-${method}`);
            if (methodElement) {
                methodElement.classList.add('active');
            }
        });
    });
    
    // Ricerca tabelle
    const tableSearch = document.getElementById('table-search');
    const tableFilter = document.getElementById('table-filter');
    
    if (tableSearch) {
        tableSearch.addEventListener('input', filterTables);
    }
    
    if (tableFilter) {
        tableFilter.addEventListener('change', filterTables);
    }
    
    // Modalità sincronizzazione
    document.querySelectorAll('input[name="sync-mode"]').forEach(radio => {
        radio.addEventListener('change', updateSyncWarning);
    });
    
    // Checkbox azioni
    document.getElementById('action-delete')?.addEventListener('change', updateSyncWarning);
}

// SETUP DRAG & DROP
function setupDragAndDrop() {
    const dropZones = ['drop-zone', 'csv-drop-zone'];
    
    dropZones.forEach(zoneId => {
        const dropZone = document.getElementById(zoneId);
        if (!dropZone) return;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            if (e.dataTransfer.files.length) {
                const file = e.dataTransfer.files[0];
                if (zoneId === 'drop-zone') {
                    handleConfigFile({ target: { files: [file] } });
                } else {
                    handleCSVFile({ target: { files: [file] } });
                }
            }
        });
    });
}

// LOAD INITIAL CONFIG
function loadInitialConfig() {
    if (hasDbConfig()) {
        const info = getDbConfigInfo();
        
        // Aggiorna UI configurazione
        const configStatus = document.getElementById('config-status');
        const configUrl = document.getElementById('config-url');
        const configLastTest = document.getElementById('config-last-test');
        const configUptime = document.getElementById('config-uptime');
        
        if (configStatus) {
            configStatus.textContent = 'Configurato';
            configStatus.className = 'value status-online';
        }
        
        if (configUrl) configUrl.textContent = info.urlShort || info.url || '-';
        if (configLastTest) configLastTest.textContent = info.timestamp || '-';
        
        if (configUptime && info.daysSinceConfig !== null) {
            configUptime.textContent = `${info.daysSinceConfig} giorni`;
        }
        
        // Popola campi manuali
        const supabaseUrl = document.getElementById('supabase-url');
        const supabaseKey = document.getElementById('supabase-key');
        
        if (supabaseUrl) supabaseUrl.value = info.url || '';
        if (supabaseKey) supabaseKey.value = '••••••••••••••••';
        
        showNotification('Configurazione database caricata', 'success');
        
    } else {
        showNotification('Configura il database per iniziare', 'warning');
    }
}

// UPDATE DB STATUS
function updateDbStatus() {
    const statusElement = document.getElementById('db-status');
    if (!statusElement) return;
    
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('span');
    
    if (hasDbConfig()) {
        if (indicator) indicator.className = 'status-indicator online';
        if (text) text.textContent = 'Database: Connesso';
    } else {
        if (indicator) indicator.className = 'status-indicator offline';
        if (text) text.textContent = 'Database: Non connesso';
    }
}

// UPDATE PAGE TITLE
function updatePageTitle() {
    const titles = {
        'config': 'Configurazione Database',
        'tables': 'Gestione Tabelle',
        'analyze': 'Analisi Tabella',
        'sync': 'Sincronizzazione CSV',
        'backup': 'Backup/Ripristino',
        'logs': 'Logs di Sistema'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = titles[currentTab] || 'FloX Admin';
    }
}

// TEST CONNECTION
async function testConnection() {
    showLoading('Test connessione', 'Verifica credenziali...');
    
    try {
        const result = await testDbConnection();
        
        if (result.success) {
            showNotification(`✅ ${result.message}`, 'success');
            
            const configStatus = document.getElementById('config-status');
            const configLastTest = document.getElementById('config-last-test');
            
            if (configStatus) {
                configStatus.textContent = 'Connesso';
                configStatus.className = 'value status-online';
            }
            
            if (configLastTest) {
                configLastTest.textContent = new Date().toLocaleString('it-IT');
            }
            
            updateDbStatus();
            
            // Test aggiuntivo per confermare l'accesso
            setTimeout(async () => {
                try {
                    const client = getSupabaseClient();
                    const { error } = await client
                        .from('tecnici')
                        .select('id')
                        .limit(1);
                    
                    if (!error) {
                        showNotification('Connessione verificata con successo', 'success');
                    }
                } catch (e) {
                    // Non critico se la tabella non esiste
                    console.log('Test tabella tecnici:', e.message);
                }
            }, 500);
            
        } else {
            throw new Error(result.error || 'Connessione fallita');
        }
    } catch (error) {
        console.error('Errore test connessione:', error);
        showNotification(`❌ Errore: ${error.message}`, 'error');
        
        const configStatus = document.getElementById('config-status');
        if (configStatus) {
            configStatus.textContent = 'Errore';
            configStatus.className = 'value status-error';
        }
    } finally {
        hideLoading();
    }
}

// HANDLE CONFIG FILE
function handleConfigFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.match(/\.(kf|txt|json)$/i)) {
        showNotification('Formato file non supportato. Usa .kf, .txt o .json', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const success = importDbConfig(e.target.result);
            if (success) {
                const fileInfo = document.getElementById('file-info');
                const fileName = document.getElementById('file-name');
                
                if (fileInfo) fileInfo.style.display = 'block';
                if (fileName) fileName.textContent = file.name;
                
                // Aggiorna configurazione
                loadInitialConfig();
                updateDbStatus();
                showNotification(`Configurazione caricata da ${file.name}`, 'success');
            }
        } catch (error) {
            showNotification(`Errore: ${error.message}`, 'error');
        }
    };
    reader.onerror = function() {
        showNotification('Errore lettura file', 'error');
    };
    reader.readAsText(file);
}

// SAVE CONFIG
async function saveConfig() {
    const urlInput = document.getElementById('supabase-url');
    const keyInput = document.getElementById('supabase-key');
    
    if (!urlInput || !keyInput) {
        showNotification('Elementi di configurazione non trovati', 'error');
        return;
    }
    
    const url = urlInput.value.trim();
    let key = keyInput.value;
    
    // Gestione campo password nascosto
    if (key === '••••••••••••••••') {
        key = getSupabaseKey();
        if (!key) {
            showNotification('Inserisci la chiave Supabase', 'error');
            return;
        }
    } else {
        key = key.trim();
    }
    
    if (!url || !key) {
        showNotification('Inserisci URL e Anon Key', 'error');
        return;
    }
    
    if (!url.startsWith('https://')) {
        showNotification('URL deve iniziare con https://', 'error');
        return;
    }
    
    showLoading('Salvataggio configurazione', 'Validazione dati...');
    
    try {
        saveDbConfig(url, key);
        showNotification('Configurazione salvata con successo', 'success');
        
        // Aggiorna UI
        loadInitialConfig();
        updateDbStatus();
        
        // Test automatico
        await testConnection();
        
    } catch (error) {
        console.error('Errore salvataggio configurazione:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// RESET CONFIG
function resetConfig() {
    if (confirm('Sei sicuro di voler resettare la configurazione?')) {
        resetDbConfig();
        showNotification('Configurazione resettata', 'info');
        loadInitialConfig();
        updateDbStatus();
    }
}

// EXPORT CONFIG
function exportConfig() {
    try {
        const content = exportDbConfig();
        downloadFile(content, 'FloX_DB_Config.kf', 'text/plain');
        showNotification('Configurazione esportata', 'success');
    } catch (error) {
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// TOGGLE PASSWORD VISIBILITY
function togglePassword() {
    const input = document.getElementById('supabase-key');
    const icon = document.getElementById('toggle-icon');
    
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
        
        // Se mostra placeholder, reimposta
        if (input.value === '••••••••••••••••') {
            const actualKey = getSupabaseKey();
            if (actualKey) {
                input.value = actualKey;
            }
        }
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
        
        // Nascondi chiave reale
        if (input.value !== '••••••••••••••••') {
            input.value = '••••••••••••••••';
        }
    }
}

// REMOVE FILE
function removeFile() {
    const fileInfo = document.getElementById('file-info');
    const fileInput = document.getElementById('file-kf');
    
    if (fileInfo) fileInfo.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    showNotification('File rimosso', 'info');
}

// LOAD TABLES - VERSIONE MIGLIORATA
async function loadTables() {
    if (!hasDbConfig()) {
        showNotification('Configura prima il database', 'warning');
        return;
    }
    
    showLoading('Caricamento tabelle', 'Recupero informazioni...');
    
    try {
        const client = getSupabaseClient();
        
        // METODO ALTERNATIVO: Ottieni tabelle senza usare information_schema
        const tables = await getTablesUsingAlternativeMethods(client);
        
        if (tables.length === 0) {
            // Se nessun metodo funziona, prova con tabelle predefinite
            const defaultTables = await checkDefaultTables(client);
            renderTables(defaultTables);
            updateTableStats(defaultTables);
        } else {
            renderTables(tables);
            updateTableStats(tables);
        }
        
    } catch (error) {
        console.error('Errore caricamento tabelle:', error);
        showNotification('Errore caricamento tabelle: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// METODI ALTERNATIVI PER OTTENERE TABELLE
async function getTablesUsingAlternativeMethods(client) {
    console.log("📊 Caricamento tabelle via RPC...");
    
    try {
        // Usa la funzione che sappiamo funziona
        const { data: tableNames, error } = await client.rpc('get_table_names_test');
        
        if (error) {
            console.error("❌ Errore RPC:", error);
            throw error;
        }
        
        if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
            console.warn("⚠️ Nessuna tabella trovata");
            return [];
        }
        
        console.log(`✅ Trovate ${tableNames.length} tabelle`);
        
        // Per PERFORMANCE, prendi solo le prime 10 tabelle per info dettagliate
        // Le altre le mostriamo solo con info base
      // A:
const tablesToProcess = tableNames; // Processa TUTTE
const remainingTables = []; // Nessuna tabella rimanente
        
        const processedTables = [];
        
        // Processa le prime 10 con info dettagliate
        for (const tableName of tablesToProcess) {
            try {
                // Prova a contare le righe
                const { count, error: countError } = await client
                    .from(tableName)
                    .select('*', { count: 'exact', head: true });
                
                processedTables.push({
                    table_name: tableName,
                    table_type: 'TABLE',
                    estimated_rows: count || 0,
                    has_data: (count || 0) > 0,
                    can_access: true,
                    last_checked: new Date().toISOString()
                });
                
            } catch (tableError) {
                // Tabella esiste ma non possiamo accedervi
                processedTables.push({
                    table_name: tableName,
                    table_type: 'TABLE',
                    estimated_rows: 0,
                    has_data: false,
                    can_access: false,
                    error: tableError.message
                });
            }
            
            // Piccola pausa per non sovraccaricare
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Aggiungi le restanti tabelle con info minime
        remainingTables.forEach(tableName => {
            processedTables.push({
                table_name: tableName,
                table_type: 'TABLE',
                estimated_rows: 0,
                has_data: false,
                can_access: null, // Non testato
                last_checked: null
            });
        });
        
        return processedTables;
        
    } catch (error) {
        console.error('💥 Errore critico:', error);
        
        // Fallback: tabelle hardcoded che sappiamo esistono
        return [
            'Parco_app', 'tecnici', 'montaggi', 'manutentori', 'annotazioni',
            'veicoli', 'venditori', 'zone_reperibilita'
        ].map(name => ({
            table_name: name,
            table_type: 'TABLE',
            estimated_rows: 0,
            has_data: false,
            can_access: true,
            is_fallback: true
        }));
    }
}
// Aggiungi questa funzione per debug
async function testRPCFunction() {
    try {
        const client = getSupabaseClient();
        console.log("Test funzione get_table_names_test...");
        
        const { data, error } = await client.rpc('get_table_names_test');
        
        console.log("Risposta completa:", data);
        console.log("Tipo di data:", typeof data);
        console.log("È array?", Array.isArray(data));
        
        if (Array.isArray(data)) {
            console.log("Lunghezza array:", data.length);
            console.log("Primo elemento:", data[0]);
            console.log("Tipo primo elemento:", typeof data[0]);
            
            if (data[0]) {
                console.log("Chiavi primo elemento:", Object.keys(data[0]));
                if (data[0].get_table_names_test) {
                    console.log("Numero tabelle:", data[0].get_table_names_test.length);
                }
            }
        }
        
        return { data, error };
        
    } catch (error) {
        console.error("Errore test:", error);
        return { error };
    }
}

// Per testare, nella console del browser:
// testRPCFunction().then(console.log)


// CHECK DEFAULT TABLES
async function checkDefaultTables(client) {
    const defaultTables = [];
    const commonTableNames = [
        'tecnici', 'montaggi', 'lavori', 'annotazioni', 'parco_app', 
        'users', 'customers', 'orders', 'products', 'inventory',
        'clienti', 'fornitori', 'fatture', 'articoli', 'categorie'
    ];
    
    for (const tableName of commonTableNames) {
        try {
            // Prova a fare una query semplice sulla tabella
            const { error } = await client
                .from(tableName)
                .select('id')
                .limit(1);
            
            // Se non c'è errore o l'errore non è "tabella non esiste"
            if (!error) {
                defaultTables.push({
                    table_name: tableName,
                    table_type: 'BASE TABLE'
                });
            } else if (error && error.code !== '42P01' && error.code !== 'PGRST116') {
                // Se l'errore non è "tabella non esiste", la tabella potrebbe esistere
                defaultTables.push({
                    table_name: tableName,
                    table_type: 'BASE TABLE'
                });
            }
        } catch (e) {
            // Ignora errori e continua
            console.log(`Test tabella ${tableName}:`, e.message);
        }
    }
    
    return defaultTables;
}

// RENDER TABLES
function renderTables(tables) {
    const tbody = document.getElementById('tables-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!tables || tables.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1;">table_rows_narrow</span>
                    <div style="margin-top: 16px; color: #64748b; font-weight: 600;">
                        Nessuna tabella trovata
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Calcola statistiche
    const accessibleTables = tables.filter(t => t.can_access === true).length;
    const inaccessibleTables = tables.filter(t => t.can_access === false).length;
    const unknownTables = tables.filter(t => t.can_access === null || t.can_access === undefined).length;
    
    // Intestazione con statistiche
    const headerRow = document.createElement('tr');
    headerRow.className = 'table-summary-header';
    headerRow.innerHTML = `
        <td colspan="6" style="background: #f8fafc; padding: 12px 16px; font-size: 0.85rem; color: #475569;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <span class="material-symbols-rounded" style="font-size: 18px;">info</span>
                <span><strong>${tables.length}</strong> tabelle totali • 
                <span style="color: #10b981;"><strong>${accessibleTables}</strong> accessibili</span> • 
                ${inaccessibleTables > 0 ? `<span style="color: #ef4444;"><strong>${inaccessibleTables}</strong> non accessibili</span> • ` : ''}
                ${unknownTables > 0 ? `<span style="color: #94a3b8;"><strong>${unknownTables}</strong> non testate</span>` : ''}
                </span>
            </div>
        </td>
    `;
    tbody.appendChild(headerRow);
    
    // Righe delle tabelle
    tables.forEach((table, index) => {
        const row = document.createElement('tr');
        
        // Determina colore e icona in base allo stato
        let statusColor = '#94a3b8'; // Grigio - sconosciuto
        let statusIcon = 'help';
        let statusText = 'Non testata';
        
        if (table.can_access === true) {
            if (table.has_data) {
                statusColor = '#10b981'; // Verde - attiva con dati
                statusIcon = 'check_circle';
                statusText = 'Attiva';
            } else {
                statusColor = '#f59e0b'; // Giallo - vuota
                statusIcon = 'warning';
                statusText = 'Vuota';
            }
        } else if (table.can_access === false) {
            statusColor = '#ef4444'; // Rosso - no accesso
            statusIcon = 'block';
            statusText = 'No accesso';
        }
        
        // Formatta righe
        let rowCountText = 'N/A';
        if (table.estimated_rows > 0) {
            rowCountText = table.estimated_rows.toLocaleString();
        } else if (table.estimated_rows === 0 && table.can_access === true) {
            rowCountText = '0';
        }
        
        row.innerHTML = `
            <td>
                <div class="table-name" style="display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded" style="color: ${statusColor};">${statusIcon}</span>
                    <span>${table.table_name}</span>
                    ${table.is_fallback ? '<span style="font-size: 0.7rem; background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">cache</span>' : ''}
                </div>
            </td>
            <td><span class="badge badge-primary">${table.table_type}</span></td>
            <td style="font-weight: 600; color: ${table.estimated_rows > 0 ? '#1e293b' : '#94a3b8'}">
                ${rowCountText}
            </td>
            <td>
                <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
            </td>
            <td>
                ${table.last_checked ? 
                    `<span style="font-size: 0.85rem; color: #64748b;">
                        ${new Date(table.last_checked).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}
                    </span>` : 
                    '<span style="color: #94a3b8;">-</span>'
                }
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon-small" title="Analizza" onclick="analyzeTable('${table.table_name}')" ${table.can_access === false ? 'disabled style="opacity: 0.5;"' : ''}>
                        <span class="material-symbols-rounded">analytics</span>
                    </button>
                    <button class="btn-icon-small" title="Visualizza dati" onclick="viewTableData('${table.table_name}')" ${table.can_access === false ? 'disabled style="opacity: 0.5;"' : ''}>
                        <span class="material-symbols-rounded">visibility</span>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}
// CREATE TABLE ROW
function createTableRow(table, isSystem = false) {
    const row = document.createElement('tr');
    row.className = isSystem ? 'system-table' : '';
    row.style.display = isSystem ? 'none' : '';
    
    row.innerHTML = `
        <td>
            <div class="table-name">
                <span class="material-symbols-rounded">${table.table_type === 'VIEW' ? 'visibility' : 'table_rows'}</span>
                ${table.table_name}
            </div>
        </td>
        <td><span class="badge ${table.table_type === 'VIEW' ? 'badge-info' : 'badge-primary'}">${table.table_type || 'TABLE'}</span></td>
        <td>0</td>
        <td>-</td>
        <td>-</td>
        <td>
            <div class="table-actions">
                <button class="btn-icon-small" title="Analizza" onclick="analyzeTable('${table.table_name}')">
                    <span class="material-symbols-rounded">analytics</span>
                </button>
                <button class="btn-icon-small" title="Visualizza dati" onclick="viewTableData('${table.table_name}')">
                    <span class="material-symbols-rounded">visibility</span>
                </button>
                <button class="btn-icon-small" title="Esporta" onclick="exportTable('${table.table_name}')">
                    <span class="material-symbols-rounded">download</span>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// FILTER TABLES
function filterTables() {
    const searchInput = document.getElementById('table-search');
    const filterSelect = document.getElementById('table-filter');
    
    if (!searchInput || !filterSelect) return;
    
    const search = searchInput.value.toLowerCase();
    const filter = filterSelect.value;
    const rows = document.querySelectorAll('#tables-body tr');
    
    rows.forEach(row => {
        if (row.classList.contains('system-tables-header')) return;
        
        const tableNameCell = row.querySelector('.table-name');
        if (!tableNameCell) return;
        
        const tableName = tableNameCell.textContent.toLowerCase();
        const isSystem = row.classList.contains('system-table');
        
        let show = true;
        
        // Applica filtro tipo
        if (filter === 'system' && !isSystem) show = false;
        if (filter === 'user' && isSystem) show = false;
        
        // Applica ricerca
        if (show && search && !tableName.includes(search)) show = false;
        
        row.style.display = show ? '' : 'none';
    });
}

// TOGGLE SYSTEM TABLES
function toggleSystemTables() {
    const systemRows = document.querySelectorAll('.system-table');
    const headerIcon = document.querySelector('.system-tables-header .material-symbols-rounded');
    
    if (!systemRows.length || !headerIcon) return;
    
    const isHidden = systemRows[0].style.display === 'none';
    
    systemRows.forEach(row => {
        row.style.display = isHidden ? '' : 'none';
    });
    
    headerIcon.textContent = isHidden ? 'expand_less' : 'expand_more';
}

// UPDATE TABLE STATS
function updateTableStats(tables) {
    const totalTablesEl = document.getElementById('total-tables');
    const totalRowsEl = document.getElementById('total-rows');
    const totalSizeEl = document.getElementById('total-size');
    const lastSyncEl = document.getElementById('last-sync');
    
    if (!tables || tables.length === 0) {
        if (totalTablesEl) totalTablesEl.textContent = '0';
        if (totalRowsEl) totalRowsEl.textContent = '0';
        if (totalSizeEl) totalSizeEl.textContent = '0/0';
        if (lastSyncEl) lastSyncEl.textContent = '-';
        return;
    }
    
    // 1. Totale tabelle
    if (totalTablesEl) {
        totalTablesEl.textContent = tables.length;
    }
    
    // 2. Righe totali stimate (solo per tabelle accessibili)
    if (totalRowsEl) {
        const accessibleTables = tables.filter(t => t.can_access === true);
        const totalRows = accessibleTables.reduce((sum, table) => {
            return sum + (table.estimated_rows || 0);
        }, 0);
        
        totalRowsEl.textContent = totalRows > 0 ? 
            totalRows.toLocaleString() + ' stimate' : 
            'Non disponibile';
    }
    
    // 3. Tabelle accessibili vs totali
    if (totalSizeEl) {
        const accessibleCount = tables.filter(t => t.can_access === true).length;
        const inaccessibleCount = tables.filter(t => t.can_access === false).length;
        const unknownCount = tables.filter(t => t.can_access === null || t.can_access === undefined).length;
        
        let statusText = '';
        if (accessibleCount === tables.length) {
            statusText = 'Tutte accessibili';
        } else {
            statusText = `${accessibleCount} accessibili`;
            if (inaccessibleCount > 0) {
                statusText += `, ${inaccessibleCount} non accessibili`;
            }
            if (unknownCount > 0) {
                statusText += `, ${unknownCount} non testate`;
            }
        }
        
        totalSizeEl.textContent = statusText;
    }
    
    // 4. Ultima sincronizzazione
    if (lastSyncEl) {
        const now = new Date();
        lastSyncEl.textContent = now.toLocaleTimeString('it-IT');
        
        // Opzionale: aggiorna il timestamp in background
        setTimeout(() => {
            if (lastSyncEl) {
                lastSyncEl.textContent = new Date().toLocaleTimeString('it-IT');
            }
        }, 60000); // Aggiorna ogni minuto
    }
}
// REFRESH TABLES
function refreshTables() {
    loadTables();
}

// VIEW TABLE DATA
async function viewTableData(tableName) {
    showLoading('Caricamento dati', `Tabella: ${tableName}`);
    
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .limit(50);
        
        if (error) throw error;
        
        showTableDataModal(tableName, data);
        
    } catch (error) {
        showNotification(`Errore caricamento dati: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// EXPORT TABLE
async function exportTable(tableName) {
    showLoading('Esportazione', `Preparazione dati: ${tableName}`);
    
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(tableName)
            .select('*');
        
        if (error) throw error;
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, `${tableName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showNotification(`Tabella ${tableName} esportata con successo`, 'success');
        
    } catch (error) {
        showNotification(`Errore esportazione: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// POPULATE TABLE SELECT
async function populateTableSelect() {
    const select = document.getElementById('table-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleziona una tabella...</option>';
    
    if (!hasDbConfig()) {
        showNotification('Configura prima il database', 'warning');
        return;
    }
    
    try {
        const client = getSupabaseClient();
        
        // Usa la stessa funzione RPC
        const { data: tableNames, error } = await client.rpc('get_table_names_test');
        
        if (error) throw error;
        
        if (!tableNames || !Array.isArray(tableNames)) {
            throw new Error('Formato dati non valido');
        }
        
        // Aggiungi tutte le tabelle alla select
        tableNames.forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            select.appendChild(option);
        });
        
        console.log(`✅ ${tableNames.length} tabelle caricate nella select`);
        
    } catch (error) {
        console.error('Errore caricamento tabelle per select:', error);
        
        // Fallback per la select
        const fallbackTables = [
            'Parco_app', 'tecnici', 'montaggi', 'manutentori', 'annotazioni'
        ];
        
        fallbackTables.forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            select.appendChild(option);
        });
    }
}

// LOAD TABLE STRUCTURE
async function loadTableStructure() {
    const select = document.getElementById('table-select');
    if (!select) return;
    
    const tableName = select.value;
    if (!tableName) return;
    
    currentTable = tableName;
    showLoading('Analisi tabella', `Caricamento struttura: ${tableName}`);
    
    try {
        const client = getSupabaseClient();
        
        // 1. Prova a ottenere struttura tramite query sample
        const { data: sampleData, error: sampleError } = await client
            .from(tableName)
            .select('*')
            .limit(1);
        
        if (sampleError) {
            if (sampleError.code === 'PGRST116' || sampleError.code === '42P01') {
                throw new Error(`Tabella "${tableName}" non trovata`);
            }
            throw sampleError;
        }
        
        // 2. Deduci colonne dal primo record (se disponibile)
        const columns = [];
        if (sampleData && sampleData.length > 0) {
            const firstRecord = sampleData[0];
            Object.keys(firstRecord).forEach(key => {
                const value = firstRecord[key];
                columns.push({
                    name: key,
                    type: detectDataType(value),
                    nullable: value === null || value === undefined,
                    defaultValue: null
                });
            });
        } else {
            // Tabella vuota - prova a ottenere informazioni dalle colonne
            const { data: emptyData, error: emptyError } = await client
                .from(tableName)
                .select('*')
                .limit(0);
            
            if (!emptyError) {
                // Se la query funziona ma non ci sono dati, la tabella esiste ma è vuota
                showNotification(`Tabella "${tableName}" esiste ma è vuota`, 'warning');
            }
        }
        
        // 3. Ottieni conteggio record
        const { count, error: countError } = await client
            .from(tableName)
            .select('*', { count: 'exact', head: true });
        
        // 4. Carica più dati per analisi
        const { data: moreData, error: moreError } = await client
            .from(tableName)
            .select('*')
            .limit(100);
        
        // Costruisci struttura
        tableStructure = {
            name: tableName,
            columns: columns,
            totalRecords: count || 0,
            sampleData: moreData || []
        };
        
        // Analizza chiavi potenziali
        analyzePotentialKeys();
        
        // Aggiorna UI
        renderTableStructure();
        renderKeyOptions();
        loadPreview();
        
        showNotification(`Tabella "${tableName}" analizzata con successo`, 'success');
        
    } catch (error) {
        console.error('Errore analisi tabella:', error);
        showNotification(`Errore analisi tabella: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// DETECT DATA TYPE
function detectDataType(value) {
    if (value === null || value === undefined) return 'unknown';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'integer' : 'float';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
        if (!isNaN(Date.parse(value)) && value.length > 10) return 'timestamp';
        if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date';
        if (value.match(/^\d{2}:\d{2}:\d{2}$/)) return 'time';
        return 'text';
    }
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'json';
    return 'text';
}

// ANALYZE POTENTIAL KEYS
function analyzePotentialKeys() {
    if (!tableStructure || !tableStructure.sampleData || tableStructure.sampleData.length === 0) return;
    
    const sample = tableStructure.sampleData;
    const keyNames = ['id', 'uuid', 'codice', 'code', 'key', 'pk', 'identificativo', 'rif'];
    
    tableStructure.columns.forEach(column => {
        // Calcola unicità
        const values = sample.map(record => record[column.name]);
        const uniqueValues = [...new Set(values.filter(v => v != null))];
        const uniqueness = uniqueValues.length / Math.max(values.length, 1);
        
        // Calcola punteggio
        let score = 0;
        if (keyNames.some(word => column.name.toLowerCase().includes(word))) score += 3;
        if (uniqueness > 0.95) score += 2;
        if (!values.some(v => v == null)) score += 1;
        if (['integer', 'bigint', 'text', 'varchar', 'uuid'].includes(column.type)) score += 1;
        
        column.isPotentialKey = score >= 3;
        column.uniqueness = uniqueness;
        column.score = score;
    });
    
    // Ordina per punteggio
    tableStructure.columns.sort((a, b) => b.score - a.score);
}

// RENDER TABLE STRUCTURE
function renderTableStructure() {
    const container = document.getElementById('table-structure');
    if (!container) return;
    
    if (!tableStructure) {
        container.innerHTML = `
            <div class="structure-loading">
                <span class="material-symbols-rounded">hourglass_top</span>
                <p>Seleziona una tabella per visualizzare la struttura</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="structure-overview">
            <div class="structure-stat">
                <span class="material-symbols-rounded">table_rows</span>
                <div>
                    <div class="stat-value">${tableStructure.totalRecords.toLocaleString()}</div>
                    <div class="stat-label">Record totali</div>
                </div>
            </div>
            <div class="structure-stat">
                <span class="material-symbols-rounded">view_column</span>
                <div>
                    <div class="stat-value">${tableStructure.columns.length}</div>
                    <div class="stat-label">Colonne</div>
                </div>
            </div>
        </div>
        
        <div class="columns-list">
            <h5>Colonne</h5>
            <table class="data-table compact">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Tipo</th>
                        <th>Nullable</th>
                        <th>Default</th>
                        <th>Chiave Potenziale</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    tableStructure.columns.forEach(col => {
        html += `
            <tr>
                <td><strong>${col.name}</strong></td>
                <td><span class="badge badge-secondary">${col.type}</span></td>
                <td>${col.nullable ? '<span class="badge badge-warning">SI</span>' : '<span class="badge badge-success">NO</span>'}</td>
                <td><code>${col.defaultValue || '-'}</code></td>
                <td>${col.isPotentialKey ? '<span class="badge badge-success">✓ Punteggio: ' + col.score + '</span>' : '-'}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// RENDER KEY OPTIONS
function renderKeyOptions() {
    const container = document.getElementById('key-options');
    if (!container || !tableStructure) return;
    
    let html = '';
    
    // Ordina colonne per punteggio (migliori prime)
    const sortedColumns = [...tableStructure.columns].sort((a, b) => b.score - a.score);
    
    sortedColumns.forEach(column => {
        if (column.score > 0) {
            html += `
                <div class="key-option ${column.name === currentKey ? 'selected' : ''}" onclick="selectKey('${column.name}')">
                    <div class="key-info">
                        <span class="material-symbols-rounded">${column.isPotentialKey ? 'key' : 'data_object'}</span>
                        <div>
                            <div class="key-name">${column.name}</div>
                            <div class="key-details">
                                ${column.type} • Unicità: ${Math.round(column.uniqueness * 100)}% • Punteggio: ${column.score}/7
                            </div>
                        </div>
                    </div>
                    ${column.name === currentKey ? '<span class="material-symbols-rounded">check_circle</span>' : ''}
                </div>
            `;
        }
    });
    
    container.innerHTML = html || '<p class="info-text">Nessuna chiave potenziale rilevata</p>';
}

// SELECT KEY
async function selectKey(keyName) {
    currentKey = keyName;
    renderKeyOptions();
    
    // Salva in localStorage per sync
    localStorage.setItem('sync_chiave_primaria', keyName);
    localStorage.setItem('sync_struttura_tabella', JSON.stringify(tableStructure));
    
    showNotification(`Chiave primaria selezionata: ${keyName}`, 'success');
}

// LOAD PREVIEW
async function loadPreview() {
    if (!currentTable) return;
    
    const limitSelect = document.getElementById('preview-limit');
    const limit = limitSelect ? parseInt(limitSelect.value) || 25 : 25;
    
    showLoading('Caricamento anteprima', `Tabella: ${currentTable}`);
    
    try {
        const client = getSupabaseClient();
        const orderBy = currentKey || (tableStructure?.columns[0]?.name);
        
        const { data, error } = await client
            .from(currentTable)
            .select('*')
            .limit(limit)
            .order(orderBy, { ascending: true });
        
        if (error) throw error;
        
        renderPreview(data);
        
    } catch (error) {
        console.error('Errore caricamento anteprima:', error);
        const container = document.getElementById('data-preview');
        if (container) {
            container.innerHTML = `<p class="error">Errore caricamento: ${error.message}</p>`;
        }
    } finally {
        hideLoading();
    }
}

// RENDER PREVIEW
function renderPreview(data) {
    const container = document.getElementById('data-preview');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Nessun dato disponibile</p>';
        return;
    }
    
    // Prendi le prime 6 colonne o tutte se meno di 6
    const allColumns = Object.keys(data[0] || {});
    const columnsToShow = allColumns.slice(0, 6);
    
    let html = `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
    `;
    
    columnsToShow.forEach(col => {
        const isKey = col === currentKey;
        html += `<th${isKey ? ' class="key-column"' : ''}>${col}${isKey ? ' <span class="material-symbols-rounded">key</span>' : ''}</th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    data.forEach((row, index) => {
        html += `<tr>`;
        html += `<td class="row-number">${index + 1}</td>`;
        
        columnsToShow.forEach(col => {
            const value = row[col];
            const isKey = col === currentKey;
            let displayValue;
            
            if (value === null || value === undefined) {
                displayValue = '<span class="null-value">NULL</span>';
            } else {
                const stringValue = String(value);
                displayValue = stringValue.length > 50 ? 
                    stringValue.substring(0, 50) + '...' : 
                    stringValue;
            }
            
            html += `<td${isKey ? ' class="key-column"' : ''}>${displayValue}</td>`;
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    
    const totalRecords = tableStructure?.totalRecords || 0;
    html += `<div class="preview-footer">Mostrando ${data.length} record su ${totalRecords.toLocaleString()} totali</div>`;
    
    container.innerHTML = html;
}

// HANDLE CSV FILE
function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.match(/\.(csv|txt)$/i)) {
        showNotification('Formato file non supportato. Usa .csv o .txt', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File troppo grande (max 10MB)', 'error');
        return;
    }
    
    csvFile = file;
    
    // Mostra info file
    const csvInfo = document.getElementById('csv-info');
    const csvFileName = document.getElementById('csv-file-name');
    const csvFileStats = document.getElementById('csv-file-stats');
    
    if (csvInfo) csvInfo.style.display = 'block';
    if (csvFileName) csvFileName.textContent = file.name;
    if (csvFileStats) csvFileStats.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    
    // Mostra opzioni
    const csvOptions = document.getElementById('csv-options');
    if (csvOptions) csvOptions.style.display = 'grid';
    
    // Abilita pulsanti
    const btnAnalyze = document.getElementById('btn-analyze');
    if (btnAnalyze) {
        btnAnalyze.disabled = false;
        btnAnalyze.style.backgroundColor = '';
        btnAnalyze.style.color = '';
        btnAnalyze.style.cursor = '';
    }
    
    showNotification(`File ${file.name} pronto per l'analisi`, 'success');
}

// REMOVE CSV
function removeCSV() {
    csvFile = null;
    csvData = null;
    csvColumns = [];
    
    const csvInfo = document.getElementById('csv-info');
    const csvOptions = document.getElementById('csv-options');
    const fileCsv = document.getElementById('file-csv');
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnSync = document.getElementById('btn-sync');
    
    if (csvInfo) csvInfo.style.display = 'none';
    if (csvOptions) csvOptions.style.display = 'none';
    if (fileCsv) fileCsv.value = '';
    
    if (btnAnalyze) {
        btnAnalyze.disabled = true;
        btnAnalyze.style.backgroundColor = '#cbd5e1';
        btnAnalyze.style.color = '#64748b';
        btnAnalyze.style.cursor = 'not-allowed';
    }
    
    if (btnSync) {
        btnSync.disabled = true;
        btnSync.style.backgroundColor = '#cbd5e1';
        btnSync.style.color = '#64748b';
        btnSync.style.cursor = 'not-allowed';
    }
    
    showNotification('File CSV rimosso', 'info');
}

// PREVIEW CSV
async function previewCSV() {
    if (!csvFile) {
        showNotification('Nessun file CSV caricato', 'error');
        return;
    }
    
    showLoading('Anteprima CSV', 'Parsing file...');
    
    try {
        const text = await readFileAsText(csvFile);
        const delimiter = document.getElementById('csv-delimiter').value;
        const header = document.getElementById('csv-header').value === 'true';
        
        const results = Papa.parse(text, {
            delimiter,
            header,
            skipEmptyLines: true,
            preview: 50
        });
        
        showCSVPreview(results);
        
    } catch (error) {
        showNotification(`Errore parsing CSV: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// READ FILE AS TEXT
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Errore lettura file'));
        reader.readAsText(file);
    });
}

// SHOW CSV PREVIEW
function showCSVPreview(results) {
    const modal = document.getElementById('modal-preview');
    const content = document.getElementById('preview-content');
    
    if (!modal || !content) return;
    
    let html = '';
    
    if (results.errors?.length) {
        html = `<div class="alert alert-error">Errore parsing: ${results.errors[0].message}</div>`;
    } else {
        html = `
            <div class="preview-header">
                <h4>Anteprima CSV (${results.data.length} righe)</h4>
                <div class="preview-info">
                    ${results.meta.fields ? `${results.meta.fields.length} colonne` : 'Nessuna intestazione'}
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
        `;
        
        // Intestazioni
        if (results.meta.fields) {
            results.meta.fields.slice(0, 10).forEach(field => {
                html += `<th>${field}</th>`;
            });
            if (results.meta.fields.length > 10) {
                html += `<th>...</th>`;
            }
        } else {
            const maxCols = Math.max(...results.data.map(row => row.length));
            for (let i = 0; i < Math.min(maxCols, 10); i++) {
                html += `<th>Col ${i + 1}</th>`;
            }
            if (maxCols > 10) {
                html += `<th>...</th>`;
            }
        }
        
        html += `</tr></thead><tbody>`;
        
        // Righe
        results.data.slice(0, 20).forEach((row, index) => {
            html += `<tr>`;
            
            if (Array.isArray(row)) {
                row.slice(0, 10).forEach(cell => {
                    html += `<td>${cell || ''}</td>`;
                });
                if (row.length > 10) html += `<td>...</td>`;
            } else {
                const fields = results.meta.fields || [];
                fields.slice(0, 10).forEach(field => {
                    html += `<td>${row[field] || ''}</td>`;
                });
                if (fields.length > 10) html += `<td>...</td>`;
            }
            
            html += `</tr>`;
        });
        
        html += `</tbody></table></div>`;
        
        if (results.data.length > 20) {
            html += `<div class="preview-footer">... e altre ${results.data.length - 20} righe</div>`;
        }
    }
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// CLOSE PREVIEW
function closePreview() {
    const modal = document.getElementById('modal-preview');
    if (modal) modal.style.display = 'none';
}

// UPDATE SYNC INFO
function updateSyncInfo() {
    const syncTable = document.getElementById('sync-table');
    const syncKey = document.getElementById('sync-key');
    const syncDbCount = document.getElementById('sync-db-count');
    
    if (syncTable && currentTable) syncTable.textContent = currentTable;
    if (syncKey && currentKey) syncKey.textContent = currentKey || '-';
    if (syncDbCount && tableStructure) syncDbCount.textContent = tableStructure.totalRecords.toLocaleString();
}

// ANALYZE COMPARISON
async function analyzeComparison() {
    if (!csvFile || !currentTable || !currentKey) {
        showNotification('Completa la configurazione prima di analizzare', 'error');
        return;
    }
    
    showLoading('Analisi confronto', 'Caricamento dati...');
    updateProgress(0, 'Inizio analisi');
    
    try {
        // 1. Carica CSV
        updateProgress(10, 'Parsing CSV');
        const csvData = await loadCSVData();
        
        if (!csvData || csvData.length === 0) {
            throw new Error('CSV vuoto o non valido');
        }
        
        // 2. Carica dati DB
        updateProgress(30, 'Caricamento dati database');
        const dbData = await loadDBData();
        
        // 3. Trova corrispondenze colonne
        updateProgress(50, 'Analisi corrispondenze colonne');
        const columnMapping = analyzeColumnMapping(csvData, dbData);
        
        // 4. Confronta dati
        updateProgress(70, 'Confronto record');
      window.comparisonResults = compareData(csvData, dbData, columnMapping);
        
        // 5. Aggiorna UI
        updateProgress(90, 'Aggiornamento risultati');
updateComparisonUI(window.comparisonResults, columnMapping);

// IMPORTANTE: Chiama afterAnalysisComplete per aggiornare lo stato
afterAnalysisComplete(comparisonResults);

updateProgress(100, 'Analisi completata');
setTimeout(() => hideLoading(), 500);
        
        showNotification('Analisi completata! Verifica il riepilogo.', 'success');
        
    } catch (error) {
        hideLoading();
        showNotification(`Errore analisi: ${error.message}`, 'error');
    }
}

// Aggiungi queste funzioni da qualche parte nel file (dopo le altre funzioni di gestione):

function resetAnalysisStatus() {
    window.comparisonResults = null;
    comparisonResults = null;
    updateAnalysisStatus(false);
    
    // Disabilita pulsante sincronizzazione
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
        btnSync.disabled = true;
        btnSync.style.backgroundColor = '#cbd5e1';
        btnSync.style.color = '#64748b';
        btnSync.style.cursor = 'not-allowed';
    }
    
    // Nascondi risultati precedenti
    const syncResultsSection = document.getElementById('sync-results');
    if (syncResultsSection) syncResultsSection.style.display = 'none';
}

// MODIFICA queste funzioni esistenti per chiamare resetAnalysisStatus:

// In loadTableStructure(), dopo currentTable = tableName; aggiungi:
resetAnalysisStatus();

// In handleCSVFile(), dopo csvFile = file; aggiungi:
resetAnalysisStatus();

// In removeCSV(), dopo csvFile = null; aggiungi:
resetAnalysisStatus();




// LOAD CSV DATA
async function loadCSVData() {
    const text = await readFileAsText(csvFile);
    const delimiter = document.getElementById('csv-delimiter').value;
    const header = document.getElementById('csv-header').value === 'true';
    
    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            delimiter,
            header,
            skipEmptyLines: true,
            complete: (results) => {
                csvData = results.data;
                csvColumns = results.meta.fields || [];
                resolve(csvData);
            },
            error: (error) => reject(error)
        });
    });
}

// LOAD DB DATA
async function loadDBData() {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from(currentTable)
        .select('*');
    
    if (error) throw error;
    return data || [];
}

// ANALYZE COLUMN MAPPING
function analyzeColumnMapping(csvData, dbData) {
    const mapping = {};
    const dbColumns = tableStructure.columns.map(c => c.name);
    
    csvColumns.forEach(csvCol => {
        // Cerca corrispondenza esatta
        let match = dbColumns.find(dbCol => 
            dbCol.toLowerCase() === csvCol.toLowerCase()
        );
        
        // Se non trovato, cerca parziale
        if (!match) {
            match = dbColumns.find(dbCol =>
                dbCol.toLowerCase().includes(csvCol.toLowerCase()) ||
                csvCol.toLowerCase().includes(dbCol.toLowerCase())
            );
        }
        
        mapping[csvCol] = match || null;
    });
    
    return mapping;
}

// COMPARE DATA
function compareData(csvData, dbData, columnMapping) {
    const results = {
        new: [],
        update: [],
        same: [],
        delete: [],
        errors: []
    };
    
    // Mappa DB per accesso rapido
    const dbMap = {};
    dbData.forEach(record => {
        const key = record[currentKey];
        if (key != null) {
            dbMap[String(key)] = record;
        }
    });
    
    const csvKeys = new Set();
    
    // Confronta CSV -> DB
    csvData.forEach(recordCSV => {
        try {
            const csvKey = recordCSV[columnMapping[currentKey] || currentKey];
            if (csvKey == null) {
                results.errors.push({
                    type: 'MISSING_KEY',
                    message: 'Chiave primaria mancante nel CSV'
                });
                return;
            }
            
            const keyStr = String(csvKey);
            csvKeys.add(keyStr);
            const recordDB = dbMap[keyStr];
            
            if (!recordDB) {
                // Nuovo record
                results.new.push({
                    key: csvKey,
                    data: recordCSV
                });
            } else {
                // Record esistente, controlla differenze
                const differences = findDifferences(recordCSV, recordDB, columnMapping);
                
                if (differences.length === 0) {
                    results.same.push({ key: csvKey });
                } else {
                    results.update.push({
                        key: csvKey,
                        dataCSV: recordCSV,
                        dataDB: recordDB,
                        differences
                    });
                }
                
                delete dbMap[keyStr];
            }
        } catch (error) {
            results.errors.push({
                type: 'COMPARISON_ERROR',
                message: error.message
            });
        }
    });
    
    // Record da eliminare (presenti solo in DB)
    Object.values(dbMap).forEach(recordDB => {
        results.delete.push({
            key: recordDB[currentKey],
            data: recordDB
        });
    });
    
    return results;
}

// FIND DIFFERENCES
function findDifferences(recordCSV, recordDB, columnMapping) {
    const differences = [];
    
    Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
        if (dbCol && recordCSV[csvCol] !== undefined) {
            const valCSV = recordCSV[csvCol];
            const valDB = recordDB[dbCol];
            
            if (String(valCSV).trim() !== String(valDB).trim()) {
                differences.push({
                    column: dbCol,
                    csvValue: valCSV,
                    dbValue: valDB
                });
            }
        }
    });
    
    return differences;
}

// UPDATE COMPARISON UI
function updateComparisonUI(results, columnMapping) {
    // Statistiche
    const statNew = document.getElementById('stat-new');
    const statUpdate = document.getElementById('stat-update');
    const statSame = document.getElementById('stat-same');
    const statDelete = document.getElementById('stat-delete');
    
    if (statNew) statNew.textContent = results.new.length;
    if (statUpdate) statUpdate.textContent = results.update.length;
    if (statSame) statSame.textContent = results.same.length;
    if (statDelete) statDelete.textContent = results.delete.length;
    
    // Info CSV
    const syncCsvFile = document.getElementById('sync-csv-file');
    const syncCsvCount = document.getElementById('sync-csv-count');
    const syncCsvCols = document.getElementById('sync-csv-cols');
    
    if (syncCsvFile) syncCsvFile.textContent = csvFile.name;
    if (syncCsvCount) syncCsvCount.textContent = csvData.length.toLocaleString();
    if (syncCsvCols) syncCsvCols.textContent = csvColumns.length;
    
    // Corrispondenze colonne
    const mappingList = document.getElementById('mapping-list');
    const columnMappingSection = document.getElementById('column-mapping');
    
    if (mappingList) {
        mappingList.innerHTML = '';
        
        let matchCount = 0;
        Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
            const div = document.createElement('div');
            div.className = 'mapping-item';
            div.innerHTML = `
                <div class="mapping-col">
                    <span class="material-symbols-rounded">${dbCol ? 'check_circle' : 'error'}</span>
                    <div class="mapping-info">
                        <div class="mapping-source">${csvCol}</div>
                        <div class="mapping-target">${dbCol ? `→ ${dbCol}` : 'Nessuna corrispondenza'}</div>
                    </div>
                </div>
                <div class="mapping-status ${dbCol ? 'match' : 'no-match'}">
                    ${dbCol ? 'MATCH' : 'NO MATCH'}
                </div>
            `;
            mappingList.appendChild(div);
            if (dbCol) matchCount++;
        });
    }
    
    if (columnMappingSection) columnMappingSection.style.display = 'block';
    
    // Warning
    updateSyncWarning();
}

// UPDATE SYNC WARNING
function updateSyncWarning() {
    const warning = document.getElementById('warning-sync');
    const warningText = document.getElementById('warning-text');
    
    if (!warning || !warningText || !window.comparisonResults) return;
    
    const mode = document.querySelector('input[name="sync-mode"]:checked')?.value;
    const deleteEnabled = document.getElementById('action-delete')?.checked;
    
    let warnings = [];
    
    if (mode === 'sync') {
        if (deleteEnabled && comparisonResults.delete.length > 0) {
            warnings.push(`Verranno eliminati ${comparisonResults.delete.length} record`);
        }
        
        if (comparisonResults.new.length > 0) {
            warnings.push(`Verranno inseriti ${comparisonResults.new.length} nuovi record`);
        }
        
        if (comparisonResults.update.length > 0) {
            warnings.push(`Verranno aggiornati ${comparisonResults.update.length} record`);
        }
    }
    
    if (warnings.length > 0) {
        warningText.innerHTML = warnings.map(w => `<div>• ${w}</div>`).join('');
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }
}

// START SYNC
async function startSync() {
    console.log('=== START SYNC CHIAMATO ===');
    
    // 1. Controlla IMMEDIATAMENTE la modalità
    const mode = document.querySelector('input[name="sync-mode"]:checked')?.value;
    console.log('Modalità:', mode);
    
    if (mode === 'analyze') {
        console.log('[DEBUG] Modalità analyze - esco');
        showNotification('Modalità "Solo Analisi" selezionata', 'info');
        return; // Esci IMMEDIATAMENTE, non fare altro!
    }
    
    console.log('[DEBUG] Modalità sync - proseguo');
    
    // 2. Controlla se l'analisi è stata eseguita (usa window.comparisonResults)
    if (!window.comparisonResults || Object.keys(window.comparisonResults).length === 0) {
        showNotification('❌ Dati di confronto non disponibili. Esegui prima l\'analisi.', 'error');
        return;
    }
    
    // 3. Controlla se c'è qualcosa da sincronizzare
    const newCount = window.comparisonResults.new?.length || 0;
    const updateCount = window.comparisonResults.update?.length || 0;
    const deleteCount = window.comparisonResults.delete?.length || 0;
    
    console.log(`Dati analisi: ${newCount} nuovi, ${updateCount} aggiornamenti, ${deleteCount} eliminazioni`);
    
    if (newCount === 0 && updateCount === 0 && deleteCount === 0) {
        showNotification('⚠️ Nessuna modifica da sincronizzare', 'warning');
        return;
    }
    
    // 4. Mostra conferma
    let confirmMessage = `Confermi la sincronizzazione?\n\n`;
    confirmMessage += `Tabella: ${currentTable}\n`;
    confirmMessage += `Chiave: ${currentKey}\n\n`;
    
    if (newCount > 0) confirmMessage += `📥 Inserire: ${newCount} record\n`;
    if (updateCount > 0) confirmMessage += `🔄 Aggiornare: ${updateCount} record\n`;
    if (deleteCount > 0) confirmMessage += `🗑️ Eliminare: ${deleteCount} record\n`;
    
    if (!confirm(confirmMessage + '\nQuesta azione non può essere annullata.')) {
        showNotification('Sincronizzazione annullata', 'info');
        return;
    }
    
    // 5. Avvia sincronizzazione
    try {
        showLoading('Sincronizzazione', 'Avvio operazioni...');
        updateProgress(0, 'Preparazione...');
        
        const risultati = await executeSync();
        
        // Aggiorna UI risultati
        updateSyncResultsUI(risultati);
        const syncResultsSection = document.getElementById('sync-results');
        if (syncResultsSection) syncResultsSection.style.display = 'block';
        
        showNotification('✅ Sincronizzazione completata!', 'success');
        
    } catch (error) {
        console.error('Errore sincronizzazione:', error);
        showNotification(`❌ Errore: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}
// In admin_database.js, aggiungi questa funzione
async function validateSyncBeforeStart() {
    const issues = [];
    
    // 1. Controlla se l'analisi è stata eseguita
    if (!window.comparisonResults) {
        issues.push('Analisi non eseguita - Esegui prima "Analizza Database"');
        return issues; // Ritorna subito, questo è un errore bloccante
    }
    
    // 2. Controlla se ci sono dati da sincronizzare
    const hasData = 
        (window.comparisonResults.new && window.comparisonResults.new.length > 0) ||
        (window.comparisonResults.update && window.comparisonResults.update.length > 0) ||
        (window.comparisonResults.delete && window.comparisonResults.delete.length > 0);
    
    if (!hasData) {
        issues.push('Nessuna differenza trovata tra i database');
    }
    
    // 3. Controlla se la tabella è selezionata
    if (!currentTable) {
        issues.push('Nessuna tabella selezionata');
    }
    
    // 4. Controlla se la chiave è selezionata
    if (!currentKey) {
        issues.push('Nessuna chiave primaria selezionata');
    }
    
    return issues;
}

// Funzione per aggiornare lo stato dell'analisi nell'UI
function updateAnalysisStatus(hasAnalysis = false, results = null) {
    console.log('updateAnalysisStatus chiamato:', { hasAnalysis, results });
    
    const statusElement = document.getElementById('analysis-status');
    const statusText = document.getElementById('analysis-status-text');
    
    if (!statusElement || !statusText) {
        console.warn('Elementi UI per stato analisi non trovati');
        console.log('Cercati: #analysis-status e #analysis-status-text');
        console.log('Elementi trovati:', {
            statusElement: document.getElementById('analysis-status'),
            statusText: document.getElementById('analysis-status-text')
        });
        return;
    }
    
    statusElement.style.display = 'flex';
    
    if (hasAnalysis && results) {
        statusElement.classList.remove('error');
        statusElement.classList.add('ready');
        
        const newCount = results.new?.length || 0;
        const updateCount = results.update?.length || 0;
        const deleteCount = results.delete?.length || 0;
        const errorCount = results.errors?.length || 0;
        
        let statusMessage = `✅ Analisi completata: `;
        
        if (newCount > 0) statusMessage += `${newCount} nuovi, `;
        if (updateCount > 0) statusMessage += `${updateCount} aggiornamenti, `;
        if (deleteCount > 0) statusMessage += `${deleteCount} eliminazioni, `;
        if (errorCount > 0) statusMessage += `${errorCount} errori`;
        
        // Rimuovi l'ultima virgola se presente
        statusMessage = statusMessage.replace(/, $/, '');
        
        statusText.textContent = statusMessage;
        
        console.log('Stato analisi aggiornato:', statusMessage);
    } else {
        statusElement.classList.remove('ready');
        statusElement.classList.add('error');
        statusText.textContent = '⚠️ Analisi non eseguita - Esegui prima "Analizza Database"';
    }
}

// Chiama questa funzione dopo ogni analisi
// Chiama questa funzione dopo ogni analisi
function afterAnalysisComplete(results) {
    if (!results) return;
    
    window.comparisonResults = results;
    updateAnalysisStatus(true, results);
    
    // Salva nei dati globali anche (per compatibilità)
    window.comparisonResults = results;
    
    showNotification('Analisi completata! Pronto per sincronizzare.', 'success');
    
    // Abilita pulsante sincronizzazione
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
        btnSync.disabled = false;
        btnSync.style.backgroundColor = '';
        btnSync.style.color = '';
        btnSync.style.cursor = '';
        btnSync.innerHTML = '<span class="material-symbols-rounded">sync</span> Sincronizza';
    }
}

// Chiama questa funzione all'inizializzazione della pagina
// ASSICURATI che questa funzione esista (la vedo già nel tuo codice):
function updateAnalysisStatus(hasAnalysis = false, results = null) {
    const statusElement = document.getElementById('analysis-status');
    const statusText = document.getElementById('analysis-status-text');
    
    if (!statusElement || !statusText) {
        console.warn('Elementi UI per stato analisi non trovati');
        return;
    }
    
    statusElement.style.display = 'block';
    
    if (hasAnalysis && results) {
        statusElement.classList.remove('error');
        statusElement.classList.add('ready');
        
        const newCount = results.new?.length || 0;
        const updateCount = results.update?.length || 0;
        const deleteCount = results.delete?.length || 0;
        const total = newCount + updateCount + deleteCount;
        
        statusText.textContent = `✅ Analisi completata: ${total} modifiche trovate (${newCount} nuovi, ${updateCount} aggiornamenti, ${deleteCount} eliminazioni)`;
    } else {
        statusElement.classList.remove('ready');
        statusElement.classList.add('error');
        statusText.textContent = '⚠️ Analisi non eseguita - Esegui prima "Analizza Database"';
    }
}
// EXECUTE SYNC
async function executeSync() {
    console.log('=== EXECUTE SYNC ===');
    
    // CONTROLLO UNICO all'inizio
    if (!window.comparisonResults) {
        console.error('❌ ERRORE: comparisonResults non disponibile');
        throw new Error('Dati di confronto non disponibili. Esegui prima l\'analisi.');
    }
    
    console.log('✅ Dati analisi disponibili:', {
        nuovi: window.comparisonResults.new?.length || 0,
        aggiornamenti: window.comparisonResults.update?.length || 0,
        eliminazioni: window.comparisonResults.delete?.length || 0,
        errori: window.comparisonResults.errors?.length || 0
    });
    
    const client = getSupabaseClient();
    const results = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        errors: [],
        log: []
    };
    
    // PER COMPATIBILITÀ, usa una variabile locale
    const comparisonData = window.comparisonResults;
    
    const insertEnabled = document.getElementById('action-insert')?.checked;
    const updateEnabled = document.getElementById('action-update')?.checked;
    const deleteEnabled = document.getElementById('action-delete')?.checked;
    const batchSize = parseInt(document.getElementById('batch-size')?.value) || 50;
    
    // LOG INIZIALE
    addLog(`🚀 Inizio sincronizzazione: ${currentTable}`);
    addLog(`   Chiave primaria: ${currentKey}`);
    addLog(`   Modalità: Insert=${insertEnabled}, Update=${updateEnabled}, Delete=${deleteEnabled}`);
    addLog(`   Batch size: ${batchSize}`);
    addLog(`   Record da eliminare: ${comparisonData.delete?.length || 0}`);
    
    // ELIMINAZIONI (se abilitate e ci sono record da eliminare)
    if (deleteEnabled && comparisonData.delete && comparisonData.delete.length > 0) {
        console.log(`🗑️ Eliminazione ${comparisonData.delete.length} record...`);
        await executeDeletes(client, results, batchSize, comparisonData, currentTable, currentKey);
    } else if (deleteEnabled) {
        addLog(`📭 Nessun record da eliminare`);
    }
    
    // INSERIMENTI (se abilitati e ci sono nuovi record)
    if (insertEnabled && comparisonData.new && comparisonData.new.length > 0) {
        console.log(`📥 Inserimento ${comparisonData.new.length} record...`);
        await executeInserts(client, results, batchSize, comparisonData, currentTable, currentKey);
    } else if (insertEnabled) {
        addLog(`📭 Nessun record da inserire`);
    }
    
    // AGGIORNAMENTI (se abilitati e ci sono aggiornamenti)
    if (updateEnabled && comparisonData.update && comparisonData.update.length > 0) {
        console.log(`🔄 Aggiornamento ${comparisonData.update.length} record...`);
        await executeUpdates(client, results, batchSize, comparisonData, currentTable, currentKey);
    } else if (updateEnabled) {
        addLog(`📭 Nessun record da aggiornare`);
    }
    
    // RIEPILOGO FINALE
    addLog(`✨ Sincronizzazione completata!`);
    addLog(`   ✅ Inseriti: ${results.inserted}`);
    addLog(`   🔄 Aggiornati: ${results.updated}`);
    addLog(`   🗑️ Eliminati: ${results.deleted}`);
    addLog(`   ❌ Errori: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
        addLog(`   📋 Errori dettagliati nella console`, 'warning');
        console.log('Errori sincronizzazione:', results.errors);
    }
    
    return results;
}

async function validateSyncBeforeStart() {
    const issues = [];
    
  // 1. Controlla se l'analisi è stata eseguita
    if (!window.comparisonResults) {
        issues.push('Analisi non eseguita - Esegui prima "Analizza Database"');
        return issues;
    }
    
    // 2. Controlla se la tabella è selezionata
    if (!currentTable) {
        issues.push('Nessuna tabella selezionata');
    }
    
    // 3. Controlla se la chiave è selezionata
    if (!currentKey) {
        issues.push('Nessuna chiave primaria selezionata');
    }
    
    // 4. Controlla se ci sono azioni selezionate
    const insertEnabled = document.getElementById('action-insert')?.checked;
    const updateEnabled = document.getElementById('action-update')?.checked;
    const deleteEnabled = document.getElementById('action-delete')?.checked;
    
    if (!insertEnabled && !updateEnabled && !deleteEnabled) {
        issues.push('Nessuna azione selezionata (inserimento/aggiornamento/eliminazione)');
    }
    
    return issues;
}

// EXECUTE INSERTS
async function executeInserts(client, results, batchSize, comparisonData, tableName, keyName) {
    const toInsert = comparisonData.new;
    const total = toInsert.length;
    
    console.log(`📥 Inserimento ${total} record...`);
    
    for (let i = 0; i < total; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        
        try {
            // Prepara i record per l'inserimento
            const records = batch.map(item => {
                const record = {};
                
                // Mappa tutte le colonne dal CSV al DB usando il mapping
                if (comparisonData.columnMapping) {
                    Object.keys(comparisonData.columnMapping).forEach(csvCol => {
                        const dbCol = comparisonData.columnMapping[csvCol];
                        if (dbCol && item.data && item.data[csvCol] !== undefined) {
                            let value = item.data[csvCol];
                            
                            // CONVERTI DATE ITALIANE IN FORMATO ISO
                            if (isItalianDate(value)) {
                                value = convertItalianDateToISO(value);
                            } else if (isItalianDateTime(value)) {
                                value = convertItalianDateTimeToISO(value);
                            }
                            
                            record[dbCol] = value;
                        }
                    });
                } else {
                    // Se non c'è mapping, usa direttamente i dati
                    Object.assign(record, item.data || item);
                    
                    // Converti eventuali date in formato ISO
                    Object.keys(record).forEach(key => {
                        if (isItalianDate(record[key])) {
                            record[key] = convertItalianDateToISO(record[key]);
                        } else if (isItalianDateTime(record[key])) {
                            record[key] = convertItalianDateTimeToISO(record[key]);
                        }
                    });
                }
                
                return record;
            });
            

records.forEach((record, index) => {
    Object.keys(record).forEach(key => {
        const value = record[key];
        if (typeof value === 'string') {
            if (isItalianDate(value)) {
                console.log(`⚠️ Data italiana trovata in record ${index}, campo ${key}: ${value} → ${convertItalianDateToISO(value)}`);
            } else if (isItalianDateTime(value)) {
                console.log(`⚠️ Data/ora italiana trovata in record ${index}, campo ${key}: ${value} → ${convertItalianDateTimeToISO(value)}`);
            }
        }
    });
});






            console.log(`Batch ${i/batchSize + 1}: ${records.length} record`, records.slice(0, 1)); // Mostra solo il primo per debug
            
            // Query INSERT reale
            const { data, error } = await client
                .from(tableName)
                .insert(records)
                .select();
            
            if (error) {
                console.error(`❌ Errore inserimento batch ${i}:`, error);
                throw error;
            }
            
            results.inserted += records.length;
            addLog(`✅ Inseriti ${records.length} record (${i + records.length}/${total})`);
            
            // Mostra dettagli nel log
            if (data && data.length > 0) {
                const insertedIds = data.map(r => r[keyName] || r.id).filter(Boolean);
                if (insertedIds.length > 0) {
                    addLog(`   ID inseriti: ${insertedIds.slice(0, 3).join(', ')}${insertedIds.length > 3 ? '...' : ''}`);
                }
            }
            
        } catch (error) {
            console.error(`💥 Errore critico inserimento batch ${i}:`, error);
            results.errors.push({
                tipo: 'INSERIMENTO',
                batch: i,
                messaggio: error.message,
                details: error
            });
            addLog(`❌ ERRORE inserimento batch ${i}: ${error.message}`, 'error');
        }
        
        // Aggiorna progresso
        const progress = 10 + (40 * (i + batch.length) / total);
        updateProgress(progress, `Inserimento: ${i + batch.length}/${total}`);
        
        // Piccola pausa per non sovraccaricare
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// FUNZIONI DI UTILITÀ PER CONVERSIONE DATE
function isItalianDate(value) {
    if (typeof value !== 'string') return false;
    
    // Pattern per date italiane: DD/MM/YYYY o DD/MM/YY
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
    return datePattern.test(value.trim());
}

function isItalianDateTime(value) {
    if (typeof value !== 'string') return false;
    
    // Pattern per date/time italiane: DD/MM/YYYY HH:MM o DD/MM/YYYY HH:MM:SS
    const dateTimePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4} \d{1,2}:\d{2}(:\d{2})?$/;
    return dateTimePattern.test(value.trim());
}

function convertItalianDateToISO(dateString) {
    // Converte DD/MM/YYYY in YYYY-MM-DD
    const parts = dateString.split('/');
    if (parts.length !== 3) return dateString;
    
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    
    // Se l'anno ha solo 2 cifre, assume 20XX
    if (year.length === 2) {
        year = '20' + year;
    }
    
    return `${year}-${month}-${day}`;
}

function convertItalianDateTimeToISO(dateTimeString) {
    // Converte DD/MM/YYYY HH:MM o DD/MM/YYYY HH:MM:SS in ISO
    const [datePart, timePart] = dateTimeString.split(' ');
    if (!datePart || !timePart) return dateTimeString;
    
    const isoDate = convertItalianDateToISO(datePart);
    return `${isoDate}T${timePart}:00`; // Aggiunge secondi se mancano
}


// EXECUTE UPDATES
async function executeUpdates(client, results, batchSize, comparisonData, tableName, keyName) {
    const toUpdate = comparisonData.update;
    const total = toUpdate.length;
    
    console.log(`🔄 Aggiornamento ${total} record...`);
    
    for (let i = 0; i < total; i += batchSize) {
        const batch = toUpdate.slice(i, i + batchSize);
        
        let updatedInBatch = 0;
        
        for (const item of batch) {
            try {
                // Prepara i dati da aggiornare (escludendo la chiave primaria)
                const updateData = {};
                let hasChanges = false;
                
                if (comparisonData.columnMapping) {
                    Object.keys(comparisonData.columnMapping).forEach(csvCol => {
                        const dbCol = comparisonData.columnMapping[csvCol];
                        
                        // Aggiorna solo se:
                        // 1. La colonna esiste nel mapping
                        // 2. Non è la chiave primaria
                        // 3. C'è una differenza
                        if (dbCol && dbCol !== keyName) {
                            const csvValue = item.dataCSV && item.dataCSV[csvCol];
                            const dbValue = item.dataDB && item.dataDB[dbCol];
                            
                            // Solo se i valori sono diversi
                            if (csvValue !== undefined && String(csvValue).trim() !== String(dbValue).trim()) {
                                // CONVERTI DATE ITALIANE IN FORMATO ISO
                                let convertedValue = csvValue;
                                if (isItalianDate(csvValue)) {
                                    convertedValue = convertItalianDateToISO(csvValue);
                                } else if (isItalianDateTime(csvValue)) {
                                    convertedValue = convertItalianDateTimeToISO(csvValue);
                                }
                                
                                updateData[dbCol] = convertedValue;
                                hasChanges = true;
                            }
                        }
                    });
                }
                
                // Se ci sono cambiamenti, esegui l'UPDATE
                if (hasChanges && item.chiave) {
                    console.log(`Aggiornamento ${keyName}=${item.chiave}:`, updateData);
                    
                    const { data, error } = await client
                        .from(tableName)
                        .update(updateData)
                        .eq(keyName, item.chiave)
                        .select();
                    
                    if (error) throw error;
                    
                    updatedInBatch++;
                    results.updated++;
                    
                    // Log dettagliato per primi aggiornamenti
                    if (results.updated <= 3) {
                        addLog(`   Aggiornato ${keyName}=${item.chiave}`);
                    }
                } else if (item.chiave) {
                    console.log(`Nessun cambiamento per ${keyName}=${item.chiave}`);
                    addLog(`   Nessun cambiamento per ${keyName}=${item.chiave}`, 'info');
                }
                
            } catch (error) {
                console.error(`Errore aggiornamento ${item.chiave}:`, error);
                results.errors.push({
                    tipo: 'AGGIORNAMENTO',
                    chiave: item.chiave,
                    messaggio: error.message
                });
                addLog(`❌ ERRORE aggiornamento ${item.chiave}: ${error.message}`, 'error');
            }
        }
        
        if (updatedInBatch > 0) {
            addLog(`✅ Aggiornati ${updatedInBatch} record (${i + batch.length}/${total})`);
        }
        
        // Aggiorna progresso
        const progress = 50 + (30 * (i + batch.length) / total);
        updateProgress(progress, `Aggiornamento: ${i + batch.length}/${total}`);
        
        // Pausa
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}
// EXECUTE DELETES
async function executeDeletes(client, results, batchSize, comparisonData, tableName, keyName) {
    const toDelete = comparisonData.delete;
    const total = toDelete.length;
    
    console.log(`🗑️ Eliminazione ${total} record...`);
    
    // CONFERMA AGGIUNTIVA PER ELIMINAZIONI
    if (total > 10) {
        const confirmDelete = confirm(`⚠️ ATTENZIONE: Stai per eliminare ${total} record.\n\nQuesta azione è IRREVERSIBILE.\n\nVuoi procedere?`);
        if (!confirmDelete) {
            addLog(`⏹️ Eliminazione annullata dall'utente`, 'warning');
            return;
        }
    }
    
    for (let i = 0; i < total; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const chiavi = batch.map(item => item.chiave).filter(Boolean);
        
        if (chiavi.length === 0) continue;
        
        try {
            console.log(`Eliminazione batch ${i}:`, chiavi);
            
            // Query DELETE reale
            const { data, error } = await client
                .from(tableName)
                .delete()
                .in(keyName, chiavi)
                .select();
            
            if (error) {
                console.error(`❌ Errore eliminazione batch ${i}:`, error);
                throw error;
            }
            
            results.deleted += batch.length;
            addLog(`🗑️ Eliminati ${batch.length} record (${i + batch.length}/${total})`);
            
            // Log dettagliato (solo per primi batch)
            if (i === 0 && data && data.length > 0) {
                const deletedIds = data.map(r => r[keyName]).filter(Boolean);
                if (deletedIds.length > 0) {
                    addLog(`   ID eliminati: ${deletedIds.slice(0, 5).join(', ')}${deletedIds.length > 5 ? '...' : ''}`);
                }
            }
            
        } catch (error) {
            console.error(`💥 Errore critico eliminazione batch ${i}:`, error);
            results.errors.push({
                tipo: 'ELIMINAZIONE',
                batch: i,
                messaggio: error.message
            });
            addLog(`❌ ERRORE eliminazione batch ${i}: ${error.message}`, 'error');
        }
        
        // Aggiorna progresso
        const progress = 80 + (20 * (i + batch.length) / total);
        updateProgress(progress, `Eliminazione: ${i + batch.length}/${total}`);
        
        // Pausa più lunga per eliminazioni (operazione critica)
        await new Promise(resolve => setTimeout(resolve, 800));
    }
}
// UPDATE SYNC RESULTS UI
function updateSyncResultsUI(results) {
    const resultInserted = document.getElementById('result-inserted');
    const resultUpdated = document.getElementById('result-updated');
    const resultDeleted = document.getElementById('result-deleted');
    const resultErrors = document.getElementById('result-errors');
    
    if (resultInserted) resultInserted.textContent = results.inserted;
    if (resultUpdated) resultUpdated.textContent = results.updated;
    if (resultDeleted) resultDeleted.textContent = results.deleted;
    if (resultErrors) resultErrors.textContent = results.errors.length;
    
    // Log operazioni
    const logContainer = document.getElementById('sync-log');
    if (logContainer) {
        logContainer.innerHTML = results.log.map(log => 
            `<div class="log-entry ${log.type === 'error' ? 'error' : ''}">${log.message}</div>`
        ).join('');
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// ADD LOG
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('it-IT');
    const logEntry = {
        timestamp,
        message: `[${timestamp}] ${message}`,
        type
    };
    
    if (syncResults) {
        syncResults.log.push(logEntry);
    }
}

// EXPORT RESULTS
function exportResults() {
    if (!syncResults) {
        showNotification('Nessun risultato da esportare', 'error');
        return;
    }
    
    try {
        const content = JSON.stringify(syncResults, null, 2);
        downloadFile(content, `FloX_Results_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        showNotification('Risultati esportati', 'success');
    } catch (error) {
        showNotification(`Errore esportazione: ${error.message}`, 'error');
    }
}

// UTILITY FUNCTIONS
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Crea notifica temporanea
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="material-symbols-rounded">
            ${type === 'success' ? 'check_circle' : 
              type === 'error' ? 'error' : 
              type === 'warning' ? 'warning' : 'info'}
        </span>
        <span>${message}</span>
        <button class="btn-icon-small" onclick="this.parentElement.remove()">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showLoading(title = 'Caricamento', message = 'Attendere...') {
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');
    const modalLoading = document.getElementById('modal-loading');
    
    if (loadingTitle) loadingTitle.textContent = title;
    if (loadingMessage) loadingMessage.textContent = message;
    if (modalLoading) modalLoading.style.display = 'flex';
}

function hideLoading() {
    const modalLoading = document.getElementById('modal-loading');
    if (modalLoading) modalLoading.style.display = 'none';
    updateProgress(0, '');
}

function updateProgress(percent, detail) {
    const bar = document.getElementById('loading-progress');
    const percentText = document.getElementById('loading-percent');
    const detailText = document.getElementById('loading-detail');
    
    if (bar) bar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${Math.round(percent)}%`;
    if (detailText) detailText.textContent = detail;
    
    if (detail) {
        const loadingMessage = document.getElementById('dettaglio-elaborazione');
        if (loadingMessage) loadingMessage.textContent = detail;
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Intestazioni
    csvRows.push(headers.join(','));
    
    // Righe
    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            
            let escaped = String(value);
            if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
                escaped = '"' + escaped.replace(/"/g, '""') + '"';
            }
            return escaped;
        });
        csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
}

// FUNZIONI MODAL
function showCreateTableModal() {
    const modal = document.getElementById('modal-create-table');
    if (modal) modal.style.display = 'flex';
}

function closeCreateTableModal() {
    const modal = document.getElementById('modal-create-table');
    if (modal) modal.style.display = 'none';
}

function showTableDataModal(tableName, data) {
    // Implementa questa funzione se necessario
    console.log('Mostra dati tabella:', tableName, data);
}

// ANALYZE TABLE
function analyzeTable(tableName) {
    // Vai al tab analisi
    const analyzeTab = document.querySelector(`[data-tab="analyze"]`);
    if (analyzeTab) {
        analyzeTab.click();
        
        setTimeout(() => {
            const select = document.getElementById('table-select');
            if (select) {
                select.value = tableName;
                loadTableStructure();
            }
        }, 100);
    }
}

// REFRESH ANALYSIS
function refreshAnalysis() {
    if (currentTable) {
        loadTableStructure();
    }
}

// DEBUG FUNCTIONS
window.debugAdmin = {
    getState: () => ({
        currentTab,
        currentTable,
        currentKey,
        tableStructure: !!tableStructure,
        csvFile: csvFile?.name,
        comparisonResults: !!comparisonResults,
        syncResults: !!syncResults,
        isInitialized
    }),
    
    testConnection: async () => {
        try {
            const result = await testDbConnection();
            return { success: result.success, message: result.message || result.error };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },
    
    clearCache: () => {
        localStorage.clear();
        sessionStorage.clear();
        showNotification('Cache pulita', 'info');
    },
    
    reloadTables: () => {
        loadTables();
    }
};

console.log('Admin Database JS caricato con successo');


