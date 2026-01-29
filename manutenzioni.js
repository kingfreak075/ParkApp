// ✅ SOSTITUIRE L'INIZIO DEL FILE (righe 1-30) CON QUESTO:

// 1. Controllo configurazione
if (typeof hasDbConfig !== 'function' || !hasDbConfig()) {
    if (typeof showDbConfigOverlay === 'function') {
        showDbConfigOverlay();
    }
    throw new Error('Configurazione database mancante');
}

// 2. Ottenere client
let supabaseClient;
try {
    supabaseClient = getSupabaseClient();
    console.log('✅ Client Supabase creato per manutenzioni');
} catch (error) {
    console.error('❌ Errore client:', error);
    mostraErroreDB(`Errore DB: ${error.message}`);
}

// 3. Funzione errore DB (MANTIENI quella esistente, è OK)
function mostraErroreDB(messaggio) {
    console.error('Errore DB:', messaggio);
    
    // Mostra messaggio nella pagina
    const listaDiv = document.getElementById('lista-manutenzioni');
    if (listaDiv) {
        listaDiv.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 20px;">error</span>
                <h3 style="margin-bottom: 10px;">Errore Database</h3>
                <p>${messaggio}</p>
                <button onclick="window.location.href='config.html'" 
                        style="margin-top: 20px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600;">
                    Configura Database
                </button>
            </div>
        `;
    }
    // Disabilita filtro periodicità se presente
    const filtroDiv = document.querySelector('.filtro-btn');
    if (filtroDiv) {
        filtroDiv.style.opacity = '0.5';
        filtroDiv.style.pointerEvents = 'none';
    }
}

// Mappa periodicità -> etichette
const PERIODICITA_MAP = {
    30: "MENSILE",
    60: "BIMESTRALE", 
    90: "TRIMESTRALE",
    180: "SEMESTRALE",
    360: "ANNUALE"
};

// VARIABILI STATISTICHE (DICHIARATE A LIVELLO GLOBALE)
let statistiche = {
    globale: { totaleImpianti: 0, senzaMeseSem: 0 },
    manutentore: { totaleImpianti: 0, senzaMeseSem: 0 }
};

// Cache per i giri dei manutentori (per evitare query multiple)
let manutentoriCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Imposta mese corrente (da 1 a 12)
    const meseCorrente = new Date().getMonth() + 1;
    const selMese = document.getElementById('select-mese');
    if (selMese) selMese.value = meseCorrente;

    // Carica statistiche globali
    await caricaStatisticheGenerali();
    
    // Carica manutentori e poi manutenzioni
    await caricaManutentori();
    caricaManutenzioni();
});

// Carica statistiche globali: totale impianti e senza mese_sem
async function caricaStatisticheGenerali() {
    try {
        console.log("Caricamento statistiche globali...");
        
        // PRIMA PROVA: con count esatto
        const { data, error, count } = await supabaseClient
            .from('Parco_app')
            .select('impianto, mese_sem', { 
                count: 'exact',
                head: false 
            });

        if (error) throw error;

        console.log("Count da Supabase:", count);
        console.log("Data length:", data.length);

        // Usa 'count' se disponibile, altrimenti data.length
        const totale = count !== null ? count : data.length;
        
        statistiche.globale.totaleImpianti = totale;
        
        // ... resto del calcolo ...
        
        console.log("Statistiche globali calcolate:", statistiche.globale);
        
        const reportGlobale = document.getElementById('report-globale');
        if (reportGlobale) {
            reportGlobale.textContent = `(G: ${statistiche.globale.totaleImpianti} | ${statistiche.globale.senzaMeseSem})`;
        }

    } catch (err) {
        console.error("Errore statistiche globali:", err);
    }
}



// Carica manutentori dalla tabella manutentori
async function caricaManutentori() {
    const select = document.getElementById('select-manutentore'); // <-- QUI CAMBIA!
    if (!select) {
        console.error("Elemento select-manutentore non trovato!");
        return;
    }
    
    try {
        // Carica dalla tabella manutentori
        const { data, error } = await supabaseClient
            .from('manutentori')
            .select('"Manutentore", "Giro"');  // Note: virgolette per CASE misto

        if (error) throw error;

        // Salva in cache per non dover rifare query
        data.forEach(m => {
            manutentoriCache[m.Manutentore] = m.Giro;
        });

        // Ordina alfabeticamente
        const manutentoriUnici = data
            .map(item => item.Manutentore)
            .filter(Boolean)
            .sort();

        select.innerHTML = ""; 
        
        // Aggiungi opzione vuota
        const optVuota = document.createElement('option');
        optVuota.value = "";
        optVuota.innerText = "Seleziona manutentore";
        select.appendChild(optVuota);
        
        manutentoriUnici.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.innerText = m;
            select.appendChild(opt);
        });

        // Se c'è un manutentore in localStorage, selezionalo
        const manutentoreSalvato = localStorage.getItem('manutentore_loggato');
        if (manutentoreSalvato && manutentoriUnici.includes(manutentoreSalvato)) {
            select.value = manutentoreSalvato;
        }

    } catch (err) {
        console.error("Errore caricamento manutentori:", err);
        select.innerHTML = "<option value=''>Errore caricamento</option>";
    }
}
// Ottieni il giro di un manutentore (dalla cache o query)
async function getGiroManutentore(manutentore) {
    if (!manutentore) return null;
    
    // Se abbiamo in cache, ritorna
    if (manutentoriCache[manutentore] !== undefined) {
        return manutentoriCache[manutentore];
    }
    
    // Altrimenti query
    try {
        const { data, error } = await supabaseClient
            .from('manutentori')
            .select('"Giro"')
            .eq('Manutentore', manutentore)
            .single();

        if (error) throw error;
        
        // Salva in cache
        manutentoriCache[manutentore] = data.Giro;
        return data.Giro;
        
    } catch (err) {
        console.error("Errore ottenimento giro:", err);
        return null;
    }
}

async function caricaStatisticheManutentore(manutentore) {
    if (!manutentore) {
        // Reset statistiche manutentore
        statistiche.manutentore = { totaleImpianti: 0, senzaMeseSem: 0 };
        aggiornaReportManutentore();
        return;
    }
    
    try {
        // 1. Ottieni il giro del manutentore
        const giroManutentore = await getGiroManutentore(manutentore);
        if (!giroManutentore) {
            console.error("Giro non trovato per manutentore:", manutentore);
            statistiche.manutentore = { totaleImpianti: 0, senzaMeseSem: 0 };
            aggiornaReportManutentore();
            return;
        }
        
        // 2. Carica tutti gli impianti di quel giro
        const { data, error } = await supabaseClient
            .from('Parco_app')
            .select('impianto, mese_sem')
            .eq('giro', giroManutentore.toString());

        if (error) throw error;

        // 3. Calcola statistiche per il manutentore
        statistiche.manutentore.totaleImpianti = data.length;
        
        statistiche.manutentore.senzaMeseSem = data.filter(imp => {
            const m = imp.mese_sem;
            
            if (m === null || m === undefined || m === '') return true;
            if (m === '0' || m === 0) return true;
            
            const num = parseInt(m);
            return isNaN(num) || num < 1 || num > 12;
        }).length;

        console.log(`Statistiche manutentore ${manutentore} (giro ${giroManutentore}):`, statistiche.manutentore);
        
        // 4. Aggiorna report
        aggiornaReportManutentore();

    } catch (err) {
        console.error("Errore statistiche manutentore:", err);
        statistiche.manutentore = { totaleImpianti: 0, senzaMeseSem: 0 };
        aggiornaReportManutentore();
    }
}

function aggiornaReportManutentore() {
    const reportManutentore = document.getElementById('report-manutentore');
    if (reportManutentore) {
        reportManutentore.textContent = `(M: ${statistiche.manutentore.totaleImpianti} | ${statistiche.manutentore.senzaMeseSem})`;
    }
}






function creaFooter(statistiche) {
    return `
        <div class="app-footer" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Statistiche -->
            <div style="display: flex; justify-content: space-around; width: 100%;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 2px;">Totali</div>
                    <div style="font-weight: 800; color: var(--text-main);">${statistiche.totali}</div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 2px;">Nel mese</div>
                    <div style="font-weight: 800; color: #22c55e;">${statistiche.nelMese}</div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 2px;">In Ritardo</div>
                    <div style="font-weight: 800; color: #ef4444;">${statistiche.inRitardo}</div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 2px;">Regolari</div>
                    <div style="font-weight: 800; color: var(--text-main);">${statistiche.regolari}</div>
                </div>
            </div>
            
            <!-- Firma -->
            <div style="text-align: right; padding-top: 5px; border-top: 1px solid var(--border);">
                <span class="footer-text">EDIT BY KINGFREAK Version 1.0</span>
            </div>
        </div>
    `;
}

// Funzione helper per verificare se un impianto è dovuto nel mese selezionato
function deveEssereFattaNelMese(meseBase, periodicita, meseSelezionato) {
    // Se periodicita non è valida o meseBase non è valido, non è nel mese
    if (!meseBase || meseBase < 1 || meseBase > 12) {
        return false;
    }

    // Se periodicita non è standard, mostra solo nel mese base
    if (![30, 60, 90, 180, 360].includes(parseInt(periodicita))) {
        return parseInt(meseBase) === meseSelezionato;
    }

    // Calcola periodicità in mesi
    const periodMonths = parseInt(periodicita) / 30;
    
    // Calcola differenza tra mese selezionato e mese base (considerando ciclo annuale)
    let diff = (meseSelezionato - meseBase) % 12;
    if (diff < 0) diff += 12;
    
    // Verifica se la differenza è multiplo della periodicità in mesi
    return diff % periodMonths === 0;
}

async function caricaAnnotazioniPerImpianto() {
    try {
        console.log("Cerco TUTTE le annotazioni (senza filtro)");
        
        const { data, error } = await supabaseClient
            .from('annotazioni')
            .select('impianto_ann, tipo');

        if (error) {
            console.error("Errore Supabase:", error);
            throw error;
        }

        console.log("Numero annotazioni trovate:", data.length);
        
        // Crea mappa: impianto -> array di tipi presenti
        const mappaTipi = {};
        data.forEach(ann => {
            const codiceImpianto = ann.impianto_ann ? ann.impianto_ann.trim().toUpperCase() : '';
            
            if (!codiceImpianto) return;
            
            if (!mappaTipi[codiceImpianto]) {
                mappaTipi[codiceImpianto] = [];
            }
            if (!mappaTipi[codiceImpianto].includes(ann.tipo)) {
                mappaTipi[codiceImpianto].push(ann.tipo);
            }
        });
        
        return mappaTipi;
    } catch (err) {
        console.error("Errore annotazioni:", err);
        return {};
    }
}

async function caricaManutenzioni() {
    const meseSelezionato = parseInt(document.getElementById('select-mese').value);
    const manutentoreScelto = document.getElementById('select-manutentore').value;
    const lista = document.getElementById('lista-manutenzioni');
    
    lista.innerHTML = "<div style='text-align:center; padding:20px;'>Caricamento...</div>";

    // 1. Aggiorna statistiche del manutentore
    await caricaStatisticheManutentore(manutentoreScelto);
    
    // 2. Se non è selezionato un manutentore, mostra messaggio
    if (!manutentoreScelto) {
        lista.innerHTML = "<div style='text-align:center; margin-top:40px; color:#64748b;'>Seleziona un manutentore</div>";
        return;
    }

    try {
        // 1. Ottieni il giro del manutentore selezionato
        const giroManutentore = await getGiroManutentore(manutentoreScelto);
        
        if (!giroManutentore) {
            lista.innerHTML = "<div style='text-align:center; margin-top:40px; color:#ef4444;'>Errore: giro non trovato per questo manutentore</div>";
            return;
        }

        console.log(`Manutentore: ${manutentoreScelto}, Giro: ${giroManutentore}, Mese: ${meseSelezionato}`);

        // 2. Query alla tabella Parco_app filtrata per giro
        const { data: impianti, error } = await supabaseClient
            .from('Parco_app')
            .select('*')
            .eq('giro', giroManutentore.toString()); // Converti a stringa per sicurezza

        if (error) throw error;

        console.log(`Impianti trovati per giro ${giroManutentore}:`, impianti.length);

        // 3. Carica annotazioni in parallelo
        const mappaTipi = await caricaAnnotazioniPerImpianto();

        // 4. FILTRO PER MESE SELEZIONATO
let filtrati = [];

if (meseSelezionato === 0) {
    // Mese 0 = NON ASSEGNATO: mostra tutti gli impianti senza mese_sem valido
    filtrati = impianti.filter(imp => {
        const m = parseInt(imp.mese_sem);
        return isNaN(m) || m < 1 || m > 12 || m === 0;
    });
} else {
    // Mese 1-12: filtra in base alla periodicità
    filtrati = impianti.filter(imp => {
        const meseBase = parseInt(imp.mese_sem);
        const periodicita = parseInt(imp.periodicit);
        
        return deveEssereFattaNelMese(meseBase, periodicita, meseSelezionato);
    });
}

// 4.5 APPLICA FILTRO PERIODICITÀ (NUOVO!)
filtrati = applicaFiltroPeriodicita(filtrati);

        // 5. ORDINAMENTO: per periodicità (crescente) e poi per indirizzo
        filtrati.sort((a, b) => {
            // Prima per periodicità
            const periodA = parseInt(a.periodicit) || 999;
            const periodB = parseInt(b.periodicit) || 999;
            
            if (periodA !== periodB) {
                return periodA - periodB;
            }
            
            // Poi per indirizzo alfabetico
            const indirizzoA = a.Indirizzo || '';
            const indirizzoB = b.Indirizzo || '';
            return indirizzoA.localeCompare(indirizzoB);
        });

        // 6. Variabili per statistiche
        let statistiche = {
            totali: filtrati.length,
            nelMese: 0,
            inRitardo: 0,
            regolari: 0
        };

        lista.innerHTML = "";
        
        // 7. CREAZIONE CARD (LOGICA INVARIATA)
        filtrati.forEach(imp => {
            // --- FILIGRANA PERIODICITA ---
            const periodicitaNum = parseInt(imp.periodicit);
            let filigranaPeriodo = "";
            let coloreFiligrana = "#e2e8f0";
            
            if ([30, 60, 90, 180, 360].includes(periodicitaNum)) {
                filigranaPeriodo = PERIODICITA_MAP[periodicitaNum];
            } else {
                filigranaPeriodo = "VERIFICA FREQUENZA";
                coloreFiligrana = "#ef4444";
            }

            // Controlla tipi annotazioni
            const tipiAnnotazioni = mappaTipi[imp.impianto] || [];
            const hasTipo1 = tipiAnnotazioni.includes("1");
            const hasTipo2 = tipiAnnotazioni.includes("2");

            // Genera stringa icone
            let iconeAnnotazioni = "";
            if (hasTipo1) iconeAnnotazioni += '<span style="display:inline-block; width:12px; height:12px; background:#a855f7; border-radius:50%; margin-left:4px;" title="Tipo 1"></span>';
            if (hasTipo2) iconeAnnotazioni += '<span style="display:inline-block; width:12px; height:12px; background:#f59e0b; border-radius:50%; margin-left:4px;" title="Tipo 2"></span>';

            // --- LOGICA DATA E COLORE (INVARIATA) ---
            let coloreData = "#475569";
            let showGreenDot = false;
            let linguettaVerde = false;

            if (imp.ult_sem) {
                const parti = imp.ult_sem.includes('/') ? imp.ult_sem.split('/') : imp.ult_sem.split('-');
                const dataVisita = imp.ult_sem.includes('/') ? 
                    new Date(parti[2], parti[1] - 1, parti[0]) : new Date(parti[0], parti[1] - 1, parti[2]);
                
                const oggi = new Date();
                const diffGiorni = (oggi - dataVisita) / (1000 * 60 * 60 * 24);
                
                const meseUltManutenzione = dataVisita.getMonth() + 1;
                const meseVisualizzato = meseSelezionato;
                const meseCorrente = new Date().getMonth() + 1;

                // Linguetta verde
                if (meseUltManutenzione === meseVisualizzato && meseVisualizzato === meseCorrente) {
                    linguettaVerde = true;
                }

                // Logica colore font e statistiche
                if (meseUltManutenzione === meseVisualizzato) {
                    coloreData = "#22c55e";
                    showGreenDot = true;
                    statistiche.nelMese++;
                } else if (diffGiorni <= 180) {
                    coloreData = "#000000";
                    showGreenDot = false;
                    statistiche.regolari++;
                } else {
                    coloreData = "#ef4444";
                    showGreenDot = false;
                    statistiche.inRitardo++;
                }
            } else {
                coloreData = "#ef4444";
                statistiche.inRitardo++;
            }

            // --- FILIGRANA SEMESTRALE ---
            const mP = parseInt(imp.mese_sem);
            let testoFiligrana = "";
            if (mP >= 1 && mP <= 12) {
                const mS = mP > 6 ? mP - 6 : mP + 6;
                const nomiMesi = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
                testoFiligrana = `${nomiMesi[mP-1]} - ${nomiMesi[mS-1]}`;
            }

            const card = document.createElement('div');

            // Determina colore bordo sinistro (linguetta)
            const borderColor = linguettaVerde ? "#22c55e" : "#3b82f6";

            card.style.cssText = `
                background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-left: 6px solid ${borderColor};
                display: flex; flex-direction: column; position: relative; overflow: hidden;
            `;

            card.innerHTML = `
                <div style="position: absolute; bottom: -5px; right: 30px; font-size: 1.8rem; font-weight: 900; color: #e2e8f0; z-index: 0; pointer-events: none; opacity: 0.8; letter-spacing: -1px;">
                    ${testoFiligrana}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; z-index: 1;">
                    <div style="flex:1; padding-right: 10px;">
                        <div style="font-size: 0.7rem; color: ${coloreFiligrana}; font-weight: 600; margin-bottom: 2px;">
                            ${filigranaPeriodo}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                            <div style="font-weight:800; color:#1e293b; font-size: 1rem;">${imp.impianto}</div>
                            ${iconeAnnotazioni}
                        </div>
                        <div style="font-size:0.8rem; color:#64748b; margin-top: 2px;">
                            ${imp.Indirizzo}${imp.localit ? ' - ' + imp.localit : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; margin-top: 10px; color: ${coloreData};">
                            <span class="material-symbols-rounded" style="font-size: 16px;">calendar_today</span>
                            ${showGreenDot ? '<span style="display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:3px;"></span>' : ''}
                            <span style="font-size: 0.85rem; font-weight: 800;">${imp.ult_sem || '---'}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px;">
                        <button onclick="vaiAEsegui('${imp.impianto}', '${imp.Indirizzo.replace(/'/g, "\\'")}')" 
                            style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
                        </button>
                        <button onclick="apriAnnotazioni('${imp.impianto}')" 
                            style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">note_add</span>
                        </button>
                        <button style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #ef4444; color: white; display: flex; align-items: center; justify-content: center; opacity: 0.8;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
                        </button>
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });

        // 8. AGGIUNGI FOOTER CON STATISTICHE
        const footer = document.createElement('div');
        footer.innerHTML = creaFooter(statistiche);
        lista.appendChild(footer);

    } catch (err) {
        console.error("Errore:", err);
        lista.innerHTML = `<div style='color:red; text-align:center;'>Errore: ${err.message}</div>`;
    }
}

function vaiAEsegui(codice, indirizzo) {
    localStorage.setItem('selected_plant', JSON.stringify({ impianto: codice, indirizzo: indirizzo }));
    window.location.href = `nuovo_lavoro.html?id=${codice}`;
}

function apriAnnotazioni(codiceImpianto) {
    window.location.href = `annotazioni.html?impianto=${codiceImpianto}`;
}


// Aggiungi all'inizio del file, dopo le altre variabili
let filtroPeriodicitaAttivo = 'tutti';

// Funzione per cambiare filtro periodicità
function cambiaFiltroPeriodicita(tipo) {
    // Se clicchi sul filtro già attivo, torna a TUTTI
    if (filtroPeriodicitaAttivo === tipo) {
        tipo = 'tutti';
    }
    
    // Aggiorna stato
    filtroPeriodicitaAttivo = tipo;
    
    // Aggiorna UI pulsanti
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('filtro-attivo');
    });
    
    // Attiva pulsante corrente
    const btnId = 'btn-' + tipo;
    const btnAttivo = document.getElementById(btnId);
    if (btnAttivo) {
        btnAttivo.classList.add('filtro-attivo');
    }


    // Aggiorna badge
    aggiornaBadgeFiltro();
    
    // Ricarica manutenzioni
    caricaManutenzioni();



}

// Funzione per applicare filtro periodicità
function applicaFiltroPeriodicita(impianti) {
    if (filtroPeriodicitaAttivo === 'tutti') {
        return impianti;
    }
    
    const meseSelezionato = parseInt(document.getElementById('select-mese').value);
    
    return impianti.filter(imp => {
        const period = parseInt(imp.periodicit) || 0;
        const meseSem = parseInt(imp.mese_sem) || 0;
        
        switch (filtroPeriodicitaAttivo) {
            case 'sem':
                // Filtra per SEMESTRALE (180 giorni)
                if (period !== 180) return false;
                
                // Se c'è mese selezionato, applica logica doppia semestre
                if (meseSelezionato > 0) {
                    // Calcola mese complementare
                    const meseComp = meseSem <= 6 ? meseSem + 6 : meseSem - 6;
                    return meseSem === meseSelezionato || meseComp === meseSelezionato;
                }
                return true;
                
            case 'tri':
                // Filtra per TRIMESTRALE (90-179 giorni)
                return period >= 90 && period <= 179;
                
            case 'bimmen':
                // Filtra per BIMENSILE/MENSILE (0-89 giorni)
                return period >= 0 && period <= 89;
                
            default:
                return true;
        }
    });
}

function aggiornaBadgeFiltro() {
    const badge = document.getElementById('filtro-attivo-badge');
    if (!badge) return;
    
    const mappaTesti = {
        'tutti': 'TUTTI',
        'sem': 'SEM',
        'tri': 'TRI', 
        'bimmen': 'BIM/MEN'
    };
    
    const testo = mappaTesti[filtroPeriodicitaAttivo] || 'TUTTI';
    badge.textContent = testo;
}



// Aggiungi dopo le altre funzioni, prima della fine del file
function resetFiltroPeriodicita() {
    // Torna a TUTTI
    filtroPeriodicitaAttivo = 'tutti';
    
    // Aggiorna UI pulsanti
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('filtro-attivo');
    });
    
    // Attiva solo il pulsante TUTTI
    const btnTutti = document.getElementById('btn-tutti');
    if (btnTutti) {
        btnTutti.classList.add('filtro-attivo');
    }
    
    // Aggiorna badge se esiste
    const badge = document.getElementById('filtro-attivo-badge');
    if (badge) {
        badge.textContent = 'TUTTI';
    }
    
    console.log('Filtro periodicità resettato a TUTTI');
}