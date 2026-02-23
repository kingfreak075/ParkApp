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

// All'inizio del file, dopo le altre variabili globali, aggiungi:
let vehiclesManagerActive = false;



// Inizializza la variabile globale una sola volta
window.comparisonResults = null;


// Inizializzazione gestione personale
// Inizializzazione gestione personale
function initializePersonnelManagement() {
    console.log('🚀 Inizializzazione gestione personale...');
    
    // Setup tab navigation
    const personnelTabs = document.querySelectorAll('[data-personnel-table]');
    personnelTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            personnelTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Load new table usando le funzioni specifiche
            const tableName = this.dataset.personnelTable;
            currentPersonnelTable = tableName;
            currentPage = 1; // Reset paginazione
            
            // Chiama la funzione di caricamento specifica per ogni tabella
            switch(tableName) {
                case 'tecnici':
                    loadTecniciData();
                    break;
                case 'manutentori':
                    loadManutentoriData();
                    break;
                case 'supervisori':
                    loadSupervisoriData();
                    break;
                case 'venditori':
                    loadVenditoriData();
                    break;
                default:
                    loadPersonnelData(); // fallback
            }
        });
    });
    
    // Setup buttons
    document.getElementById('btn-add-personnel')?.addEventListener('click', showAddPersonnelModal);
    document.getElementById('btn-upload-csv-personnel')?.addEventListener('click', () => uploadCSVToPersonnelTable(currentPersonnelTable));
    document.getElementById('btn-download-csv-personnel')?.addEventListener('click', () => downloadPersonnelCSV(currentPersonnelTable));
    document.getElementById('btn-refresh-personnel')?.addEventListener('click', function() {
        // Ricarica la tabella corrente con la funzione specifica
        switch(currentPersonnelTable) {
            case 'tecnici':
                loadTecniciData();
                break;
            case 'manutentori':
                loadManutentoriData();
                break;
            case 'supervisori':
                loadSupervisoriData();
                break;
            case 'venditori':
                loadVenditoriData();
                break;
            default:
                loadPersonnelData();
        }
    });
    
    // Setup search
    const searchInput = document.getElementById('personnel-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterPersonnelData, 300));
    }
    
    // Setup pagination
    document.getElementById('btn-prev-personnel')?.addEventListener('click', prevPersonnelPage);
    document.getElementById('btn-next-personnel')?.addEventListener('click', nextPersonnelPage);
    
    // Load initial data se il tab è attivo
    if (document.getElementById('tab-personnel').classList.contains('active')) {
        // Carica la tabella iniziale (tecnici)
        loadTecniciData();
    }
}








// Carica dati personale - VERSIONE CORRETTA
async function loadPersonnelData() {
    console.log(`📥 Caricamento dati per tabella: ${currentPersonnelTable}`);
    
    if (!hasDbConfig()) {
        showNotification('Configura prima il database', 'warning');
        return;
    }
    
    showLoading('Caricamento dati', `Tabella: ${currentPersonnelTable}`);
    
    try {
        const client = getSupabaseClient();
        
        // Ottieni configurazione tabella
        const tableConfig = getTableConfig(currentPersonnelTable);
        if (!tableConfig) {
            console.warn(`⚠️ Tabella ${currentPersonnelTable} non configurata in DB_RULES`);
            
            // Fallback: carica dati senza validazioni
            const { data, error } = await client
                .from(currentPersonnelTable)
                .select('*')
                .limit(100);
            
            if (error) throw error;
            
            personnelData = data || [];
            personnelColumns = data && data.length > 0 ? Object.keys(data[0]) : [];
            renderPersonnelTable();
            
            showNotification(`Caricati ${personnelData.length} record (senza validazioni)`, 'info');
            return;
        }
        
        console.log(`✅ Config tabella trovata:`, tableConfig);
        
        // Determina la chiave di ordinamento
        const orderByField = Array.isArray(tableConfig.key) ? tableConfig.key[0] : tableConfig.key;
        
        // Query base
        let query = client
            .from(currentPersonnelTable)
            .select('*');
        
        // Applica ordinamento solo se il campo esiste
        if (orderByField) {
            query = query.order(orderByField, { ascending: true });
        } else {
            // Fallback: prova i campi comuni
            try {
                query = query.order('codice', { ascending: true });
            } catch {
                try {
                    query = query.order('nome', { ascending: true });
                } catch {
                    // Nessun ordinamento
                }
            }
        }
        
        // Limita per performance
        query = query.limit(500);
        
        const { data, error } = await query;
        
        if (error) {
            console.error(`❌ Errore query:`, error);
            
            // Prova senza ordinamento
            const { data: data2, error: error2 } = await client
                .from(currentPersonnelTable)
                .select('*')
                .limit(100);
            
            if (error2) throw error2;
            
            personnelData = data2 || [];
        } else {
            personnelData = data || [];
        }
        
        // Determina colonne da mostrare
        if (personnelData.length > 0) {
            personnelColumns = Object.keys(personnelData[0]);
        } else {
            // Usa colonne dalla configurazione
            personnelColumns = Object.keys(tableConfig.columns || {}).filter(col => !tableConfig.columns[col].auto);
        }
        
        console.log(`✅ Dati caricati: ${personnelData.length} record, ${personnelColumns.length} colonne`);
        
        // Renderizza la tabella
        renderPersonnelTable();
        
        // Aggiorna timestamp (senza fallire se elemento non esiste)
        try {
            const updateElement = document.getElementById('last-update-personnel');
            if (updateElement) {
                updateElement.textContent = new Date().toLocaleTimeString('it-IT');
            }
        } catch (e) {
            console.log('Timestamp update skipped:', e.message);
        }
        
        showNotification(`✅ Caricati ${personnelData.length} record da ${currentPersonnelTable}`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento personale:', error);
        showNotification(`Errore: ${error.message}`, 'error');
        
        // Mostra tabella vuota con messaggio di errore
        personnelData = [];
        personnelColumns = [];
        renderPersonnelTable();
    } finally {
        hideLoading();
    }
}


// Ricava il nome della primary key in modo coerente (TABLE_CONFIGS → DB_RULES → 'id')
function getPrimaryKeyName(table) {
  if (TABLE_CONFIGS?.[table]?.primaryKey) return TABLE_CONFIGS[table].primaryKey;
  const cfg = typeof getTableConfig === 'function' ? getTableConfig(table) : null;
  if (cfg?.key) return Array.isArray(cfg.key) ? cfg.key[0] : cfg.key;
  return 'id';
}





// Render tabella personale
// Render tabella personale - VERSIONE ROBUSTA
// Helper: ricava il nome della primary key per la tabella corrente
function getPrimaryKeyName(table) {
  // Priorità: TABLE_CONFIGS → DB_RULES (getTableConfig) → fallback 'id'
  if (typeof TABLE_CONFIGS !== 'undefined' && TABLE_CONFIGS?.[table]?.primaryKey) {
    return TABLE_CONFIGS[table].primaryKey;
  }
  const cfg = (typeof getTableConfig === 'function') ? getTableConfig(table) : null;
  if (cfg?.key) return Array.isArray(cfg.key) ? cfg.key[0] : cfg.key;
  return 'id';
}

function renderPersonnelTable() {
  console.log(`🔄 Rendering tabella ${currentPersonnelTable}`);

  const container = document.getElementById('personnel-content');
  if (!container) {
    console.error('❌ Container #personnel-content non trovato');
    return;
  }

  // Se la pagina corrente sfora (es. dopo filtro o cambio tab), riporta a 1
  if (currentPage > 1 && (currentPage - 1) * recordsPerPage >= personnelData.length) {
    currentPage = 1;
  }

  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, personnelData.length);
  const pageData = personnelData.slice(startIndex, endIndex);

  console.log(`📊 Pagina ${currentPage}: ${pageData.length} record su ${personnelData.length}`);

  // Pulisci container
  container.innerHTML = '';

  // 1) Barra controlli
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'personnel-controls';
  controlsDiv.innerHTML = `
    <div class="search-box">
      <span class="material-symbols-rounded">search</span>
      <input type="text" id="personnel-search" placeholder="Cerca...">
    </div>
    <div class="personnel-actions">
      <button class="btn btn-primary" id="btn-add-personnel">
        <span class="material-symbols-rounded">add</span>
        Aggiungi
      </button>
      <button class="btn btn-secondary" id="btn-upload-csv-personnel">
        <span class="material-symbols-rounded">upload</span>
        Upload CSV
      </button>
      <button class="btn btn-secondary" id="btn-download-csv-personnel">
        <span class="material-symbols-rounded">download</span>
        Esporta CSV
      </button>
      <button class="btn btn-icon" id="btn-refresh-personnel" title="Aggiorna">
        <span class="material-symbols-rounded">refresh</span>
      </button>
    </div>
  `;
  container.appendChild(controlsDiv);

  // 2) Statistiche
  const statsDiv = document.createElement('div');
  statsDiv.className = 'personnel-stats';
  statsDiv.innerHTML = `
    <div class="stat-item">
      <span class="material-symbols-rounded">group</span>
      <div>
        <div class="stat-value">${personnelData.length}</div>
        <div class="stat-label">Record totali</div>
      </div>
    </div>
    <div class="stat-item">
      <span class="material-symbols-rounded">visibility</span>
      <div>
        <div class="stat-value">${pageData.length}</div>
        <div class="stat-label">Visualizzati</div>
      </div>
    </div>
    <div class="stat-item">
      <span class="material-symbols-rounded">schedule</span>
      <div>
        <div class="stat-value" id="last-update-personnel">${new Date().toLocaleTimeString('it-IT')}</div>
        <div class="stat-label">Ultimo aggiornamento</div>
      </div>
    </div>
  `;
  container.appendChild(statsDiv);

  // 3) Tabella dati
  if (personnelData.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--gray-500);">
        <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1;">inbox</span>
        <div style="margin-top: 16px; font-weight: 600;">Nessun dato disponibile</div>
        <div style="margin-top: 8px; color: #94a3b8;">Usa il pulsante "Aggiungi" per inserire il primo record</div>
      </div>
    `;
    container.appendChild(emptyDiv);
  } else {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-responsive';

    const table = document.createElement('table');
    table.className = 'data-table';

    // Intestazione
    const thead = document.createElement('thead');
    let headerHTML = '<tr>';

    // Colonne da mostrare (escludi colonne tecniche)
    const columnsToShow = (personnelColumns || []).filter(col =>
      !['id', 'created_at', 'updated_at', 'hash_csv', 'uid'].includes(col)
    );

    columnsToShow.forEach(column => {
      const displayName = formatColumnName(column);
      headerHTML += `<th>${displayName}</th>`;
    });

    headerHTML += '<th>Azioni</th></tr>';
    thead.innerHTML = headerHTML;
    table.appendChild(thead);

    // Corpo
    const tbody = document.createElement('tbody');
    tbody.id = 'personnel-table-body';

    // Primary key per la tabella corrente
    const primaryKey = getPrimaryKeyName(currentPersonnelTable);

    pageData.forEach((record) => {
      const row = document.createElement('tr');

      // Celle dati
      columnsToShow.forEach(column => {
        const cell = document.createElement('td');
        const value = record[column];
        cell.innerHTML = formatCellValue(value, column);
        row.appendChild(cell);
      });

      // Cella azioni
      const actionsCell = document.createElement('td');
      actionsCell.className = 'table-actions-cell';

      const keyValue = record?.[primaryKey];
      const keyAttr = (keyValue === undefined || keyValue === null)
        ? ''
        : String(keyValue).replace(/'/g, "\\'"); // evita rotture nell’HTML

      if (keyAttr === '') {
        console.warn(`Chiave primaria "${primaryKey}" assente nel record`, { table: currentPersonnelTable, record });
        actionsCell.innerHTML = `
          <button class="btn-table-action edit" title="Chiave mancante" disabled>
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button class="btn-table-action view" title="Chiave mancante" disabled>
            <span class="material-symbols-rounded">visibility</span>
          </button>
          <button class="btn-table-action delete" title="Chiave mancante" disabled>
            <span class="material-symbols-rounded">delete</span>
          </button>
        `;
      } else {
        actionsCell.innerHTML = `
          <button class="btn-table-action edit" title="Modifica"
            onclick="openEditModal('${currentPersonnelTable}', '${keyAttr}')">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button class="btn-table-action view" title="Visualizza"
            onclick="openEditModal('${currentPersonnelTable}', '${keyAttr}')">
            <span class="material-symbols-rounded">visibility</span>
          </button>
          <button class="btn-table-action delete" title="Elimina"
            onclick="deleteRecord('${currentPersonnelTable}', '${keyAttr}')">
            <span class="material-symbols-rounded">delete</span>
          </button>
        `;
      }

      row.appendChild(actionsCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
  }

  // 4) Paginazione
  if (personnelData.length > 0) {
    const totalPages = Math.ceil(personnelData.length / recordsPerPage);

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    paginationDiv.innerHTML = `
      <button class="btn btn-secondary" id="btn-prev-personnel" ${currentPage === 1 ? 'disabled' : ''}>
        <span class="material-symbols-rounded">chevron_left</span>
        Precedente
      </button>
      <span id="page-info-personnel" class="page-info">
        Pagina ${currentPage} di ${totalPages}
      </span>
      <button class="btn btn-secondary" id="btn-next-personnel" ${(currentPage === totalPages || totalPages === 0) ? 'disabled' : ''}>
        Successivo
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
    `;
    container.appendChild(paginationDiv);
  }

  // 5) Event listeners (ricerca, paginazione, ecc.)
  setupPersonnelEventListeners();
}

// Formatta nome colonna
function formatColumnName(columnName) {
    return columnName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Formatta valore cella
// Formatta valore cella per visualizzazione
function formatCellValue(value, columnName) {
    if (value === null || value === undefined || value === '') {
        return '<span class="null-value">-</span>';
    }
    
    // Boolean values
    if (typeof value === 'boolean') {
        return value ? 
            '<span class="badge badge-success">SI</span>' : 
            '<span class="badge badge-danger">NO</span>';
    }
    
    // Object/Array values
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `[${value.length} elementi]`;
        }
        try {
            return JSON.stringify(value).substring(0, 30) + '...';
        } catch {
            return '[oggetto]';
        }
    }
    
    const strValue = String(value);
    
    // Special formatting
    if (columnName.toLowerCase().includes('email')) {
        return `<a href="mailto:${strValue}" class="email-link">${strValue}</a>`;
    }
    
    if (columnName.toLowerCase().includes('telefono') || columnName.toLowerCase().includes('phone')) {
        return `<a href="tel:${strValue}" class="phone-link">${strValue}</a>`;
    }
    
    if (columnName.toLowerCase().includes('data') || columnName.toLowerCase().includes('date')) {
        try {
            // Try to parse date
            const date = new Date(strValue);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('it-IT');
            }
        } catch (e) {
            // Not a valid date
        }
    }
    
    // Truncate long text
    if (strValue.length > 50) {
        return strValue.substring(0, 50) + '...';
    }
    
    return strValue;
}

// Setup event listeners per personale
// Setup event listeners per personale
function setupPersonnelEventListeners() {
    console.log('🔧 Setup event listeners personale');
    
    // Pulsante Aggiungi
    const addBtn = document.getElementById('btn-add-personnel');
    if (addBtn) {
        addBtn.addEventListener('click', showAddPersonnelModal);
    }
    
    // Pulsante Aggiungi Primo Record (stato vuoto)
    const addFirstBtn = document.getElementById('btn-add-first-record');
    if (addFirstBtn) {
        addFirstBtn.addEventListener('click', showAddPersonnelModal);
    }
    
    // Pulsante Download CSV
    const downloadBtn = document.getElementById('btn-download-csv-personnel');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => downloadPersonnelCSV(currentPersonnelTable));
    }
    
    // Pulsante Refresh
    const refreshBtn = document.getElementById('btn-refresh-personnel');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPersonnelData);
    }
    
    // Pulsanti Paginazione
    const prevBtn = document.getElementById('btn-prev-personnel');
    const nextBtn = document.getElementById('btn-next-personnel');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', prevPersonnelPage);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', nextPersonnelPage);
    }
    
    // Ricerca
    const searchInput = document.getElementById('personnel-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterPersonnelData, 300));
    }
}

// Navigazione pagine

// ============================================
// MODAL E FUNZIONALITÀ CRUD - IMPLEMENTAZIONE COMPLETA
// ============================================

// 1. VARIABILI GLOBALI PER LO STATO
let currentEditId = null;
let currentEditTable = null;
let currentEditKeyField = 'id';

// 2. CONFIGURAZIONI PER OGNI TABELLA
const TABLE_CONFIGS = {
'tecnici': {
    displayName: 'Tecnici',
    icon: 'engineering',
    primaryKey: 'id',
    fields: [
        { 
            name: 'nome_completo', 
            label: 'Nome Completo *', 
            type: 'text', 
            required: true,
            placeholder: 'Mario Rossi'
        },
        { 
            name: 'pin', 
            label: 'PIN (4 cifre) *', 
            type: 'text', 
            required: true,
            pattern: '\\d{4}',
            placeholder: '1234',
            maxlength: 4
        },
        { 
            name: 'ruolo', 
            label: 'Ruolo', 
            type: 'text',
            placeholder: 'tecnico, capo-tecnico, etc.'
        },
        { 
            name: 'cod_supervisore', 
            label: 'Codice Supervisore', 
            type: 'number',
            placeholder: '1001'
        },
        { 
            name: 'Telefono', 
            label: 'Telefono', 
            type: 'tel',
            placeholder: '3331234567'
        },
       { 
            name: 'Mail', 
            label: 'Email *', 
            type: 'email', 
            required: true,  // <-- AGGIUNTO required
            placeholder: 'mario.rossi@azienda.it'
        },
        { 
            name: 'attivo', 
            label: 'Stato Account', 
            type: 'boolean-select',  // Tipo personalizzato per booleano
            options: [
                { value: true, label: '✅ Attivo', icon: 'check_circle', color: '#10b981' },
                { value: false, label: '❌ Non attivo', icon: 'cancel', color: '#ef4444' }
            ]
        }
    ],
    orderBy: 'nome_completo'
},
    
    'manutentori': {
        displayName: 'Manutentori',
        icon: 'construction',
        primaryKey: 'Giro',
        fields: [
            { 
                name: 'Giro', 
                label: 'Giro *', 
                type: 'number', 
                required: true,
                placeholder: '1'
            },
            { 
                name: 'Manutentore', 
                label: 'Nome Manutentore *', 
                type: 'text', 
                required: true,
                placeholder: 'Luigi Bianchi'
            },
            { 
                name: 'Supervisore', 
                label: 'Codice Supervisore', 
                type: 'number',
                placeholder: '1001'
            },
            { 
                name: 'Telefono', 
                label: 'Telefono', 
                type: 'tel',
                placeholder: '3331234567'
            },
            { 
                name: 'Mail', 
                label: 'Email', 
                type: 'email',
                placeholder: 'luigi.bianchi@azienda.it'
            },
            { 
                name: 'Titolo', 
                label: 'Titolo', 
                type: 'text',
                placeholder: 'Responsabile manutenzione'
            }
        ],
        orderBy: 'Giro'
    },
    
    'supervisori': {
        displayName: 'Supervisori',
        icon: 'supervisor_account',
        primaryKey: 'Cod',
        fields: [
            { 
                name: 'Cod', 
                label: 'Codice *', 
                type: 'number', 
                required: true,
                placeholder: '1001'
            },
            { 
                name: 'Nome', 
                label: 'Nome *', 
                type: 'text', 
                required: true,
                placeholder: 'Giuseppe Verdi'
            },
            { 
                name: 'Telefono', 
                label: 'Telefono', 
                type: 'tel',
                placeholder: '3331234567'
            },
            { 
                name: 'Mail', 
                label: 'Email', 
                type: 'email',
                placeholder: 'giuseppe.verdi@azienda.it'
            },
            { 
                name: 'Titolo', 
                label: 'Titolo', 
                type: 'text',
                placeholder: 'Supervisore regionale'
            }
        ],
        orderBy: 'Cod'
    },
    
    'venditori': {
        displayName: 'Venditori',
        icon: 'storefront',
        primaryKey: 'Cod',
        fields: [
            { 
                name: 'Cod', 
                label: 'Codice *', 
                type: 'number', 
                required: true,
                placeholder: '2001'
            },
            { 
                name: 'Nome', 
                label: 'Nome *', 
                type: 'text', 
                required: true,
                placeholder: 'Anna Neri'
            },
            { 
                name: 'Telefono', 
                label: 'Telefono', 
                type: 'tel',
                placeholder: '3331234567'
            },
            { 
                name: 'Mail', 
                label: 'Email', 
                type: 'email',
                placeholder: 'anna.neri@azienda.it'
            },
            { 
                name: 'Titolo', 
                label: 'Titolo', 
                type: 'text',
                placeholder: 'Responsabile vendite'
            }
        ],
        orderBy: 'Cod'
    }
};

// 3. APRI MODAL PER AGGIUNTA RECORD
// 3. APRI MODAL PER AGGIUNTA RECORD (VERSIONE CORRETTA CON DEFAULT NON ATTIVO)
function openAddModal(tableName) {
    console.log(`➕ Apertura modal aggiunta per: ${tableName}`);
    
    currentEditTable = tableName;
    currentEditId = null;
    currentEditKeyField = TABLE_CONFIGS[tableName]?.primaryKey || 'id';
    
    const config = TABLE_CONFIGS[tableName] || {
        displayName: tableName,
        icon: 'add',
        fields: []
    };
    
    // Costruisci i campi del form
    let formFieldsHTML = '';
    config.fields.forEach(field => {
        // Gestione speciale per campo booleano in aggiunta
        if (field.type === 'boolean-select') {
            formFieldsHTML += `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div style="display: flex; gap: 20px; margin-top: 8px; padding: 8px 0;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; padding: 10px; border: 2px solid #e2e8f0; border-radius: 12px; transition: all 0.2s;">
                            <input type="radio" name="${field.name}" value="true">
                            <span class="material-symbols-rounded" style="color: #10b981;">check_circle</span>
                            <div>
                                <div style="font-weight: 600;">✅ Attivo</div>
                                <div style="font-size: 12px; color: #64748b;">Account abilitato all'accesso</div>
                            </div>
                        </label>
                        
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; padding: 10px; border: 2px solid #ef4444; border-radius: 12px; background: #fef2f2;">
                            <input type="radio" name="${field.name}" value="false" checked>
                            <span class="material-symbols-rounded" style="color: #ef4444;">cancel</span>
                            <div>
                                <div style="font-weight: 600;">❌ Non attivo</div>
                                <div style="font-size: 12px; color: #64748b;">Account in attesa di approvazione</div>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        } else {
            // Campi normali (text, number, email, ecc.)
            formFieldsHTML += `
                <div class="form-group">
                    <label for="field-${field.name}">
                        ${field.label}
                        ${field.required ? '<span class="required-star">*</span>' : ''}
                    </label>
                    <input 
                        type="${field.type || 'text'}"
                        id="field-${field.name}"
                        name="${field.name}"
                        ${field.required ? 'required' : ''}
                        ${field.pattern ? `pattern="${field.pattern}"` : ''}
                        ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}
                        ${field.min ? `min="${field.min}"` : ''}
                        ${field.max ? `max="${field.max}"` : ''}
                        ${field.step ? `step="${field.step}"` : ''}
                        placeholder="${field.placeholder || field.label}"
                        class="form-input"
                    >
                    ${field.pattern ? `<small class="field-hint">Formato: ${field.pattern}</small>` : ''}
                </div>
            `;
        }
    });
    
    // Modal HTML completo
    const modalHTML = `
        <div class="crud-modal-overlay" id="crud-modal">
            <div class="crud-modal">
                <!-- HEADER -->
                <div class="crud-modal-header">
                    <div class="crud-modal-title">
                        <span class="material-symbols-rounded modal-icon">${config.icon}</span>
                        <div>
                            <h3 class="modal-title-text">Nuovo ${config.displayName}</h3>
                            <p class="modal-subtitle">Compila i campi per aggiungere un nuovo record</p>
                        </div>
                    </div>
                    <button class="crud-modal-close" onclick="closeCrudModal()" aria-label="Chiudi">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                
                <!-- BODY -->
                <div class="crud-modal-body">
                    <form id="crud-form" onsubmit="handleCrudSubmit(event)">
                        <div class="form-grid">
                            ${formFieldsHTML}
                        </div>
                        
                        <!-- FOOTER -->
                        <div class="crud-modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeCrudModal()">
                                Annulla
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <span class="material-symbols-rounded">save</span>
                                Salva Record
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Rimuovi eventuali modal esistenti
    const existingModal = document.getElementById('crud-modal');
    if (existingModal) existingModal.remove();
    
    // Aggiungi nuovo modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Focus sul primo campo
    setTimeout(() => {
        const firstInput = document.querySelector('#crud-form .form-input');
        if (firstInput) firstInput.focus();
    }, 100);
}

// 4. CHIUDI MODAL
function closeCrudModal() {
    const modal = document.getElementById('crud-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// 5. GESTIONE INVIO FORM
async function handleCrudSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const recordData = {};
    
    // Raccogli dati dal form
    // Dopo aver raccolto i dati, converti i valori booleani
formData.forEach((value, key) => {
    // Se il campo è 'attivo', converti in booleano
    if (key === 'attivo') {
        recordData[key] = value === 'true';
    } else if (value.trim() !== '') {
        // Converte numeri se necessario
        if (!isNaN(value) && value.trim() !== '' && key !== 'pin') {
            recordData[key] = parseInt(value, 10);
        } else {
            recordData[key] = value;
        }
    }
});
    
    console.log('📝 Dati del form:', recordData);
    console.log('📊 Tabella:', currentEditTable, 'ID:', currentEditId);
    
    // Validazione
    if (Object.keys(recordData).length === 0) {
        showNotification('Compila almeno un campo', 'warning');
        return false;
    }
    
    const config = TABLE_CONFIGS[currentEditTable];
    if (config) {
        // Controlla campi obbligatori
        const missingRequired = config.fields
            .filter(f => f.required)
            .filter(f => !recordData[f.name]);
        
        if (missingRequired.length > 0) {
            const fieldNames = missingRequired.map(f => f.label.replace('*', '')).join(', ');
            showNotification(`Compila i campi obbligatori: ${fieldNames}`, 'error');
            return false;
        }
    }
    
    // Mostra loading
    showLoading(
        currentEditId ? 'Aggiornamento' : 'Salvataggio',
        currentEditId ? 'Aggiorno record...' : 'Salvo nuovo record...'
    );
    
    try {
        const client = getSupabaseClient();
        let result;
        
        if (currentEditId) {
            // MODIFICA RECORD ESISTENTE
            console.log(`🔄 Aggiornamento record ${currentEditId} in ${currentEditTable}`);
            
            const { error } = await client
                .from(currentEditTable)
                .update(recordData)
                .eq(currentEditKeyField, currentEditId);
            
            if (error) throw error;
            
            result = { action: 'update', id: currentEditId };
            
        } else {
            // INSERISCI NUOVO RECORD
            console.log(`📥 Inserimento nuovo record in ${currentEditTable}`);
            
            const { data, error } = await client
                .from(currentEditTable)
                .insert(recordData)
                .select();
            
            if (error) throw error;
            
            result = { action: 'insert', data: data?.[0] };
        }
        
        // Successo!
        showNotification(
            currentEditId ? '✅ Record aggiornato!' : '✅ Record aggiunto!',
            'success'
        );
        
        // Chiudi modal
        closeCrudModal();
        
        // Ricarica i dati della tabella corrente
        setTimeout(() => {
            if (currentPersonnelTable === currentEditTable) {
                loadCurrentTableData();
            }
        }, 500);
        
        return true;
        
    } catch (error) {
        console.error('❌ Errore operazione CRUD:', error);
        
        // Messaggi di errore specifici
        let errorMessage = 'Errore durante l\'operazione';
        
        if (error.code === '23505') {
            errorMessage = 'Record già esistente (chiave duplicata)';
        } else if (error.code === '23503') {
            errorMessage = 'Riferimento a record inesistente';
        } else if (error.code === '23502') {
            errorMessage = 'Campo obbligatorio mancante';
        } else if (error.message.includes('violates not-null constraint')) {
            errorMessage = 'Alcuni campi obbligatori sono mancanti';
        } else {
            errorMessage = error.message || 'Errore sconosciuto';
        }
        
        showNotification(`❌ ${errorMessage}`, 'error');
        return false;
        
    } finally {
        hideLoading();
    }
}

// 6. FUNZIONE PER APRIRE MODIFICA
async function openEditModal(tableName, recordId) {
    console.log(`✏️ Apertura modifica: ${tableName} - ID: ${recordId}`);
    
    if (!recordId || recordId === 'undefined') {
        showNotification('ID record non valido', 'error');
        return;
    }
    
    showLoading('Caricamento', 'Recupero dati del record...');
    
    try {
        const client = getSupabaseClient();
        const config = TABLE_CONFIGS[tableName];
        
        if (!config) {
            throw new Error(`Configurazione non trovata per ${tableName}`);
        }
        
        // MAPPA DELLE CHIAVI PRIMARIE (stessa della delete)
        const primaryKeys = {
            'tecnici': 'id',
            'manutentori': 'Giro',
            'supervisori': 'Cod',
            'venditori': 'Cod',
            'veicoli': 'id'
        };
        
        const keyField = primaryKeys[tableName] || 'id';
        
        // Converti in numero se necessario
        let recordValue = recordId;
        if (typeof recordId === 'string' && !isNaN(recordId) && keyField !== 'targa') {
            recordValue = parseInt(recordId, 10);
        }
        
        // Recupera il record esistente
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .eq(keyField, recordValue)
            .single();
        
        if (error) throw error;
        
        if (!data) {
            throw new Error('Record non trovato');
        }
        
        console.log('📋 Record trovato:', data);
        
        // Nascondi loading e apri modal precompilato
        hideLoading();
        openEditModalWithData(tableName, data);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore caricamento record:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// 7. APRI MODAL PRECOMPILATO PER MODIFICA
// 7. APRI MODAL PRECOMPILATO PER MODIFICA (VERSIONE CORRETTA)
function openEditModalWithData(tableName, recordData) {
    const config = TABLE_CONFIGS[tableName];
    if (!config) return;
    
    // ✅ IMPORTANTE: Salva il tableName nelle variabili globali
    currentEditTable = tableName;
    currentEditId = recordData[config.primaryKey || 'id'];
    currentEditKeyField = config.primaryKey || 'id';
    
    console.log(`✏️ Apertura modifica per ${tableName}, ID: ${currentEditId}`);
    
    // Costruisci form precompilato
    let formFieldsHTML = '';
   // All'interno di openEditModalWithData(), sostituisci il loop dei campi
config.fields.forEach(field => {
    const value = recordData[field.name];
    const displayValue = value !== null && value !== undefined ? value : '';
    
    // Gestione speciale per campo booleano
    if (field.type === 'boolean-select') {
        const isActive = value === true || value === 'true' || value === 1 || value === '1';
        
        formFieldsHTML += `
            <div class="form-group">
                <label>${field.label}</label>
                <div style="display: flex; gap: 20px; margin-top: 8px; padding: 8px 0;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; padding: 10px; border: 2px solid ${isActive ? '#10b981' : '#e2e8f0'}; border-radius: 12px; background: ${isActive ? '#f0fdf4' : 'white'}; transition: all 0.2s;">
                        <input type="radio" name="${field.name}" value="true" ${isActive ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span class="material-symbols-rounded" style="color: #10b981;">check_circle</span>
                        <div>
                            <div style="font-weight: 600;">✅ Attivo</div>
                            <div style="font-size: 12px; color: #64748b;">Account abilitato all'accesso</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; padding: 10px; border: 2px solid ${!isActive && value !== undefined ? '#ef4444' : '#e2e8f0'}; border-radius: 12px; background: ${!isActive && value !== undefined ? '#fef2f2' : 'white'}; transition: all 0.2s;">
                        <input type="radio" name="${field.name}" value="false" ${!isActive && value !== undefined ? 'checked' : ''} ${value === undefined ? 'checked' : ''}>
                        <span class="material-symbols-rounded" style="color: #ef4444;">cancel</span>
                        <div>
                            <div style="font-weight: 600;">❌ Non attivo</div>
                            <div style="font-size: 12px; color: #64748b;">Account in attesa di approvazione</div>
                        </div>
                    </label>
                </div>
            </div>
        `;
    } else {
        // Campi normali (text, number, email, ecc.)
        formFieldsHTML += `
            <div class="form-group">
                <label for="field-${field.name}">
                    ${field.label}
                    ${field.required ? '<span class="required-star">*</span>' : ''}
                </label>
                <input 
                    type="${field.type || 'text'}"
                    id="field-${field.name}"
                    name="${field.name}"
                    value="${displayValue}"
                    ${field.required ? 'required' : ''}
                    ${field.pattern ? `pattern="${field.pattern}"` : ''}
                    ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}
                    placeholder="${field.placeholder || field.label}"
                    class="form-input"
                >
            </div>
        `;
    }
});
    
    // Modal HTML per modifica
    const modalHTML = `
        <div class="crud-modal-overlay" id="crud-modal">
            <div class="crud-modal">
                <!-- HEADER -->
                <div class="crud-modal-header">
                    <div class="crud-modal-title">
                        <span class="material-symbols-rounded modal-icon">edit</span>
                        <div>
                            <h3 class="modal-title-text">Modifica ${config.displayName}</h3>
                            <p class="modal-subtitle">Modifica i campi del record</p>
                        </div>
                    </div>
                    <button class="crud-modal-close" onclick="closeCrudModal()" aria-label="Chiudi">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                
                <!-- BODY -->
                <div class="crud-modal-body">
                    <form id="crud-form" onsubmit="handleCrudSubmit(event)">
                        <div class="form-grid">
                            ${formFieldsHTML}
                        </div>
                        
                        <!-- FOOTER -->
                        <div class="crud-modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeCrudModal()">
                                Annulla
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <span class="material-symbols-rounded">save</span>
                                Aggiorna Record
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Rimuovi eventuali modal esistenti
    const existingModal = document.getElementById('crud-modal');
    if (existingModal) existingModal.remove();
    
    // Aggiungi nuovo modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ELIMINAZIONE CON CONFERMA - VERSIONE DEFINITIVA CON DEBUG COMPLETO
// ELIMINAZIONE CON CONFERMA - VERSIONE FINALE CON APPROCCIO RADICALE
async function deleteRecord(tableName, recordId, recordName = 'questo record') {
    console.log('%c========== DELETE RECORD INIZIO ==========', 'background: #ff0000; color: white; font-size: 12px;');
    console.log('📋 Parametri:', { tableName, recordId, recordName });
    
    // Verifica configurazione
    const config = TABLE_CONFIGS[tableName];
    if (!config) {
        showNotification('Tabella non configurata', 'error');
        return;
    }
    
    // Dialog conferma
    const confirmed = await showConfirmDialog(
        'Conferma eliminazione',
        `Sei sicuro di voler eliminare ${recordName}?`,
        `Questa azione non può essere annullata.`,
        'delete'
    );
    
    if (!confirmed) return;
    
    showLoading('Eliminazione', 'Elimino record...');
    
    try {
        const client = getSupabaseClient();
        
        // FORZA l'uso della chiave primaria corretta
        const keyField = 'id';  // <-- FORZATO a id
        let recordValue = recordId;
        
        console.log(`🔑 Chiave: ${keyField} = ${recordValue}`);
        
        // 1. VERIFICA RECORD PRIMA
        const { data: beforeData, error: beforeError } = await client
            .from(tableName)
            .select('*')
            .eq(keyField, recordValue);
        
        console.log('📊 Record prima della DELETE:', beforeData);
        
        if (!beforeData || beforeData.length === 0) {
            showNotification('Record non trovato', 'warning');
            hideLoading();
            return;
        }
        
        // 2. PROVA DIVERSI APPROCCI
        
        // Approccio 1: DELETE con filtro semplice
        console.log('🔄 Approccio 1: DELETE semplice');
        const { error: error1 } = await client
            .from(tableName)
            .delete()
            .eq(keyField, recordValue);
        
        if (error1) console.error('❌ Approccio 1 fallito:', error1);
        
        // Attendi un po'
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 3. VERIFICA RECORD DOPO
        const { data: afterData, error: afterError } = await client
            .from(tableName)
            .select('*')
            .eq(keyField, recordValue);
        
        console.log('📊 Record dopo la DELETE:', afterData);
        
        if (!afterData || afterData.length === 0) {
            console.log('✅✅✅ RECORD ELIMINATO!');
            showNotification(`✅ ${recordName} eliminato!`, 'success');
        } else {
            console.log('❌❌❌ RECORD ANCORA PRESENTE');
            showNotification(`❌ Eliminazione fallita`, 'error');
            
            // TENTATIVO DISPERATO: usa raw SQL
            console.log('🔄 Tentativo con raw SQL...');
            const { error: sqlError } = await client.rpc('exec_sql', {
                query: `DELETE FROM ${tableName} WHERE id = ${recordValue} RETURNING *;`
            });
            
            if (sqlError) {
                console.error('❌ Anche raw SQL fallito:', sqlError);
            } else {
                console.log('✅ Raw SQL eseguito?');
            }
        }
        
        // Ricarica dati
        setTimeout(() => {
            if (currentPersonnelTable === tableName) {
                loadCurrentTableData();
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ ERRORE:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    } finally {
        hideLoading();
        console.log('========== DELETE RECORD FINE ==========');
    }
}




// 9. DIALOG DI CONFERMA
function showConfirmDialog(title, message, detail, icon = 'warning') {
    return new Promise((resolve) => {
        const dialogId = 'confirm-dialog-' + Date.now();
        
        const dialogHTML = `
            <div class="confirm-dialog-overlay" id="${dialogId}">
                <div class="confirm-dialog">
                    <div class="confirm-dialog-icon">
                        <span class="material-symbols-rounded">${icon}</span>
                    </div>
                    <div class="confirm-dialog-content">
                        <h3 class="confirm-dialog-title">${title}</h3>
                        <p class="confirm-dialog-message">${message}</p>
                        ${detail ? `<p class="confirm-dialog-detail">${detail}</p>` : ''}
                    </div>
                    <div class="confirm-dialog-actions">
                        <button class="btn btn-secondary" onclick="window.handleConfirmResult('${dialogId}', false)">
                            Annulla
                        </button>
                        <button class="btn btn-danger" onclick="window.handleConfirmResult('${dialogId}', true)">
                            <span class="material-symbols-rounded">delete</span>
                            Elimina
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi dialog al DOM
        document.body.insertAdjacentHTML('beforeend', dialogHTML);
        
        // Esponi la funzione di gestione globalmente
        window.handleConfirmResult = function(dialogId, result) {
            const dialog = document.getElementById(dialogId);
            if (dialog) dialog.remove();
            delete window.handleConfirmResult;
            resolve(result);
        };
    });
}

async function loadTecniciData() {
    try {
        const client = getSupabaseClient();
        const { data } = await client
            .from('tecnici')
            .select('id, nome_completo, pin, ruolo, cod_supervisore, Telefono, Mail, attivo')  // <-- AGGIUNTO attivo
            .order('nome_completo', { ascending: true });
        
        console.log('📊 Tecnici caricati con stato attivo:', data?.map(t => ({ nome: t.nome_completo, attivo: t.attivo })));
        
        window.tecniciData = data || [];
        renderTecniciTable();
    } catch (error) {
        console.error('Errore caricamento tecnici:', error);
    }
}

// FUNZIONE HELPER PER CARICARE LA TABELLA CORRENTE
function loadCurrentTableData() {
    if (!currentPersonnelTable) return;
    
    // Controlla quale funzione di caricamento chiamare
    switch(currentPersonnelTable) {
        case 'tecnici':
            if (typeof loadTecniciData === 'function') loadTecniciData();
            break;
        case 'manutentori':
            if (typeof loadManutentoriData === 'function') loadManutentoriData();
            break;
        case 'supervisori':
            if (typeof loadSupervisoriData === 'function') loadSupervisoriData();
            break;
        case 'venditori':
            if (typeof loadVenditoriData === 'function') loadVenditoriData();
            break;
        default:
            console.warn(`Nessuna funzione di caricamento per: ${currentPersonnelTable}`);
    }
}

// FUNZIONI DI CARICAMENTO PER OGNI TABELLA
async function loadManutentoriData() {
    try {
        const client = getSupabaseClient();
        const { data } = await client
            .from('manutentori')
            .select('id, Titolo, Giro, Manutentore, Mail, Telefono, Supervisore')
            .order('Giro', { ascending: true });
        
        console.log('📊 DATI MANUTENTORI CARICATI:');
        data?.forEach(m => {
            console.log(`   ID: ${m.id}, Giro: ${m.Giro}, Nome: ${m.Manutentore}`);
        });
        
        window.manutentoriData = data || [];
        renderManutentoriTable();
    } catch (error) {
        console.error('Errore caricamento manutentori:', error);
    }
}

async function loadSupervisoriData() {
    try {
        const client = getSupabaseClient();
        const { data } = await client
            .from('supervisori')
            .select('id, Titolo, Cod, Nome, Mail, Telefono')  // AGGIUNTO id
            .order('Cod', { ascending: true });
        
        window.supervisoriData = data || [];
        renderSupervisoriTable();
    } catch (error) {
        console.error('Errore caricamento supervisori:', error);
    }
}

async function loadVenditoriData() {
    try {
        const client = getSupabaseClient();
        const { data } = await client
            .from('venditori')
            .select('id, Titolo, Cod, Nome, Mail, Telefono')  // AGGIUNTO id
            .order('Cod', { ascending: true });
        
        window.venditoriData = data || [];
        renderVenditoriTable();
    } catch (error) {
        console.error('Errore caricamento venditori:', error);
    }
}

// Navigazione pagine
function prevPersonnelPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPersonnelTable();
    }
}

function nextPersonnelPage() {
    const totalPages = Math.ceil(personnelData.length / recordsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderPersonnelTable();
    }
}

// Filtra dati (versione semplice)
function filterPersonnelData() {
    const searchInput = document.getElementById('personnel-search');
    if (!searchInput || !searchInput.value.trim()) {
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    console.log(`🔍 Ricerca: ${searchTerm}`);
    
    // Implementazione semplice: mostra messaggio
    showNotification(`Funzionalità ricerca in sviluppo per "${searchTerm}"`, 'info');
}

// Aggiorna statistiche
// Carica dati personale - VERSIONE ULTRA-ROBUSTA
async function loadPersonnelData() {
    console.log(`📥 [LOAD] Caricamento tabella: ${currentPersonnelTable}`);
    
    if (!hasDbConfig()) {
        showNotification('Configura prima il database', 'warning');
        return;
    }
    
    showLoading('Caricamento dati', `Tabella: ${currentPersonnelTable}`);
    
    try {
        const client = getSupabaseClient();
        
        // 1. DETERMINA LA CHIAVE DI ORDINAMENTO CORRETTA
        let orderField = 'id'; // default
        
        // Mappa delle chiavi primarie per ogni tabella
        const primaryKeys = {
            'tecnici': 'nome_completo', // oppure 'id' se esiste
            'manutentori': 'Giro',
            'supervisori': 'Cod', 
            'venditori': 'Cod',
            'veicoli': 'targa'
        };
        
        // Usa la chiave corretta per la tabella corrente
        orderField = primaryKeys[currentPersonnelTable] || 'id';
        
        console.log(`🔑 Campo ordinamento per ${currentPersonnelTable}: ${orderField}`);
        
        // 2. QUERY CON ORDINAMENTO DINAMICO
        let query = client
            .from(currentPersonnelTable)
            .select('*')
            .limit(100); // Limita per performance
        
        // Prova a ordinare, ma gestisci errori
        try {
            query = query.order(orderField, { ascending: true });
        } catch (orderError) {
            console.warn(`⚠️ Errore ordinamento per ${orderField}:`, orderError.message);
            // Continua senza ordinamento
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error(`❌ Errore query ${currentPersonnelTable}:`, error);
            
            // Se l'errore è "column does not exist", prova query semplice
            if (error.code === '42703' || error.message.includes('does not exist')) {
                console.log(`🔄 Retry senza ordinamento...`);
                const { data: data2, error: error2 } = await client
                    .from(currentPersonnelTable)
                    .select('*')
                    .limit(100);
                
                if (error2) throw error2;
                personnelData = data2 || [];
            } else {
                throw error;
            }
        } else {
            personnelData = data || [];
        }
        
        console.log(`✅ Dati caricati: ${personnelData.length} record`);
        
        // 3. DETERMINA COLONNE DA MOSTRARE
        if (personnelData.length > 0) {
            personnelColumns = Object.keys(personnelData[0]);
            
            // Escludi colonne tecniche/nascoste
            personnelColumns = personnelColumns.filter(col => 
                !['id', 'created_at', 'updated_at', 'uid', 'hash_csv'].includes(col)
            );
        } else {
            // Fallback per tabelle vuote
            switch(currentPersonnelTable) {
                case 'tecnici':
                    personnelColumns = ['nome_completo', 'pin', 'ruolo', 'cod_supervisore', 'telefono', 'email'];
                    break;
                case 'manutentori':
                    personnelColumns = ['Giro', 'Manutentore', 'Supervisore', 'Mail', 'Telefono'];
                    break;
                case 'supervisori':
                case 'venditori':
                    personnelColumns = ['Cod', 'Nome', 'Mail', 'Telefono', 'Titolo'];
                    break;
                default:
                    personnelColumns = [];
            }
        }
        
        console.log(`📊 Colonne da mostrare:`, personnelColumns);
        
        // 4. RENDERIZZA LA TABELLA
        renderPersonnelTable();
        
        showNotification(`✅ ${personnelData.length} record da ${currentPersonnelTable}`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento personale:', error);
        showNotification(`Errore: ${error.message}`, 'error');
        
        // Mostra stato di errore
        personnelData = [];
        personnelColumns = ['Errore', 'Messaggio'];
        renderPersonnelTable();
    } finally {
        hideLoading();
    }
}

// Modal per aggiungere record
// Modal per aggiungere record (versione base)
function showAddPersonnelModal() {
    const modalHTML = `
        <div class="modal" id="modal-add-personnel" style="display: flex; align-items: center; justify-content: center;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded">add</span>
                        Nuovo Record - ${currentPersonnelTable}
                    </h3>
                    <button class="btn-icon-small" onclick="closeModal('modal-add-personnel')"
                        style="background: none; border: none; cursor: pointer; color: #64748b;">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div style="text-align: center; padding: 20px;">
                        <span class="material-symbols-rounded" style="font-size: 48px; color: #3b82f6; margin-bottom: 16px;">
                            construction
                        </span>
                        <h4 style="color: #475569; margin-bottom: 8px;">Funzionalità in sviluppo</h4>
                        <p style="color: #64748b; margin-bottom: 24px;">
                            Il modulo per aggiungere nuovi record a <strong>${currentPersonnelTable}</strong>
                            è attualmente in fase di sviluppo.
                        </p>
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button class="btn btn-secondary" onclick="closeModal('modal-add-personnel')">
                                Chiudi
                            </button>
                            <button class="btn btn-primary" onclick="uploadCSVToPersonnelTable('${currentPersonnelTable}')">
                                <span class="material-symbols-rounded">upload</span>
                                Usa Upload CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Aggiungi modal al body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
}

// Chiudi modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => modal.remove(), 300);
    }
}

// Salva record personale





// Upload CSV per personale
async function uploadCSVToPersonnelTable(tableName) {
    showNotification(`Upload CSV per ${tableName} - Usa la sezione Sincronizzazione CSV`, 'info');
    
    // Vai al tab sync
    const syncTab = document.querySelector(`[data-tab="sync"]`);
    if (syncTab) {
        syncTab.click();
        
        // Imposta la tabella selezionata
        setTimeout(() => {
            const tableSelect = document.getElementById('table-select');
            if (tableSelect) {
                tableSelect.value = tableName;
                loadTableStructure();
            }
        }, 100);
    }
}

// Download CSV personale
async function downloadPersonnelCSV(tableName) {
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
    }
}

// ============================================
// GESTIONE MANUALE VEICOLI
// ============================================

// Inizializzazione gestione veicoli - VERSIONE CORRETTA
function initializeVehiclesManagement() {
    console.log('🚗 Inizializzazione gestione veicoli...');
     vehiclesManagerActive = true;
    // Setup buttons
    const vehiclesTab = document.getElementById('tab-vehicles');
    if (vehiclesTab && vehiclesTab.classList.contains('active')) {
        loadVehiclesData();
    }
    
    // Setup tab listener
    const vehiclesNavBtn = document.querySelector('[data-tab="vehicles"]');
    if (vehiclesNavBtn) {
        vehiclesNavBtn.addEventListener('click', function() {
            setTimeout(loadVehiclesData, 100);
        });
    }
}


// SOSTITUISCI la funzione loadVehiclesData() esistente con questa:
async function loadVehiclesData() {
    // Non fare nulla - il modulo veicoli è gestito da admin_veicoli_manager.js
    // Questa funzione è mantenuta solo per compatibilità
    console.log('🚗 Caricamento veicoli delegato a admin_veicoli_manager.js');
    return;
}

// Render tabella veicoli
function renderVehiclesTable(data) {
    const container = document.getElementById('vehicles-content');
    if (!container) return;
    
    let html = `
        <div class="vehicles-controls">
            <div class="search-box">
                <span class="material-symbols-rounded">search</span>
                <input type="text" id="vehicles-search" placeholder="Cerca targa, modello...">
            </div>
            <div class="vehicles-actions">
                <button class="btn btn-primary" id="btn-add-vehicle">
                    <span class="material-symbols-rounded">add</span>
                    Nuovo Veicolo
                </button>
                <button class="btn btn-secondary" id="btn-upload-csv-vehicles">
                    <span class="material-symbols-rounded">upload</span>
                    Upload CSV
                </button>
                <button class="btn btn-secondary" id="btn-download-csv-vehicles">
                    <span class="material-symbols-rounded">download</span>
                    Esporta CSV
                </button>
                <button class="btn btn-icon" id="btn-refresh-vehicles" title="Aggiorna">
                    <span class="material-symbols-rounded">refresh</span>
                </button>
            </div>
        </div>
        
        <div class="vehicles-stats">
            <div class="stat-item">
                <span class="material-symbols-rounded">directions_car</span>
                <div>
                    <div class="stat-value">${data.length}</div>
                    <div class="stat-label">Veicoli totali</div>
                </div>
            </div>
            <div class="stat-item">
                <span class="material-symbols-rounded">check_circle</span>
                <div>
                    <div class="stat-value">${data.filter(v => v.attivo).length}</div>
                    <div class="stat-label">Attivi</div>
                </div>
            </div>
            <div class="stat-item">
                <span class="material-symbols-rounded">schedule</span>
                <div>
                    <div class="stat-value" id="last-update-vehicles">${new Date().toLocaleTimeString('it-IT')}</div>
                    <div class="stat-label">Ultimo aggiornamento</div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Targa</th>
                        <th>Modello</th>
                        <th>Marca</th>
                        <th>Tecnico Assegnato</th>
                        <th>KM Iniziali</th>
                        <th>Data Assegnazione</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (data.length === 0) {
        html += `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--gray-500);">
                    <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1;">directions_car</span>
                    <div style="margin-top: 16px; font-weight: 600;">Nessun veicolo registrato</div>
                    <div style="margin-top: 8px; color: #94a3b8;">Usa il pulsante "Nuovo Veicolo" per inserire il primo veicolo</div>
                </td>
            </tr>
        `;
    } else {
        data.forEach(vehicle => {
            html += `
                <tr>
                    <td><strong>${vehicle.targa || '-'}</strong></td>
                    <td>${vehicle.modello || '-'}</td>
                    <td>${vehicle.marca || '-'}</td>
                    <td>${vehicle.tecnico_assegnato || '-'}</td>
                    <td>${vehicle.km_totali_iniziali?.toLocaleString() || '0'}</td>
                    <td>${vehicle.data_assegnazione ? new Date(vehicle.data_assegnazione).toLocaleDateString('it-IT') : '-'}</td>
                    <td>
                        ${vehicle.attivo ? 
                            '<span class="badge badge-success">Attivo</span>' : 
                            '<span class="badge badge-danger">Inattivo</span>'}
                    </td>
                    <td class="table-actions-cell">
                        <button class="btn-table-action edit" title="Modifica" onclick="editVehicle('${vehicle.id}')">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-table-action delete" title="Elimina" onclick="deleteVehicle('${vehicle.id}')">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    html += `</tbody></table></div>`;
    
    container.innerHTML = html;
    
    // Re-attach event listeners
    setupVehiclesEventListeners();
}

// Setup event listeners per veicoli
function setupVehiclesEventListeners() {
 document.getElementById('btn-add-vehicle')?.addEventListener('click', () => openAddModal('veicoli'));
    document.getElementById('btn-refresh-vehicles')?.addEventListener('click', loadVehiclesData);
    document.getElementById('btn-upload-csv-vehicles')?.addEventListener('click', () => uploadCSVToVehicles());
    document.getElementById('btn-download-csv-vehicles')?.addEventListener('click', () => downloadVehiclesCSV());
    
    const searchInput = document.getElementById('vehicles-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterVehiclesData, 300));
    }
}

// Modal per aggiungere veicolo


// Salva veicolo




// Filtra veicoli
function filterVehiclesData() {
    const searchInput = document.getElementById('vehicles-search');
    if (!searchInput || !searchInput.value.trim()) {
        return;
    }
    
    // Implementa filtro
    showNotification(`Filtro veicoli - Funzionalità in sviluppo`, 'info');
}

// Upload CSV veicoli
function uploadCSVToVehicles() {
    showNotification(`Upload CSV veicoli - Usa la sezione Sincronizzazione CSV`, 'info');
    
    // Vai al tab sync
    const syncTab = document.querySelector(`[data-tab="sync"]`);
    if (syncTab) {
        syncTab.click();
        
        // Imposta la tabella veicoli
        setTimeout(() => {
            const tableSelect = document.getElementById('table-select');
            if (tableSelect) {
                tableSelect.value = 'veicoli';
                loadTableStructure();
            }
        }, 100);
    }
}

// Download CSV veicoli
async function downloadVehiclesCSV() {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('veicoli')
            .select('*');
        
        if (error) throw error;
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, `veicoli_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showNotification(`Veicoli esportati con successo`, 'success');
        
    } catch (error) {
        showNotification(`Errore esportazione: ${error.message}`, 'error');
    }
}





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
// Modifica l'inizializzazione in admin_database.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FLOX ADMIN INIT ===');
    
    // Setup notifiche CSS
    setupNotifications();
    
    // Inizializza selettore tabelle (per upload)
    if (typeof initTableSelector === 'function') {
        initTableSelector();
    }
    
    // Setup navigazione tabs
    setupTabNavigation();
    
    // Setup gestione personale e veicoli
    if (document.getElementById('tab-personnel')) {
        initializePersonnelManagement();
    }
    
    if (document.getElementById('tab-vehicles')) {
        initializeVehiclesManagement();
    }
    
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
    console.log('✅ Admin inizializzato con successo');
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

// FUNZIONE UNIFICATA PER CARICARE QUALSIASI TABELLA
// FUNZIONE UNIFICATA PER CARICARE QUALSIASI TABELLA - VERSIONE CORRETTA
async function loadTableData(tableName) {
    console.log(`📥 Caricamento: ${tableName}`);
    
    if (!hasDbConfig()) {
        showNotification('Configura prima il database', 'warning');
        return;
    }
    
    showLoading('Caricamento', `Tabella: ${tableName}`);
    
    try {
        const client = getSupabaseClient();
        
        // Configurazioni per ogni tabella
        const tableConfig = {
            'tecnici': {
                select: 'id, nome_completo, pin, ruolo, cod_supervisore, Telefono, Mail',
                orderBy: 'nome_completo',
                limit: 100
            },
            'manutentori': {
    select: 'id, Titolo, Giro, Manutentore, Mail, Telefono, Supervisore',  // AGGIUNTO id
    orderBy: 'Giro',
    limit: 100
},
'supervisori': {
    select: 'id, Titolo, Cod, Nome, Mail, Telefono',  // AGGIUNTO id
    orderBy: 'Cod',
    limit: 100
},
'venditori': {
    select: 'id, Titolo, Cod, Nome, Mail, Telefono',  // AGGIUNTO id
    orderBy: 'Cod',
    limit: 100
}

        };
        
        const config = tableConfig[tableName] || {
            select: '*',
            orderBy: 'id',
            limit: 50
        };
        
        let query = client
            .from(tableName)
            .select(config.select)
            .limit(config.limit);
        
        // Prova a ordinare
        try {
            query = query.order(config.orderBy, { ascending: true });
        } catch (orderError) {
            console.warn('Ordinamento non disponibile:', orderError.message);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Aggiorna lo stato globale in base alla tabella
        switch(tableName) {
            case 'tecnici':
                window.tecniciData = data || [];
                currentPersonnelTable = 'tecnici';
                renderTecniciTable();
                break;
            case 'manutentori':
                window.manutentoriData = data || [];
                currentPersonnelTable = 'manutentori';
                renderManutentoriTable();
                break;
            case 'supervisori':
                window.supervisoriData = data || [];
                currentPersonnelTable = 'supervisori';
                renderSupervisoriTable();
                break;
            case 'venditori':
                window.venditoriData = data || [];
                currentPersonnelTable = 'venditori';
                renderVenditoriTable();
                break;
            default:
                // Per altre tabelle, usa un render generico
                console.warn(`Nessun render specifico per ${tableName}`);
        }
        
        showNotification(`✅ ${data.length} record da ${tableName}`, 'success');
        
    } catch (error) {
        console.error(`❌ Errore caricamento ${tableName}:`, error);
        showNotification(`Errore: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// RENDER DINAMICO PER QUALSIASI TABELLA
function renderTable(tableName, data, isError = false) {
    const container = document.getElementById('personnel-content');
    if (!container) return;
    
    if (isError) {
        container.innerHTML = `
            <div class="error-state">
                <span class="material-symbols-rounded">error</span>
                <h3>Errore di caricamento</h3>
                <p>Impossibile caricare i dati della tabella ${tableName}</p>
                <button class="btn btn-primary" onclick="loadTableData('${tableName}')">
                    Riprova
                </button>
            </div>
        `;
        return;
    }
    
    // Qui puoi chiamare la tua funzione di render esistente
    // o mantenere quella che già funziona
    renderTecniciTable();
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

function renderTecniciTable() {
    console.log('🔄 Render tecnici con stato attivo:', tecniciData);
    
    const container = document.getElementById('personnel-content');
    if (!container) return;
    
    if (!tecniciData || tecniciData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">group</span>
                <h3>Nessun tecnico registrato</h3>
                <p>La tabella tecnici è vuota</p>
                <button class="btn btn-primary" onclick="openAddModal('tecnici')">
                    <span class="material-symbols-rounded">add</span>
                    Aggiungi primo tecnico
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <!-- HEADER -->
        <div class="section-header">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">engineering</span>
                    Gestione Tecnici
                </h2>
                <p style="margin: 4px 0 0 0; color: #64748b;">
                    ${tecniciData.length} tecnici registrati • Ultimo aggiornamento: ${new Date().toLocaleTimeString('it-IT')}
                </p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openAddModal('tecnici')">
                    <span class="material-symbols-rounded">add</span>
                    Nuovo Tecnico
                </button>
                <button class="btn btn-secondary" onclick="exportTecniciCSV()">
                    <span class="material-symbols-rounded">download</span>
                    Esporta CSV
                </button>
            </div>
        </div>
        
        <!-- TABELLA -->
        <div class="table-container">
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>Nome Completo</th>
                        <th>PIN</th>
                        <th>Ruolo</th>
                        <th>Supervisore</th>
                        <th>Email</th>
                        <th>Stato</th>
                        <th style="width: 120px;">Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${tecniciData.map((tecnico) => {
                        // Determina lo stato attivo (gestisce sia booleano che stringa)
                        const isActive = tecnico.attivo === true || tecnico.attivo === 'true' || tecnico.attivo === 1 || tecnico.attivo === '1';
                        
                        return `
                        <tr>
                            <td><strong>${tecnico.nome_completo || '-'}</strong></td>
                            <td>
                                <span style="font-family: monospace; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">
                                    ${tecnico.pin || '0000'}
                                </span>
                            </td>
                            <td>
                                <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                                    ${tecnico.ruolo || 'tecnico'}
                                </span>
                            </td>
                            <td>${tecnico.cod_supervisore || '-'}</td>
                            <td>${tecnico.Mail ? `<a href="mailto:${tecnico.Mail}">${tecnico.Mail}</a>` : '-'}</td>
                            <td>
                                ${isActive ? 
                                    '<span class="badge badge-success" style="background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 20px; font-weight: 600;">✅ Attivo</span>' : 
                                    '<span class="badge badge-danger" style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 20px; font-weight: 600;">❌ Non attivo</span>'}
                            </td>
                            <td class="action-cells">
                                <button class="btn-icon edit" title="Modifica" 
                                    onclick="openEditModal('tecnici', ${tecnico.id})">
                                    <span class="material-symbols-rounded">edit</span>
                                </button>
                                <button class="btn-icon delete" title="Elimina" 
                                    onclick="deleteRecord('tecnici', ${tecnico.id}, '${tecnico.nome_completo || 'tecnico'}')">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// RENDER MANUTENTORI TABLE
function renderManutentoriTable() {
    console.log('🔄 Render manutentori');
    const container = document.getElementById('personnel-content');
    if (!container) return;
    
    if (!manutentoriData || manutentoriData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">construction</span>
                <h3>Nessun manutentore registrato</h3>
                <p>La tabella manutentori è vuota</p>
                <button class="btn btn-primary" onclick="openAddModal('manutentori')">
                    <span class="material-symbols-rounded">add</span>
                    Aggiungi primo manutentore
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="section-header">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">construction</span>
                    Gestione Manutentori
                </h2>
                <p style="margin: 4px 0 0 0; color: #64748b;">
                    ${manutentoriData.length} manutentori registrati • Ultimo aggiornamento: ${new Date().toLocaleTimeString('it-IT')}
                </p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openAddModal('manutentori')">
                    <span class="material-symbols-rounded">add</span>
                    Nuovo Manutentore
                </button>
                <button class="btn btn-secondary" onclick="downloadTableCSV('manutentori')">
                    <span class="material-symbols-rounded">download</span>
                    Esporta CSV
                </button>
            </div>
        </div>
        
        <div class="table-container">
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>Giro</th>
                        <th>Manutentore</th>
                        <th>Supervisore</th>
                        <th>Email</th>
                        <th>Telefono</th>
                        <th>Titolo</th>
                        <th style="width: 120px;">Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${manutentoriData.map(manutentore => {
                        const recordName = (manutentore.Manutentore || 'Senza nome').replace(/'/g, "\\'");
                        
                        return `
                        <tr>
                            <td><strong>${manutentore.Giro || '-'}</strong></td>
                            <td>${manutentore.Manutentore || '-'}</td>
                            <td>${manutentore.Supervisore || '-'}</td>
                            <td>${manutentore.Mail ? `<a href="mailto:${manutentore.Mail}">${manutentore.Mail}</a>` : '-'}</td>
                            <td>${manutentore.Telefono || '-'}</td>
                            <td>${manutentore.Titolo || '-'}</td>
                            <td class="action-cells">
                                <button class="btn-icon edit" title="Modifica" 
                                    onclick="openEditModal('manutentori', ${manutentore.id})">
                                    <span class="material-symbols-rounded">edit</span>
                                </button>
                                <button class="btn-icon delete" title="Elimina" 
                                    onclick="deleteRecord('manutentori', ${manutentore.id}, '${recordName}')">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// RENDER SUPERVISORI TABLE
function renderSupervisoriTable() {
    console.log('🔄 Render supervisori');
    const container = document.getElementById('personnel-content');
    if (!container) return;
    
    if (!supervisoriData || supervisoriData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">supervisor_account</span>
                <h3>Nessun supervisore registrato</h3>
                <p>La tabella supervisori è vuota</p>
                <button class="btn btn-primary" onclick="openAddModal('supervisori')">
                    <span class="material-symbols-rounded">add</span>
                    Aggiungi primo supervisore
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="section-header">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">supervisor_account</span>
                    Gestione Supervisori
                </h2>
                <p style="margin: 4px 0 0 0; color: #64748b;">
                    ${supervisoriData.length} supervisori registrati • Ultimo aggiornamento: ${new Date().toLocaleTimeString('it-IT')}
                </p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openAddModal('supervisori')">
                    <span class="material-symbols-rounded">add</span>
                    Nuovo Supervisore
                </button>
                <button class="btn btn-secondary" onclick="downloadTableCSV('supervisori')">
                    <span class="material-symbols-rounded">download</span>
                    Esporta CSV
                </button>
            </div>
        </div>
        
        <div class="table-container">
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>Codice</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefono</th>
                        <th>Titolo</th>
                        <th style="width: 120px;">Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${supervisoriData.map(supervisore => {
                        const recordName = (supervisore.Nome || 'Senza nome').replace(/'/g, "\\'");
                        
                        return `
                        <tr>
                            <td><strong>${supervisore.Cod || '-'}</strong></td>
                            <td>${supervisore.Nome || '-'}</td>
                            <td>${supervisore.Mail ? `<a href="mailto:${supervisore.Mail}">${supervisore.Mail}</a>` : '-'}</td>
                            <td>${supervisore.Telefono || '-'}</td>
                            <td>${supervisore.Titolo || '-'}</td>
                            <td class="action-cells">
                                <button class="btn-icon edit" title="Modifica" 
                                    onclick="openEditModal('supervisori', ${supervisore.id})">
                                    <span class="material-symbols-rounded">edit</span>
                                </button>
                                <button class="btn-icon delete" title="Elimina" 
                                    onclick="deleteRecord('supervisori', ${supervisore.id}, '${recordName}')">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// RENDER VENDITORI TABLE
function renderVenditoriTable() {
    console.log('🔄 Render venditori');
    const container = document.getElementById('personnel-content');
    if (!container) return;
    
    if (!venditoriData || venditoriData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded">storefront</span>
                <h3>Nessun venditore registrato</h3>
                <p>La tabella venditori è vuota</p>
                <button class="btn btn-primary" onclick="openAddModal('venditori')">
                    <span class="material-symbols-rounded">add</span>
                    Aggiungi primo venditore
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="section-header">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">storefront</span>
                    Gestione Venditori
                </h2>
                <p style="margin: 4px 0 0 0; color: #64748b;">
                    ${venditoriData.length} venditori registrati • Ultimo aggiornamento: ${new Date().toLocaleTimeString('it-IT')}
                </p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openAddModal('venditori')">
                    <span class="material-symbols-rounded">add</span>
                    Nuovo Venditore
                </button>
                <button class="btn btn-secondary" onclick="downloadTableCSV('venditori')">
                    <span class="material-symbols-rounded">download</span>
                    Esporta CSV
                </button>
            </div>
        </div>
        
        <div class="table-container">
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>Codice</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefono</th>
                        <th>Titolo</th>
                        <th style="width: 120px;">Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${venditoriData.map(venditore => {
                        const recordName = (venditore.Nome || 'Senza nome').replace(/'/g, "\\'");
                        
                        return `
                        <tr>
                            <td><strong>${venditore.Cod || '-'}</strong></td>
                            <td>${venditore.Nome || '-'}</td>
                            <td>${venditore.Mail ? `<a href="mailto:${venditore.Mail}">${venditore.Mail}</a>` : '-'}</td>
                            <td>${venditore.Telefono || '-'}</td>
                            <td>${venditore.Titolo || '-'}</td>
                            <td class="action-cells">
                                <button class="btn-icon edit" title="Modifica" 
                                    onclick="openEditModal('venditori', ${venditore.id})">
                                    <span class="material-symbols-rounded">edit</span>
                                </button>
                                <button class="btn-icon delete" title="Elimina" 
                                    onclick="deleteRecord('venditori', ${venditore.id}, '${recordName}')">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}


// CHIUDI MODAL
function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// GESTIONE SALVATAGGIO RECORD





// MODIFICA RECORD (VERSIONE SEMPLICE)
async function editRecord(tableName, recordId) {
    console.log(`✏️ Modifica: ${tableName} - ID: ${recordId}`);
    
    showLoading('Caricamento', `Recupero dati del record...`);
    
    try {
        const client = getSupabaseClient();
        
        // Determina campo chiave
        let keyField = 'id';
        const keyMapping = {
            'tecnici': 'id',
            'manutentori': 'Giro',
            'supervisori': 'Cod',
            'venditori': 'Cod'
        };
        keyField = keyMapping[tableName] || 'id';
        
        // Recupera il record esistente
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .eq(keyField, recordId)
            .single();
        
        if (error) throw error;
        
        if (!data) {
            throw new Error('Record non trovato');
        }
        
        console.log('📋 Record trovato:', data);
        
        // Chiudi loading e mostra modal di modifica
        hideLoading();
        showEditModal(tableName, data, keyField);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore caricamento record:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// MODAL PER MODIFICA


// CHIUDI MODAL MODIFICA
function closeEditModal() {
    const modal = document.getElementById('edit-modal-overlay');
    if (modal) modal.remove();
}

// GESTIONE AGGIORNAMENTO RECORD



// DIALOG DI CONFERMA PERSONALIZZATO
function showConfirmDialog(title, message, icon = 'warning') {
    return new Promise((resolve) => {
        const dialogHTML = `
            <div class="modal-overlay" id="confirm-dialog">
                <div class="modal-container" style="max-width: 400px;">
                    <div class="modal-body">
                        <div style="text-align: center; padding: 20px;">
                            <span class="material-symbols-rounded" style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;">
                                ${icon}
                            </span>
                            <h3 style="color: #1e293b; margin-bottom: 8px;">${title}</h3>
                            <p style="color: #64748b; margin-bottom: 24px;">${message}</p>
                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <button class="btn btn-secondary" onclick="handleConfirmDialog(false)">
                                    Annulla
                                </button>
                                <button class="btn btn-danger" onclick="handleConfirmDialog(true)">
                                    <span class="material-symbols-rounded">delete</span>
                                    Elimina
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const dialogContainer = document.createElement('div');
        dialogContainer.innerHTML = dialogHTML;
        document.body.appendChild(dialogContainer.firstElementChild);
        
        // Esponi la funzione di gestione globalmente
        window.handleConfirmDialog = function(result) {
            const dialog = document.getElementById('confirm-dialog');
            if (dialog) dialog.remove();
            delete window.handleConfirmDialog;
            resolve(result);
        };
    });
}






// Funzioni helper
function getTableIcon(tableName) {
    const icons = {
        'tecnici': 'engineering',
        'manutentori': 'construction',
        'supervisori': 'supervisor_account',
        'venditori': 'storefront',
        'veicoli': 'directions_car'
    };
    return icons[tableName] || 'table';
}

function formatTableName(tableName) {
    return tableName.charAt(0).toUpperCase() + tableName.slice(1);
}

function formatCellValue(value, column) {
    if (value === null || value === undefined || value === '') return '-';
    
    // Formattazione speciale
    if (column.toLowerCase().includes('mail')) {
        return `<a href="mailto:${value}" class="email-link">${value}</a>`;
    }
    
    if (column.toLowerCase().includes('telefono')) {
        return `<a href="tel:${value}" class="phone-link">${value}</a>`;
    }
    
    if (typeof value === 'boolean') {
        return value ? 
            '<span class="badge success">Sì</span>' : 
            '<span class="badge error">No</span>';
    }
    
    return value;
}



function exportTecniciCSV() {
    if (!tecniciData || tecniciData.length === 0) {
        showNotification('Nessun tecnico da esportare', 'warning');
        return;
    }
    
    console.log(`📥 Esportazione ${tecniciData.length} tecnici in CSV`);
    
    // Intestazioni CSV
    const headers = ['nome_completo', 'pin', 'ruolo', 'cod_supervisore', 'Telefono', 'Mail', 'attivo'];
    
    // Crea righe CSV
    const csvRows = [
        headers.join(';'), // Intestazione
        ...tecniciData.map(tecnico => 
            headers.map(header => {
                let value = tecnico[header] || '';
                // Gestisci booleano
                if (header === 'attivo') {
                    value = tecnico.attivo === true || tecnico.attivo === 'true' || tecnico.attivo === 1 ? 'true' : 'false';
                }
                // Escaping per CSV
                if (typeof value === 'string' && (value.includes(';') || value.includes('"') || value.includes('\n'))) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            }).join(';')
        )
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Crea e scarica file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // Aggiunge BOM per UTF-8
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tecnici_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(`✅ ${tecniciData.length} tecnici esportati in CSV`, 'success');
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
        // Silenzia l'errore se gli elementi non esistono
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

// ============================================
// GESTIONE MANUALE PERSONALE
// ============================================

let currentPersonnelTable = 'tecnici';
let personnelData = [];
let personnelColumns = [];
let currentPage = 1;
const recordsPerPage = 20;





// Formatta nome colonna
function formatColumnName(columnName) {
    return columnName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}



// Aggiorna paginazione
function updatePagination() {
    const totalPages = Math.ceil(personnelData.length / recordsPerPage);
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    if (pageInfo) {
        pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
    }
    
    if (btnPrev) {
        btnPrev.disabled = currentPage === 1;
    }
    
    if (btnNext) {
        btnNext.disabled = currentPage === totalPages || totalPages === 0;
    }
}

// Navigazione pagine
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPersonnelTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(personnelData.length / recordsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderPersonnelTable();
    }
}

// Filtra dati
function filterPersonnelData() {
    const searchInput = document.getElementById('personnel-search');
    if (!searchInput || !searchInput.value.trim()) {
        renderPersonnelTable();
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    // Implementa logica di filtro se necessario
    renderPersonnelTable();
}

// Debounce per ricerca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modal per aggiungere record
function showAddPersonnelModal() {
  openAddModal(currentPersonnelTable || 'tecnici');
}
// Carica CSV in tabella
async function uploadCSVToTable(tableName) {
    // Implementa upload CSV per tabelle specifiche
    showNotification(`Upload CSV per ${tableName} - Funzionalità in sviluppo`, 'info');
}

// Esporta CSV
async function downloadTableCSV(tableName) {
    try {
        showLoading('Esportazione', `Preparazione dati ${tableName}...`);
        
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(tableName)
            .select('*');
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showNotification('Nessun dato da esportare', 'warning');
            return;
        }
        
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(';'),
            ...data.map(row => 
                headers.map(header => {
                    let value = row[header] || '';
                    if (typeof value === 'string' && (value.includes(';') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                }).join(';')
            )
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`✅ ${data.length} record esportati da ${tableName}`, 'success');
        
    } catch (error) {
        console.error('Errore esportazione:', error);
        showNotification(`❌ Errore: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Alias "compatibilità"
function showAddModal(tableName) { openAddModal(tableName); }         // alias
async function handleAddRecord(e, table) { return handleCrudSubmit(e); } // alias
function showEditModal(t, rec, key) { openEditModal(t, rec[key || 'id']); } // opzionale
async function handleEditRecord(e) { return handleCrudSubmit(e); }    // alias


document.getElementById('btn-add-personnel')
  ?.addEventListener('click', () => openAddModal(currentPersonnelTable || 'tecnici'));

document.getElementById('btn-add-vehicle')
  ?.addEventListener('click', () => openAddModal('veicoli'));



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


// ==========================================
// INTEGRAZIONE UPLOAD SYSTEM (ESA PROJECT)
// ==========================================

// 1. Popola il menu a tendina all'avvio
function initTableSelector() {
    const selector = document.getElementById('table-select');
    if (!selector) return;

    // Pulisce opzioni esistenti tranne la prima
    selector.innerHTML = '<option value="">-- Seleziona Tabella --</option>';

    // Usa DB_RULES definito in db-rules.js
    Object.keys(DB_RULES).forEach(tableName => {
        const opt = document.createElement('option');
        opt.value = tableName;
        opt.textContent = tableName.toUpperCase();
        selector.appendChild(opt);
    });
    
    console.log("Selettore tabelle inizializzato con 9 tabelle ESA.");
}

// 2. Funzione Principale di Upload
async function handleESAUpload() {
    const tableName = document.getElementById('table-select').value;
    const fileInput = document.getElementById('csv-file');
    const statusDiv = document.getElementById('upload-status');

    if (!tableName) return alert("Seleziona una tabella!");
    if (!fileInput.files[0]) return alert("Seleziona un file CSV!");

    const config = DB_RULES[tableName];
    statusDiv.innerHTML = '<span style="color:blue">⏳ Lettura e analisi CSV in corso...</span>';

    Papa.parse(fileInput.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const rawData = results.data;
            let validRecords = [];
            let errors = [];

            // VALIDAZIONE E PULIZIA DATI
            rawData.forEach((row, idx) => {
                let cleanRow = { ...row };
                let isValid = true;

                // Check campi obbligatori
                config.required.forEach(field => {
                    if (!row[field]) {
                        isValid = false;
                        errors.push(`Riga ${idx+1}: Manca ${field}`);
                    }
                });

                // Trasformazioni (es. date, numeri)
                if (isValid) {
                    for (let key in cleanRow) {
                        // Fix Date
                        if (key.includes('data') || key === 'created_at') {
                            const isoDate = parseDateIT(cleanRow[key]);
                            if (isoDate) cleanRow[key] = isoDate;
                        }
                        // Fix Numeri (se definito in transform)
                        if (config.transform && config.transform[key] === 'integer') {
                            cleanRow[key] = parseInt(cleanRow[key]) || 0;
                        }
                        if (config.transform && config.transform[key] === 'bigint') {
                            cleanRow[key] = parseInt(cleanRow[key]) || null;
                        }
                    }
                    validRecords.push(cleanRow);
                }
            });

            if (errors.length > 0) {
                console.warn("Errori CSV:", errors);
                statusDiv.innerHTML += `<br><span style="color:orange">⚠️ Ignorate ${errors.length} righe con errori.</span>`;
            }

            // INVIO A SUPABASE
            if (validRecords.length > 0) {
                statusDiv.innerHTML = `🚀 Caricamento di ${validRecords.length} record in <b>${tableName}</b>...`;
                await syncBatchToSupabase(tableName, validRecords, config, statusDiv);
            } else {
                statusDiv.innerHTML = '<span style="color:red">❌ Nessun record valido trovato.</span>';
            }
        }
    });
}

// 3. Motore di Sync (Batching)
async function syncBatchToSupabase(tableName, records, config, statusUi) {
    const supabase = getSupabaseClient(); // Assumendo esista in db-config.js
    
    // Modalità REPLACE: Cancella tutto prima
    if (config.syncMode === 'replace') {
        await supabase.from(tableName).delete().neq('id', 0); // Cancella tutto (o usa truncate)
    }

    // Modalità UPSERT (Batch di 50)
    const BATCH_SIZE = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        // Gestione chiave conflitto per upsert
        let conflict = config.key;
        if (Array.isArray(conflict)) conflict = conflict.join(',');

        const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: conflict });

        if (error) {
            console.error("Errore batch:", error);
            errorCount += batch.length;
        } else {
            successCount += batch.length;
        }
        
        // Update UI parziale
        statusUi.innerHTML = `Caricamento... ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`;
    }

    // Logica speciale VEICOLI (Cancella vecchi)
    if (config.syncMode === 'upsert_with_delete' && tableName === 'veicoli') {
        // Qui dovremmo implementare la logica di cancellazione di ciò che non è nel CSV
        // Per ora lasciamo un placeholder
        console.log("Pulizia veicoli obsoleti non ancora implementata.");
    }

    statusUi.innerHTML = `<span style="color:green">✅ Fatto! Inseriti: ${successCount}, Errori: ${errorCount}</span>`;
    
    // Ricarica la vista se necessario
    if (typeof loadTableStructure === 'function') {
        // Refresh dell'interfaccia esistente
        setTimeout(() => loadTableStructure(), 1000); 
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


// ============================================
// INIZIALIZZAZIONE COMPLETA
// ============================================

// Modifica l'inizializzazione esistente
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FLOX ADMIN INIT ===');
    
    // Setup notifiche CSS
    setupNotifications();
    initTableSelector();
    
    // Setup navigazione tabs
    setupTabNavigation();
    
    // Inizializza gestione personale e veicoli
    initializePersonnelManagement();
    initializeVehiclesManagement();
    
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
    console.log('✅ Admin inizializzato con successo');







});

// Collega il bottone upload
    const btnUpload = document.getElementById('btn-upload');
    if(btnUpload) btnUpload.addEventListener('click', handleESAUpload); // <--- E QUESTO


    // ESPORTA LE FUNZIONI PER RENDERLE GLOBALI
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.deleteRecord = deleteRecord;
window.closeCrudModal = closeCrudModal;

console.log('✅ Funzioni CRUD esportate globalmente');



// ============================================
// FUNZIONI WRAPPER PER RETROCOMPATIBILITÀ
// ============================================

// Funzioni di Aggiunta (wrapper)
function showAddTecnicoModal() { openAddModal('tecnici'); }
function showAddManutentoreModal() { openAddModal('manutentori'); }
function showAddSupervisoreModal() { openAddModal('supervisori'); }
function showAddVenditoreModal() { openAddModal('venditori'); }
function showAddVehicleModal() { openAddModal('veicoli'); }

// Funzioni di Modifica (wrapper)
function editTecnico(id) { openEditModal('tecnici', id); }
function editManutentore(id) { openEditModal('manutentori', id); }
function editSupervisore(id) { openEditModal('supervisori', id); }
function editVenditore(id) { openEditModal('venditori', id); }
function editVehicle(id) { openEditModal('veicoli', id); }

// Funzioni di Eliminazione (wrapper)
function deleteTecnico(id) { deleteRecord('tecnici', id); }
function deleteManutentore(id) { deleteRecord('manutentori', id); }
function deleteSupervisore(id) { deleteRecord('supervisori', id); }
function deleteVenditore(id) { deleteRecord('venditori', id); }
function deleteVehicle(id) { deleteRecord('veicoli', id); }

// Funzione generica per personale (adatta dinamicamente)
function showAddPersonnelModal() { 
    openAddModal(currentPersonnelTable || 'tecnici'); 
}

// Esporta le funzioni wrapper
window.showAddTecnicoModal = showAddTecnicoModal;
window.showAddManutentoreModal = showAddManutentoreModal;
window.showAddSupervisoreModal = showAddSupervisoreModal;
window.showAddVenditoreModal = showAddVenditoreModal;
window.showAddVehicleModal = showAddVehicleModal;
window.editTecnico = editTecnico;
window.editManutentore = editManutentore;
window.editSupervisore = editSupervisore;
window.editVenditore = editVenditore;
window.editVehicle = editVehicle;
window.deleteTecnico = deleteTecnico;
window.deleteManutentore = deleteManutentore;
window.deleteSupervisore = deleteSupervisore;
window.deleteVenditore = deleteVenditore;
window.deleteVehicle = deleteVehicle;
window.renderManutentoriTable = renderManutentoriTable;
window.renderSupervisoriTable = renderSupervisoriTable;
window.renderVenditoriTable = renderVenditoriTable;