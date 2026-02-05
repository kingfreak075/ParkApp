// ============================================
// REPERIBILITÀ TECNICO - PARKAPP
// ============================================

// VARIABILI GLOBALI
let tecnicoNome = '';
let turniList = [];
let richiesteList = [];
let zoneList = [];
let colleghiList = [];
let meseCorrente = new Date().getMonth(); // 0-11
let annoCorrente = new Date().getFullYear();

// ============================================
// INIZIALIZZAZIONE PAGINA
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🔄 Inizializzazione Reperibilità Tecnico...');
        
        // Ottieni nome tecnico loggato
        tecnicoNome = localStorage.getItem('tecnico_loggato') || 'Tecnico';
        document.getElementById('nome-tecnico').textContent = tecnicoNome;
        
        // Controlla connessione DB
        const configInfo = getDbConfigInfo();
        if (!configInfo.configured) {
            mostraMessaggio('Database non configurato', 'error');
        }
        
        // Inizializza le tab
        inizializzaTabsTecnico();
        
        // Setup event listeners per modali
        document.getElementById('tipo-richiesta').addEventListener('change', cambiaTipoRichiesta);
        
        // Carica dati iniziali per la tab attiva (Calendario)
        await caricaDatiIniziali();
        
        // Imposta mese/anno corrente nel calendario
        aggiornaTitoloCalendario();
        generaCalendario(meseCorrente, annoCorrente);
        
        console.log('✅ Reperibilità Tecnico inizializzato');
        
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
        mostraMessaggio('Errore inizializzazione pagina', 'error');
    }
});

// ============================================
// FUNZIONI GESTIONE TAB
// ============================================

function inizializzaTabsTecnico() {
    console.log('🔄 Inizializzo tab system tecnico...');
    
    const tabs = document.querySelectorAll('.tecnico-tab');
    
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
                    case 'calendario-tab':
                        console.log('📅 Aggiorno calendario...');
                        await caricaTurniTecnico();
                        aggiornaTitoloCalendario();
                        generaCalendario(meseCorrente, annoCorrente);
                        break;
                    case 'turni-tab':
                        console.log('📋 Carico tutti i turni...');
                        await caricaTuttiTurni();
                        break;
                    case 'richieste-tab':
                        console.log('📨 Carico richieste...');
                        await caricaRichieste();
                        await caricaColleghi(); // Per nuove richieste
                        break;
                    case 'statistiche-tab':
                        console.log('📊 Calcolo statistiche...');
                        await caricaStatistiche();
                        break;
                }
            }
        });
    });
    
    console.log('✅ Tab system tecnico inizializzato');
}

// ============================================
// FUNZIONI CARICAMENTO DATI
// ============================================

async function caricaDatiIniziali() {
    try {
        console.log('📥 Caricamento dati iniziali...');
        
        // Carica zone per i colori
        await caricaZone();
        
        // Carica turni del tecnico
        await caricaTurniTecnico();
        
        // Carica colleghi per eventuali richieste
        await caricaColleghi();
        
        console.log('✅ Dati iniziali caricati');
        
    } catch (error) {
        console.error('❌ Errore caricamento dati iniziali:', error);
        mostraMessaggio('Errore nel caricamento dei dati', 'error');
    }
}

async function caricaZone() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        console.log('📍 Caricamento zone...');
        
        const { data: zone, error } = await supabase
            .from('zone_reperibilita')
            .select('*')
            .eq('attivo', true)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        zoneList = zone || [];
        console.log(`✅ Zone caricate: ${zoneList.length}`);
        
    } catch (error) {
        console.error('❌ Errore caricamento zone:', error);
        throw error;
    }
}

async function caricaTurniTecnico() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        console.log(`📋 Caricamento turni per ${tecnicoNome}...`);
        
        const { data: turni, error } = await supabase
            .from('turni_reperibilita')
            .select(`
                *,
                zone_reperibilita!inner(nome, colore_hex)
            `)
            .eq('tecnico_id', tecnicoNome)
            .order('data_inizio', { ascending: true });
        
        if (error) throw error;
        
        turniList = turni || [];

        // Recupera cessioni parziali attive per i turni e agganciale
        const parzialiMap = await caricaParzialiPerTurni(turniList);
        turniList = (turniList || []).map(t => ({ ...t, parziali: parzialiMap[t.id] || [] }));
        
        console.log(`✅ Turni caricati: ${turniList.length}`);
        
        // Calcola peso turni (se non già calcolato)
        await calcolaPesoTurni(turniList);
        
    } catch (error) {
        console.error('❌ Errore caricamento turni:', error);
        mostraMessaggio('Errore nel caricamento dei turni', 'error');
    }
}

// Nuova funzione: carica parziali per i turni caricati
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

async function calcolaPesoTurni(turni) {
    // Calcolo semplificato - nella realtà dovrebbe usare la funzione DB
    turni.forEach(turno => {
        if (!turno.peso_turno || turno.peso_turno === 0) {
            // Calcolo base: 2 weekend giorni per ogni turno (sab + dom)
            turno.peso_turno = 2;
            
            // TODO: Aggiungere festività quando implementato
        }
    });
}

async function caricaColleghi() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        console.log('👥 Caricamento colleghi...');
        
        // Ottieni tutti i tecnici unici dai turni
        const { data: turniColleghi, error } = await supabase
            .from('turni_reperibilita')
            .select('tecnico_id')
            .not('tecnico_id', 'eq', tecnicoNome)
            .order('tecnico_id', { ascending: true });
        
        if (error) throw error;
        
        // Estrai nomi unici
        const nomiUnici = [...new Set(turniColleghi.map(t => t.tecnico_id))];
        colleghiList = nomiUnici;
        
        console.log(`✅ Colleghi trovati: ${colleghiList.length}`);
        
    } catch (error) {
        console.error('❌ Errore caricamento colleghi:', error);
    }
}

async function caricaRichieste() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        console.log(`📨 Caricamento richieste di ${tecnicoNome}...`);
        
        const { data: richieste, error } = await supabase
            .from('richieste_cambio')
            .select(`
                *,
                turni_reperibilita!inner(
                    data_inizio,
                    data_fine,
                    zone_reperibilita!inner(nome, colore_hex)
                )
            `)
            .or(`tecnico_richiedente_id.eq.${tecnicoNome},tecnico_destinatario_id.eq.${tecnicoNome}`)
            .order('data_richiesta', { ascending: false });
        
        if (error) throw error;
        
        richiesteList = richieste || [];
        aggiornaUI_Richieste();
        
    } catch (error) {
        console.error('❌ Errore caricamento richieste:', error);
        mostraMessaggio('Errore nel caricamento delle richieste', 'error');
    }
}

// ============================================
// CALENDARIO (TAB 1)
// ============================================

function aggiornaTitoloCalendario() {
    const mesi = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    
    document.getElementById('mese-anno-calendario').textContent = 
        `${mesi[meseCorrente]} ${annoCorrente}`;
}

function cambiaMese(delta) {
    meseCorrente += delta;
    
    if (meseCorrente < 0) {
        meseCorrente = 11;
        annoCorrente--;
    } else if (meseCorrente > 11) {
        meseCorrente = 0;
        annoCorrente++;
    }
    
    aggiornaTitoloCalendario();
    generaCalendario(meseCorrente, annoCorrente);
}

function generaCalendario(mese, anno) {
    const container = document.getElementById('calendario-griglia');
    if (!container) return;
    
    // Pulisci container
    container.innerHTML = '';
    
    // Primo giorno del mese
    const primoGiorno = new Date(anno, mese, 1);
    // Ultimo giorno del mese
    const ultimoGiorno = new Date(anno, mese + 1, 0);
    
    // Giorno della settimana del primo giorno (0=Domenica, 1=Lunedì, ...)
    let giornoInizio = primoGiorno.getDay();
    // Converti a Lunedì=0, Domenica=6
    giornoInizio = giornoInizio === 0 ? 6 : giornoInizio - 1;
    
    // Celle vuote all'inizio
    for (let i = 0; i < giornoInizio; i++) {
        const cellaVuota = document.createElement('div');
        cellaVuota.className = 'calendario-giorno';
        container.appendChild(cellaVuota);
    }
    
    // Giorni del mese
    const giorniNelMese = ultimoGiorno.getDate();
    
    for (let giorno = 1; giorno <= giorniNelMese; giorno++) {
        const data = new Date(anno, mese, giorno);
        const cella = document.createElement('div');
        cella.className = 'calendario-giorno';
        
        // Numero del giorno
        const numeroSpan = document.createElement('div');
        numeroSpan.className = 'numero';
        numeroSpan.textContent = giorno;
        cella.appendChild(numeroSpan);
        
        // Nuova logica: costruisco un array di view-turni per il giorno (tenendo conto delle cessioni parziali)
        const turniOggi = [];
        turniList.forEach(turno => {
            const inizio = new Date(turno.data_inizio);
            const fine = new Date(turno.data_fine);
            
            // Date a mezzanotte per confronto di giorni (end escluso)
            const giornoData = new Date(data.getFullYear(), data.getMonth(), data.getDate());
            const giornoInizio = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate());
            const giornoFine = new Date(fine.getFullYear(), fine.getMonth(), fine.getDate());
            
            // Se è il giorno ESATTO di fine → escludi
            if (giornoData.getTime() === giornoFine.getTime()) {
                return;
            }
            
            // Controlla se il giorno è nel range del turno
            const nelTurno = giornoData >= giornoInizio && giornoData < giornoFine;
            if (!nelTurno) return;
            
            // Se il turno ha parziali attive, verifica se il giorno rientra in una cessione
            const parziali = turno.parziali || [];
            const parzialeMatch = parziali.find(p => {
                const pInizio = new Date(p.data_inizio_cessione);
                const pFine = new Date(p.data_fine_cessione);
                const giornoPInizio = new Date(pInizio.getFullYear(), pInizio.getMonth(), pInizio.getDate());
                const giornoPFine = new Date(pFine.getFullYear(), pFine.getMonth(), pFine.getDate());
                // Manteniamo end escluso per coerenza: se il giorno === giornoPFine => escluso
                return giornoData >= giornoPInizio && giornoData < giornoPFine;
            });

            if (parzialeMatch) {
                // aggiungi una "view" del turno per la giornata con il tecnico cessionario
                turniOggi.push({
                    ...turno,
                    tecnico_id: parzialeMatch.tecnico_cessionario_id || parzialeMatch.tecnico_cessionario,
                    _isParziale: true,
                    _parzialeInfo: parzialeMatch
                });
            } else {
                // giorno normale del turno (titolare)
                turniOggi.push(turno);
            }
        });
        
        // Se ci sono turni, aggiungi indicatori
        if (turniOggi.length > 0) {
            cella.classList.add('turno');
            
            // Colore del primo turno (per semplicità)
            const primoTurno = turniOggi[0];
            const zona = zoneList.find(z => z.id === primoTurno.zona_id) || primoTurno.zone_reperibilita;
            
            if (zona) {
                cella.style.borderColor = zona.colore_hex;
                cella.style.background = `${zona.colore_hex}15`; // Trasparente
            }
            
            // Indicatore per turni multipli
            if (turniOggi.length > 1) {
                const indicatore = document.createElement('div');
                indicatore.className = 'turno-indicatore';
                indicatore.style.background = '#64748b';
                indicatore.title = `${turniOggi.length} turni`;
                cella.appendChild(indicatore);
            }
            
            // Aggiungi click handler
            cella.style.cursor = 'pointer';
            cella.addEventListener('click', () => mostraDettaglioTurniGiorno(data, turniOggi));
        }
        
        // Evidenzia oggi
        const oggi = new Date();
        if (data.getDate() === oggi.getDate() && 
            data.getMonth() === oggi.getMonth() && 
            data.getFullYear() === oggi.getFullYear()) {
            cella.style.boxShadow = 'inset 0 0 0 2px var(--primary)';
        }
        
        container.appendChild(cella);
    }
    
    // Aggiungi turni del mese nella lista sotto
    aggiornaListaTurniMese(mese, anno);
}

function aggiornaListaTurniMese(mese, anno) {
    const container = document.getElementById('turni-mese');
    if (!container) return;
    
    const turniMese = turniList.filter(turno => {
        const dataTurno = new Date(turno.data_inizio);
        return dataTurno.getMonth() === mese && dataTurno.getFullYear() === anno;
    });
    
    if (turniMese.length === 0) {
        container.innerHTML = `
            <div class="vuoto-state" style="padding: 2rem;">
                <span class="material-symbols-rounded">event_busy</span>
                <p>Nessun turno di reperibilità questo mese</p>
            </div>
        `;
        return;
    }
    
    let html = '<h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 1rem;">Turni del mese:</h3>';
    
    turniMese.forEach(turno => {
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        const zona = turno.zone_reperibilita;
        
        html += creaHTMLTurnoItem(turno, zona, inizio, fine);
    });
    
    container.innerHTML = html;
}

function mostraDettaglioTurniGiorno(data, turni) {
    // Per semplicità, mostra il primo turno
    if (turni.length > 0) {
        apriModalDettaglio(turni[0]);
    }
}

// ============================================
// LISTA TURNI (TAB 2)
// ============================================

async function caricaTuttiTurni() {
    try {
        const container = document.getElementById('lista-tutti-turni');
        if (!container) return;
        
        if (turniList.length === 0) {
            container.innerHTML = `
                <div class="vuoto-state">
                    <span class="material-symbols-rounded">directions_car_off</span>
                    <p>Nessun turno di reperibilità assegnato</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        turniList.forEach(turno => {
            const inizio = new Date(turno.data_inizio);
            const fine = new Date(turno.data_fine);
            const zona = turno.zone_reperibilita;
            
            html += creaHTMLTurnoItem(turno, zona, inizio, fine);
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Errore caricamento tutti turni:', error);
        mostraMessaggio('Errore nel caricamento dei turni', 'error');
    }
}

function creaHTMLTurnoItem(turno, zona, inizio, fine) {
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
    
    const coloreZona = zona?.colore_hex || '#3B82F6';
    const nomeZona = zona?.nome || 'Zona sconosciuta';
    
    let statoIcona = '';
    if (turno.stato === 'modificato') {
        statoIcona = '<span class="material-symbols-rounded" style="color: #f59e0b; font-size: 1rem; margin-left: 0.5rem;">swap_horiz</span>';
    } else if (turno.stato === 'parziale') {
        statoIcona = '<span class="material-symbols-rounded" style="color: #8b5cf6; font-size: 1rem; margin-left: 0.5rem;">call_split</span>';
    }
    
    return `
        <div class="turno-item" onclick="apriModalDettaglio('${turno.id}')" style="border-left-color: ${coloreZona};">
            <div class="turno-header">
                <div>
                    <div class="turno-zona" style="background: ${coloreZona}20; color: ${coloreZona};">${nomeZona} ${statoIcona}</div>
                    <div class="turno-date">${dataInizio} → ${dataFine}</div>
<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
    <span class="material-symbols-rounded" style="font-size: 0.8rem; vertical-align: middle;">info</span>
    Il turno termina alle 8:00 del ${dataFine}
</div>


                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Durata</div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">7 giorni</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                <div class="turno-peso">
                    <span class="material-symbols-rounded" style="font-size: 0.9rem; vertical-align: middle;">weight</span>
                    Peso: ${turno.peso_turno || 2}
                </div>
                <button onclick="event.stopPropagation(); apriModalRichiestaPerTurno('${turno.id}')" 
                        style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 800; cursor: pointer;">
                    <span class="material-symbols-rounded" style="font-size: 1rem; vertical-align: middle;">swap_horiz</span>
                    Modifica
                </button>
            </div>
        </div>
    `;
}

// ============================================
// RICHIESTE (TAB 3)
// ============================================

function aggiornaUI_Richieste() {
    const container = document.getElementById('lista-richieste');
    if (!container) return;
    
    if (richiesteList.length === 0) {
        container.innerHTML = `
            <div class="vuoto-state">
                <span class="material-symbols-rounded">pending_actions</span>
                <p>Nessuna richiesta inviata</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Crea la tua prima richiesta di modifica turno</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    richiesteList.forEach(richiesta => {
        const dataRichiesta = new Date(richiesta.data_richiesta);
        const turno = richiesta.turni_reperibilita;
        const zona = turno?.zone_reperibilita;
        
        let tipoTesto = '';
        let icona = '';
        
        switch(richiesta.tipo) {
            case 'scambio':
                tipoTesto = 'Scambio';
                icona = 'swap_horiz';
                break;
            case 'sostituzione':
                tipoTesto = 'Sostituzione';
                icona = 'person_add';
                break;
            case 'cessione_parziale':
                tipoTesto = 'Cessione parziale';
                icona = 'call_split';
                break;
        }
        
        let statoBadge = '';
        switch(richiesta.stato) {
            case 'pending':
                statoBadge = '<span class="stato-badge stato-pending">⏳ In attesa</span>';
                break;
            case 'peer_approval':
                statoBadge = '<span class="stato-badge stato-peer">👥 Attesa collega</span>';
                break;
            case 'admin_approval':
                statoBadge = '<span class="stato-badge stato-pending">📋 In revisione admin</span>';
                break;
            case 'approved':
                statoBadge = '<span class="stato-badge stato-approved">✅ Approvata</span>';
                break;
            case 'rejected':
                statoBadge = '<span class="stato-badge stato-rejected">❌ Rifiutata</span>';
                break;
        }
        
        const dataFormattata = dataRichiesta.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="richiesta-item">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <h4 style="margin: 0 0 0.25rem 0; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-symbols-rounded">${icona}</span>
                            ${tipoTesto}
                        </h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
                            ${zona?.nome || 'Zona sconosciuta'} • ${dataFormattata}
                        </p>
                    </div>
                    ${statoBadge}
                </div>
                <p style="margin: 0.75rem 0; color: var(--text-main); font-size: 0.9rem;">
                    ${richiesta.motivo || 'Nessun motivo specificato'}
                </p>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                    <strong>Destinatario:</strong> ${richiesta.tecnico_destinatario_id || richiesta.nuovo_tecnico_id || 'N/D'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// STATISTICHE (TAB 4)
// ============================================

async function caricaStatistiche() {
    try {
        console.log('📊 Calcolo statistiche...');
        
        // Turni totali
        document.getElementById('stat-turni-totali').textContent = turniList.length;
        
        // Peso totale
        const pesoTotale = turniList.reduce((sum, turno) => sum + (turno.peso_turno || 2), 0);
        document.getElementById('stat-peso-totale').textContent = pesoTotale;
        
        // Zone diverse
        const zoneUniche = [...new Set(turniList.map(t => t.zona_id))];
        document.getElementById('stat-zone-diverse').textContent = zoneUniche.length;
        
        // Richieste inviate
        const richiesteInviate = richiesteList.filter(r => r.tecnico_richiedente_id === tecnicoNome).length;
        document.getElementById('stat-richieste-inviate').textContent = richiesteInviate;
        
        // Grafico zone
        aggiornaGraficoZone();
        
    } catch (error) {
        console.error('❌ Errore calcolo statistiche:', error);
    }
}

function aggiornaGraficoZone() {
    const container = document.getElementById('grafico-zone');
    if (!container || turniList.length === 0) return;
    
    // Raggruppa turni per zona
    const turniPerZona = {};
    
    turniList.forEach(turno => {
        const zonaId = turno.zona_id;
        const zonaNome = turno.zone_reperibilita?.nome || `Zona ${zonaId}`;
        
        if (!turniPerZona[zonaNome]) {
            turniPerZona[zonaNome] = {
                count: 0,
                colore: turno.zone_reperibilita?.colore_hex || '#3B82F6'
            };
        }
        
        turniPerZona[zonaNome].count++;
    });
    
    // Crea grafico semplice
    let html = '';
    
    Object.entries(turniPerZona).forEach(([zona, dati]) => {
        const percentuale = (dati.count / turniList.length * 100).toFixed(1);
        
        html += `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span style="font-weight: 600; color: var(--text-main);">${zona}</span>
                    <span style="font-weight: 800; color: var(--primary);">${dati.count} turni (${percentuale}%)</span>
                </div>
                <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${percentuale}%; background: ${dati.colore}; border-radius: 4px;"></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// MODALI
// ============================================

async function apriModalDettaglio(turnoId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        // Se turnoId è stringa, cerca il turno, altrimenti usa l'oggetto
        let turno;
        if (typeof turnoId === 'string') {
            turno = turniList.find(t => t.id === turnoId);
            if (!turno) {
                // Carica dal DB se non in cache
                const { data: turnoDB, error } = await supabase
                    .from('turni_reperibilita')
                    .select(`
                        *,
                        zone_reperibilita!inner(*)
                    `)
                    .eq('id', turnoId)
                    .single();
                
                if (error) throw error;
                turno = turnoDB;
            }
        } else {
            turno = turnoId;
        }
        
        if (!turno) {
            mostraMessaggio('Turno non trovato', 'error');
            return;
        }
        
        const inizio = new Date(turno.data_inizio);
        const fine = new Date(turno.data_fine);
        const zona = turno.zone_reperibilita;
        
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
        
        const durataGiorni = Math.round((fine - inizio) / (1000 * 60 * 60 * 24));
        
        let statoTesto = '';
        switch(turno.stato) {
            case 'originale': statoTesto = 'Originale (dal CSV)'; break;
            case 'modificato': statoTesto = 'Modificato'; break;
            case 'parziale': statoTesto = 'Parziale'; break;
        }
        
        const content = `
            <div style="margin-bottom: 1.5rem;">
                <div class="turno-zona" style="background: ${zona?.colore_hex}20; color: ${zona?.colore_hex}; display: inline-block; margin-bottom: 1rem;">
                    ${zona?.nome || 'Zona sconosciuta'}
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span class="material-symbols-rounded" style="color: var(--primary);">calendar_today</span>
                       <div>
    <div style="font-weight: 800; color: var(--text-main);">Inizio</div>
    <div style="color: var(--text-muted);">${dataInizio}</div>
    <div style="font-size: 0.75rem; color: #3B82F6; margin-top: 0.25rem;">
        Venerdì 8:00
    </div>
</div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-symbols-rounded" style="color: var(--primary);">event_available</span>
                       <div>
    <div style="font-weight: 800; color: var(--text-main);">Fine</div>
    <div style="color: var(--text-muted);">${dataFine}</div>
    <div style="font-size: 0.75rem; color: #EF4444; margin-top: 0.25rem;">
        Venerdì 8:00 (turno escluso questo giorno)
    </div>
</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                    <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${durataGiorni}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Giorni totali</div>
                    </div>
                    
                    <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b;">${turno.peso_turno || 2}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Peso turno</div>
                    </div>
                </div>
                
                <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 800; color: #92400e; margin-bottom: 0.25rem;">Stato turno</div>
                    <div style="color: #92400e;">${statoTesto}</div>
                    ${turno.note ? `<div style="margin-top: 0.5rem; color: #92400e;"><strong>Note:</strong> ${turno.note}</div>` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('dettaglio-turno-content').innerHTML = content;
        
        // Salva l'ID del turno per eventuali richieste
        document.getElementById('dettaglio-turno-content').dataset.turnoId = turno.id;
        
        // Mostra il modale
        document.getElementById('modale-dettaglio-turno').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore apertura dettaglio turno:', error);
        mostraMessaggio('Errore nel caricamento dei dettagli', 'error');
    }
}

function chiudiModaleDettaglio() {
    document.getElementById('modale-dettaglio-turno').style.display = 'none';
}

function apriModalRichiestaDaDettaglio() {
    const turnoId = document.getElementById('dettaglio-turno-content').dataset.turnoId;
    chiudiModaleDettaglio();
    apriModalRichiestaPerTurno(turnoId);
}

function apriModalRichiestaPerTurno(turnoId) {
    // Popola il select dei turni
    const selectTurno = document.getElementById('turno-richiesta');
    selectTurno.innerHTML = '<option value="">Seleziona turno...</option>';
    
    turniList.forEach(turno => {
        const inizio = new Date(turno.data_inizio);
        const dataStr = inizio.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const zona = turno.zone_reperibilita?.nome || 'Zona';
        
        selectTurno.innerHTML += `<option value="${turno.id}">${dataStr} - ${zona}</option>`;
    });
    
    // Seleziona il turno specifico
    if (turnoId) {
        selectTurno.value = turnoId;
    }
    
    // Popola colleghi
    const selectScambio = document.getElementById('collega-scambio');
    const selectSostituto = document.getElementById('collega-sostituto');
    const selectCessionario = document.getElementById('collega-cessionario');
    
    [selectScambio, selectSostituto, selectCessionario].forEach(select => {
        select.innerHTML = '<option value="">Seleziona collega...</option>';
        colleghiList.forEach(collega => {
            select.innerHTML += `<option value="${collega}">${collega}</option>`;
        });
    });
    
    // Resetta il form
    document.getElementById('tipo-richiesta').value = '';
    document.getElementById('motivo-richiesta').value = '';
    document.getElementById('scambio-container').style.display = 'none';
    document.getElementById('sostituzione-container').style.display = 'none';
    document.getElementById('parziale-container').style.display = 'none';
    
    // Mostra il modale
    document.getElementById('modale-nuova-richiesta').style.display = 'flex';
}

function apriModalNuovaRichiesta() {
    apriModalRichiestaPerTurno(null);
}

function chiudiModaleRichiesta() {
    document.getElementById('modale-nuova-richiesta').style.display = 'none';
}

function cambiaTipoRichiesta() {
    const tipo = document.getElementById('tipo-richiesta').value;
    
    // Nascondi tutti i container
    document.getElementById('scambio-container').style.display = 'none';
    document.getElementById('sostituzione-container').style.display = 'none';
    document.getElementById('parziale-container').style.display = 'none';
    
    // Mostra il container corretto
    switch(tipo) {
        case 'scambio':
            document.getElementById('scambio-container').style.display = 'block';
            break;
        case 'sostituzione':
            document.getElementById('sostituzione-container').style.display = 'block';
            break;
        case 'cessione_parziale':
            document.getElementById('parziale-container').style.display = 'block';
            break;
    }
}

async function inviaRichiesta() {
    try {
        const tipo = document.getElementById('tipo-richiesta').value;
        const turnoId = document.getElementById('turno-richiesta').value;
        const motivo = document.getElementById('motivo-richiesta').value.trim();
        
        if (!tipo || !turnoId || !motivo) {
            mostraMessaggio('Compila tutti i campi obbligatori', 'error');
            return;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        let datiRichiesta = {
            turno_originale_id: turnoId,
            tipo: tipo,
            tecnico_richiedente_id: tecnicoNome,
            motivo: motivo,
            stato: 'pending'
        };
        
        // Aggiungi dati specifici per tipo
        switch(tipo) {
            case 'scambio':
                const collegaScambio = document.getElementById('collega-scambio').value;
                if (!collegaScambio) {
                    mostraMessaggio('Seleziona un collega per lo scambio', 'error');
                    return;
                }
                datiRichiesta.tecnico_destinatario_id = collegaScambio;
                break;
                
            case 'sostituzione':
                const collegaSostituto = document.getElementById('collega-sostituto').value;
                if (!collegaSostituto) {
                    mostraMessaggio('Seleziona un collega sostituto', 'error');
                    return;
                }
                datiRichiesta.nuovo_tecnico_id = collegaSostituto;
                break;
                
            case 'cessione_parziale':
                const collegaCessionario = document.getElementById('collega-cessionario').value;
                const dataInizioCessione = document.getElementById('data-inizio-cessione').value;
                const dataFineCessione = document.getElementById('data-fine-cessione').value;
                
                if (!collegaCessionario || !dataInizioCessione || !dataFineCessione) {
                    mostraMessaggio('Compila tutti i campi per la cessione', 'error');
                    return;
                }
                
                if (new Date(dataFineCessione) <= new Date(dataInizioCessione)) {
                    mostraMessaggio('La data fine deve essere successiva alla data inizio', 'error');
                    return;
                }
                
                datiRichiesta.dettagli_parziale_json = {
                    tecnico_cessionario: collegaCessionario,
                    data_inizio_cessione: dataInizioCessione,
                    data_fine_cessione: dataFineCessione
                };
                break;
        }
        
        // Invia la richiesta
        const { error } = await supabase
            .from('richieste_cambio')
            .insert([datiRichiesta]);
        
        if (error) throw error;
        
        // Chiudi modale e mostra successo
        chiudiModaleRichiesta();
        mostraMessaggio('Richiesta inviata con successo!', 'success');
        
        // Ricarica le richieste
        await caricaRichieste();
        
    } catch (error) {
        console.error('❌ Errore invio richiesta:', error);
        mostraMessaggio(`Errore nell'invio della richiesta: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI UTILITY
// ============================================

function mostraMessaggio(testo, tipo = 'info') {
    const messaggioDiv = document.getElementById('messaggio-tecnico');
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

// ============================================
// ESPORTA FUNZIONI GLOBALI
// ============================================
window.cambiaMese = cambiaMese;
window.caricaTuttiTurni = caricaTuttiTurni;
window.caricaRichieste = caricaRichieste;
window.caricaStatistiche = caricaStatistiche;
window.apriModalDettaglio = apriModalDettaglio;
window.chiudiModaleDettaglio = chiudiModaleDettaglio;
window.apriModalRichiestaDaDettaglio = apriModalRichiestaDaDettaglio;
window.apriModalRichiestaPerTurno = apriModalRichiestaPerTurno;
window.apriModalNuovaRichiesta = apriModalNuovaRichiesta;
window.chiudiModaleRichiesta = chiudiModaleRichiesta;
window.cambiaTipoRichiesta = cambiaTipoRichiesta;
window.inviaRichiesta = inviaRichiesta;