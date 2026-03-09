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

function getMesiSemestrali(meseNum) {
    const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const m = parseInt(meseNum);
    if (isNaN(m) || m < 1 || m > 12) return "-";
    const meseCorrente = mesi[m - 1];
    let mesePrecedenteIndex = (m - 1) - 6;
    if (mesePrecedenteIndex < 0) mesePrecedenteIndex += 12;
    return `${mesi[mesePrecedenteIndex]} - ${meseCorrente}`;
}

function parseDataItaliana(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    if (s === '-' || s.toLowerCase().includes('n/d') || s === '') return null;
    try {
        const parti = s.split('/');
        if (parti.length !== 3) return null;
        const d = new Date(parseInt(parti[2]), parseInt(parti[1]) - 1, parseInt(parti[0]));
        return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
}

async function caricaScheda() {
    // ✅ AGGIUNTO CONTROLLO CLIENT
    if (!supabaseClient) {
        alert('Errore di connessione al database');
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const idImpianto = params.get('id');
    if (!idImpianto) { window.location.href = 'index.html'; return; }

    const { data: imp, error } = await supabaseClient
        .from('Parco_app')
        .select('*')
        .eq('impianto', idImpianto)
        .single();

    if (error || !imp) { alert("Impianto non trovato"); return; }

    // --- LOGICA VENDITORE (DEBUG) ---
    let visualizzazioneVenditore = imp.venditore || "Vuoto";
    
    if (imp.venditore && imp.venditore !== "-" && imp.venditore !== "") {
        // Puliamo il codice (es. da "901" a 901)
        const codPulito = parseInt(imp.venditore.toString().trim());
        
        if (!isNaN(codPulito)) {
            const { data: vData, error: vError } = await supabaseClient
                .from('venditori')
                .select('Nome')
                .eq('Cod', codPulito)
                .maybeSingle();

            if (vData && vData.Nome) {
                // Se lo trova, mostra: "Nome (Codice)"
                visualizzazioneVenditore = `${vData.Nome} (${codPulito})`;
            } else {
                // Se NON lo trova, mostra solo il codice con un avviso
                visualizzazioneVenditore = `Cod. ${codPulito} (Non trovato in tabella)`;
            }
            
            if (vError) console.error("Errore query venditori:", vError);
        }
    }

    // --- RISOLUZIONE MANUTENTORE E SUPERVISORE ---
    let nomeManutentore = imp.giro || "-"; 
    let nomeSupervisore = "-";
    if (imp.giro && !isNaN(parseInt(imp.giro))) {
        const { data: mData } = await supabaseClient.from('manutentori').select('Manutentore, Supervisore').eq('Giro', parseInt(imp.giro)).maybeSingle();
        if (mData) {
            nomeManutentore = mData.Manutentore || imp.giro;
            if (mData.Supervisore) {
                const { data: sData } = await supabaseClient.from('supervisori').select('Nome').eq('Cod', parseInt(mData.Supervisore)).maybeSingle();
                nomeSupervisore = sData ? sData.Nome : mData.Supervisore;
            }
        }
    }

    // --- RIEMPIMENTO UI ---
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val || '-';
    };

    setVal('det-impianto', imp.impianto);
    setVal('badge-manut', imp.manut);
    setVal('badge-tipo', imp.tipo);
    setVal('det-matricola', imp.matricola);
    setVal('det-tecnico', imp.tecnico);
    setVal('det-giro', nomeManutentore);
    setVal('det-supervisore', nomeSupervisore);
    setVal('det-mese-semestre', getMesiSemestrali(imp.mese_sem));
    setVal('det-periodicita', imp.periodicit);
    setVal('det-cliente', imp.cliente);
    setVal('det-amministratore', imp.amministratore);
    setVal('det-venditore', visualizzazioneVenditore); // Visualizzazione debug
    setVal('det-note', imp.note || 'Nessuna nota presente.');

    const locEl = document.getElementById('det-localita');
    if (locEl) {
        locEl.innerHTML = `${imp.Indirizzo || '-'}<br>${imp.localit || '-'} (${imp.prov || '-'})`;
    }

    // --- GESTIONE SCADENZE ---
    const oggi = new Date();
    const checkScadenza = (id, valoreData, mesiSoglia) => {
        const el = document.getElementById(id);
        if (!el) return;
        const dataParsed = parseDataItaliana(valoreData);
        if (dataParsed) {
            const limite = new Date();
            limite.setMonth(oggi.getMonth() - mesiSoglia);
            el.innerHTML = (dataParsed < limite) ? `⚠️ <span style="color: #ef4444;">${valoreData}</span>` : valoreData;
        } else { el.innerText = valoreData || '-'; }
    };

    checkScadenza('det-ult-sem', imp.ult_sem, 6);
    checkScadenza('det-ult-vp', imp.utl_vp, 24);

   

document.getElementById('btn-nuovo-lavoro').onclick = () => {
    // Prepariamo l'oggetto con i dati puliti per la pagina successiva
    const datiPerLavoro = {
        id: imp.impianto,
        nome: imp.cliente || imp.impianto, // Usa il cliente o il codice se il cliente manca
        indirizzo: `${imp.Indirizzo || ''} ${imp.localit || ''}`.trim()
    };
    
    // Salvataggio nel "magazzino" del browser
    localStorage.setItem('selected_plant', JSON.stringify(datiPerLavoro));
    
    // Navigazione
    window.location.href = `nuovo_lavoro.html?id=${encodeURIComponent(imp.impianto)}`;
};

    document.getElementById('dettaglio-content').style.display = 'block';
}

// Avvio
caricaScheda();
