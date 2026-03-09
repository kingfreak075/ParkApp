// ✅ SOSTITUITO CON CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraErroreDB('Connessione al database non disponibile');
}

// 3. Funzione errore DB (INVARIATA)
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

let currentEvents = [];
// ✅ SOSTITUITO con authGetUtente()
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;
const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

document.addEventListener('DOMContentLoaded', () => {
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        alert('Errore di connessione al database');
        return;
    }
    
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
    
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        alert('Errore di connessione al database');
        return;
    }
    
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
        
        renderCalendar();
        calcolaReportMensilePerTecnico();

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
        const giornoSettimana = dataCorrente.getDay();
        const isFeriale = giornoSettimana !== 0 && giornoSettimana !== 6;
        const isGiornoFestivo = isFestivo(dataCorrente);
        const isPassato = dataCorrente <= oggi;

        // Filtro interventi del giorno
        const interventiGiorno = currentEvents.filter(e => parseInt(e.giorno) === d);
        
        // Calcolo ore totali e tipo
        let oreOrdinarieTotali = 0;
        let oreStraordinarieTotali = 0;
        let oreViaggioTotali = 0;
        let isAssenzaGiorno = false;
        
        interventiGiorno.forEach(e => {
            const oreO = parseFloat(String(e.ore_ord || 0).replace(',', '.'));
            const oreS = parseFloat(String(e.ore_stra || 0).replace(',', '.'));
            const oreV = parseFloat(String(e.ore_viaggio || 0).replace(',', '.'));
            oreOrdinarieTotali += oreO;
            oreStraordinarieTotali += oreS;
            oreViaggioTotali += oreV;
            
            // Verifica se è assenza (codici 72-92 o ALTRO)
            const codice = e.codice ? e.codice.toString() : '';
            if ((codice >= '72' && codice <= '92') || e.ch_rep === 'ALTRO') {
                isAssenzaGiorno = true;
            }
        });

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerText = d;

        // --- COLORAZIONE ESTETICA (Sfondo) ---
        if (isGiornoFestivo || giornoSettimana === 0) {
            dayEl.style.backgroundColor = '#fee2e2';
            dayEl.style.color = '#b91c1c';
            dayEl.title = isGiornoFestivo ? "Giorno Festivo" : "Domenica";
            dayEl.style.fontWeight = "800";
        } else if (giornoSettimana === 6) {
            dayEl.style.backgroundColor = '#f1f5f9';
        }

        // --- LOGICA PALLINI PER TECNICO (SOLO giorni feriali passati) ---
        if (isFeriale && isPassato) {
            if (isAssenzaGiorno) {
                // GIORNO CON ASSENZA → VERIFICA SE COMPLETO
                
                // Calcola ore TOTALI del giorno (assenza + lavoro + straordinari)
                const oreTotaliGiorno = oreOrdinarieTotali + oreStraordinarieTotali;
                const isCompleto = Math.abs(oreTotaliGiorno - 8) < 0.01;
                
                if (isCompleto) {
                    // ASSENZA COMPLETA: 8 ore totali (bordo VERDE)
                    dayEl.classList.add('status-assenza-completa');
                    dayEl.title = `Assenza: ${oreOrdinarieTotali.toFixed(2)} ore (8 ore totali - COMPLETO)`;
                } else {
                    // ASSENZA INCOMPLETA: meno di 8 ore totali (bordo ROSSO)
                    dayEl.classList.add('status-assenza-incompleta');
                    const oreMancanti = 8 - oreTotaliGiorno;
                    dayEl.title = `Assenza: ${oreOrdinarieTotali.toFixed(2)} ore (mancano ${oreMancanti.toFixed(2)} ore totali)`;
                }
                
            } else if (Math.abs(oreOrdinarieTotali - 8) < 0.01) {
                // OK: 8 ore ordinarie esatte (senza assenze)
                dayEl.classList.add('status-ok');
                dayEl.title = `OK: 8 ore ordinarie`;
            } else if (oreOrdinarieTotali > 0 && oreOrdinarieTotali < 8) {
                // ATTENZIONE: Meno di 8 ore (senza assenze)
                dayEl.classList.add('status-warning');
                const oreMancanti = 8 - oreOrdinarieTotali;
                dayEl.title = `Attenzione: ${oreOrdinarieTotali.toFixed(2)} ore ordinarie (mancano ${oreMancanti.toFixed(2)} ore)`;
            } else if (oreOrdinarieTotali > 8) {
                // ERRORE: Più di 8 ore ordinarie
                dayEl.classList.add('status-error');
                const oreEccesso = oreOrdinarieTotali - 8;
                dayEl.title = `Errore: ${oreOrdinarieTotali.toFixed(2)} ore ordinarie (${oreEccesso.toFixed(2)} ore in eccesso, dovrebbero essere straordinari?)`;
            } else {
                // ERRORE: 0 ore ordinarie
                dayEl.classList.add('status-error');
                dayEl.title = `Errore: 0 ore ordinarie inserite`;
            }
        } else if (interventiGiorno.length > 0) {
            // Weekend o futuro con dati → pallino blu standard
            dayEl.classList.add('has-events');
            dayEl.title = `${interventiGiorno.length} intervento${interventiGiorno.length > 1 ? 'i' : ''}`;
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
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        alert('Errore di connessione al database');
        return;
    }
    
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
        urlDestinazione = `nuovo_lavoro_montaggi.html?id=${intervento.impianto}&mode=edit`;
    } else {
        urlDestinazione = `nuovo_lavoro.html?id=${intervento.impianto}&mode=edit`;
    }
    
    // ✅ AGGIUNGI UN PARAMETRO PER SAPERE CHE SIAMO IN MODIFICA DAL CALENDARIO
    urlDestinazione += '&from=calendario';
    
    // Salva i dati dell'intervento per la modifica
    localStorage.setItem('edit_intervento', JSON.stringify(intervento));
    
    console.log('Reindirizzamento a:', urlDestinazione);
    
    // Reindirizza alla pagina corretta
    window.location.href = urlDestinazione;
}
// ============================================================================
// FUNZIONI REPORT MENSILE PER TECNICO (COMPLETAMENTE RISCRITTE)
// ============================================================================

function calcolaReportMensilePerTecnico() {
    const m = parseInt(document.getElementById('select-mese').value);
    const a = parseInt(document.getElementById('select-anno').value);
    
    // Aggiorna titolo
    const titoloElement = document.getElementById('report-mese-titolo');
    if (titoloElement) {
        titoloElement.innerText = `Report ${mesiNomi[m-1]} ${a} - Autocontrollo Tecnico`;
    }
    
    console.log('Calcolo report tecnico per:', m, '/', a);
    
    if (currentEvents.length === 0) {
        console.log('Nessun dato, resettando report');
        resetReportTecnico();
        return;
    }
    
    // ============================================================================
    // 1. RACCOLTA DATI BASE
    // ============================================================================
    
    const CODICI_ASSENZE = [];
    for (let i = 72; i <= 92; i++) {
        CODICI_ASSENZE.push(i.toString());
    }
    
    // Mappa per raggruppare per giorno
    const giorniMap = new Map();
    
    // Contatori globali
    let totOreOrdinarie = 0;
    let totOreStraordinarie = 0;
    let totOreViaggio = 0;
    let totOreAssenza = 0;
    let totGiorniConAssenza = 0;
    
    // Processa TUTTI gli interventi
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
                oreOrdinarie: 0,
                oreStraordinarie: 0,
                oreViaggio: 0,
                oreAssenza: 0,
                isAssenzaGiorno: false,
                isFeriale: false,
                isFestivo: false,
                isPassato: false
            });
        }
        
        const datiGiorno = giorniMap.get(giorno);
        
        // Aggiorna totali
        datiGiorno.oreOrdinarie += oreO;
        datiGiorno.oreStraordinarie += oreS;
        datiGiorno.oreViaggio += oreV;
        
        totOreOrdinarie += oreO;
        totOreStraordinarie += oreS;
        totOreViaggio += oreV;
        
        // Gestione assenze
        if (isAssenza) {
            datiGiorno.isAssenzaGiorno = true;
            datiGiorno.oreAssenza += oreO;
            totOreAssenza += oreO;
        }
    });
    
    // ============================================================================
    // 2. ANALISI GIORNO PER GIORNO (PER TECNICO)
    // ============================================================================
    
    const giorniMese = new Date(a, m, 0).getDate();
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    // Metriche per tecnico
    const metricheTecnico = {
        // Conteggi
        giorniFerialiTotali: 0,
        giorniLavorativiTeorici: 0,
        
        // Situazione
        giorniOk: 0,              // 8 ore esatte, non assenze
        giorniAssenzaTotale: 0,   // 8 ore di assenza
        giorniAssenzaParziale: 0, // <8 ore di assenza
        giorniMenoDi8h: 0,        // <8 ore ordinarie, non assenze
        giorniPiuDi8h: 0,         // >8 ore ordinarie (ERRORE!)
        giorniSenzaDati: 0,       // 0 ore, non assenze
        
        // Ore
        oreOrdinarieLavorate: 0,  // ore ordinarie NON assenza
        oreMancantiTotali: 0,
        oreEccessoTotali: 0,
        
        // Lista problemi
        giorniProblema: []
    };
    
    // Analizza ogni giorno del mese
    for (let giorno = 1; giorno <= giorniMese; giorno++) {
        const dataCorrente = new Date(a, m-1, giorno);
        const giornoSettimana = dataCorrente.getDay();
        const isFeriale = giornoSettimana >= 1 && giornoSettimana <= 5;
        const isFestivoCalendario = isFestivo(dataCorrente);
        const isPassato = dataCorrente <= oggi;
        
        const datiGiorno = giorniMap.get(giorno) || {
            oreOrdinarie: 0,
            oreStraordinarie: 0,
            oreViaggio: 0,
            oreAssenza: 0,
            isAssenzaGiorno: false,
            isFeriale: isFeriale,
            isFestivo: isFestivoCalendario,
            isPassato: isPassato
        };
        
        // Aggiorna flag nel map
        datiGiorno.isFeriale = isFeriale;
        datiGiorno.isFestivo = isFestivoCalendario;
        datiGiorno.isPassato = isPassato;
        
        // Solo per giorni feriali NON festivi
        if (isFeriale && !isFestivoCalendario) {
            metricheTecnico.giorniFerialiTotali++;
            
            // Se è un giorno lavorativo teorico (passato)
            if (isPassato) {
                metricheTecnico.giorniLavorativiTeorici++;
            }
            
            const oreOrd = datiGiorno.oreOrdinarie;
            const isAssenza = datiGiorno.isAssenzaGiorno;
            
            // LOGICA PER TECNICO
            if (isAssenza) {
                // GIORNO DI ASSENZA
                if (oreOrd >= 7.99 && oreOrd <= 8.01) {
                    metricheTecnico.giorniAssenzaTotale++;
                } else {
                    metricheTecnico.giorniAssenzaParziale++;
                }
            } else {
                // GIORNO DI LAVORO
                metricheTecnico.oreOrdinarieLavorate += oreOrd;
                
                if (Math.abs(oreOrd - 8) < 0.01) {
                    // PERFETTO: 8 ore esatte
                    metricheTecnico.giorniOk++;
                } else if (oreOrd === 0) {
                    // PROBLEMA: Nessuna ora inserita
                    metricheTecnico.giorniSenzaDati++;
                    metricheTecnico.oreMancantiTotali += 8;
                    
                    // Aggiungi alla lista problemi
                    if (isPassato) {
                        metricheTecnico.giorniProblema.push({
                            giorno: giorno,
                            problema: "NESSUNA ORA INSERITA",
                            oreMancanti: 8,
                            oreInserite: 0
                        });
                    }
                } else if (oreOrd < 8) {
                    // PROBLEMA: Meno di 8 ore
                    metricheTecnico.giorniMenoDi8h++;
                    const oreMancanti = 8 - oreOrd;
                    metricheTecnico.oreMancantiTotali += oreMancanti;
                    
                    // Aggiungi alla lista problemi
                    if (isPassato) {
                        metricheTecnico.giorniProblema.push({
                            giorno: giorno,
                            problema: `SOLO ${oreOrd.toFixed(2)} ORE`,
                            oreMancanti: oreMancanti,
                            oreInserite: oreOrd
                        });
                    }
                } else if (oreOrd > 8) {
                    // PROBLEMA: Più di 8 ore ordinarie (dovrebbero essere straordinari)
                    metricheTecnico.giorniPiuDi8h++;
                    const oreEccesso = oreOrd - 8;
                    metricheTecnico.oreEccessoTotali += oreEccesso;
                    
                    // Aggiungi alla lista problemi
                    if (isPassato) {
                        metricheTecnico.giorniProblema.push({
                            giorno: giorno,
                            problema: `${oreOrd.toFixed(2)} ORE (ECCESSO)`,
                            oreMancanti: 0,
                            oreInserite: oreOrd,
                            oreEccesso: oreEccesso
                        });
                    }
                }
            }
        }
    }
    
    // ============================================================================
    // 3. CALCOLO METRICHE DERIVATE
    // ============================================================================
    
    // Ore teoriche del mese
    const oreTeoricheMensili = metricheTecnico.giorniLavorativiTeorici * 8;
    
    // Percentuale completamento (SOLO ore ordinarie lavorate, ESCLUSE assenze)
    const percentCompletato = oreTeoricheMensili > 0 ? 
        Math.min(100, (metricheTecnico.oreOrdinarieLavorate / oreTeoricheMensili) * 100) : 0;
    
    // Giorni da verificare (tutti i problemi)
    const giorniDaVerificare = 
        metricheTecnico.giorniMenoDi8h + 
        metricheTecnico.giorniPiuDi8h + 
        metricheTecnico.giorniSenzaDati;
    
    // Media ore ordinarie per giorno lavorato (escluse assenze)
    const giorniLavoratiEffettivi = metricheTecnico.giorniOk + metricheTecnico.giorniMenoDi8h + metricheTecnico.giorniPiuDi8h;
    const mediaOrePerGiorno = giorniLavoratiEffettivi > 0 ? 
        (metricheTecnico.oreOrdinarieLavorate / giorniLavoratiEffettivi).toFixed(2) : "0.00";
    
    // Percentuale giorni con straordinari
    let giorniConStraordinari = 0;
    giorniMap.forEach(dati => {
        if (dati.oreStraordinarie > 0.01) {
            giorniConStraordinari++;
        }
    });
    
    const percentGiorniStra = giorniLavoratiEffettivi > 0 ? 
        ((giorniConStraordinari / giorniLavoratiEffettivi) * 100).toFixed(1) : "0.0";
    
    // ============================================================================
    // 4. AGGIORNAMENTO INTERFACCIA
    // ============================================================================
    
    // A. SITUAZIONE RAPIDA
    document.getElementById('giorni-ok').innerText = metricheTecnico.giorniOk;
    document.getElementById('giorni-da-verificare').innerText = giorniDaVerificare;
    document.getElementById('ore-mancanti-totali').innerText = metricheTecnico.oreMancantiTotali.toFixed(0) + 'h';
    document.getElementById('straordinari-totali').innerText = totOreStraordinarie.toFixed(0) + 'h';
    
    // B. CHECKLIST
    aggiornaChecklist(
        metricheTecnico.oreMancantiTotali === 0,
        giorniDaVerificare === 0,
        metricheTecnico.oreEccessoTotali === 0 || metricheTecnico.giorniPiuDi8h === 0
    );
    
    // C. LISTA GIORNI PROBLEMATICI
    aggiornaListaProblemi(metricheTecnico.giorniProblema, m, a);
    
    // D. METRICHE PRINCIPALI (esistenti)
    document.getElementById('report-ore-ord').innerText = totOreOrdinarie.toFixed(2);
    
    // Calcola giorni con lavoro (escluse assenze)
    let giorniConLavoro = 0;
    giorniMap.forEach(dati => {
        if (dati.oreOrdinarie > 0.01 && !dati.isAssenzaGiorno) {
            giorniConLavoro++;
        }
    });
    document.getElementById('report-ore-ord-giorni').innerText = 
        `${giorniConLavoro} ${giorniConLavoro === 1 ? 'giorno' : 'giorni'}`;
    
    document.getElementById('report-ore-stra').innerText = totOreStraordinarie.toFixed(2);
    
    // Calcola giorni con straordinari
    let giorniConStra = 0;
    giorniMap.forEach(dati => {
        if (dati.oreStraordinarie > 0.01) {
            giorniConStra++;
        }
    });
    document.getElementById('report-ore-stra-giorni').innerText = 
        `${giorniConStra} ${giorniConStra === 1 ? 'giorno' : 'giorni'}`;
    
    document.getElementById('report-ore-viag').innerText = totOreViaggio.toFixed(2);
    
    // Calcola giorni con viaggio
    let giorniConViag = 0;
    giorniMap.forEach(dati => {
        if (dati.oreViaggio > 0.01) {
            giorniConViag++;
        }
    });
    document.getElementById('report-ore-viag-giorni').innerText = 
        `${giorniConViag} ${giorniConViag === 1 ? 'giorno' : 'giorni'}`;
    
    // E. ASSENZE
    document.getElementById('report-assenze').innerText = totOreAssenza.toFixed(2);
    const giorniAssenzaTot = metricheTecnico.giorniAssenzaTotale + metricheTecnico.giorniAssenzaParziale;
    document.getElementById('report-assenze-giorni').innerText = 
        `${giorniAssenzaTot} ${giorniAssenzaTot === 1 ? 'giorno' : 'giorni'}`;
    
    // F. PROGRESS BAR
    const progressBar = document.getElementById('report-progress-bar');
    document.getElementById('report-progress-text').innerText = 
        `${metricheTecnico.oreOrdinarieLavorate.toFixed(0)}/${oreTeoricheMensili} ore`;
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
    
    // G. STATISTICHE AVANZATE
    updateAdvancedStats(
        metricheTecnico.giorniLavorativiTeorici,
        oreTeoricheMensili,
        mediaOrePerGiorno,
        percentGiorniStra,
        totOreAssenza,
        metricheTecnico.giorniAssenzaParziale,
        metricheTecnico.giorniAssenzaTotale,
        giorniLavoratiEffettivi,
        giorniMese,
        metricheTecnico.oreMancantiTotali,
        metricheTecnico.oreEccessoTotali
    );
}

function aggiornaChecklist(check1Ok, check2Ok, check3Ok) {
    // Checkbox 1: Tutti i giorni feriali hanno 8 ore ordinarie
    const check1 = document.getElementById('check1');
    const icon1 = check1.querySelector('.material-symbols-rounded');
    if (check1Ok) {
        check1.classList.add('checked');
        check1.style.borderColor = '#22c55e';
        icon1.style.display = 'block';
    } else {
        check1.classList.remove('checked');
        check1.style.borderColor = '#cbd5e1';
        icon1.style.display = 'none';
    }
    
    // Checkbox 2: Nessun giorno da verificare o correggere
    const check2 = document.getElementById('check2');
    const icon2 = check2.querySelector('.material-symbols-rounded');
    if (check2Ok) {
        check2.classList.add('checked');
        check2.style.borderColor = '#22c55e';
        icon2.style.display = 'block';
    } else {
        check2.classList.remove('checked');
        check2.style.borderColor = '#cbd5e1';
        icon2.style.display = 'none';
    }
    
    // Checkbox 3: Eccessi convertiti in straordinari dove necessario
    const check3 = document.getElementById('check3');
    const icon3 = check3.querySelector('.material-symbols-rounded');
    if (check3Ok) {
        check3.classList.add('checked');
        check3.style.borderColor = '#22c55e';
        icon3.style.display = 'block';
    } else {
        check3.classList.remove('checked');
        check3.style.borderColor = '#cbd5e1';
        icon3.style.display = 'none';
    }
}

function aggiornaListaProblemi(giorniProblema, mese, anno) {
    const countElement = document.getElementById('count-problemi');
    const listaElement = document.getElementById('lista-problemi');
    
    countElement.innerText = giorniProblema.length;
    
    if (giorniProblema.length === 0) {
        listaElement.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #64748b;">
                <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.3;">check_circle</span>
                <div style="margin-top: 10px; font-weight: 600;">Nessun problema rilevato!</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">Tutti i giorni sono in regola.</div>
            </div>
        `;
        return;
    }
    
    listaElement.innerHTML = '';
    
    // Ordina per giorno
    giorniProblema.sort((a, b) => a.giorno - b.giorno);
    
    giorniProblema.forEach(problema => {
        const giornoDiv = document.createElement('div');
        giornoDiv.className = 'giorno-problema';
        
        // Determina il tipo di problema per il colore
        let coloreBordo = '#ef4444'; // Rosso default
        if (problema.problema.includes('ECCESSO')) {
            coloreBordo = '#f59e0b'; // Arancione per eccesso
        } else if (problema.problema.includes('SOLO')) {
            coloreBordo = '#3b82f6'; // Blu per ore insufficienti
        }
        
        giornoDiv.style.borderLeftColor = coloreBordo;
        
        // Formatta la data
        const data = new Date(anno, mese-1, problema.giorno);
        const giornoSettimana = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][data.getDay()];
        const dataFormattata = `${problema.giorno} ${mese}/${anno} (${giornoSettimana})`;
        
        // Testo del problema
        let testoProblema = problema.problema;
        if (problema.oreMancanti > 0) {
            testoProblema += ` - Mancano ${problema.oreMancanti.toFixed(2)} ore`;
        }
        if (problema.oreEccesso > 0) {
            testoProblema += ` - ${problema.oreEccesso.toFixed(2)} ore in eccesso`;
        }
        
        giornoDiv.innerHTML = `
            <div class="data">${dataFormattata}</div>
            <div class="problema">${testoProblema}</div>
        `;
        
        // Click sul giorno problema → mostra il dettaglio
        giornoDiv.onclick = () => {
            // Trova l'elemento del giorno nel calendario e cliccalo
            const giornoElements = document.querySelectorAll('.calendar-day');
            giornoElements.forEach(el => {
                if (el.innerText == problema.giorno && !el.classList.contains('header')) {
                    el.click();
                    // Scrolla al dettaglio
                    setTimeout(() => {
                        document.getElementById('day-detail').scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            });
        };
        
        listaElement.appendChild(giornoDiv);
    });
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

function resetReportTecnico() {
    // Reset valori base
    const baseElements = [
        {id: 'giorni-ok', value: '0'},
        {id: 'giorni-da-verificare', value: '0'},
        {id: 'ore-mancanti-totali', value: '0h'},
        {id: 'straordinari-totali', value: '0h'},
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
    
    // Reset checklist
    aggiornaChecklist(false, false, false);
    
    // Reset lista problemi
    document.getElementById('count-problemi').innerText = '0';
    document.getElementById('lista-problemi').innerHTML = '';
    
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