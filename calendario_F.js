const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentEvents = [];
const tecnicoLoggato = localStorage.getItem('tecnico_loggato');
const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

document.addEventListener('DOMContentLoaded', () => {
    if (!tecnicoLoggato) {
        window.location.href = 'index.html';
        return;
    }
    initSelectors();
    fetchMese();
});

function initSelectors() {
    const selectMese = document.getElementById('select-mese');
    const selectAnno = document.getElementById('select-anno');
    const oggi = new Date();

    selectMese.innerHTML = '';
    mesiNomi.forEach((m, i) => {
        let opt = document.createElement('option');
        opt.value = i + 1;
        opt.innerText = m;
        if (i === oggi.getMonth()) opt.selected = true;
        selectMese.appendChild(opt);
    });

    selectAnno.innerHTML = '';
    for (let i = 2024; i <= 2026; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.innerText = i;
        if (i === oggi.getFullYear()) opt.selected = true;
        selectAnno.appendChild(opt);
    }

    selectMese.onchange = fetchMese;
    selectAnno.onchange = fetchMese;
}

async function fetchMese() {
    const loading = document.getElementById('loading-overlay');
    const m = parseInt(document.getElementById('select-mese').value);
    const a = parseInt(document.getElementById('select-anno').value);
    
    if (loading) loading.style.display = 'block';
    document.getElementById('day-detail').style.display = 'none';

    try {
        const { data, error } = await supabaseClient
            .from('fogliolavoro')
            .select('*')
            .eq('tecnico', tecnicoLoggato)
            .eq('mese', m)
            .eq('anno', a);

        if (error) throw error;
        currentEvents = data || [];
        
        console.log('Dati caricati:', currentEvents.length, 'interventi');
        if (currentEvents.length > 0) {
            console.log('Primi 3 interventi:', currentEvents.slice(0, 3));
        }
        
        renderCalendar();
        calcolaReportMensile();
        setupReportTooltips();

    } catch (err) {
        console.error("ERRORE SUPABASE:", err);
        resetReport();
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const selectMese = document.getElementById('select-mese');
    const selectAnno = document.getElementById('select-anno');
    
    container.innerHTML = '';
    
    // Intestazione giorni (L M M G V S D)
    ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(g => {
        container.innerHTML += `<div class="calendar-day header">${g}</div>`;
    });

    const m = parseInt(selectMese.value) - 1;
    const a = parseInt(selectAnno.value);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0); 

    const primoGiorno = new Date(a, m, 1).getDay();
    const offset = (primoGiorno === 0) ? 6 : primoGiorno - 1;
    const giorniMese = new Date(a, m + 1, 0).getDate();

    // Celle vuote iniziali
    for (let i = 0; i < offset; i++) {
        container.innerHTML += `<div class="calendar-day" style="background:transparent; cursor:default;"></div>`;
    }

    // Generazione giorni del mese
    for (let d = 1; d <= giorniMese; d++) {
        const dataCorrente = new Date(a, m, d);
        const giornoSettimana = dataCorrente.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
        const isFeriale = giornoSettimana !== 0 && giornoSettimana !== 6;
        const isGiornoFestivo = isFestivo(dataCorrente);
        const isPassato = dataCorrente <= oggi;

        // Filtro interventi e calcolo ore ordinarie totali del giorno
        const interventiGiorno = currentEvents.filter(e => parseInt(e.giorno) === d);
        let oreOrdinarieTotali = 0;
        interventiGiorno.forEach(e => {
            const o = parseFloat(String(e.ore_ord || 0).replace(',', '.'));
            oreOrdinarieTotali += o;
        });

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerText = d;

        // --- 1. COLORAZIONE ESTETICA (Sfondo) ---
        if (isGiornoFestivo || giornoSettimana === 0) {
            // Sfondo rosso chiaro per festivi e domeniche
            dayEl.style.backgroundColor = '#fee2e2'; 
            dayEl.style.color = '#b91c1c';           
            dayEl.title = isGiornoFestivo ? "Giorno Festivo" : "Domenica";
            dayEl.style.fontWeight = "800";
        } else if (giornoSettimana === 6) {
            // Grigio chiaro per i sabati
            dayEl.style.backgroundColor = '#f1f5f9';
        }

        // --- 2. LOGICA AVVISI/PALLINI (Controllo 8h su Lun-Ven, inclusi i festivi) ---
        if (isFeriale && isPassato) {
            // Essendo un giorno feriale (Lun-Ven), deve avere 8 ore anche se festivo
            if (oreOrdinarieTotali === 8) {
                dayEl.classList.add('status-ok');      // VERDE: 8h precise
            } else if (oreOrdinarieTotali > 0 && oreOrdinarieTotali < 8) {
                dayEl.classList.add('status-warning'); // GIALLO: Incompleto
            } else {
                // ROSSO: 0 ore inserite o più di 8 ore (es. 8.50)
                dayEl.classList.add('status-error');   
            }
        } else if (interventiGiorno.length > 0) {
            // Per i weekend o giorni futuri, pallino blu standard se ci sono dati
            dayEl.classList.add('has-events');
        }

        // Click per i dettagli
        dayEl.onclick = () => showDetail(d, dayEl);
        container.appendChild(dayEl);
    }
}

function showDetail(giorno, element) {
    // Gestione selezione grafica sul calendario
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    // Filtro interventi del giorno selezionato
    const evts = currentEvents.filter(e => parseInt(e.giorno) === giorno);
    const detail = document.getElementById('day-detail');
    const list = document.getElementById('events-list');
    
    // CONTROLLO BLOCCAGGIO MESE
    const meseSelezionato = parseInt(document.getElementById('select-mese').value);
    const annoSelezionato = parseInt(document.getElementById('select-anno').value);
    const meseBloccato = isMeseBloccato(meseSelezionato, annoSelezionato);
    
    // Aggiornamento titolo dettaglio con eventuale lucchetto
    const titoloElement = document.getElementById('selected-date-title');
    let titoloBase = giorno + " " + mesiNomi[meseSelezionato-1];
    
    if (meseBloccato) {
        titoloElement.innerHTML = `
            ${titoloBase} 
            <span style="color:#ef4444; font-size:0.9rem; margin-left:8px;">
                <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle;">lock</span>
                BLOCCATO
            </span>
        `;
    } else {
        titoloElement.innerText = titoloBase;
    }
    
    detail.style.display = 'block';
    list.innerHTML = '';

    let tOrd = 0, tStra = 0, tViag = 0;

    if (evts.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.6;">Nessun intervento oggi.</p>';
    } else {
        evts.forEach(e => {
            // Calcolo ore con gestione virgola/punto
            const oreO = parseFloat(String(e.ore_ord || 0).replace(',', '.'));
            const oreS = parseFloat(String(e.ore_stra || 0).replace(',', '.'));
            const oreV = parseFloat(String(e.ore_viaggio || 0).replace(',', '.'));
            tOrd += oreO; tStra += oreS; tViag += oreV;

            // Mappatura Icone e Stili
            const tipi = {
                'ORDINARIA': { bg: 'rgba(255,255,255,0.9)', txt: '#475569', icon: 'build_circle' },
                'REPERIBILITÀ': { bg: 'rgba(239,68,68,0.15)', txt: '#b91c1c', icon: 'e911_emergency' },
                'ALTRO': { bg: 'rgba(234,179,8,0.15)', txt: '#a16207', icon: 'pending_actions' },
                'MONTAGGIO': { bg: 'rgba(59,130,246,0.15)', txt: '#1d4ed8', icon: 'precision_manufacturing' },
                'STRAORDINARIO': { bg: 'rgba(249,115,22,0.15)', txt: '#c2410c', icon: 'handyman' },
                'Attività in Filiale': { bg: 'rgba(100,116,139,0.15)', txt: '#334155', icon: 'domain' }
            };

            const stile = tipi[e.ch_rep] || tipi['ALTRO'];
            
            // Formattazione Orari (nasconde se 00:00)
            const ini = (e.inizio_int && e.inizio_int !== '00:00:00' && e.inizio_int !== '00:00') ? e.inizio_int.substring(0,5) : '';
            const fin = (e.fine_int && e.fine_int !== '00:00:00' && e.fine_int !== '00:00') ? e.fine_int.substring(0,5) : '';
            const orarioLabel = (ini && fin) ? `${ini} / ${fin}` : '';

            // LOGICA GESTIONE N/D E TITOLO MAGGIORATO
            const haImpianto = e.impianto && e.impianto !== 'N/D' && e.impianto.trim() !== '';
            const titoloVisibile = haImpianto ? e.impianto : e.indirizzo;
            const sottotitoloVisibile = haImpianto ? e.indirizzo : '';
            const fontTitolo = haImpianto ? '1.1rem' : '1.8rem';

            // CONTROLLI PER TASTI MODIFICA/CANCELLA
            const isAltro = e.ch_rep === 'ALTRO';
            const showModifica = !isAltro && !meseBloccato;
            const showCancella = !meseBloccato;

            const card = document.createElement('div');
            card.className = 'section-card';
            card.style.cssText = `
                background: ${stile.bg};
                border-left: 6px solid ${stile.txt};
                padding: 16px;
                margin-bottom: 14px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            `;
            
            card.innerHTML = `
    <div style="position: absolute; right: 10px; bottom: -10px; font-size: 3.5rem; font-weight: 900; color: rgba(0,0,0,0.05); pointer-events: none; user-select: none; z-index: 0;">
        ${e.codice || ''}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:flex-start; position: relative; z-index: 1;">
        <div style="flex:1">
            <div style="display:flex; align-items:center; gap:6px; color:${stile.txt}; margin-bottom:6px;">
                <span class="material-symbols-rounded" style="font-size:18px;">${stile.icon}</span>
                <span style="font-weight:800; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.6px;">${e.ch_rep}</span>
            </div>
            
            <div style="font-weight:900; color:#1e293b; font-size:${fontTitolo}; line-height:1.2; margin-bottom:4px;">
                ${titoloVisibile}
            </div>
            
            ${sottotitoloVisibile ? `<div style="font-size:0.9rem; color:#64748b; font-weight:500;">${sottotitoloVisibile}</div>` : ''}
            
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                ${oreO > 0 ? `<div style="display:flex; align-items:center; gap:4px; font-size:0.85rem; font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:4px;"><span class="material-symbols-rounded" style="font-size:16px;">schedule</span>${oreO.toFixed(2)}</div>` : ''}
                ${oreS > 0 ? `<div style="display:flex; align-items:center; gap:4px; font-size:0.85rem; font-weight:800; color:#dc2626; background:#fef2f2; padding:2px 6px; border-radius:4px;"><span class="material-symbols-rounded" style="font-size:16px;">bolt</span>${oreS.toFixed(2)}</div>` : ''}
                ${oreV > 0 ? `<div style="display:flex; align-items:center; gap:4px; font-size:0.85rem; font-weight:800; color:#16a34a; background:#f0fdf4; padding:2px 6px; border-radius:4px;"><span class="material-symbols-rounded" style="font-size:16px;">directions_car</span>${oreV.toFixed(2)}</div>` : ''}
            </div>
        </div>
        
        <div style="text-align:right; font-weight:900; font-size:0.95rem; color:#1e293b; background: rgba(255,255,255,0.6); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05);">
            ${orarioLabel}
        </div>
    </div>

    <div style="display:flex; justify-content:flex-start; align-items:center; gap:20px; margin-top:8px; position: relative; z-index: 2;">
        
        ${showModifica ? `
        <button onclick="modificaIntervento(${JSON.stringify(e).replace(/"/g, '&quot;')})" 
                style="background:none; border:none; color:#2563eb; display:flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:800; cursor:pointer; padding:0; text-transform:uppercase;">
            <span class="material-symbols-rounded" style="font-size:18px;">edit</span> MODIFICA
        </button>` : ''}

        ${showCancella ? `
        <button onclick="eliminaIntervento('${e.ID}')" 
                style="background:none; border:none; color:#ef4444; display:flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:800; cursor:pointer; padding:0; text-transform:uppercase;">
            <span class="material-symbols-rounded" style="font-size:18px;">delete</span> CANCELLA
        </button>` : `
        <span style="color:#94a3b8; font-size:0.75rem; font-weight:600; display:flex; align-items:center; gap:4px;">
            <span class="material-symbols-rounded" style="font-size:18px;">lock</span>
            Modifiche bloccate
        </span>`}

    </div>
`;
            list.appendChild(card);
        });
    }

    // Aggiornamento statistiche a fondo pagina
    document.getElementById('sum-ord').innerText = tOrd.toFixed(2);
    document.getElementById('sum-stra').innerText = tStra.toFixed(2);
    document.getElementById('sum-viag').innerText = tViag.toFixed(2);
    
    // Scroll automatico verso il dettaglio
    setTimeout(() => {
        detail.scrollIntoView({ behavior: 'smooth' });
    }, 150);
}

function isMeseBloccato(mese, anno) {
    const oggi = new Date();
    const annoCorrente = oggi.getFullYear();
    const meseCorrente = oggi.getMonth() + 1;
    const giornoOggi = oggi.getDate();
    
    // 1. Mese corrente: sempre modificabile
    if (anno === annoCorrente && mese === meseCorrente) {
        return false;
    }
    
    // 2. Mese precedente: controlla se siamo oltre il giorno 5
    if (anno === annoCorrente && mese === meseCorrente - 1) {
        return giornoOggi > 5;
    }
    
    // 3. Mese precedente ma con cambio anno
    if (anno === annoCorrente - 1 && mese === 12 && meseCorrente === 1) {
        return giornoOggi > 5;
    }
    
    // 4. Tutti gli altri mesi passati: sempre bloccati
    if (anno < annoCorrente || (anno === annoCorrente && mese < meseCorrente - 1)) {
        return true;
    }
    
    // 5. Mesi futuri: non bloccati
    return false;
}

function isFestivo(data) {
    const d = data.getDate();
    const m = data.getMonth() + 1;
    const y = data.getFullYear();

    // 1. Festività Fisse + San Petronio (4 Ottobre)
    const festiviFissi = [
        "1-1",   // Capodanno
        "6-1",   // Epifania
        "25-4",  // Liberazione
        "1-5",   // Festa del Lavoro
        "2-6",   // Festa della Repubblica
        "15-8",  // Ferragosto
        "4-10",  // San Petronio (Bologna)
        "1-11",  // Ognissanti
        "8-12",  // Immacolata
        "25-12", // Natale
        "26-12"  // S. Stefano
    ];

    const chiave = `${d}-${m}`;
    if (festiviFissi.includes(chiave)) return true;

    // 2. Calcolo Pasqua e Pasquetta
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d_div = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d_div - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const n = Math.floor((a + 11 * h + 22 * l) / 451);
    const mesePasqua = Math.floor((h + l - 7 * n + 114) / 31);
    const giornoPasqua = ((h + l - 7 * n + 114) % 31) + 1;

    // Pasqua
    if (d === giornoPasqua && m === mesePasqua) return true;

    // Pasquetta
    const dataPasquetta = new Date(y, mesePasqua - 1, giornoPasqua + 1);
    if (d === dataPasquetta.getDate() && m === (dataPasquetta.getMonth() + 1)) return true;

    return false;
}

async function eliminaIntervento(idDaCancellare) {
    const intervento = currentEvents.find(e => e.ID === idDaCancellare);
    if (intervento) {
        const meseIntervento = parseInt(intervento.mese);
        const annoIntervento = parseInt(intervento.anno);
        
        if (isMeseBloccato(meseIntervento, annoIntervento)) {
            alert("⚠️ Non puoi cancellare interventi di mesi bloccati.\nIl mese è stato chiuso per la rendicontazione.");
            return;
        }
        
        if (intervento.ch_rep === 'ALTRO') {
            const confermaAltro = confirm("Stai per cancellare una voce 'ALTRO' (permesso/ferie/malattia).\nSei sicuro di voler procedere?\n\nDopo la cancellazione, dovrai inserire nuovamente la voce corretta.");
            if (!confermaAltro) return;
        }
    }
    
    const conferma = confirm("Sei sicuro di voler eliminare definitivamente questo intervento?");
    if (!conferma) return;

    try {
        const { error } = await supabaseClient
            .from('fogliolavoro')
            .delete()
            .eq('ID', idDaCancellare);

        if (error) throw error;

        alert("Intervento eliminato con successo.");
        
        const modal = document.getElementById('modal-details');
        if (modal) {
            modal.style.display = 'none';
        }

        fetchMese();

    } catch (err) {
        console.error("Errore:", err.message);
        alert("Errore durante la cancellazione: " + err.message);
    }
}

function modificaIntervento(intervento) {
    const meseIntervento = parseInt(intervento.mese);
    const annoIntervento = parseInt(intervento.anno);
    
    if (isMeseBloccato(meseIntervento, annoIntervento)) {
        alert("⚠️ Non puoi modificare interventi di mesi bloccati.\nIl mese è stato chiuso per la rendicontazione.");
        return;
    }
    
    if (intervento.ch_rep === 'ALTRO') {
        alert("⚠️ Le voci 'ALTRO' (permessi/ferie/malattia) non possono essere modificate.\n\nSe hai sbagliato, cancella questa voce e inseriscine una nuova.");
        return;
    }
    
    // DETERMINA LA PAGINA CORRETTA PER LA MODIFICA
    let urlDestinazione = '';
    
    if (intervento.ch_rep === 'MONTAGGIO') {
        // MONTAGGIO → va a nuovo_lavoro_montaggi.html con parametro edit
        urlDestinazione = `nuovo_lavoro_montaggi.html?id=${intervento.impianto}&mode=edit`;
    } else {
        // ALTRI TIPI (ORDINARIA, STRAORDINARIO, REPERIBILITÀ) → va a nuovo_lavoro.html
        urlDestinazione = `nuovo_lavoro.html?id=${intervento.impianto}&mode=edit`;
    }
    
    // Salva i dati dell'intervento per la modifica
    localStorage.setItem('edit_intervento', JSON.stringify(intervento));
    
    console.log('Reindirizzamento a:', urlDestinazione);
    
    // Reindirizza alla pagina corretta
    window.location.href = urlDestinazione;
}

// FUNZIONE REPORT MENSILE
// FUNZIONE REPORT MENSILE (con correzioni per assenze in ore e giorni corretti)
function calcolaReportMensile() {
    const m = parseInt(document.getElementById('select-mese').value);
    const a = parseInt(document.getElementById('select-anno').value);
    
    // Aggiorna titolo
    const titoloElement = document.getElementById('report-mese-titolo');
    if (titoloElement) {
        titoloElement.innerText = `Report ${mesiNomi[m-1]} ${a}`;
    }
    
    console.log('Calcolo report per:', m, '/', a);
    console.log('Interventi disponibili:', currentEvents.length);
    
    if (currentEvents.length === 0) {
        console.log('Nessun dato, resettando report');
        resetReport();
        return;
    }
    
    // CODICI ASSENZE (72-92 inclusi)
    const CODICI_ASSENZE = [];
    for (let i = 72; i <= 92; i++) {
        CODICI_ASSENZE.push(i.toString());
    }
    
    // INIZIALIZZA CONTATORI
    let totOreOrdinarie = 0;
    let totOreStraordinarie = 0;
    let totOreViaggio = 0;
    let totOreAssenza = 0;
    let totOreLavoroVero = 0;
    
    // Mappa per raggruppare per giorno
    const giorniMap = new Map();
    
    // PRIMA FASE: Processa TUTTI gli interventi
    currentEvents.forEach(e => {
        const giorno = parseInt(e.giorno);
        const codice = e.codice ? e.codice.toString() : '';
        const oreO = parseFloat(String(e.ore_ord || 0).replace(',', '.')) || 0;
        const oreS = parseFloat(String(e.ore_stra || 0).replace(',', '.')) || 0;
        const oreV = parseFloat(String(e.ore_viaggio || 0).replace(',', '.')) || 0;
        const isAltro = e.ch_rep === 'ALTRO';
        const isAssenza = CODICI_ASSENZE.includes(codice) || isAltro;
        
        // Inizializza giorno se non esiste
        if (!giorniMap.has(giorno)) {
            giorniMap.set(giorno, {
                oreOrdTotali: 0,
                oreOrdLavoro: 0,
                oreStra: 0,
                oreViag: 0,
                oreAssenza: 0,
                oreLavoroVero: 0
            });
        }
        
        const datiGiorno = giorniMap.get(giorno);
        
        // Aggiorna totali globali
        totOreOrdinarie += oreO;
        datiGiorno.oreOrdTotali += oreO;
        
        // SE È ASSENZA
        if (isAssenza) {
            datiGiorno.oreAssenza += oreO;
            totOreAssenza += oreO;
            
            if (oreS > 0) {
                datiGiorno.oreStra += oreS;
                totOreStraordinarie += oreS;
                datiGiorno.oreLavoroVero += oreS;
                totOreLavoroVero += oreS;
            }
            
            if (oreV > 0) {
                datiGiorno.oreViag += oreV;
                totOreViaggio += oreV;
            }
        } 
        // SE È LAVORO NORMALE
        else {
            datiGiorno.oreOrdLavoro += oreO;
            datiGiorno.oreLavoroVero += oreO;
            totOreLavoroVero += oreO;
            
            if (oreS > 0) {
                datiGiorno.oreStra += oreS;
                datiGiorno.oreLavoroVero += oreS;
                totOreStraordinarie += oreS;
                totOreLavoroVero += oreS;
            }
            
            if (oreV > 0) {
                datiGiorno.oreViag += oreV;
                totOreViaggio += oreV;
            }
        }
    });
    
    console.log('Totale ore ordinarie:', totOreOrdinarie);
    console.log('Totale ore lavoro vero:', totOreLavoroVero);
    console.log('Totale ore assenza:', totOreAssenza);
    
    // SECONDA FASE: Calcola statistiche per giorno
    const giorniConLavoroVero = new Set();
    const giorniConStra = new Set();
    const giorniConViag = new Set();
    const giorniConAssenza = new Set();
    const giorniAssenzaParziale = new Set();
    const giorniAssenzaTotale = new Set();
    
    giorniMap.forEach((dati, giorno) => {
        const oreLavoroVero = Math.round(dati.oreLavoroVero * 100) / 100;
        const oreStra = Math.round(dati.oreStra * 100) / 100;
        const oreViag = Math.round(dati.oreViag * 100) / 100;
        const oreAss = Math.round(dati.oreAssenza * 100) / 100;
        
        if (oreLavoroVero > 0.009) {
            giorniConLavoroVero.add(giorno);
        }
        if (oreStra > 0.009) {
            giorniConStra.add(giorno);
        }
        if (oreViag > 0.009) {
            giorniConViag.add(giorno);
        }
        if (oreAss > 0.009) {
            giorniConAssenza.add(giorno);
            
            if (oreAss >= 7.99 && oreAss <= 8.01) {
                giorniAssenzaTotale.add(giorno);
            } else {
                giorniAssenzaParziale.add(giorno);
            }
        }
    });
    
    // TERZA FASE: Calcola ore teoriche del mese
    const giorniMese = new Date(a, m, 0).getDate();
    let giorniLavorativiTeorici = 0;
    let oreTeoricheMensili = 0;
    
    for (let d = 1; d <= giorniMese; d++) {
        const dataCorrente = new Date(a, m-1, d);
        const giornoSettimana = dataCorrente.getDay();
        const isFestivoCalendario = isFestivo(dataCorrente);
        
        if (giornoSettimana >= 1 && giornoSettimana <= 5 && !isFestivoCalendario) {
            giorniLavorativiTeorici++;
            oreTeoricheMensili += 8;
        }
    }
    
    // QUARTA FASE: Calcola percentuale completamento
    const percentCompletato = oreTeoricheMensili > 0 ? 
        Math.min(100, (totOreOrdinarie / oreTeoricheMensili) * 100) : 0;
    
    const oreMancanti = Math.max(0, oreTeoricheMensili - totOreOrdinarie);
    const oreInEccesso = Math.max(0, totOreOrdinarie - oreTeoricheMensili);
    
    const giorniLavoratiEffettivi = giorniConLavoroVero.size;
    const mediaOreLavoroPerGiorno = giorniLavoratiEffettivi > 0 ? 
        (totOreLavoroVero / giorniLavoratiEffettivi).toFixed(2) : "0.00";
    
    const percentGiorniStra = giorniLavoratiEffettivi > 0 ? 
        ((giorniConStra.size / giorniLavoratiEffettivi) * 100).toFixed(1) : "0.0";
    
    // QUINTA FASE: Aggiorna UI con CORREZIONI
    // 1. ORE ORDINARIE TOTALI
    document.getElementById('report-ore-ord').innerText = totOreOrdinarie.toFixed(2);
    const giorniLavoroTesto = giorniConLavoroVero.size === 1 ? 'giorno' : 'giorni';
    document.getElementById('report-ore-ord-giorni').innerText = 
        `${giorniConLavoroVero.size} ${giorniLavoroTesto}`;
    
    // 2. ORE STRAORDINARIE
    document.getElementById('report-ore-stra').innerText = totOreStraordinarie.toFixed(2);
    const giorniStraTesto = giorniConStra.size === 1 ? 'giorno' : 'giorni';
    document.getElementById('report-ore-stra-giorni').innerText = 
        `${giorniConStra.size} ${giorniStraTesto}`;
    
    // 3. ORE VIAGGIO
    document.getElementById('report-ore-viag').innerText = totOreViaggio.toFixed(2);
    const giorniViagTesto = giorniConViag.size === 1 ? 'giorno' : 'giorni';
    document.getElementById('report-ore-viag-giorni').innerText = 
        `${giorniConViag.size} ${giorniViagTesto}`;
    
    // 4. ASSENZE IN ORE (CORRETTO!)
    document.getElementById('report-assenze').innerText = totOreAssenza.toFixed(2);
    const giorniAssenzaTesto = giorniConAssenza.size === 1 ? 'giorno' : 'giorni';
    document.getElementById('report-assenze-giorni').innerText = 
        `${giorniConAssenza.size} ${giorniAssenzaTesto}`;
    
    // 5. PROGRESS BAR
    const progressBar = document.getElementById('report-progress-bar');
    document.getElementById('report-progress-text').innerText = 
        `${totOreOrdinarie.toFixed(0)}/${oreTeoricheMensili} ore`;
    progressBar.style.width = `${percentCompletato}%`;
    document.getElementById('report-progress-percent').innerText = 
        `${percentCompletato.toFixed(1)}%`;
    
    // Colore dinamico progress bar
    if (percentCompletato >= 100) {
        progressBar.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
    } else if (percentCompletato >= 80) {
        progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #eab308)';
    } else if (percentCompletato >= 50) {
        progressBar.style.background = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }
    
    // SESTA FASE: Statistiche avanzate
    updateAdvancedStats(
        giorniLavorativiTeorici,
        oreTeoricheMensili,
        mediaOreLavoroPerGiorno,
        percentGiorniStra,
        totOreAssenza,  // Passa le ORE, non i giorni
        giorniAssenzaParziale.size,
        giorniAssenzaTotale.size,
        giorniConLavoroVero.size,
        giorniMese,
        oreMancanti,
        oreInEccesso
    );
}

function updateAdvancedStats(
    giorniLavorativiTeorici,
    oreTeoricheMensili,
    mediaOreLavoroPerGiorno,
    percentGiorniStra,
    totOreAssenza,
    giorniAssenzaParziale,
    giorniAssenzaTotale,
    giorniLavoratiEffettivi,
    giorniMeseTotali,
    oreMancanti,
    oreInEccesso
) {
    // Aggiorna solo gli elementi che esistono
    const elements = {
        'report-giorni-lavorativi': `${giorniLavorativiTeorici} giorni (${oreTeoricheMensili} ore)`,
        'report-media-ore': `${mediaOreLavoroPerGiorno}h`,
        'report-perc-stra': `${percentGiorniStra}%`,
        'report-ore-assenze': `${totOreAssenza.toFixed(0)} ore`,
        'report-assenze-parziali': `${giorniAssenzaParziale} giorni`,
        'report-assenze-totali': `${giorniAssenzaTotale} giorni`,
        'report-giorni-lavorati': `${giorniLavoratiEffettivi} su ${giorniMeseTotali} giorni`,
        'report-ore-mancanti': `${oreMancanti.toFixed(0)} ore`,
        'report-ore-eccesso': `${oreInEccesso.toFixed(0)} ore`
    };
    
    Object.keys(elements).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = elements[id];
    });
}

function resetReport() {
    // Reset valori base
    const baseElements = [
        {id: 'report-ore-ord', value: '0'},
        {id: 'report-ore-ord-giorni', value: '0 giorni'},
        {id: 'report-ore-stra', value: '0'},
        {id: 'report-ore-stra-giorni', value: '0 giorni'},
        {id: 'report-ore-viag', value: '0'},
        {id: 'report-ore-viag-giorni', value: '0 giorni'},
        {id: 'report-assenze', value: '0'},
        {id: 'report-assenze-giorni', value: '0 giorni'},
        {id: 'report-progress-text', value: '0/0 ore'},
        {id: 'report-progress-percent', value: '0%'}
    ];
    
    baseElements.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) el.innerText = item.value;
    });
    
    // Reset progress bar
    const progressBar = document.getElementById('report-progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.background = 'linear-gradient(90deg, #2563eb, #3b82f6)';
    }
    
    // Reset statistiche avanzate
    const advancedElements = [
        'report-giorni-lavorativi',
        'report-media-ore',
        'report-perc-stra',
        'report-ore-assenze',
        'report-assenze-parziali',
        'report-assenze-totali',
        'report-giorni-lavorati',
        'report-ore-mancanti',
        'report-ore-eccesso'
    ];
    
    advancedElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '0';
    });
}

function setupReportTooltips() {
    // Tooltip per ore ordinarie
    const ordEl = document.getElementById('report-ore-ord').parentElement.parentElement;
    ordEl.title = "Somma di tutte le ore ordinarie lavorate nel mese";
    ordEl.style.cursor = "help";
    
    // Tooltip per ore straordinarie
    const straEl = document.getElementById('report-ore-stra').parentElement.parentElement;
    straEl.title = "Somma di tutte le ore straordinarie lavorate nel mese";
    straEl.style.cursor = "help";
    
    // Tooltip per ore viaggio
    const viagEl = document.getElementById('report-ore-viag').parentElement.parentElement;
    viagEl.title = "Somma di tutte le ore di viaggio nel mese";
    viagEl.style.cursor = "help";
    
       // Tooltip per assenze
    const assenzeEl = document.getElementById('report-assenze').parentElement.parentElement;
    assenzeEl.title = "Ore totali di assenza (permessi, ferie, malattia)";
    assenzeEl.style.cursor = "help";
    
    // Tooltip per progress bar
    const progressEl = document.getElementById('report-progress-bar').parentElement.parentElement;
    progressEl.title = "Progresso ore ordinarie su obiettivo mensile";
    progressEl.style.cursor = "help";
}