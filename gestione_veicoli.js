// ================================
// GESTIONE VEICOLI - PARKAPP
// ================================

// VARIABILI GLOBALI
let veicoloCorrente = null;
let kilometriMensili = [];
let reminderList = [];
let meseCorrente = new Date().getMonth() + 1;
let annoCorrente = new Date().getFullYear();

// ================================
// INIZIALIZZAZIONE PAGINA
// ================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🔄 Inizializzazione pagina Gestione Veicoli...');
        
        // Mostra nome tecnico
        const tecnico = localStorage.getItem('tecnico_loggato') || 'Tecnico';
        document.getElementById('tecnico-veicoli').textContent = `Tecnico: ${tecnico}`;
        
        // Controlla configurazione DB
        const configInfo = getDbConfigInfo();
        const indicator = document.getElementById('db-status-indicator');
        
        if (configInfo.configured) {
            indicator.style.background = '#22c55e';
            indicator.title = `DB configurato • ${configInfo.urlShort || 'N/A'}`;
        } else {
            indicator.style.background = '#f59e0b';
            indicator.title = 'Database non configurato';
        }
        
        // Inizializza le tab
        inizializzaTabs();
        
        // Inizializza pulsanti fluttuanti
        inizializzaPulsantiFluttuanti();
        
        // Inizializza bottoni nelle sezioni
        document.getElementById('btn-nuovo-km')?.addEventListener('click', apriModaleKm);
        document.getElementById('btn-nuovo-reminder')?.addEventListener('click', apriModaleReminder);
        
        // Carica dati iniziali
        await caricaDatiIniziali();
        
        // Setup auto-refresh ogni 30 secondi
        setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await verificaAlert();
            }
        }, 30000);
        
        console.log('✅ Pagina inizializzata correttamente');
        
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
        mostraMessaggio('Errore inizializzazione pagina', 'error');
    }
});

// ================================
// FUNZIONI GESTIONE TAB
// ================================

function inizializzaTabs() {
    console.log('🔄 Inizializzo tab system...');
    
    const tabs = document.querySelectorAll('.veicoli-tab');
    
    // Aggiungi event listener a ogni tab
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            console.log(`📱 Tab cliccata: ${targetId}`);
            
            // Rimuovi classe active da tutte le tab
            tabs.forEach(t => t.classList.remove('active'));
            // Aggiungi classe active alla tab cliccata
            this.classList.add('active');
            
            // Nascondi tutte le sezioni
            ['dashboard-section', 'kilometri-section', 'reminder-section'].forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.style.display = 'none';
                }
            });
            
            // Mostra la sezione selezionata
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
                
                // Carica i dati specifici se necessario
                if (targetId === 'kilometri-section') {
                    console.log('📊 Carico lista kilometri...');
                    caricaListaKilometriCompleta();
                } else if (targetId === 'reminder-section') {
                    console.log('🔔 Carico lista reminder...');
                    caricaListaReminderCompleta();
                }
            }
            
            // Aggiorna il pulsante fluttuante
            aggiornaPulsanteFluttuante(targetId);
        });
    });
    
    console.log('✅ Tab system inizializzato');
}

function inizializzaPulsantiFluttuanti() {
    const btnAzione = document.getElementById('btn-azione-principale');
    if (!btnAzione) {
        console.warn('⚠️ Pulsante azione principale non trovato');
        return;
    }
    
    btnAzione.addEventListener('click', function() {
        const tabAttiva = document.querySelector('.veicoli-tab.active');
        if (!tabAttiva) {
            console.warn('⚠️ Nessuna tab attiva trovata');
            return;
        }
        
        const targetId = tabAttiva.getAttribute('data-target');
        console.log(`🎯 Pulsante cliccato, tab attiva: ${targetId}`);
        
        if (targetId === 'kilometri-section') {
            apriModaleKm();
        } else if (targetId === 'reminder-section') {
            apriModaleReminder();
        } else {
            apriModaleKm(); // Default per dashboard
        }
    });
    
    console.log('✅ Pulsanti fluttuanti inizializzati');
}

function aggiornaPulsanteFluttuante(targetId) {
    const btnAzione = document.getElementById('btn-azione-principale');
    if (!btnAzione) return;
    
    const icona = btnAzione.querySelector('.material-symbols-rounded');
    
    switch(targetId) {
        case 'kilometri-section':
            icona.textContent = 'add';
            console.log('🎯 Pulsante impostato per Kilometri');
            break;
        case 'reminder-section':
            icona.textContent = 'add_alert';
            console.log('🎯 Pulsante impostato per Reminder');
            break;
        default:
            icona.textContent = 'add';
            console.log('🎯 Pulsante impostato per default (Dashboard)');
    }
}

// ================================
// FUNZIONI CARICAMENTO DATI
// ================================

async function caricaDatiIniziali() {
    try {
        console.log('📥 Caricamento dati iniziali...');
        mostraLoading();
        
        // 1. Carica veicolo assegnato al tecnico
        await caricaVeicoloTecnico();
        
        // 2. Se c'è un veicolo, carica kilometri e statistiche
        if (veicoloCorrente) {
            console.log(`🚗 Veicolo trovato: ${veicoloCorrente.targa}`);
            await caricaKilometriVeicolo();
            await caricaStatistiche();
            await caricaReminder();
            await caricaUltimiInserimenti();
            await verificaAlert();
        } else {
            console.log('🚫 Nessun veicolo assegnato');
            mostraStatoVuoto();
        }
        
        nascondiLoading();
        console.log('✅ Dati iniziali caricati');
        
    } catch (error) {
        console.error('❌ Errore caricamento dati:', error);
        mostraMessaggio('Errore nel caricamento dei dati', 'error');
        nascondiLoading();
    }
}

async function caricaVeicoloTecnico() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const tecnico = localStorage.getItem('tecnico_loggato');
        if (!tecnico) throw new Error('Nessun tecnico loggato');
        
        console.log(`🔍 Cerco veicolo per tecnico: ${tecnico}`);
        
        const { data: veicoli, error } = await supabase
            .from('veicoli')
            .select('*')
            .ilike('tecnico_assegnato', `%${tecnico}%`)
            .eq('attivo', true)
            .limit(1);
        
        if (error) throw error;
        
        if (veicoli && veicoli.length > 0) {
            veicoloCorrente = veicoli[0];
            console.log(`✅ Veicolo trovato: ${veicoloCorrente.targa} - ${veicoloCorrente.modello}`);
            
            // Aggiorna il nome nel DB per farlo corrispondere esattamente
            if (veicoloCorrente.tecnico_assegnato !== tecnico) {
                await supabase
                    .from('veicoli')
                    .update({ tecnico_assegnato: tecnico })
                    .eq('id', veicoloCorrente.id);
                console.log('🔄 Nome tecnico normalizzato nel DB');
            }
            
            aggiornaUI_Veicolo();
        } else {
            veicoloCorrente = null;
            document.getElementById('veicolo-assegnato').innerHTML = `
                <div class="stato-vuoto">
                    <span class="material-symbols-rounded">directions_car_off</span>
                    <h3 style="color: var(--text-muted); margin: 1rem 0 0.5rem 0;">Nessun veicolo assegnato</h3>
                    <p>Contatta l'amministrazione per l'assegnazione di un veicolo aziendale.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento veicolo:', error);
        throw error;
    }
}

async function caricaKilometriVeicolo() {
    try {
        if (!veicoloCorrente) {
            console.log('🚫 Nessun veicolo, salto caricamento kilometri');
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        console.log(`📊 Caricamento kilometri per veicolo: ${veicoloCorrente.targa}`);
        
        const { data: km, error } = await supabase
            .from('kilometri_mensili')
            .select('*')
            .eq('veicolo_id', veicoloCorrente.id)
            .order('anno', { ascending: false })
            .order('mese', { ascending: false });
        
        if (error) throw error;
        
        kilometriMensili = km || [];
        console.log(`✅ Kilometri caricati: ${kilometriMensili.length} record`);
        
    } catch (error) {
        console.error('❌ Errore caricamento kilometri:', error);
        throw error;
    }
}

async function caricaStatistiche() {
    try {
        if (!veicoloCorrente) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        // Usa la vista statistiche_veicoli
        const { data: stats, error } = await supabase
            .from('statistiche_veicoli')
            .select('*')
            .eq('id', veicoloCorrente.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        
        aggiornaUI_Statistiche(stats);
        
    } catch (error) {
        console.error('❌ Errore caricamento statistiche:', error);
    }
}

async function caricaReminder() {
    try {
        if (!veicoloCorrente) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        const { data: reminders, error } = await supabase
            .from('reminder_veicoli')
            .select('*')
            .eq('veicolo_id', veicoloCorrente.id)
            .eq('completato', false)
            .order('data_scadenza', { ascending: true });
        
        if (error) throw error;
        
        reminderList = reminders || [];
        aggiornaUI_Reminder();
        
    } catch (error) {
        console.error('❌ Errore caricamento reminder:', error);
    }
}

async function caricaUltimiInserimenti() {
    try {
        if (!veicoloCorrente || kilometriMensili.length === 0) {
            document.getElementById('ultimi-inserimenti').innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <span class="material-symbols-rounded">history</span>
                    <p style="margin-top: 0.5rem;">Nessun inserimento kilometri</p>
                </div>
            `;
            return;
        }
        
        const ultimi = kilometriMensili.slice(0, 5);
        let html = '';
        
        ultimi.forEach(km => {
            const data = `${getNomeMese(km.mese)} ${km.anno}`;
            const stato = km.confermato ? 'confermato' : 'pendente';
            const icona = km.confermato ? 'check_circle' : 'pending';
            
            html += `
                <div class="km-item ${stato}">
                    <div class="km-info">
                        <h4>${data}</h4>
                        <p>Inserito: ${formattaData(km.data_inserimento)}</p>
                    </div>
                    <div style="text-align: right;">
                        <div class="km-valore">${km.km_fine_mese.toLocaleString()} km</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                            <span class="material-symbols-rounded" style="font-size: 0.9rem; vertical-align: middle;">${icona}</span>
                            ${km.confermato ? 'Confermato' : 'In attesa'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('ultimi-inserimenti').innerHTML = html;
        
    } catch (error) {
        console.error('❌ Errore caricamento ultimi inserimenti:', error);
    }
}

// ================================
// FUNZIONI UI
// ================================

function aggiornaUI_Veicolo() {
    if (!veicoloCorrente) return;
    
    const container = document.getElementById('veicolo-assegnato');
    if (!container) return;
    
    container.innerHTML = `
        <div class="veicolo-card">
            <div class="veicolo-header">
                <div>
                    <div class="veicolo-targa">${veicoloCorrente.targa}</div>
                    <div class="veicolo-modello">${veicoloCorrente.modello || 'Modello non specificato'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Assegnato dal</div>
                    <div style="font-size: 1rem; font-weight: 800; color: var(--text-main);">
                        ${formattaData(veicoloCorrente.data_assegnazione)}
                    </div>
                </div>
            </div>
            
            ${veicoloCorrente.note ? `
            <div style="background: white; padding: 0.875rem; border-radius: 10px; border-left: 4px solid var(--primary); margin-top: 1rem; font-size: 0.9rem; color: var(--text-main);">
                <strong>Note veicolo:</strong> ${veicoloCorrente.note}
            </div>
            ` : ''}
        </div>
    `;
}

function aggiornaUI_Statistiche(stats) {
    const container = document.getElementById('statistiche-km');
    if (!container) return;
    
    if (!stats) {
        container.innerHTML = `
            <div class="stato-vuoto" style="padding: 1rem;">
                <span class="material-symbols-rounded">bar_chart</span>
                <p>Nessuna statistica disponibile</p>
            </div>
        `;
        return;
    }
    
    const kmTotali = stats.km_totali || 0;
    const kmMedi = Math.round(stats.km_medi_mensili || 0);
    const mesiReg = stats.mesi_registrati || 0;
    const ultimoIns = stats.ultimo_inserimento ? new Date(stats.ultimo_inserimento) : null;
    
    let ultimoTesto = 'Mai';
    if (ultimoIns) {
        const giorniPassati = Math.floor((new Date() - ultimoIns) / (1000 * 60 * 60 * 24));
        if (giorniPassati === 0) ultimoTesto = 'Oggi';
        else if (giorniPassati === 1) ultimoTesto = 'Ieri';
        else if (giorniPassati < 30) ultimoTesto = `${giorniPassati} giorni fa`;
        else ultimoTesto = formattaData(ultimoIns);
    }
    
    container.innerHTML = `
        <div class="km-stats">
            <div class="km-stat-card">
                <div class="km-stat-label">Totale KM</div>
                <div class="km-stat-value">${kmTotali.toLocaleString()}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">dall'inizio</div>
            </div>
            
            <div class="km-stat-card">
                <div class="km-stat-label">Media Mensile</div>
                <div class="km-stat-value">${kmMedi.toLocaleString()}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">km/mese</div>
            </div>
            
            <div class="km-stat-card">
                <div class="km-stat-label">Mesi Registrati</div>
                <div class="km-stat-value">${mesiReg}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">totale</div>
            </div>
            
            <div class="km-stat-card">
                <div class="km-stat-label">Ultimo Inserimento</div>
                <div class="km-stat-value" style="font-size: 1.1rem;">${ultimoTesto}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">aggiornamento</div>
            </div>
        </div>
    `;
}

function aggiornaUI_Reminder() {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    if (reminderList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                <span class="material-symbols-rounded">check_circle</span>
                <p style="margin-top: 0.5rem;">Nessun reminder attivo</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    const oggi = new Date();
    
    reminderList.forEach(reminder => {
        const scadenza = new Date(reminder.data_scadenza);
        const giorniDiff = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
        
        let icona = 'notifications';
        let colore = '#f59e0b';
        let tipoTesto = 'Reminder';
        
        switch(reminder.tipo) {
            case 'cambio_gomme_estive':
                icona = 'tire_repair';
                tipoTesto = 'Cambio gomme estive';
                colore = '#3b82f6';
                break;
            case 'cambio_gomme_invernali':
                icona = 'ac_unit';
                tipoTesto = 'Cambio gomme invernali';
                colore = '#0ea5e9';
                break;
            case 'assicurazione':
                icona = 'security';
                tipoTesto = 'Assicurazione';
                colore = '#ef4444';
                break;
            case 'revisione':
                icona = 'car_crash';
                tipoTesto = 'Revisione';
                colore = '#8b5cf6';
                break;
            case 'bollo':
                icona = 'receipt_long';
                tipoTesto = 'Bollo auto';
                colore = '#10b981';
                break;
        }
        
        let stato = '';
        if (giorniDiff < 0) {
            stato = 'SCADUTO';
        } else if (giorniDiff <= 7) {
            stato = 'URGENTE';
        } else if (giorniDiff <= 30) {
            stato = 'PROSSIMO';
        }
        
        html += `
            <div class="reminder-card ${giorniDiff < 0 ? 'pulse-animation' : ''}">
                <span class="material-symbols-rounded reminder-icon" style="color: ${colore};">${icona}</span>
                <div class="reminder-content">
                    <h4>${tipoTesto}</h4>
                    <p>${reminder.descrizione || 'Nessuna descrizione'}</p>
                    <div style="font-size: 0.75rem; color: #b45309; margin-top: 0.25rem;">
                        Scadenza: ${formattaData(scadenza)}
                    </div>
                </div>
                <div class="reminder-giorni" style="background: ${giorniDiff < 0 ? '#ef4444' : (giorniDiff <= 7 ? '#f59e0b' : '#10b981')}">
                    ${giorniDiff < 0 ? 'SCADUTO' : `${giorniDiff} giorni`}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function mostraStatoVuoto() {
    document.getElementById('dashboard-section').innerHTML = `
        <div class="veicoli-section">
            <div class="stato-vuoto">
                <span class="material-symbols-rounded">directions_car_off</span>
                <h3 style="color: var(--text-muted); margin: 1rem 0 0.5rem 0;">Nessun veicolo assegnato</h3>
                <p>Contatta l'amministrazione per l'assegnazione di un veicolo aziendale.</p>
                <button onclick="location.reload()" class="btn-action btn-secondary" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem;">
                    <span class="material-symbols-rounded">refresh</span>
                    Ricarica
                </button>
            </div>
        </div>
    `;
}

// ================================
// FUNZIONI SEZIONI/TAB
// ================================

async function caricaListaKilometriCompleta() {
    try {
        console.log('📊 Caricamento lista kilometri completa...');
        
        const container = document.getElementById('lista-kilometri');
        if (!container) {
            console.error('❌ Container lista-kilometri non trovato');
            return;
        }
        
        if (!veicoloCorrente) {
            container.innerHTML = `
                <div class="stato-vuoto">
                    <span class="material-symbols-rounded">directions_car_off</span>
                    <p>Nessun veicolo assegnato</p>
                </div>
            `;
            return;
        }
        
        if (kilometriMensili.length === 0) {
            container.innerHTML = `
                <div class="stato-vuoto">
                    <span class="material-symbols-rounded">history</span>
                    <h3 style="color: var(--text-muted); margin: 1rem 0 0.5rem 0;">Nessun chilometraggio registrato</h3>
                    <p>Inizia inserendo i kilometri del tuo veicolo.</p>
                    <button onclick="apriModaleKm()" class="btn-action btn-primary" style="margin-top: 1.5rem;">
                        <span class="material-symbols-rounded">add</span>
                        Inserisci Kilometri
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        kilometriMensili.forEach(km => {
            const data = `${getNomeMese(km.mese)} ${km.anno}`;
            const stato = km.confermato ? 'confermato' : 'pendente';
            const icona = km.confermato ? 'check_circle' : 'pending';
            const coloreStato = km.confermato ? '#22c55e' : '#f59e0b';
            
            const kmDelMese = km.km_del_mese || 'N/A';
            
            html += `
                <div class="km-item ${stato}">
                    <div class="km-info">
                        <h4>${data}</h4>
                        <p>Inserito il ${formattaData(km.data_inserimento)}</p>
                        ${km.note ? `<p style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">${km.note}</p>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div class="km-valore">${km.km_fine_mese.toLocaleString()} km</div>
                        <div style="font-size: 0.85rem; color: ${coloreStato}; font-weight: 700; margin-top: 0.25rem;">
                            <span class="material-symbols-rounded" style="font-size: 1rem; vertical-align: middle;">${icona}</span>
                            ${km.confermato ? 'Confermato' : 'In attesa'}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                            KM mese: ${typeof kmDelMese === 'number' ? kmDelMese.toLocaleString() : kmDelMese} km
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log(`✅ Lista kilometri caricata: ${kilometriMensili.length} elementi`);
        
    } catch (error) {
        console.error('❌ Errore caricamento lista kilometri:', error);
        mostraMessaggio('Errore nel caricamento dello storico kilometri', 'error');
    }
}

async function caricaListaReminderCompleta() {
    try {
        console.log('🔔 Caricamento lista reminder completa...');
        
        const container = document.getElementById('lista-reminder');
        if (!container) {
            console.error('❌ Container lista-reminder non trovato');
            return;
        }
        
        if (!veicoloCorrente) {
            container.innerHTML = `
                <div class="stato-vuoto">
                    <span class="material-symbols-rounded">directions_car_off</span>
                    <p>Nessun veicolo assegnato</p>
                </div>
            `;
            return;
        }
        
        if (reminderList.length === 0) {
            container.innerHTML = `
                <div class="stato-vuoto">
                    <span class="material-symbols-rounded">notifications_off</span>
                    <h3 style="color: var(--text-muted); margin: 1rem 0 0.5rem 0;">Nessun reminder attivo</h3>
                    <p>Crea il tuo primo reminder per non dimenticare scadenze importanti.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        const oggi = new Date();
        
        reminderList.forEach((reminder) => {
            const scadenza = new Date(reminder.data_scadenza);
            const giorniDiff = Math.floor((scadenza - oggi) / (1000 * 60 * 60 * 24));
            
            let icona = 'notifications';
            let colore = '#f59e0b';
            let tipoTesto = 'Reminder';
            
            switch(reminder.tipo) {
                case 'cambio_gomme_estive':
                    icona = 'tire_repair';
                    tipoTesto = 'Cambio gomme estive';
                    colore = '#3b82f6';
                    break;
                case 'cambio_gomme_invernali':
                    icona = 'ac_unit';
                    tipoTesto = 'Cambio gomme invernali';
                    colore = '#0ea5e9';
                    break;
                case 'assicurazione':
                    icona = 'security';
                    tipoTesto = 'Assicurazione';
                    colore = '#ef4444';
                    break;
                case 'revisione':
                    icona = 'car_crash';
                    tipoTesto = 'Revisione';
                    colore = '#8b5cf6';
                    break;
                case 'bollo':
                    icona = 'receipt_long';
                    tipoTesto = 'Bollo auto';
                    colore = '#10b981';
                    break;
            }
            
            // Usa un ID univoco per i bottoni
            const reminderId = reminder.id || `reminder-${Date.now()}`;
            
            html += `
                <div class="reminder-card">
                    <div style="display: flex; align-items: flex-start; gap: 1rem; width: 100%;">
                        <span class="material-symbols-rounded reminder-icon" style="color: ${colore};">${icona}</span>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <h4 style="margin: 0 0 0.25rem 0; color: #1e293b;">${tipoTesto}</h4>
                                    <p style="margin: 0; color: #64748b; font-size: 0.9rem;">${reminder.descrizione || 'Nessuna descrizione'}</p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="padding: 0.25rem 0.75rem; background: ${giorniDiff < 0 ? '#ef4444' : (giorniDiff <= 7 ? '#f59e0b' : '#10b981')}; color: white; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">
                                        ${giorniDiff < 0 ? 'SCADUTO' : `${giorniDiff} giorni`}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                                        Scade: ${formattaData(scadenza)}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button onclick="completaReminder('${reminderId}')" class="btn-action btn-success" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                                    <span class="material-symbols-rounded">check</span> Completa
                                </button>
                                <button onclick="eliminaReminder('${reminderId}')" class="btn-action btn-danger" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                                    <span class="material-symbols-rounded">delete</span> Elimina
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log(`✅ Lista reminder caricata: ${reminderList.length} elementi`);
        
    } catch (error) {
        console.error('❌ Errore caricamento lista reminder:', error);
        mostraMessaggio('Errore nel caricamento dei reminder', 'error');
    }
}

// ================================
// FUNZIONI MODALI (rimangono uguali)
// ================================

function apriModaleKm() {
    if (!veicoloCorrente) {
        mostraMessaggio('Nessun veicolo assegnato. Contatta l\'amministrazione.', 'warning');
        return;
    }
    
    console.log('📋 Apertura modale kilometri');
    
    document.getElementById('veicolo-selezionato').textContent = 
        `${veicoloCorrente.targa} - ${veicoloCorrente.modello || 'Modello non specificato'}`;
    
    document.getElementById('mese-km').value = meseCorrente;
    document.getElementById('anno-km').value = annoCorrente;
    document.getElementById('km-fine-mese').value = '';
    document.getElementById('note-km').value = '';
    
    const ultimoKm = kilometriMensili
        .filter(km => km.confermato)
        .sort((a, b) => {
            if (a.anno !== b.anno) return b.anno - a.anno;
            return b.mese - a.mese;
        })[0];
    
    if (ultimoKm) {
        document.getElementById('info-precedente').style.display = 'block';
        document.getElementById('km-precedente').textContent = ultimoKm.km_fine_mese.toLocaleString();
    } else {
        document.getElementById('info-precedente').style.display = 'none';
    }
    
    document.getElementById('modale-km').style.display = 'flex';
    document.getElementById('km-fine-mese').focus();
}

function chiudiModaleKm() {
    document.getElementById('modale-km').style.display = 'none';
}

function apriModaleReminder() {
    if (!veicoloCorrente) {
        mostraMessaggio('Nessun veicolo assegnato. Contatta l\'amministrazione.', 'warning');
        return;
    }
    
    console.log('🔔 Apertura modale reminder');
    
    const oggi = new Date();
    const dataDefault = new Date(oggi);
    dataDefault.setDate(oggi.getDate() + 30);
    
    document.getElementById('tipo-reminder').value = 'cambio_gomme_estive';
    document.getElementById('data-scadenza').value = dataDefault.toISOString().split('T')[0];
    document.getElementById('descrizione-reminder').value = '';
    
    document.getElementById('modale-reminder').style.display = 'flex';
}

function chiudiModaleReminder() {
    document.getElementById('modale-reminder').style.display = 'none';
}

// ================================
// FUNZIONI CRUD (rimangono uguali)
// ================================

async function salvaKilometri() {
    try {
        const mese = parseInt(document.getElementById('mese-km').value);
        const anno = parseInt(document.getElementById('anno-km').value);
        const km = parseInt(document.getElementById('km-fine-mese').value);
        const note = document.getElementById('note-km').value.trim();
        
        if (!mese || !anno || !km) {
            mostraMessaggio('Compila tutti i campi obbligatori', 'error');
            return;
        }
        
        if (mese < 1 || mese > 12) {
            mostraMessaggio('Mese non valido', 'error');
            return;
        }
        
        if (anno < 2020 || anno > 2030) {
            mostraMessaggio('Anno non valido', 'error');
            return;
        }
        
        if (km <= 0) {
            mostraMessaggio('Inserisci un valore valido per i kilometri', 'error');
            return;
        }
        
        const esistente = kilometriMensili.find(k => k.mese === mese && k.anno === anno);
        
        if (esistente) {
            if (!confirm(`Esiste già un inserimento per ${getNomeMese(mese)} ${anno} (${esistente.km_fine_mese} km). Vuoi sovrascriverlo?`)) {
                return;
            }
        }
        
        const ultimoConfermato = kilometriMensili
            .filter(k => k.confermato)
            .sort((a, b) => {
                if (a.anno !== b.anno) return b.anno - a.anno;
                return b.mese - a.mese;
            })[0];
        
        if (ultimoConfermato && km <= ultimoConfermato.km_fine_mese) {
            if (!confirm(`Attenzione: I kilometri inseriti (${km}) sono minori o uguali all'ultimo inserimento confermato (${ultimoConfermato.km_fine_mese}). Vuoi procedere comunque?`)) {
                return;
            }
        }
        
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const tecnico = localStorage.getItem('tecnico_loggato');
        
        const datiKm = {
            veicolo_id: veicoloCorrente.id,
            anno: anno,
            mese: mese,
            km_fine_mese: km,
            data_inserimento: new Date().toISOString().split('T')[0],
            note: note || null,
            confermato: false,
            created_by: tecnico
        };
        
        let result;
        if (esistente) {
            const { data, error } = await supabase
                .from('kilometri_mensili')
                .update(datiKm)
                .eq('id', esistente.id)
                .select();
            
            if (error) throw error;
            result = data?.[0];
        } else {
            const { data, error } = await supabase
                .from('kilometri_mensili')
                .insert([datiKm])
                .select();
            
            if (error) throw error;
            result = data?.[0];
        }
        
        await caricaKilometriVeicolo();
        await caricaStatistiche();
        await caricaUltimiInserimenti();
        
        chiudiModaleKm();
        mostraMessaggio('Kilometri salvati con successo! In attesa di conferma.', 'success');
        
        await verificaInserimentoTardivo(mese, anno);
        
    } catch (error) {
        console.error('❌ Errore salvataggio kilometri:', error);
        mostraMessaggio(`Errore nel salvataggio: ${error.message}`, 'error');
    } finally {
        nascondiLoading();
    }
}

async function salvaReminder() {
    try {
        const tipo = document.getElementById('tipo-reminder').value;
        const dataScadenza = document.getElementById('data-scadenza').value;
        const descrizione = document.getElementById('descrizione-reminder').value.trim();
        
        if (!dataScadenza) {
            mostraMessaggio('Inserisci una data di scadenza', 'error');
            return;
        }
        
        const scadenza = new Date(dataScadenza);
        const oggi = new Date();
        
        if (scadenza < oggi) {
            if (!confirm('La data di scadenza è nel passato. Vuoi creare comunque il reminder?')) {
                return;
            }
        }
        
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const tecnico = localStorage.getItem('tecnico_loggato');
        
        const { data, error } = await supabase
            .from('reminder_veicoli')
            .insert([{
                veicolo_id: veicoloCorrente.id,
                tipo: tipo,
                data_scadenza: dataScadenza,
                descrizione: descrizione || null,
                notificato: false,
                completato: false,
                created_by: tecnico
            }])
            .select();
        
        if (error) throw error;
        
        await caricaReminder();
        
        chiudiModaleReminder();
        mostraMessaggio('Reminder creato con successo!', 'success');
        
    } catch (error) {
        console.error('❌ Errore creazione reminder:', error);
        mostraMessaggio(`Errore nella creazione: ${error.message}`, 'error');
    } finally {
        nascondiLoading();
    }
}

async function completaReminder(id) {
    try {
        if (!confirm('Segnare questo reminder come completato?')) return;
        
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const { error } = await supabase
            .from('reminder_veicoli')
            .update({ completato: true })
            .eq('id', id);
        
        if (error) throw error;
        
        await caricaReminder();
        
        const tabAttivo = document.querySelector('.veicoli-tab.active');
        if (tabAttivo && tabAttivo.textContent.includes('Reminder')) {
            await caricaListaReminderCompleta();
        }
        
        mostraMessaggio('Reminder completato!', 'success');
        
    } catch (error) {
        console.error('❌ Errore completamento reminder:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    } finally {
        nascondiLoading();
    }
}

async function eliminaReminder(id) {
    try {
        if (!confirm('Eliminare definitivamente questo reminder?')) return;
        
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        const { error } = await supabase
            .from('reminder_veicoli')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await caricaReminder();
        
        const tabAttivo = document.querySelector('.veicoli-tab.active');
        if (tabAttivo && tabAttivo.textContent.includes('Reminder')) {
            await caricaListaReminderCompleta();
        }
        
        mostraMessaggio('Reminder eliminato!', 'success');
        
    } catch (error) {
        console.error('❌ Errore eliminazione reminder:', error);
        mostraMessaggio(`Errore: ${error.message}`, 'error');
    } finally {
        nascondiLoading();
    }
}

// ================================
// FUNZIONI UTILITY (rimangono uguali)
// ================================

function mostraMessaggio(testo, tipo = 'info') {
    const messaggioDiv = document.getElementById('messaggio-veicoli');
    if (!messaggioDiv) return;
    
    messaggioDiv.textContent = testo;
    messaggioDiv.className = 'message-veicoli';
    
    switch(tipo) {
        case 'success': messaggioDiv.classList.add('message-success'); break;
        case 'error': messaggioDiv.classList.add('message-error'); break;
        case 'warning': messaggioDiv.classList.add('message-warning'); break;
        default: messaggioDiv.classList.add('message-info');
    }
    
    messaggioDiv.style.display = 'block';
    
    setTimeout(() => {
        messaggioDiv.style.display = 'none';
    }, 5000);
}

function mostraLoading() {
    let loading = document.getElementById('loading-overlay-veicoli');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay-veicoli';
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
            <div style="font-weight: 800; color: var(--primary);">Caricamento...</div>
        `;
        document.body.appendChild(loading);
    }
    
    loading.style.display = 'flex';
}

function nascondiLoading() {
    const loading = document.getElementById('loading-overlay-veicoli');
    if (loading) loading.style.display = 'none';
}

function formattaData(dataString) {
    if (!dataString) return 'Data non valida';
    
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return 'Data non valida';
        
        return data.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('❌ Errore formattazione data:', error);
        return 'Data non valida';
    }
}

function getNomeMese(numeroMese) {
    const mesi = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return mesi[numeroMese - 1] || 'Mese non valido';
}
// ================================
// FUNZIONI DI VERIFICA AGGIUNTIVE
// ================================

async function verificaInserimentoTardivo(mese, anno) {
    try {
        const oggi = new Date();
        const dataInserimento = new Date(anno, mese - 1, 1);
        const mesiDiff = (oggi.getFullYear() - anno) * 12 + (oggi.getMonth() + 1 - mese);
        
        if (mesiDiff > 1) {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            
            const tecnico = localStorage.getItem('tecnico_loggato');
            
            const { data, error } = await supabase
                .from('log_azioni')
                .insert([{
                    azione: 'inserimento_tardivo_km',
                    dettagli: JSON.stringify({
                        veicolo_id: veicoloCorrente.id,
                        targa: veicoloCorrente.targa,
                        mese: mese,
                        anno: anno,
                        mesi_ritardo: mesiDiff
                    }),
                    created_by: tecnico
                }]);
            
            if (!error) {
                console.log(`⚠️ Inserimento tardivo registrato: ${mesiDiff} mesi di ritardo`);
            }
        }
    } catch (error) {
        console.error('❌ Errore verifica inserimento tardivo:', error);
    }
}

async function verificaAlert() {
    try {
        console.log('🔍 Verifica alert in corso...');
        
        if (!veicoloCorrente) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        // Verifica reminder scaduti o in scadenza
        const oggi = new Date().toISOString().split('T')[0];
        const settimanaProssima = new Date();
        settimanaProssima.setDate(settimanaProssima.getDate() + 7);
        const dataSettimana = settimanaProssima.toISOString().split('T')[0];
        
        const { data: reminderUrgenti, error } = await supabase
            .from('reminder_veicoli')
            .select('*')
            .eq('veicolo_id', veicoloCorrente.id)
            .eq('completato', false)
            .lte('data_scadenza', dataSettimana)
            .order('data_scadenza', { ascending: true });
        
        if (error) {
            console.error('❌ Errore verifica alert:', error);
            return;
        }
        
        // Mostra notifica se ci sono reminder urgenti
        if (reminderUrgenti && reminderUrgenti.length > 0) {
            const scaduti = reminderUrgenti.filter(r => new Date(r.data_scadenza) < new Date());
            const inScadenza = reminderUrgenti.filter(r => new Date(r.data_scadenza) >= new Date());
            
            if (scaduti.length > 0) {
                console.warn(`⚠️ ${scaduti.length} reminder SCADUTI!`);
            }
            if (inScadenza.length > 0) {
                console.log(`📅 ${inScadenza.length} reminder in scadenza nei prossimi 7 giorni`);
            }
        }
        
    } catch (error) {
        console.error('❌ Errore verifica alert:', error);
    }
}
// ================================
// ESPORTA FUNZIONI GLOBALI
// ================================
window.apriModaleKm = apriModaleKm;
window.chiudiModaleKm = chiudiModaleKm;
window.salvaKilometri = salvaKilometri;
window.apriModaleReminder = apriModaleReminder;
window.chiudiModaleReminder = chiudiModaleReminder;
window.salvaReminder = salvaReminder;
window.completaReminder = completaReminder;
window.eliminaReminder = eliminaReminder;