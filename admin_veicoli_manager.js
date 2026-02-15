// admin_veicoli_manager.js
// Gestione completa del modulo veicoli per FloX Admin
// Versione con fix doppio storico e vista storico

// Variabili globali
let currentVehicleView = 'fleet';
let vehiclesData = [];
let approvalsData = [];
let vehiclesFilterCache = {};
let isSavingVehicle = false;
let lastSaveTime = 0;
const SAVE_COOLDOWN = 2000; // ms

window.vehiclesManagerActive = true;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚗 Admin Veicoli Manager inizializzato');
    
    // Aggiungi listener per quando il tab veicoli viene attivato
    document.querySelectorAll('[data-tab="vehicles"]').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('📂 Tab veicoli attivato');
            setTimeout(() => {
                loadVehicles();
                loadApprovals();
                loadVehicleStats();
            }, 100);
        });
    });
    
    // Collega manualmente il pulsante dopo il caricamento
    setTimeout(connectAddVehicleButton, 500);
});

// Funzione per collegare il pulsante
function connectAddVehicleButton() {
    console.log('🔌 Cerco pulsante Aggiungi Veicolo...');
 const aggiungiBtnVeicolo = document.getElementById('btn-nuovo-veicolo-specifico'); 
    buttons.forEach(btn => {
        if (btn.textContent.includes('Aggiungi Veicolo') || 
            btn.innerHTML.includes('add_circle') ||
            btn.innerHTML.includes('add')) {
            console.log('✅ Trovato pulsante, collego evento');
            btn.onclick = function(e) {
                e.preventDefault();
                console.log('🚗 Click su aggiungi veicolo');
                showAddVehicleModal();
            };
        }
    });
}

// Funzione per cambiare vista
function switchVehicleView(view) {
    currentVehicleView = view;
    
    document.querySelectorAll('[data-vehicle-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vehicleView === view);
    });
    
    document.querySelectorAll('.vehicle-view').forEach(v => {
        v.classList.toggle('active', v.id === `vehicle-view-${view}`);
    });
    
    if (view === 'fleet' && vehiclesData.length === 0) {
        loadVehicles();
    } else if (view === 'approvals' && approvalsData.length === 0) {
        loadApprovals();
    }
}

// CARICAMENTO DATI
async function loadVehicles() {
    console.log('🚗 Caricamento veicoli...');
    
    if (!hasDbConfig()) {
        showNotification('⚠️ Configura prima il database', 'warning');
        showFleetError('Database non configurato');
        return;
    }
    
    showLoading('Caricamento veicoli', 'Recupero dati dal database...');
    
    try {
        const supabase = getSupabaseClient();
        
        // Carica veicoli
        const { data, error } = await supabase
            .from('veicoli')
            .select('*')
            .order('targa', { ascending: true });
        
        if (error) throw error;
        
        vehiclesData = data || [];
        
        // Carica conteggio cambi per ogni veicolo
        const { data: counts, error: countError } = await supabase
            .from('storico_assegnazioni')
            .select('veicolo_id, count');
        
        if (!countError && counts) {
            const changeCountMap = {};
            counts.forEach(c => { changeCountMap[c.veicolo_id] = c.count; });
            window.vehicleChangeCounts = changeCountMap;
        } else {
            window.vehicleChangeCounts = {};
        }
        
        console.log(`✅ Caricati ${vehiclesData.length} veicoli`);
        
        renderFleetTable(vehiclesData);
        showNotification(`✅ Caricati ${vehiclesData.length} veicoli`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento veicoli:', error);
        showNotification(`❌ Errore: ${error.message}`, 'error');
        showFleetError(`Errore: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function loadApprovals() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            showApprovalsError('Database non configurato');
            return;
        }
        
        const { data, error } = await supabase
            .from('kilometri_mensili')
            .select(`
                *,
                veicoli!inner(targa, modello, tecnico_assegnato)
            `)
            .eq('confermato', false)
            .order('data_inserimento', { ascending: false });
        
        if (error) throw error;
        
        approvalsData = data || [];
        renderApprovalsTable(approvalsData);
        populateVehicleFilter(approvalsData);
        
    } catch (error) {
        console.error('Errore caricamento approvazioni:', error);
        showApprovalsError(`Errore: ${error.message}`);
    }
}

async function loadVehicleStats() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        const { count: total, error: totalError } = await supabase
            .from('veicoli')
            .select('*', { count: 'exact', head: true });
        
        if (totalError) throw totalError;
        
        const { count: active, error: activeError } = await supabase
            .from('veicoli')
            .select('*', { count: 'exact', head: true })
            .eq('attivo', true);
        
        if (activeError) throw activeError;
        
        const { count: pending, error: pendingError } = await supabase
            .from('kilometri_mensili')
            .select('*', { count: 'exact', head: true })
            .eq('confermato', false);
        
        if (pendingError) throw pendingError;
        
        document.getElementById('stats-total-vehicles').textContent = total || 0;
        document.getElementById('stats-active-vehicles').textContent = active || 0;
        document.getElementById('stats-pending-approvals').textContent = pending || 0;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: kmData, error: kmError } = await supabase
            .from('kilometri_mensili')
            .select('km_fine_mese, km_precedenti')
            .eq('confermato', true)
            .gte('data_inserimento', thirtyDaysAgo.toISOString().split('T')[0]);
        
        if (!kmError && kmData) {
            const totalKm = kmData.reduce((sum, item) => {
                return sum + (item.km_fine_mese - (item.km_precedenti || 0));
            }, 0);
            document.getElementById('stats-total-km').textContent = totalKm.toLocaleString();
        }
        
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
    }
}

// RENDERING TABELLA VEICOLI
function renderFleetTable(vehicles) {
    console.log('📊 Rendering tabella veicoli...');
    
    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) {
        console.error('❌ Elemento #fleet-table-body non trovato');
        return;
    }
    
    if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
                        <span class="material-symbols-rounded" style="font-size: 64px; color: #cbd5e1;">directions_car_off</span>
                        <div style="margin-top: 16px; font-size: 18px; font-weight: 600;">Nessun veicolo registrato</div>
                        <div style="margin-top: 8px; color: #64748b;">Usa il pulsante "Aggiungi Veicolo" per inserire il primo veicolo</div>
                        <button class="btn btn-primary" onclick="showAddVehicleModal()" style="margin-top: 24px;">
                            <span class="material-symbols-rounded">add</span>
                            Aggiungi il primo veicolo
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    vehicles.forEach(vehicle => {
        const dataAssegnazione = vehicle.data_assegnazione 
            ? new Date(vehicle.data_assegnazione).toLocaleDateString('it-IT')
            : '-';
        
        const kmIniziali = vehicle.km_totali_iniziali 
            ? vehicle.km_totali_iniziali.toLocaleString() + ' km'
            : '-';
        
        const changeCount = window.vehicleChangeCounts?.[vehicle.id] || 0;
        
        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded" style="color: ${vehicle.attivo ? '#10b981' : '#94a3b8'}">
                            ${vehicle.attivo ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <strong style="font-family: monospace; font-size: 16px;">${vehicle.targa || '-'}</strong>
                    </div>
                </td>
                <td>${vehicle.modello || '-'}</td>
                <td>${vehicle.tecnico_assegnato || '-'}</td>
                <td>${dataAssegnazione}</td>
                <td>${kmIniziali}</td>
                <td>
                    <span class="badge ${vehicle.attivo ? 'badge-success' : 'badge-danger'}">
                        ${vehicle.attivo ? 'Attivo' : 'Non attivo'}
                    </span>
                </td>
                <td>
                    <span class="badge badge-info" title="Numero cambi tecnico">
                        ${changeCount} <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">swap_horiz</span>
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-small" onclick="editVehicle('${vehicle.id}')" title="Modifica">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-icon-small" onclick="toggleVehicleStatus('${vehicle.id}', ${!vehicle.attivo})" 
                                title="${vehicle.attivo ? 'Disattiva' : 'Attiva'}" 
                                style="color: ${vehicle.attivo ? '#ef4444' : '#10b981'};">
                            <span class="material-symbols-rounded">${vehicle.attivo ? 'toggle_off' : 'toggle_on'}</span>
                        </button>
                        <button class="btn-icon-small" onclick="viewVehicleHistory('${vehicle.id}')" title="Storico">
                            <span class="material-symbols-rounded">history</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    console.log(`✅ Tabella renderizzata con ${vehicles.length} veicoli`);
}

function renderApprovalsTable(approvals) {
    const tbody = document.getElementById('approvals-table-body');
    if (!tbody) return;
    
    if (!approvals || approvals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">check_circle</span>
                        <p>Nessuna approvazione in attesa</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    approvals.forEach(a => {
        const veicolo = a.veicoli || {};
        const dataInserimento = a.data_inserimento ? new Date(a.data_inserimento).toLocaleDateString('it-IT') : '-';
        const periodo = `${getNomeMese(a.mese)} ${a.anno}`;
        
        html += `
            <tr>
                <td>${dataInserimento}</td>
                <td><strong>${veicolo.targa || 'N/D'}</strong><br><small>${veicolo.modello || ''}</small></td>
                <td>${veicolo.tecnico_assegnato || '-'}</td>
                <td>${periodo}</td>
                <td class="text-right"><strong>${a.km_fine_mese?.toLocaleString() || 0}</strong> km</td>
                <td>${a.note ? `📝` : '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-small" onclick="approveKilometers('${a.id}')" title="Approva">
                            <span class="material-symbols-rounded">check</span>
                        </button>
                        <button class="btn-icon-small" onclick="rejectKilometers('${a.id}')" title="Rifiuta">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// FILTRI
function filterFleetTable() {
    const searchTerm = document.getElementById('search-fleet')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filter-fleet-status')?.value || 'all';
    
    const filtered = vehiclesData.filter(v => {
        const matchesSearch = 
            v.targa?.toLowerCase().includes(searchTerm) ||
            v.modello?.toLowerCase().includes(searchTerm) ||
            v.tecnico_assegnato?.toLowerCase().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === 'active') matchesStatus = v.attivo === true;
        if (statusFilter === 'inactive') matchesStatus = v.attivo === false;
        
        return matchesSearch && matchesStatus;
    });
    
    renderFleetTable(filtered);
}

function filterApprovalsTable() {
    const searchTerm = document.getElementById('search-approvals')?.value.toLowerCase() || '';
    const vehicleFilter = document.getElementById('filter-approvals-vehicle')?.value || 'all';
    
    const filtered = approvalsData.filter(a => {
        const veicolo = a.veicoli || {};
        
        const matchesSearch = 
            veicolo.targa?.toLowerCase().includes(searchTerm) ||
            veicolo.tecnico_assegnato?.toLowerCase().includes(searchTerm) ||
            a.note?.toLowerCase().includes(searchTerm);
        
        const matchesVehicle = vehicleFilter === 'all' || a.veicolo_id === vehicleFilter;
        
        return matchesSearch && matchesVehicle;
    });
    
    renderApprovalsTable(filtered);
}

function populateVehicleFilter(approvals) {
    const select = document.getElementById('filter-approvals-vehicle');
    if (!select) return;
    
    const uniqueVehicles = {};
    approvals.forEach(a => {
        if (a.veicoli && a.veicolo_id) {
            uniqueVehicles[a.veicolo_id] = {
                id: a.veicolo_id,
                targa: a.veicoli.targa,
                modello: a.veicoli.modello
            };
        }
    });
    
    const vehicleList = Object.values(uniqueVehicles);
    
    let options = '<option value="all">Tutti i veicoli</option>';
    vehicleList.forEach(v => {
        options += `<option value="${v.id}">${v.targa} - ${v.modello || ''}</option>`;
    });
    
    select.innerHTML = options;
}

// AZIONI VEICOLI
async function toggleVehicleStatus(id, newStatus) {
    try {
        const action = newStatus ? 'attivare' : 'disattivare';
        const confirmed = confirm(`Sei sicuro di voler ${action} questo veicolo?`);
        
        if (!confirmed) return;
        
        showLoading('Aggiornamento', 'Modifica stato veicolo...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const { error } = await supabase
            .from('veicoli')
            .update({ attivo: newStatus })
            .eq('id', id);
        
        if (error) throw error;
        
        hideLoading();
        showNotification(`Veicolo ${newStatus ? 'attivato' : 'disattivato'} con successo`, 'success');
        
        await loadVehicles();
        await loadVehicleStats();
        
    } catch (error) {
        hideLoading();
        console.error('Errore cambio stato:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// MODALE AGGIUNTA VEICOLO - VERSIONE SEMPLIFICATA
function showAddVehicleModal() {
    console.log('🚗 Apertura modale veicolo');
    
    // Rimuovi eventuali modali precedenti
    const oldModal = document.getElementById('modal-add-vehicle');
    if (oldModal) oldModal.remove();
    
    const modalHtml = `
        <div id="modal-add-vehicle" class="modal" style="display: flex !important; z-index: 10000 !important;">
            <div class="modal-content" style="max-width: 500px; background: white; border-radius: 8px;">
                <div class="modal-header" style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0;">
                        <span class="material-symbols-rounded">add_circle</span>
                        Nuovo Veicolo
                    </h3>
                    <button class="btn-icon-small" onclick="closeAddVehicleModal()">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 16px;">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="modal-targa">Targa *</label>
                        <input type="text" id="modal-targa" class="form-control" placeholder="AB123CD" maxlength="7" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; text-transform: uppercase;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="modal-modello">Modello</label>
                        <input type="text" id="modal-modello" class="form-control" placeholder="Fiat Doblo, Ford Transit..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="modal-tecnico">Tecnico Assegnato *</label>
                        <input type="text" id="modal-tecnico" class="form-control" placeholder="Nome e cognome" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="modal-km">Km Iniziali</label>
                        <input type="number" id="modal-km" class="form-control" value="0" min="0" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="modal-note">Note</label>
                        <textarea id="modal-note" class="form-control" rows="3" placeholder="Eventuali note..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;"></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px; border-top: 1px solid #e2e8f0; text-align: right;">
                    <button class="btn btn-secondary" onclick="closeAddVehicleModal()" style="padding: 8px 16px; margin-right: 8px;">Annulla</button>
                    <button class="btn btn-primary" onclick="saveNewVehicle()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px;">
                        <span class="material-symbols-rounded">save</span>
                        Salva Veicolo
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log('✅ Modale aggiunto al DOM');
    
    setTimeout(() => {
        document.getElementById('modal-targa')?.focus();
    }, 100);
}

function closeAddVehicleModal() {
    console.log('🚪 Chiusura modale');
    const modal = document.getElementById('modal-add-vehicle');
    if (modal) modal.remove();
}

async function saveNewVehicle() {
    console.log('💾 Salvataggio nuovo veicolo...');
    
    try {
        const targa = document.getElementById('modal-targa')?.value.trim().toUpperCase();
        const modello = document.getElementById('modal-modello')?.value.trim();
        const tecnico = document.getElementById('modal-tecnico')?.value.trim();
        const km = parseInt(document.getElementById('modal-km')?.value) || 0;
        const note = document.getElementById('modal-note')?.value.trim();
        
        if (!targa) {
            alert('Inserisci la targa');
            return;
        }
        
        if (!tecnico) {
            alert('Inserisci il tecnico assegnato');
            return;
        }
        
        showLoading('Salvataggio', 'Inserimento veicolo in corso...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const { data: esistente, error: checkError } = await supabase
            .from('veicoli')
            .select('id')
            .eq('targa', targa)
            .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (esistente) {
            hideLoading();
            alert(`La targa ${targa} è già registrata`);
            return;
        }
        
        const { error } = await supabase
            .from('veicoli')
            .insert([{
                targa: targa,
                modello: modello || null,
                tecnico_assegnato: tecnico,
                data_assegnazione: new Date().toISOString().split('T')[0],
                km_totali_iniziali: km,
                note: note || null,
                attivo: true
            }]);
        
        if (error) throw error;
        
        hideLoading();
        closeAddVehicleModal();
        
        showNotification(`Veicolo ${targa} inserito con successo!`, 'success');
        
        await loadVehicles();
        await loadVehicleStats();
        
    } catch (error) {
        hideLoading();
        console.error('Errore inserimento veicolo:', error);
        alert(`Errore: ${error.message}`);
    }
}

// AZIONI APPROVAZIONI
async function approveKilometers(id) {
    if (!confirm('Approva questi kilometri?')) return;
    
    try {
        showLoading('Approvazione', 'Salvataggio in corso...');
        
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('kilometri_mensili')
            .update({ 
                confermato: true,
                data_conferma: new Date().toISOString().split('T')[0]
            })
            .eq('id', id);
        
        if (error) throw error;
        
        hideLoading();
        showNotification('Kilometri approvati!', 'success');
        
        await loadApprovals();
        await loadVehicleStats();
        
    } catch (error) {
        hideLoading();
        console.error('Errore approvazione:', error);
        alert(`Errore: ${error.message}`);
    }
}

async function rejectKilometers(id) {
    const motivo = prompt('Motivo del rifiuto (opzionale):');
    
    try {
        showLoading('Rifiuto', 'Aggiornamento in corso...');
        
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('kilometri_mensili')
            .update({ 
                confermato: false,
                note: motivo ? `RIFIUTATO: ${motivo}` : 'RIFIUTATO'
            })
            .eq('id', id);
        
        if (error) throw error;
        
        hideLoading();
        showNotification('Kilometri rifiutati', 'success');
        
        await loadApprovals();
        
    } catch (error) {
        hideLoading();
        console.error('Errore rifiuto:', error);
        alert(`Errore: ${error.message}`);
    }
}

// FUNZIONI DI UTILITY
function showFleetError(message) {
    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <span class="material-symbols-rounded" style="font-size: 48px;">error</span>
                    <div style="margin-top: 16px; font-weight: 600;">${message}</div>
                    <button class="btn btn-primary btn-sm" onclick="loadVehicles()" style="margin-top: 16px;">
                        <span class="material-symbols-rounded">refresh</span>
                        Riprova
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function showApprovalsError(message) {
    const tbody = document.getElementById('approvals-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div style="text-align: center; padding: 40px; color: #ef4444;">
                        <span class="material-symbols-rounded" style="font-size: 48px;">error</span>
                        <div style="margin-top: 16px; font-weight: 600;">${message}</div>
                        <button class="btn btn-primary btn-sm" onclick="loadApprovals()" style="margin-top: 16px;">
                            <span class="material-symbols-rounded">refresh</span>
                            Riprova
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

function showLoading(title, message) {
    const modal = document.getElementById('modal-loading');
    if (modal) {
        document.getElementById('loading-title').textContent = title || 'Caricamento...';
        document.getElementById('loading-message').textContent = message || 'Attendere prego';
        modal.style.display = 'flex';
    }
}

function hideLoading() {
    const modal = document.getElementById('modal-loading');
    if (modal) modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function getNomeMese(numeroMese) {
    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    return mesi[numeroMese - 1] || 'Mese non valido';
}

// ============================================
// STEP 6: MODIFICA VEICOLO CON STORICO ASSEGNAZIONI
// ============================================

// Funzione principale per modificare un veicolo
async function editVehicle(id) {
    console.log('✏️ Modifica veicolo ID:', id);
    
    try {
        showLoading('Caricamento', 'Recupero dati veicolo...');
        
        const supabase = getSupabaseClient();
        
        // Carica i dati del veicolo
        const { data: vehicle, error } = await supabase
            .from('veicoli')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        if (!vehicle) throw new Error('Veicolo non trovato');
        
        hideLoading();
        
        // Salva i dati originali per confronto
        window.currentEditingVehicle = {
            id: vehicle.id,
            targa: vehicle.targa,
            modello: vehicle.modello || '',
            tecnico: vehicle.tecnico_assegnato || '',
            data: vehicle.data_assegnazione || '',
            km: vehicle.km_totali_iniziali || 0,
            note: vehicle.note || '',
            attivo: vehicle.attivo
        };
        
        // Apri modale di modifica
        showEditVehicleModal(window.currentEditingVehicle);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore caricamento veicolo:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// Mostra modale di modifica
// Variabili globali per protezione doppi salvataggi
let activeSaveOperation = null;
let lastSavePerVehicle = {}; // mappa veicoloId -> timestamp ultimo salvataggio

function showEditVehicleModal(vehicle) {
    console.log('🚗 Apertura modale modifica:', vehicle);
    
    // Rimuovi eventuali modali precedenti
    const oldModal = document.getElementById('modal-edit-vehicle');
    if (oldModal) oldModal.remove();
    
    // Opzioni motivo
    const motivoOptions = [
        'Dimissioni', 'Malattia', 'Ferie lunghe', 'Cambio turno',
        'Nuovo assegnato', 'Sostituzione temporanea', 'Promozione',
        'Trasferimento', 'Altro'
    ];
    const optionsHtml = motivoOptions.map(opt => 
        `<option value="${opt}">${opt}</option>`
    ).join('');
    
    const modalHtml = `
        <div id="modal-edit-vehicle" class="modal" style="display: flex !important; z-index: 10000 !important;">
            <div class="modal-content" style="max-width: 500px; background: white; border-radius: 8px;">
                <div class="modal-header" style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0;">
                        <span class="material-symbols-rounded">edit</span>
                        Modifica Veicolo
                    </h3>
                    <button class="btn-icon-small" onclick="closeEditVehicleModal()">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 16px;">
                    <!-- Targa (sola lettura) -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-targa">Targa</label>
                        <input type="text" id="edit-targa" class="form-control" 
                               value="${vehicle.targa}" readonly disabled
                               style="width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <small style="color: #64748b;">La targa non può essere modificata</small>
                    </div>
                    
                    <!-- Modello -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-modello">Modello</label>
                        <input type="text" id="edit-modello" class="form-control" 
                               value="${vehicle.modello}" placeholder="Fiat Doblo, Ford Transit..."
                               style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </div>
                    
                    <!-- Tecnico -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-tecnico">Tecnico Assegnato *</label>
                        <input type="text" id="edit-tecnico" class="form-control" 
                               value="${vehicle.tecnico}" placeholder="Nome e cognome"
                               style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <small id="tec-change-warning" style="color: #3b82f6; display: none; margin-top: 4px;">
                            ⚠️ Hai modificato il tecnico. Inserisci i dettagli del cambio qui sotto.
                        </small>
                    </div>
                    
                    <!-- Campi aggiuntivi per cambio tecnico (nascosti inizialmente) -->
                    <div id="cambio-tecnico-fields" style="display: none; margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 16px;">Dettagli cambio tecnico</h4>
                        
                        <!-- Km -->
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="edit-km-cambio" style="display: block; margin-bottom: 8px; font-weight: 600; color: #475569;">
                                Km al momento del cambio <span style="color: #ef4444;">*</span>
                            </label>
                            <div style="position: relative;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">speed</span>
                                <input type="number" id="edit-km-cambio" class="form-control" 
                                       placeholder="Inserisci i km attuali" min="0" step="1" required
                                       style="width: 100%; padding: 12px 12px 12px 44px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px;">
                            </div>
                            <small id="edit-km-error" style="color: #ef4444; display: none; margin-top: 4px;">
                                Campo obbligatorio - inserisci i km
                            </small>
                        </div>
                        
                        <!-- Motivo -->
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="edit-motivo-select" style="display: block; margin-bottom: 8px; font-weight: 600; color: #475569;">
                                Motivo del cambio (opzionale)
                            </label>
                            <select id="edit-motivo-select" class="form-control" 
                                    style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; font-size: 15px;">
                                <option value="">Seleziona un motivo...</option>
                                ${optionsHtml}
                            </select>
                            
                            <div id="edit-altro-container" style="display: none;">
                                <input type="text" id="edit-motivo-altro" class="form-control" 
                                       placeholder="Specifica il motivo" 
                                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 15px;">
                            </div>
                        </div>
                        
                        <div style="background: #eff6ff; border-radius: 8px; padding: 12px; font-size: 13px; color: #1e40af; display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">info</span>
                            <span>Questo cambio verrà registrato nello storico del veicolo</span>
                        </div>
                    </div>
                    
                    <!-- Data Assegnazione -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-data">Data Assegnazione</label>
                        <input type="date" id="edit-data" class="form-control" 
                               value="${vehicle.data}"
                               style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    </div>
                    
                    <!-- Km Iniziali (sola lettura) -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-km">Km Iniziali</label>
                        <input type="text" id="edit-km" class="form-control" 
                               value="${vehicle.km} km" readonly disabled
                               style="width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <small style="color: #64748b;">I km iniziali non possono essere modificati</small>
                    </div>
                    
                    <!-- Note -->
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-note">Note</label>
                        <textarea id="edit-note" class="form-control" rows="3" 
                                  placeholder="Eventuali note..."
                                  style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">${vehicle.note}</textarea>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px; border-top: 1px solid #e2e8f0; text-align: right;">
                    <button class="btn btn-secondary" onclick="closeEditVehicleModal()" style="padding: 8px 16px; margin-right: 8px;">
                        Annulla
                    </button>
                    <button class="btn btn-primary" id="save-vehicle-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px;">
                        <span class="material-symbols-rounded">save</span>
                        Salva Modifiche
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Assegna l'event handler al pulsante di salvataggio (assicura un solo listener)
    document.getElementById('save-vehicle-btn').onclick = function(e) {
        e.preventDefault();
        saveVehicleChanges(this);
    };
    
    // Mostra/nascondi campi cambio tecnico in base alla modifica del campo tecnico
    const tecInput = document.getElementById('edit-tecnico');
    const cambioFields = document.getElementById('cambio-tecnico-fields');
    const warning = document.getElementById('tec-change-warning');
    
    if (tecInput && cambioFields && warning) {
        tecInput.addEventListener('input', function() {
            const newTec = this.value.trim();
            const oldTec = vehicle.tecnico;
            if (newTec !== oldTec) {
                cambioFields.style.display = 'block';
                warning.style.display = 'block';
            } else {
                cambioFields.style.display = 'none';
                warning.style.display = 'none';
                // Reset campi
                document.getElementById('edit-km-cambio').value = '';
                document.getElementById('edit-motivo-select').value = '';
                document.getElementById('edit-altro-container').style.display = 'none';
                document.getElementById('edit-motivo-altro').value = '';
            }
        });
    }
    
    // Gestione motivo "Altro"
    const select = document.getElementById('edit-motivo-select');
    const altroContainer = document.getElementById('edit-altro-container');
    const altroInput = document.getElementById('edit-motivo-altro');
    if (select && altroContainer) {
        select.addEventListener('change', function() {
            if (this.value === 'Altro') {
                altroContainer.style.display = 'block';
                setTimeout(() => altroInput?.focus(), 100);
            } else {
                altroContainer.style.display = 'none';
                if (altroInput) altroInput.value = '';
            }
        });
    }
}

async function saveVehicleChanges(button) {
    const vehicleId = window.currentEditingVehicle?.id;
    if (!vehicleId) {
        showNotification('Errore: dati veicolo non trovati', 'error');
        return;
    }
    
    const now = Date.now();
    const operationId = vehicleId + '-' + now + '-' + Math.random().toString(36).substr(2, 5);
    
    // Controllo se c'è già un'operazione attiva (per qualsiasi veicolo)
    if (activeSaveOperation) {
        console.log('⏳ Salvataggio già in corso, operazione ignorata', operationId, 'attiva:', activeSaveOperation);
        showNotification('Salvataggio già in corso, attendere', 'warning');
        return;
    }
    
    // Controllo cooldown per questo specifico veicolo (3 secondi)
    const lastSave = lastSavePerVehicle[vehicleId] || 0;
    if (now - lastSave < 3000) {
        console.log('⏳ Ultimo salvataggio per questo veicolo troppo recente, attendere');
        showNotification('Hai appena salvato, attendere qualche secondo', 'warning');
        return;
    }
    
    // Imposta lock
    activeSaveOperation = operationId;
    lastSavePerVehicle[vehicleId] = now;
    
    // Disabilita pulsante
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
    }
    
    console.log('💾 saveVehicleChanges() iniziata', new Date().toISOString(), 'op:', operationId);
    
    try {
        // Raccogli dati
        const modello = document.getElementById('edit-modello')?.value.trim();
        const nuovoTecnico = document.getElementById('edit-tecnico')?.value.trim();
        const nuovaData = document.getElementById('edit-data')?.value;
        const nuoveNote = document.getElementById('edit-note')?.value.trim();
        
        if (!nuovoTecnico) {
            showNotification('Il tecnico è obbligatorio', 'error');
            return;
        }
        
        const oldVehicle = window.currentEditingVehicle;
        if (!oldVehicle) {
            showNotification('Errore: dati veicolo non trovati', 'error');
            return;
        }
        
        const updates = {
            modello: modello || null,
            tecnico_assegnato: nuovoTecnico,
            data_assegnazione: nuovaData,
            note: nuoveNote || null
        };
        
        showLoading('Salvataggio', 'Aggiornamento veicolo...');
        
        const supabase = getSupabaseClient();
        
        // Aggiorna veicolo
        const { error: updateError } = await supabase
            .from('veicoli')
            .update(updates)
            .eq('id', oldVehicle.id);
        
        if (updateError) throw updateError;
        
        const isTechnicianChanged = (nuovoTecnico !== oldVehicle.tecnico);
        
        if (isTechnicianChanged) {
            console.log('🔄 Rilevato cambio tecnico');
            
            // Raccogli dati cambio
            const kmCambio = parseInt(document.getElementById('edit-km-cambio')?.value);
            const motivoSelect = document.getElementById('edit-motivo-select')?.value;
            const motivoAltro = document.getElementById('edit-motivo-altro')?.value;
            
            if (!kmCambio || kmCambio <= 0) {
                hideLoading();
                showNotification('Inserisci i km al momento del cambio', 'error');
                return;
            }
            
            let motivo = motivoSelect;
            if (motivo === 'Altro' && motivoAltro) {
                motivo = motivoAltro;
            } else if (motivo === 'Altro') {
                motivo = 'Altro (non specificato)';
            } else if (motivo === '') {
                motivo = null;
            }
            
            // Inserisci storico
            const { error: historyError } = await supabase
                .from('storico_assegnazioni')
                .insert([{
                    veicolo_id: oldVehicle.id,
                    tecnico_precedente: oldVehicle.tecnico,
                    tecnico_nuovo: nuovoTecnico,
                    data_cambio: new Date().toISOString(),
                    km_al_cambio: kmCambio,
                    motivo: motivo
                }]);
            
            if (historyError) {
                console.error('❌ Errore inserimento storico:', historyError);
                showNotification('Veicolo aggiornato ma errore nello storico', 'warning');
            } else {
                console.log('✅ Storico cambio tecnico registrato');
            }
        }
        
        hideLoading();
        closeEditVehicleModal();
        showNotification('✅ Veicolo aggiornato con successo!', 'success');
        
        // Ricarica dati
        await loadVehicles();
        await loadVehicleStats();
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore modifica veicolo:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    } finally {
        // Rilascia il lock solo se è l'operazione corrente
        if (activeSaveOperation === operationId) {
            activeSaveOperation = null;
        }
        if (button) {
            button.disabled = false;
            button.style.opacity = '1';
        }
    }
}




// Chiudi modale modifica
function closeEditVehicleModal() {
    const modal = document.getElementById('modal-edit-vehicle');
    if (modal) modal.remove();
    window.currentEditingVehicle = null;
}

// ============================================
// DIALOG CAMBIO TECNICO - VERSIONE CORRETTA
// ============================================

let pendingTechnicianChange = {
    veicoloId: null,
    oldTecnico: null,
    newTecnico: null,
    processed: false
};
let isDialogOpen = false;

function showChangeTechnicianDialog(oldTecnico, newTecnico) {
    console.log('📋 Apertura dialog cambio tecnico');
    
    // Se un dialog è già aperto, non aprirne un altro
    if (isDialogOpen) {
        console.log('⚠️ Dialog già aperto, ignoro');
        return Promise.reject('Dialog già aperto');
    }
    
    isDialogOpen = true;
    
    return new Promise((resolve) => {
        const dialogId = 'tech-change-dialog-' + Date.now();
        
        // Opzioni motivo predefinite
        const motivoOptions = [
            'Dimissioni',
            'Malattia',
            'Ferie lunghe',
            'Cambio turno',
            'Nuovo assegnato',
            'Sostituzione temporanea',
            'Promozione',
            'Trasferimento',
            'Altro'
        ];
        
        const optionsHtml = motivoOptions.map(opt => 
            `<option value="${opt}">${opt}</option>`
        ).join('');
        
        const dialogHtml = `
            <div id="${dialogId}" class="modal" style="display: flex !important; z-index: 10001 !important;">
                <div class="modal-content" style="max-width: 450px; background: white; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
                    
                    <!-- HEADER -->
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                        <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded" style="font-size: 24px;">swap_horiz</span>
                            Cambio Tecnico
                        </h3>
                        <button class="btn-icon-small" onclick="closeTechChangeDialog('${dialogId}')" style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; padding: 4px;">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    
                    <!-- BODY -->
                    <div class="modal-body" style="padding: 24px;">
                        <!-- Info cambio -->
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span class="material-symbols-rounded" style="color: #ef4444; background: #fee2e2; padding: 8px; border-radius: 50%;">person_remove</span>
                                    <div>
                                        <div style="font-size: 12px; color: #64748b;">Tecnico precedente</div>
                                        <div style="font-weight: 700; color: #1e293b;">${oldTecnico}</div>
                                    </div>
                                </div>
                                <span class="material-symbols-rounded" style="color: #3b82f6;">arrow_forward</span>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span class="material-symbols-rounded" style="color: #10b981; background: #d1fae5; padding: 8px; border-radius: 50%;">person_add</span>
                                    <div>
                                        <div style="font-size: 12px; color: #64748b;">Nuovo tecnico</div>
                                        <div style="font-weight: 700; color: #1e293b;">${newTecnico}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Campo Km (obbligatorio) -->
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="km-cambio-${dialogId}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #475569;">
                                Km al momento del cambio <span style="color: #ef4444;">*</span>
                            </label>
                            <div style="position: relative;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">speed</span>
                                <input type="number" id="km-cambio-${dialogId}" class="form-control" 
                                       placeholder="Inserisci i km attuali" min="0" step="1" required
                                       style="width: 100%; padding: 12px 12px 12px 44px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.2s;">
                            </div>
                            <small id="km-error-${dialogId}" style="color: #ef4444; display: none; margin-top: 4px;">
                                ⚠️ Campo obbligatorio - inserisci i km
                            </small>
                        </div>
                        
                        <!-- Campo Motivo (opzionale) -->
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="motivo-select-${dialogId}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #475569;">
                                Motivo del cambio (opzionale)
                            </label>
                            <select id="motivo-select-${dialogId}" class="form-control" 
                                    style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; font-size: 15px;">
                                <option value="">Seleziona un motivo...</option>
                                ${optionsHtml}
                            </select>
                            
                            <div id="altro-container-${dialogId}" style="display: none;">
                                <input type="text" id="motivo-altro-${dialogId}" class="form-control" 
                                       placeholder="Specifica il motivo" 
                                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 15px;">
                            </div>
                        </div>
                        
                        <!-- Nota informativa -->
                        <div style="background: #eff6ff; border-radius: 8px; padding: 12px; font-size: 13px; color: #1e40af; display: flex; align-items: center; gap: 8px; margin-top: 16px;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">info</span>
                            <span>Questo cambio verrà registrato nello storico del veicolo</span>
                        </div>
                    </div>
                    
                    <!-- FOOTER -->
                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                        <button class="btn btn-secondary" onclick="closeTechChangeDialog('${dialogId}')" 
                                style="padding: 10px 20px; border: 1px solid #cbd5e1; background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Annulla
                        </button>
                        <button class="btn btn-primary" onclick="confirmTechnicianChange('${dialogId}')" 
                                style="padding: 10px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded">check</span>
                            Conferma Cambio
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi il dialog al DOM
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        
        // ========================================
        // GESTIONE EVENTI
        // ========================================
        
        // Setup listener per motivo "Altro"
        const select = document.getElementById(`motivo-select-${dialogId}`);
        const altroContainer = document.getElementById(`altro-container-${dialogId}`);
        const altroInput = document.getElementById(`motivo-altro-${dialogId}`);
        
        if (select && altroContainer) {
            select.addEventListener('change', function() {
                if (this.value === 'Altro') {
                    altroContainer.style.display = 'block';
                    setTimeout(() => altroInput?.focus(), 100);
                } else {
                    altroContainer.style.display = 'none';
                    if (altroInput) altroInput.value = '';
                }
            });
        }
        
        // Focus sul campo km
        setTimeout(() => {
            document.getElementById(`km-cambio-${dialogId}`)?.focus();
        }, 200);
        
        // ========================================
        // FUNZIONI DI CHIUSURA
        // ========================================
        
        // Funzione per chiudere il dialog (da chiamare sia da Annulla che da Conferma)
        window.closeTechChangeDialog = function(id) {
            const dialog = document.getElementById(id);
            if (dialog) {
                dialog.style.opacity = '0';
                setTimeout(() => {
                    dialog.remove();
                    isDialogOpen = false;
                }, 200);
            }
            resolve(null);
        };
        
        // Funzione per confermare il cambio
        window.confirmTechnicianChange = function(id) {
            const kmInput = document.getElementById(`km-cambio-${id}`);
            const km = parseInt(kmInput?.value);
            const kmError = document.getElementById(`km-error-${id}`);
            
            // Validazione km obbligatorio
            if (!km || km <= 0) {
                if (kmError) {
                    kmError.style.display = 'block';
                    kmInput.style.borderColor = '#ef4444';
                }
                return;
            }
            
            // Raccogli motivo
            const select = document.getElementById(`motivo-select-${id}`);
            const altro = document.getElementById(`motivo-altro-${id}`);
            let motivo = select?.value || '';
            
            if (motivo === 'Altro' && altro?.value) {
                motivo = altro.value;
            } else if (motivo === 'Altro') {
                motivo = 'Altro (non specificato)';
            } else if (motivo === '') {
                motivo = null;
            }
            
            // Chiudi dialog
            const dialog = document.getElementById(id);
            if (dialog) {
                dialog.style.opacity = '0';
                setTimeout(() => {
                    dialog.remove();
                    isDialogOpen = false;
                }, 200);
            }
            
            // Resolve con i dati
            resolve({
                km: km,
                motivo: motivo
            });
        };
        
        // Gestisci chiusura con ESC
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                closeTechChangeDialog(dialogId);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Cleanup listener quando il dialog viene rimosso
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.removedNodes.forEach(function(node) {
                    if (node.id === dialogId) {
                        document.removeEventListener('keydown', escHandler);
                        observer.disconnect();
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
    });
}

// ============================================
// SALVATAGGIO MODIFICHE VEICOLO (FIX DOPPIO RECORD)
// ============================================



// ============================================
// NUOVA FUNZIONE STORICO VEICOLO
// ============================================

async function viewVehicleHistory(vehicleId) {
    console.log('📜 Caricamento storico per veicolo ID:', vehicleId);
    try {
        showLoading('Caricamento storico', 'Recupero dati...');
        const supabase = getSupabaseClient();

        // Carica dettagli veicolo
        const { data: vehicle, error: vErr } = await supabase
            .from('veicoli')
            .select('targa, modello')
            .eq('id', vehicleId)
            .single();
        if (vErr) throw vErr;

        // Carica storico assegnazioni (TUTTI i record, grezzi)
        const { data: rawHistory, error: hErr } = await supabase
            .from('storico_assegnazioni')
            .select('*')
            .eq('veicolo_id', vehicleId)
            .order('data_cambio', { ascending: false });
        if (hErr) throw hErr;

        // RAGGRUPPA i record in eventi di cambio
        const groupedHistory = groupTechnicianChanges(rawHistory || []);

        hideLoading();
        showHistoryModal(vehicle, groupedHistory, rawHistory.length);
    } catch (error) {
        hideLoading();
        console.error('❌ Errore caricamento storico:', error);
        showNotification(`Errore: ${error.message}`, 'error');
    }
}

// Funzione per raggruppare i record grezzi in eventi di cambio
function groupTechnicianChanges(rawRecords) {
    if (!rawRecords.length) return [];
    
    const grouped = [];
    const used = new Set(); // Per tenere traccia dei record già processati
    
    // Ordina dal più recente al più vecchio
    const sorted = [...rawRecords].sort((a, b) => 
        new Date(b.data_cambio) - new Date(a.data_cambio)
    );
    
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        
        // Se questo record è già stato usato, salta
        if (used.has(current.id)) continue;
        
        // Cerca un record "complementare" con stesso veicolo e stessi tecnici
        // ma con km > 0 (se current ha km 0) oppure con km 0 (se current ha km > 0)
        const complement = sorted.find(r => 
            r.id !== current.id &&
            !used.has(r.id) &&
            r.veicolo_id === current.veicolo_id &&
            r.tecnico_precedente === current.tecnico_precedente &&
            r.tecnico_nuovo === current.tecnico_nuovo &&
            Math.abs(new Date(r.data_cambio) - new Date(current.data_cambio)) < 60000 // entro 60 secondi
        );
        
        if (complement) {
            // Abbiamo una coppia: current e complement
            const recordConKm = current.km_al_cambio > 0 ? current : complement;
            const recordSenzaKm = current.km_al_cambio === 0 ? current : complement;
            
            grouped.push({
                id: `group_${recordConKm.id}_${recordSenzaKm.id}`,
                veicolo_id: current.veicolo_id,
                tecnico_precedente: current.tecnico_precedente,
                tecnico_nuovo: current.tecnico_nuovo,
                data_inizio_cambio: recordSenzaKm.data_cambio, // quando è iniziato
                data_completamento_cambio: recordConKm.data_cambio, // quando è stato completato
                km_al_cambio: recordConKm.km_al_cambio,
                motivo: recordConKm.motivo,
                tempo_completamento_ms: new Date(recordConKm.data_cambio) - new Date(recordSenzaKm.data_cambio),
                record_ids: [recordSenzaKm.id, recordConKm.id]
            });
            
            used.add(current.id);
            used.add(complement.id);
        } else {
            // Record singolo (senza complemento)
            grouped.push({
                id: `single_${current.id}`,
                veicolo_id: current.veicolo_id,
                tecnico_precedente: current.tecnico_precedente,
                tecnico_nuovo: current.tecnico_nuovo,
                data_inizio_cambio: current.data_cambio,
                data_completamento_cambio: current.km_al_cambio > 0 ? current.data_cambio : null,
                km_al_cambio: current.km_al_cambio || null,
                motivo: current.motivo,
                tempo_completamento_ms: null,
                record_ids: [current.id],
                incompleto: current.km_al_cambio === 0
            });
            
            used.add(current.id);
        }
    }
    
    // Ordina i gruppi per data di inizio cambio (dal più recente)
    return grouped.sort((a, b) => 
        new Date(b.data_inizio_cambio) - new Date(a.data_inizio_cambio)
    );
}


function showHistoryModal(vehicle, groupedHistory, rawCount) {
    // Rimuovi modali precedenti
    const old = document.getElementById('modal-history');
    if (old) old.remove();

    const stats = calculateHistoryStats(groupedHistory);

    const modalHtml = `
        <div id="modal-history" class="modal" style="display: flex; z-index: 10000;">
            <div class="modal-content" style="max-width: 900px; background: white; border-radius: 12px;">
                <div class="modal-header" style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin:0;">
                        <span class="material-symbols-rounded">history</span>
                        Storico Cambi - ${vehicle.targa} (${vehicle.modello || 'n.d.'})
                    </h3>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span class="badge badge-info" title="Record grezzi nel DB">${rawCount} record</span>
                        <button class="btn-icon-small" onclick="document.getElementById('modal-history').remove()">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </div>
                <div class="modal-body" style="padding: 16px;">
                    <!-- Tabs -->
                    <div style="display: flex; gap: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;">
                        <button class="tab-btn active" onclick="switchHistoryTab('timeline')">📋 Timeline (${groupedHistory.length} cambi)</button>
                        <button class="tab-btn" onclick="switchHistoryTab('stats')">📊 Statistiche</button>
                    </div>
                    <!-- Timeline Tab -->
                    <div id="history-timeline" class="history-tab">
                        ${buildTimelineTable(groupedHistory)}
                    </div>
                    <!-- Stats Tab (inizialmente nascosto) -->
                    <div id="history-stats" class="history-tab" style="display: none;">
                        ${buildStatsView(stats, groupedHistory)}
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #64748b; font-size: 12px;">
                        <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">info</span>
                        I cambi con km 0 sono in attesa di completamento
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="exportGroupedHistoryCSV(${JSON.stringify(groupedHistory).replace(/"/g, '&quot;')}, '${vehicle.targa}')">
                            <span class="material-symbols-rounded">download</span> Esporta CSV
                        </button>
                        <button class="btn btn-primary" onclick="document.getElementById('modal-history').remove()">Chiudi</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function exportGroupedHistoryCSV(groupedHistory, targa) {
    if (!groupedHistory.length) {
        alert('Nessun dato da esportare');
        return;
    }
    
    const headers = ['Data inizio', 'Data completamento', 'Tecnico precedente', 'Tecnico nuovo', 'Km al cambio', 'Motivo', 'Tempo completamento (s)', 'Stato'];
    
    const rows = groupedHistory.map(c => {
        const tempoSec = c.tempo_completamento_ms ? Math.round(c.tempo_completamento_ms / 1000) : '';
        return [
            new Date(c.data_inizio_cambio).toLocaleString('it-IT'),
            c.data_completamento_cambio ? new Date(c.data_completamento_cambio).toLocaleString('it-IT') : '',
            c.tecnico_precedente || '',
            c.tecnico_nuovo,
            c.km_al_cambio || '',
            c.motivo || '',
            tempoSec,
            c.incompleto ? 'In attesa' : 'Completato'
        ];
    });
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `storico_${targa}_raggruppato.csv`;
    link.click();
}



function switchHistoryTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.history-tab').forEach(t => t.style.display = 'none');
    if (tab === 'timeline') {
        document.querySelector('[onclick="switchHistoryTab(\'timeline\')"]').classList.add('active');
        document.getElementById('history-timeline').style.display = 'block';
    } else {
        document.querySelector('[onclick="switchHistoryTab(\'stats\')"]').classList.add('active');
        document.getElementById('history-stats').style.display = 'block';
    }
}

function buildTimelineTable(groupedHistory) {
    if (!groupedHistory.length) {
        return '<p class="text-center">Nessun cambio registrato</p>';
    }
    
    let rows = '';
    for (let i = 0; i < groupedHistory.length; i++) {
        const cambio = groupedHistory[i];
        
        // Formatta date
        const dataInizio = new Date(cambio.data_inizio_cambio).toLocaleString('it-IT');
        const dataCompletamento = cambio.data_completamento_cambio 
            ? new Date(cambio.data_completamento_cambio).toLocaleString('it-IT')
            : '—';
        
        // Calcola tempo impiegato
        let tempoImp = '';
        if (cambio.tempo_completamento_ms) {
            const secondi = Math.round(cambio.tempo_completamento_ms / 1000);
            if (secondi < 60) {
                tempoImp = ` (completato in ${secondi}s)`;
            } else {
                const minuti = Math.floor(secondi / 60);
                const secRestanti = secondi % 60;
                tempoImp = ` (completato in ${minuti}m ${secRestanti}s)`;
            }
        }
        
        // Icona per cambi incompleti
        const incompleteBadge = cambio.incompleto 
            ? '<span class="badge badge-warning" style="margin-left: 8px;" title="Cambio in attesa di km">⏳ In attesa</span>' 
            : '';
        
        // Km formattati
        const kmText = cambio.km_al_cambio 
            ? `${cambio.km_al_cambio.toLocaleString()} km` 
            : '<span style="color: #f59e0b;">Da inserire</span>';
        
        rows += `
            <tr>
                <td>
                    <div>
                        <strong>${dataInizio}</strong>
                        ${cambio.data_completamento_cambio ? `` : ''}
                        
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="badge badge-secondary">${cambio.tecnico_precedente || '-'}</span>
                        <span class="material-symbols-rounded" style="font-size: 16px;">arrow_forward</span>
                        <span class="badge badge-primary">${cambio.tecnico_nuovo}</span>
                        ${incompleteBadge}
                    </div>
                </td>
                <td>${kmText}</td>
                <td>${cambio.motivo || '-'}</td>
            </tr>
        `;
    }
    
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Data cambio</th>
                    <th>Tecnico</th>
                    <th>Km al cambio</th>
                    <th>Motivo</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}
function calculateHistoryStats(groupedHistory) {
    if (groupedHistory.length === 0) {
        return { 
            totalChanges: 0, 
            totalKm: 0, 
            longestDriver: null, 
            maxDays: 0,
            incompleteChanges: 0,
            avgCompletionTime: null
        };
    }
    
    // Filtra solo i cambi completati (con km > 0)
    const completati = groupedHistory.filter(c => c.km_al_cambio > 0);
    const incompleti = groupedHistory.filter(c => c.incompleto);
    
    if (completati.length === 0) {
        return {
            totalChanges: groupedHistory.length,
            completedChanges: 0,
            incompleteChanges: incompleti.length,
            totalKm: 0,
            longestDriver: null,
            maxDays: 0,
            avgCompletionTime: null
        };
    }
    
    // Ordina per data (dal più vecchio al più recente) per calcoli corretti
    const ordinati = [...completati].sort((a, b) => 
        new Date(a.data_inizio_cambio) - new Date(b.data_inizio_cambio)
    );
    
    const primo = ordinati[0];
    const ultimo = ordinati[ordinati.length - 1];
    
    // Km totali percorsi (dal primo km registrato all'ultimo)
    const totalKm = ultimo.km_al_cambio - primo.km_al_cambio;
    
    // Calcola i giorni per ogni tecnico
    const driverDays = {};
    
    // Aggiungi periodi tra cambi completati
    for (let i = 0; i < ordinati.length - 1; i++) {
        const curr = ordinati[i];
        const next = ordinati[i + 1];
        
        // Il tecnico "nuovo" del cambio corrente ha guidato fino al cambio successivo
        const giorni = Math.round((new Date(next.data_inizio_cambio) - new Date(curr.data_completamento_cambio)) / (1000 * 60 * 60 * 24));
        if (giorni > 0) {
            driverDays[curr.tecnico_nuovo] = (driverDays[curr.tecnico_nuovo] || 0) + giorni;
        }
    }
    
    // Aggiungi periodo dall'ultimo cambio a oggi (se l'ultimo è completato)
    if (ultimo && ultimo.km_al_cambio > 0) {
        const giorniUltimo = Math.round((new Date() - new Date(ultimo.data_completamento_cambio)) / (1000 * 60 * 60 * 24));
        if (giorniUltimo > 0) {
            driverDays[ultimo.tecnico_nuovo] = (driverDays[ultimo.tecnico_nuovo] || 0) + giorniUltimo;
        }
    }
    
    // Trova il tecnico con più giorni
    let longestDriver = null;
    let maxDays = 0;
    for (const [tech, days] of Object.entries(driverDays)) {
        if (days > maxDays) {
            maxDays = days;
            longestDriver = tech;
        }
    }
    
    // Tempo medio di completamento (solo per cambi che hanno entrambi i record)
    const conTempo = completati.filter(c => c.tempo_completamento_ms !== null);
    let avgCompletionTime = null;
    if (conTempo.length > 0) {
        const avgMs = conTempo.reduce((sum, c) => sum + c.tempo_completamento_ms, 0) / conTempo.length;
        const secondi = Math.round(avgMs / 1000);
        if (secondi < 60) {
            avgCompletionTime = `${secondi} secondi`;
        } else {
            const minuti = Math.floor(secondi / 60);
            const secRestanti = secondi % 60;
            avgCompletionTime = `${minuti} minuti e ${secRestanti} secondi`;
        }
    }
    
    return {
        totalChanges: groupedHistory.length,
        completedChanges: completati.length,
        incompleteChanges: incompleti.length,
        totalKm: totalKm,
        longestDriver: longestDriver,
        maxDays: maxDays,
        avgCompletionTime: avgCompletionTime
    };
}

function buildStatsView(stats, groupedHistory) {
    if (groupedHistory.length === 0) {
        return '<p class="text-center">Nessun dato statistico disponibile</p>';
    }
    
    const completati = groupedHistory.filter(c => c.km_al_cambio > 0);
    const incompleti = groupedHistory.filter(c => c.incompleto);
    
    // Costruisci dettaglio periodi per cambi completati
    let periodsHtml = '';
    if (completati.length > 0) {
        const ordinati = [...completati].sort((a, b) => 
            new Date(a.data_inizio_cambio) - new Date(b.data_inizio_cambio)
        );
        
        for (let i = 0; i < ordinati.length - 1; i++) {
            const curr = ordinati[i];
            const next = ordinati[i + 1];
            
            const dataInizio = new Date(curr.data_completamento_cambio).toLocaleDateString();
            const dataFine = new Date(next.data_inizio_cambio).toLocaleDateString();
            const giorni = Math.round((new Date(next.data_inizio_cambio) - new Date(curr.data_completamento_cambio)) / (1000 * 60 * 60 * 24));
            
            periodsHtml += `
                <li>
                    <strong>${curr.tecnico_nuovo}</strong> ha guidato per <strong>${giorni}</strong> giorni 
                    (dal ${dataInizio} al ${dataFine})
                </li>
            `;
        }
        
        // Ultimo periodo
        const ultimo = ordinati[ordinati.length - 1];
        const giorniUltimo = Math.round((new Date() - new Date(ultimo.data_completamento_cambio)) / (1000 * 60 * 60 * 24));
        if (giorniUltimo > 0) {
            periodsHtml += `
                <li>
                    <strong>${ultimo.tecnico_nuovo}</strong> sta guidando da <strong>${giorniUltimo}</strong> giorni 
                    (dal ${new Date(ultimo.data_completamento_cambio).toLocaleDateString()} ad oggi)
                </li>
            `;
        }
    }
    
    // Lista cambi incompleti
    let incompleteHtml = '';
    if (incompleti.length > 0) {
        incompleteHtml = `
            <div style="margin-top: 16px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <h5 style="margin: 0 0 8px 0; color: #856404;">⏳ Cambi in attesa di completamento:</h5>
                <ul style="margin: 0; padding-left: 20px;">
                    ${incompleti.map(c => `
                        <li>
                            ${c.tecnico_precedente || '-'} → ${c.tecnico_nuovo} 
                            (dal ${new Date(c.data_inizio_cambio).toLocaleDateString()})
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    return `
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 12px; color: #64748b;">TOTALE CAMBI</div>
                    <div style="font-size: 24px; font-weight: 700;">${stats.totalChanges}</div>
                    <div style="font-size: 12px; color: #10b981;">${stats.completedChanges} completati</div>
                    <div style="font-size: 12px; color: #f59e0b;">${stats.incompleteChanges} in attesa</div>
                </div>
                
                <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 12px; color: #64748b;">KM TOTALI PERCORSI</div>
                    <div style="font-size: 24px; font-weight: 700;">${stats.totalKm.toLocaleString()} km</div>
                    <div style="font-size: 12px; color: #475569;">dal primo all'ultimo cambio</div>
                </div>
                
                <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 12px; color: #64748b;">TECNICO PIÙ PRESENTE</div>
                    <div style="font-size: 20px; font-weight: 700;">${stats.longestDriver || 'N/D'}</div>
                    <div style="font-size: 12px; color: #475569;">${stats.maxDays} giorni alla guida</div>
                </div>
                
                ${stats.avgCompletionTime ? `
                <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 12px; color: #64748b;">TEMPO MEDIO COMPLETAMENTO</div>
                    <div style="font-size: 18px; font-weight: 700;">${stats.avgCompletionTime}</div>
                    <div style="font-size: 12px; color: #475569;">da inizio a fine cambio</div>
                </div>
                ` : ''}
            </div>
            
            ${periodsHtml ? `
            <div style="margin-top: 20px;">
                <h4 style="margin: 0 0 10px 0;">Dettaglio periodi di guida:</h4>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                    ${periodsHtml}
                </ul>
            </div>
            ` : ''}
            
            ${incompleteHtml}
        </div>
    `;
}

function exportHistoryCSV(history, targa) {
    if (!history.length) {
        alert('Nessun dato da esportare');
        return;
    }
    const headers = ['Data cambio', 'Tecnico precedente', 'Tecnico nuovo', 'Km al cambio', 'Motivo'];
    const rows = history.map(h => [
        new Date(h.data_cambio).toLocaleString('it-IT'),
        h.tecnico_precedente,
        h.tecnico_nuovo,
        h.km_al_cambio,
        h.motivo || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM per Excel
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `storico_${targa}.csv`;
    link.click();
}

// Esposizione globale
window.closeEditVehicleModal = closeEditVehicleModal;
window.saveVehicleChanges = saveVehicleChanges;
window.showAddVehicleModal = showAddVehicleModal;
window.closeAddVehicleModal = closeAddVehicleModal;
window.saveNewVehicle = saveNewVehicle;
window.loadVehicles = loadVehicles;
window.toggleVehicleStatus = toggleVehicleStatus;
window.filterFleetTable = filterFleetTable;
window.switchVehicleView = switchVehicleView;
window.approveKilometers = approveKilometers;
window.rejectKilometers = rejectKilometers;
window.editVehicle = editVehicle;
window.viewVehicleHistory = viewVehicleHistory;
window.switchHistoryTab = switchHistoryTab;
window.exportHistoryCSV = exportHistoryCSV;
window.exportGroupedHistoryCSV = exportGroupedHistoryCSV;

console.log('✅ Admin Veicoli Manager caricato con successo (versione con storico e fix duplicati)');